export const dirtLevels = ["leve", "medio", "pesado"] as const;
export type DirtLevel = (typeof dirtLevels)[number];

export const dirtLevelInfo: Record<DirtLevel, { label: string; surcharge: number; description: string }> = {
  leve: { label: "Leve", surcharge: 0, description: "Uso normal, sem manchas visíveis" },
  medio: { label: "Médio", surcharge: 20, description: "Manchas moderadas (+20%)" },
  pesado: { label: "Pesado", surcharge: 40, description: "Manchas intensas (+40%)" },
};

export const serviceInfo = {
  lavagem: { label: "Lavagem" },
  impermeabilizacao: { label: "Impermeabilização" },
  lavagem_impermeabilizacao: { label: "Lavagem + Impermeabilização" },
} as const;

export type ServiceType = keyof typeof serviceInfo;

export function calculateServiceBasePrice(washPrice: number, waterproofPrice: number, service: ServiceType) {
  if (service === "lavagem") return washPrice;
  if (service === "impermeabilizacao") return waterproofPrice;
  return washPrice + waterproofPrice;
}

export function calculateUnitPrice(basePrice: number, dirtLevel: DirtLevel) {
  const multiplier = 1 + dirtLevelInfo[dirtLevel].surcharge / 100;
  return Math.round(basePrice * multiplier * 100) / 100;
}

export function calculateLineTotal(basePrice: number, dirtLevel: DirtLevel, quantity: number) {
  return Math.round(calculateUnitPrice(basePrice, dirtLevel) * quantity * 100) / 100;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatEstimateNumber(estimateId: number) {
  return `#${String(estimateId).padStart(6, "0")}`;
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export type WhatsAppEstimateItem = {
  productName: string;
  places: string;
  itemType: string;
  fabric: string;
  dirtLevel: DirtLevel;
  service: ServiceType;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export function buildWhatsAppMessage(data: {
  quoteNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string | null;
  customerState: string | null;
  scheduledAt: Date;
  items: WhatsAppEstimateItem[];
  total: number;
}) {
  const schedule = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data.scheduledAt);
  const lines = data.items.map((item, index) => {
    const details = [item.places, item.itemType, item.fabric, dirtLevelInfo[item.dirtLevel].label].join(" · ");
    return [
      `${index + 1}. ${item.productName} — ${serviceInfo[item.service].label}`,
      `   ${details}`,
      `   ${item.quantity} un. × ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.lineTotal)}`,
    ].join("\n");
  });

  return [
    "*CASAL CLEAN — ORÇAMENTO*",
    `Orçamento ${data.quoteNumber}`,
    "",
    "*Cliente*",
    `Nome: ${data.customerName}`,
    `Telefone: ${data.customerPhone}`,
    `Endereço: ${[data.customerAddress, data.customerCity, data.customerState].filter(Boolean).join(" — ")}`,
    `Agendamento: ${schedule}`,
    "",
    "*Itens*",
    ...lines,
    "",
    `*Total geral: ${formatCurrency(data.total)}*`,
  ].join("\n");
}
