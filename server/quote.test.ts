import { buildWhatsAppMessage, calculateLineTotal, calculateUnitPrice, formatEstimateNumber } from "../shared/quote";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { describe, expect, it } from "vitest";

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: null,
      username: "teste",
      passwordHash: null,
      name: "Usuário de teste",
      email: null,
      loginMethod: "password",
      role,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("regras de orçamento", () => {
  it("calcula os acréscimos de sujeira e a multiplicação pela quantidade", () => {
    expect(calculateUnitPrice(100, "leve")).toBe(100);
    expect(calculateUnitPrice(100, "medio")).toBe(120);
    expect(calculateUnitPrice(100, "pesado")).toBe(140);
    expect(calculateLineTotal(100, "pesado", 3)).toBe(420);
  });

  it("formata o número pesquisável e monta a mensagem detalhada do WhatsApp", () => {
    const message = buildWhatsAppMessage({
      quoteNumber: "#000042",
      customerName: "Marina Souza",
      customerPhone: "(11) 99999-9999",
      customerAddress: "Rua das Flores, 100, Centro",
      customerCity: "São Paulo",
      customerState: "SP",
      scheduledAt: new Date("2026-08-21T13:30:00.000Z"),
      total: 552,
      items: [{
        productName: "Sofá",
        places: "3 lugares",
        itemType: "retrátil",
        fabric: "linho",
        dirtLevel: "medio",
        service: "lavagem",
        quantity: 2,
        unitPrice: 276,
        lineTotal: 552,
      }],
    });

    expect(formatEstimateNumber(42)).toBe("#000042");
    expect(message).toContain("Orçamento #000042");
    expect(message).toContain("Marina Souza");
    expect(message).toContain("Rua das Flores, 100, Centro — São Paulo — SP");
    expect(message).toContain("Sofá — Lavagem");
    expect(message).toContain("2 un. × R$ 276,00 = R$ 552,00");
    expect(message).toContain("Total geral: R$ 552,00");
  });
});

describe("controle de acesso administrativo", () => {
  it("bloqueia usuário comum antes de acessar a gestão", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("validação da finalização", () => {
  const validBase = {
    customerName: "Marina Souza",
    customerPhone: "(11) 98888-7766",
    customerAddress: "Rua das Flores, 100, Centro",
    customerCity: "São Paulo",
    customerState: "SP" as const,
    scheduledAt: "2026-08-21T13:30:00.000Z",
    expectedTotal: 100,
    items: [{ pricingRuleId: 1, dirtLevel: "leve" as const, service: "lavagem" as const, quantity: 1 }],
  };

  it("rejeita telefone sem DDD brasileiro válido", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({ ...validBase, customerPhone: "11 1234-5678" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita nome ausente", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({ ...validBase, customerName: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita endereço sem número e bairro", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({ ...validBase, customerAddress: "Rua das Flores" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita cidade ou UF ausentes", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({ ...validBase, customerCity: "", customerState: "SP" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita data e horário inválidos", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({ ...validBase, scheduledAt: "amanhã de manhã" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita orçamento sem itens", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({ ...validBase, items: [] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
