import {
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }),
    username: varchar("username", { length: 64 }),
    passwordHash: varchar("passwordHash", { length: 255 }),
    name: varchar("name", { length: 160 }),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("users_open_id_unique").on(table.openId),
    uniqueIndex("users_username_unique").on(table.username),
  ]
);

export const pricingRules = mysqlTable(
  "pricing_rules",
  {
    id: int("id").autoincrement().primaryKey(),
    productKey: varchar("productKey", { length: 48 }).notNull(),
    productName: varchar("productName", { length: 80 }).notNull(),
    places: varchar("places", { length: 32 }).notNull(),
    itemType: varchar("itemType", { length: 64 }).notNull(),
    fabric: varchar("fabric", { length: 64 }).notNull(),
    washPrice: decimal("washPrice", { precision: 10, scale: 2 }).notNull(),
    waterproofPrice: decimal("waterproofPrice", { precision: 10, scale: 2 }).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("pricing_rules_variant_unique").on(
      table.productKey,
      table.places,
      table.itemType,
      table.fabric
    ),
    index("pricing_rules_product_idx").on(table.productKey),
  ]
);

export const estimates = mysqlTable(
  "estimates",
  {
    id: int("id").autoincrement().primaryKey(),
    customerName: varchar("customerName", { length: 160 }).notNull(),
    customerPhone: varchar("customerPhone", { length: 32 }).notNull(),
    customerAddress: text("customerAddress").notNull(),
    scheduledAt: timestamp("scheduledAt").notNull(),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    total: decimal("total", { precision: 12, scale: 2 }).notNull(),
    status: mysqlEnum("status", ["draft", "sent"]).default("sent").notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("estimates_customer_idx").on(table.customerName),
    index("estimates_schedule_idx").on(table.scheduledAt),
    index("estimates_creator_idx").on(table.createdByUserId),
  ]
);

export const estimateItems = mysqlTable(
  "estimate_items",
  {
    id: int("id").autoincrement().primaryKey(),
    estimateId: int("estimateId").notNull(),
    pricingRuleId: int("pricingRuleId"),
    productKey: varchar("productKey", { length: 48 }).notNull(),
    productName: varchar("productName", { length: 80 }).notNull(),
    places: varchar("places", { length: 32 }).notNull(),
    itemType: varchar("itemType", { length: 64 }).notNull(),
    fabric: varchar("fabric", { length: 64 }).notNull(),
    dirtLevel: mysqlEnum("dirtLevel", ["leve", "medio", "pesado"]).notNull(),
    dirtSurcharge: int("dirtSurcharge").notNull(),
    service: mysqlEnum("service", ["lavagem", "impermeabilizacao"]).notNull(),
    quantity: int("quantity").notNull(),
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
    lineTotal: decimal("lineTotal", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("estimate_items_estimate_idx").on(table.estimateId)]
);

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    userId: int("userId").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("auth_sessions_token_unique").on(table.tokenHash),
    index("auth_sessions_user_idx").on(table.userId),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PricingRule = typeof pricingRules.$inferSelect;
export type Estimate = typeof estimates.$inferSelect;
export type EstimateItem = typeof estimateItems.$inferSelect;
