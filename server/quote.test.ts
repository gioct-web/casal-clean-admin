import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, calculateLineTotal, calculateUnitPrice } from "../shared/quote";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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

  it("monta uma mensagem detalhada e legível para o WhatsApp", () => {
    const message = buildWhatsAppMessage({
      estimateId: 42,
      customerName: "Marina Souza",
      customerPhone: "(11) 99999-9999",
      customerAddress: "Rua das Flores, 100, São Paulo",
      scheduledAt: new Date("2026-08-21T13:30:00.000Z"),
      total: 336,
      items: [
        {
          productName: "Sofá",
          places: "3 lugares",
          itemType: "retrátil",
          fabric: "linho",
          dirtLevel: "medio",
          service: "lavagem",
          quantity: 2,
          unitPrice: 276,
          lineTotal: 552,
        },
      ],
    });

    expect(message).toContain("Orçamento #42");
    expect(message).toContain("Marina Souza");
    expect(message).toContain("Sofá — Lavagem");
    expect(message).toContain("2 un. × R$ 276,00 = R$ 552,00");
    expect(message).toContain("Total geral: R$ 336,00");
  });
});

describe("controle de acesso administrativo", () => {
  it("bloqueia usuário comum antes de acessar a gestão", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("validação da finalização", () => {
  it("rejeita a ausência de itens e os campos obrigatórios do cliente", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.estimates.save({
        customerName: "",
        customerPhone: "12",
        customerAddress: "",
        scheduledAt: "data-inválida",
        items: [],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita telefone inválido mesmo com nome, endereço e data informados", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(
      caller.estimates.save({
        customerName: "Marina Souza",
        customerPhone: "telefone",
        customerAddress: "Rua das Flores, 100",
        scheduledAt: "2026-08-21T13:30:00.000Z",
        items: [{ pricingRuleId: 1, dirtLevel: "leve", service: "lavagem", quantity: 1 }],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita nome ausente com os demais dados válidos", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({
      customerName: "",
      customerPhone: "(11) 98888-7766",
      customerAddress: "Rua das Flores, 100",
      scheduledAt: "2026-08-21T13:30:00.000Z",
      items: [{ pricingRuleId: 1, dirtLevel: "leve", service: "lavagem", quantity: 1 }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita endereço ausente com os demais dados válidos", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({
      customerName: "Marina Souza",
      customerPhone: "(11) 98888-7766",
      customerAddress: "",
      scheduledAt: "2026-08-21T13:30:00.000Z",
      items: [{ pricingRuleId: 1, dirtLevel: "leve", service: "lavagem", quantity: 1 }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita data e horário inválidos com os demais dados válidos", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({
      customerName: "Marina Souza",
      customerPhone: "(11) 98888-7766",
      customerAddress: "Rua das Flores, 100",
      scheduledAt: "amanhã de manhã",
      items: [{ pricingRuleId: 1, dirtLevel: "leve", service: "lavagem", quantity: 1 }],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita orçamento sem itens com todos os dados do cliente válidos", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.estimates.save({
      customerName: "Marina Souza",
      customerPhone: "(11) 98888-7766",
      customerAddress: "Rua das Flores, 100",
      scheduledAt: "2026-08-21T13:30:00.000Z",
      items: [],
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
