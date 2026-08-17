import { and, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  authSessions,
  estimateItems,
  estimates,
  pricingRules,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) return;
  const db = await getDb();
  if (!db) return;

  await db
    .insert(users)
    .values({
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      lastSignedIn: user.lastSignedIn ?? new Date(),
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
    })
    .onDuplicateKeyUpdate({
      set: {
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        lastSignedIn: user.lastSignedIn ?? new Date(),
      },
    });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getCredentialUser(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), eq(users.active, true)))
    .limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function listAuthorizedUsers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    })
    .from(users)
    .where(eq(users.loginMethod, "password"))
    .orderBy(desc(users.createdAt));
}

export async function getAuthorizedUserCount() {
  const list = await listAuthorizedUsers();
  return list.length;
}

export async function listPricingRules(includeInactive = false) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(pricingRules);
  const rows = includeInactive
    ? await query.orderBy(pricingRules.productName, pricingRules.places, pricingRules.itemType, pricingRules.fabric)
    : await query
        .where(eq(pricingRules.active, true))
        .orderBy(pricingRules.productName, pricingRules.places, pricingRules.itemType, pricingRules.fabric);
  return rows;
}

export async function getPricingRuleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(pricingRules).where(eq(pricingRules.id, id)).limit(1);
  return rows[0];
}

export async function getSessionUserByTokenHash(tokenHash: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({ user: users, expiresAt: authSessions.expiresAt })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash), eq(users.active, true)))
    .limit(1);
  return rows[0];
}

export async function createSessionRecord(tokenHash: string, userId: number, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  await db.insert(authSessions).values({ tokenHash, userId, expiresAt });
}

export async function removeSessionRecord(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function touchUserSignIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function listEstimates(filters: { search?: string; from?: Date; to?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.search) {
    conditions.push(
      or(
        like(estimates.customerName, `%${filters.search}%`),
        like(estimates.customerPhone, `%${filters.search}%`)
      )
    );
  }
  if (filters.from) conditions.push(gte(estimates.scheduledAt, filters.from));
  if (filters.to) conditions.push(lte(estimates.scheduledAt, filters.to));
  return db
    .select()
    .from(estimates)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(estimates.createdAt));
}

export async function getEstimateWithItems(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
  if (!estimate) return undefined;
  const items = await db
    .select()
    .from(estimateItems)
    .where(eq(estimateItems.estimateId, id))
    .orderBy(estimateItems.id);
  return { estimate, items };
}
