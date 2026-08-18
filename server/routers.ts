import { TRPCError } from "@trpc/server";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  estimateItems,
  estimates,
  pricingRules,
  users,
} from "../drizzle/schema";
import {
  buildWhatsAppMessage,
  calculateLineTotal,
  calculateUnitPrice,
  dirtLevels,
  dirtLevelInfo,
  formatEstimateNumber,
  type DirtLevel,
  type ServiceType,
} from "../shared/quote";
import { clearUserSession, createUserSession, sanitizeUser, verifyPassword } from "./auth";
import {
  getAuthorizedUserCount,
  getCredentialUser,
  getDb,
  getEstimateWithItems,
  getPricingRuleById,
  listAuthorizedUsers,
  listEstimates,
  listPricingRules,
} from "./db";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { systemRouter } from "./_core/systemRouter";

const serviceSchema = z.enum(["lavagem", "impermeabilizacao"]);
const dirtSchema = z.enum(dirtLevels);
const passwordSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.");

const catalogRuleSchema = z.object({
  productKey: z.string().min(1).max(48),
  productName: z.string().min(1).max(80),
  places: z.string().min(1).max(32),
  itemType: z.string().min(1).max(64),
  fabric: z.string().min(1).max(64),
  washPrice: z.number().nonnegative(),
  waterproofPrice: z.number().nonnegative(),
  active: z.boolean().default(true),
});

const quoteItemSchema = z.object({
  pricingRuleId: z.number().int().positive(),
  dirtLevel: dirtSchema,
  service: serviceSchema,
  quantity: z.number().int().min(1).max(100),
});

function checkPhone(value: string) {
  return /^[1-9]\d(?:9\d{8}|\d{8})$/.test(value.replace(/\D/g, ""));
}

const brazilianStates = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;
const stateSchema = z.enum(brazilianStates);
const municipalityCache = new Map<string, { normalized: Set<string>; names: string[] }>();

function normalizePlaceName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

async function getBrazilianMunicipalities(state: (typeof brazilianStates)[number]) {
  let municipalities = municipalityCache.get(state);
  if (!municipalities) {
    let response: Response;
    try {
      response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`, { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Não foi possível validar a cidade agora. Tente novamente." });
    }
    if (!response.ok) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Não foi possível validar a cidade agora. Tente novamente." });
    const records = (await response.json()) as Array<{ nome?: string }>;
    const names = records.map(record => (record.nome || "").trim()).filter(Boolean).sort((left, right) => left.localeCompare(right, "pt-BR"));
    municipalities = { names, normalized: new Set(names.map(normalizePlaceName)) };
    municipalityCache.set(state, municipalities);
  }
  return municipalities;
}

async function validateBrazilianCity(city: string, state: (typeof brazilianStates)[number]) {
  const municipalities = await getBrazilianMunicipalities(state);
  return municipalities.normalized.has(normalizePlaceName(city));
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => (ctx.user ? sanitizeUser(ctx.user) : null)),
    login: publicProcedure
      .input(z.object({ username: z.string().trim().min(3), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const user = await getCredentialUser(input.username.toLowerCase());
        if (!user || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
        }
        await createUserSession(ctx.req, ctx.res, user.id);
        return sanitizeUser(user);
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await clearUserSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  catalog: router({
    list: protectedProcedure.query(async () => {
      const rules = await listPricingRules();
      return rules.map(rule => ({ ...rule, washPrice: toNumber(rule.washPrice), waterproofPrice: toNumber(rule.waterproofPrice) }));
    }),
  }),
  estimates: router({
    list: protectedProcedure
      .input(z.object({ quoteNumber: z.number().int().positive().optional(), customerName: z.string().trim().min(1).max(160).optional() }))
      .query(async ({ input }) => {
        const data = await listEstimates({ quoteNumber: input.quoteNumber, customerName: input.customerName });
        return data.map(estimate => ({ ...estimate, quoteNumber: formatEstimateNumber(estimate.id), subtotal: toNumber(estimate.subtotal), total: toNumber(estimate.total) }));
      }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const result = await getEstimateWithItems(input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Orçamento não encontrado." });
      return {
        estimate: { ...result.estimate, quoteNumber: formatEstimateNumber(result.estimate.id), subtotal: toNumber(result.estimate.subtotal), total: toNumber(result.estimate.total) },
        items: result.items.map(item => ({ ...item, unitPrice: toNumber(item.unitPrice), lineTotal: toNumber(item.lineTotal) })),
      };
    }),
    save: protectedProcedure
      .input(
        z.object({
          customerName: z.string().trim().min(3, "Informe o nome completo.").max(160),
          customerPhone: z.string().trim().refine(checkPhone, "Informe um telefone brasileiro válido."),
          customerAddress: z.string().trim().min(8, "Informe rua, número e bairro.").max(1000),
          customerCity: z.string().trim().min(2, "Informe a cidade.").max(160),
          customerState: stateSchema,
          scheduledAt: z.string().datetime(),
          expectedTotal: z.number().finite().nonnegative(),
          items: z.array(quoteItemSchema).min(1, "Adicione ao menos um item ao orçamento."),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db || !ctx.user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

        const calculatedItems = [] as Array<{
          rule: NonNullable<Awaited<ReturnType<typeof getPricingRuleById>>>;
          dirtLevel: DirtLevel;
          service: ServiceType;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }>;

        for (const item of input.items) {
          const rule = await getPricingRuleById(item.pricingRuleId);
          if (!rule || !rule.active) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Um dos preços selecionados não está mais disponível." });
          }
          const basePrice = item.service === "lavagem" ? toNumber(rule.washPrice) : toNumber(rule.waterproofPrice);
          calculatedItems.push({
            rule,
            dirtLevel: item.dirtLevel,
            service: item.service,
            quantity: item.quantity,
            unitPrice: calculateUnitPrice(basePrice, item.dirtLevel),
            lineTotal: calculateLineTotal(basePrice, item.dirtLevel, item.quantity),
          });
        }

        const total = calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0);
        if (Math.abs(total - input.expectedTotal) > 0.001) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O total do orçamento foi alterado. Revise os itens antes de enviar." });
        }
        if (!(await validateBrazilianCity(input.customerCity, input.customerState))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "A cidade informada não pertence à UF selecionada." });
        }
        const scheduledAt = new Date(input.scheduledAt);
        const inserted = await db.insert(estimates).values({
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          customerAddress: input.customerAddress,
          customerCity: input.customerCity,
          customerState: input.customerState,
          scheduledAt,
          subtotal: total.toFixed(2),
          total: total.toFixed(2),
          createdByUserId: ctx.user.id,
        });
        const estimateId = Number(inserted[0].insertId);

        await db.insert(estimateItems).values(
          calculatedItems.map(item => ({
            estimateId,
            pricingRuleId: item.rule.id,
            productKey: item.rule.productKey,
            productName: item.rule.productName,
            places: item.rule.places,
            itemType: item.rule.itemType,
            fabric: item.rule.fabric,
            dirtLevel: item.dirtLevel,
            dirtSurcharge: dirtLevelInfo[item.dirtLevel].surcharge,
            service: item.service,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toFixed(2),
            lineTotal: item.lineTotal.toFixed(2),
          }))
        );

        const persisted = await getEstimateWithItems(estimateId);
        if (!persisted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível concluir o orçamento." });
        const persistedTotal = toNumber(persisted.estimate.total);
        const quoteNumber = formatEstimateNumber(persisted.estimate.id);
        const message = buildWhatsAppMessage({
          quoteNumber,
          customerName: persisted.estimate.customerName,
          customerPhone: persisted.estimate.customerPhone,
          customerAddress: persisted.estimate.customerAddress,
          customerCity: persisted.estimate.customerCity,
          customerState: persisted.estimate.customerState,
          scheduledAt: persisted.estimate.scheduledAt,
          total: persistedTotal,
          items: persisted.items.map(item => ({
            productName: item.productName,
            places: item.places,
            itemType: item.itemType,
            fabric: item.fabric,
            dirtLevel: item.dirtLevel,
            service: item.service,
            quantity: item.quantity,
            unitPrice: toNumber(item.unitPrice),
            lineTotal: toNumber(item.lineTotal),
          })),
        });
        return { estimateId, quoteNumber, total: persistedTotal, message };
      }),
  }),
  address: router({
    municipalities: protectedProcedure.input(z.object({ state: stateSchema })).query(async ({ input }) => {
      const municipalities = await getBrazilianMunicipalities(input.state);
      return municipalities.names;
    }),
    validateCity: protectedProcedure.input(z.object({ city: z.string().trim().min(2).max(160), state: stateSchema })).mutation(async ({ input }) => {
      const valid = await validateBrazilianCity(input.city, input.state);
      if (!valid) throw new TRPCError({ code: "BAD_REQUEST", message: "A cidade informada não pertence à UF selecionada." });
      return { valid: true } as const;
    }),
  }),
  admin: router({
    priceList: adminProcedure.query(async () => {
      const rules = await listPricingRules(true);
      return rules.map(rule => ({ ...rule, washPrice: toNumber(rule.washPrice), waterproofPrice: toNumber(rule.waterproofPrice) }));
    }),
    savePrice: adminProcedure
      .input(catalogRuleSchema.extend({ id: z.number().int().positive().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        const { id, ...priceFields } = input;
        const values = { ...priceFields, washPrice: input.washPrice.toFixed(2), waterproofPrice: input.waterproofPrice.toFixed(2) };
        if (id) {
          await db.update(pricingRules).set(values).where(eq(pricingRules.id, id));
          return { id };
        }
        const inserted = await db.insert(pricingRules).values(values);
        return { id: Number(inserted[0].insertId) };
      }),
    removePrice: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      await db.update(pricingRules).set({ active: false }).where(eq(pricingRules.id, input.id));
      return { success: true } as const;
    }),
    users: adminProcedure.query(async () => listAuthorizedUsers()),
    saveUser: adminProcedure
      .input(
        z.object({
          id: z.number().int().positive().optional(),
          username: z.string().trim().min(3).max(64).optional(),
          name: z.string().trim().min(2).max(160),
          role: z.enum(["admin", "user"]),
          active: z.boolean(),
          password: passwordSchema.optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        if (!input.id) {
          if (!input.username || !input.password) throw new TRPCError({ code: "BAD_REQUEST", message: "Usuário e senha são obrigatórios." });
          if ((await getAuthorizedUserCount()) >= 3) throw new TRPCError({ code: "BAD_REQUEST", message: "O limite de três usuários autorizados já foi atingido." });
          const { randomBytes, scryptSync } = await import("node:crypto");
          const salt = randomBytes(16).toString("hex");
          const passwordHash = `${salt}:${scryptSync(input.password, salt, 64).toString("hex")}`;
          const inserted = await db.insert(users).values({
            username: input.username.toLowerCase(),
            passwordHash,
            name: input.name,
            loginMethod: "password",
            role: input.role,
            active: input.active,
          });
          return { id: Number(inserted[0].insertId) };
        }

        const [current] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
        if (!current || current.loginMethod !== "password") throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
        if (current.id === ctx.user.id && !input.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode desativar a própria conta." });
        if (current.id === ctx.user.id && current.role === "admin" && input.role !== "admin") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode remover o próprio acesso administrativo." });
        }
        const updates: Record<string, unknown> = { name: input.name, role: input.role, active: input.active };
        if (input.password) {
          const { randomBytes, scryptSync } = await import("node:crypto");
          const salt = randomBytes(16).toString("hex");
          updates.passwordHash = `${salt}:${scryptSync(input.password, salt, 64).toString("hex")}`;
        }
        await db.update(users).set(updates).where(eq(users.id, input.id));
        return { id: input.id };
      }),
  }),
});

export type AppRouter = typeof appRouter;
