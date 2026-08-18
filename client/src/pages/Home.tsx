import { trpc } from "@/lib/trpc";
import { dirtLevelInfo, formatCurrency, calculateLineTotal, calculateUnitPrice, type DirtLevel, type ServiceType } from "@shared/quote";
import {
  Armchair,
  ArrowLeft,
  BedDouble,
  Box,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  History,
  LayoutList,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  Minus,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sofa,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type CatalogRule = {
  id: number;
  productKey: string;
  productName: string;
  places: string;
  itemType: string;
  fabric: string;
  washPrice: number;
  waterproofPrice: number;
  active: boolean;
};

type QuoteDraft = {
  pricingRuleId: number;
  productKey: string;
  productName: string;
  places: string;
  itemType: string;
  fabric: string;
  service: ServiceType;
  dirtLevel: DirtLevel;
  basePrice: number;
};

type CartItem = QuoteDraft & {
  cartId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type CustomerData = {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerState: BrazilianState | "";
  scheduledAt: string;
};

type BrazilianState = "AC" | "AL" | "AP" | "AM" | "BA" | "CE" | "DF" | "ES" | "GO" | "MA" | "MT" | "MS" | "MG" | "PA" | "PB" | "PR" | "PE" | "PI" | "RJ" | "RN" | "RS" | "RO" | "RR" | "SC" | "SP" | "SE" | "TO";

const brazilianStates: BrazilianState[] = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

const products = [
  { key: "sofa", name: "Sofá", icon: Sofa },
  { key: "poltrona", name: "Poltrona", icon: Armchair },
  { key: "cadeira", name: "Cadeira", icon: Armchair },
  { key: "banqueta", name: "Banqueta", icon: PackageOpen },
  { key: "colchao", name: "Colchão", icon: BedDouble },
] as const;

const CUSTOMER_DEFAULT: CustomerData = {
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  customerCity: "",
  customerState: "",
  scheduledAt: "",
};

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function getStorageValue<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function useSessionValue<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => getStorageValue(key, fallback));
  useEffect(() => {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function cleanLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function AppBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "login-brand" : ""}`}>
      <span className="brand-mark" aria-hidden="true"><Box size={21} strokeWidth={1.8} /></span>
      <span>
        <span className="brand-title block">LIMPEZA PREMIUM</span>
        <span className="brand-subtitle block">Orçamento Personalizado</span>
      </span>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div>© 2026 Limpeza Premium — Todos os direitos reservados</div>
      <div className="footer-contacts"><span>(11) 97685-7410</span><span>atendimento.casalclean@gmail.com</span></div>
    </footer>
  );
}

function Header({ user, onLogout, onNavigate }: { user: { name: string | null; role: "admin" | "user" } | null; onLogout: () => void; onNavigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="brand text-left" onClick={() => onNavigate("/")} aria-label="Ir para produtos"><AppBrand /></button>
        <div className="relative flex items-center gap-8px">
          <button className="top-action" onClick={() => setOpen(value => !value)} aria-label="Abrir menu" aria-expanded={open}>
            <Menu size={19} />
          </button>
          {open && (
            <div className="absolute right-0 top-[47px] z-40 w-52 overflow-hidden rounded-[10px] border border-[#454545] bg-[#292929] p-1 shadow-2xl">
              <button className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[12px] text-[#ece8e2] hover:bg-[#343129]" onClick={() => { setOpen(false); onNavigate("/"); }}><LayoutList size={15} color="#D4A843" />Novo orçamento</button>
              <button className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[12px] text-[#ece8e2] hover:bg-[#343129]" onClick={() => { setOpen(false); onNavigate("/historico"); }}><History size={15} color="#D4A843" />Histórico</button>
              {user?.role === "admin" && <button className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[12px] text-[#ece8e2] hover:bg-[#343129]" onClick={() => { setOpen(false); onNavigate("/admin"); }}><Settings2 size={15} color="#D4A843" />Administração</button>}
              <div className="mx-2 my-1 border-t border-[#424242]" />
              <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-[#aaa6a1]"><UserRound size={14} />{user?.name || "Usuário"}</div>
              <button className="flex w-full items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[12px] text-[#f4a2a2] hover:bg-[#3a2929]" onClick={onLogout}><LogOut size={15} />Sair</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (user: { id: number; username: string | null; name: string | null; role: "admin" | "user" }) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: user => onLoggedIn(user),
    onError: error => toast.error(error.message),
  });
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username, password });
  };
  return (
    <main className="login-screen">
      <section className="login-panel">
        <AppBrand compact />
        <form className="login-card form-card" onSubmit={handleSubmit}>
          <h1 className="login-title">Acesso administrativo</h1>
          <p className="login-copy">Entre com suas credenciais autorizadas para elaborar orçamentos.</p>
          <div className="field-group"><label className="label" htmlFor="username">Usuário</label><div className="input-shell"><UserRound className="input-icon" /><input id="username" className="text-input" autoComplete="username" placeholder="Seu usuário" value={username} onChange={event => setUsername(event.target.value)} /></div></div>
          <div className="field-group"><label className="label" htmlFor="password">Senha</label><div className="input-shell"><LockKeyhole className="input-icon" /><input id="password" type="password" className="text-input" autoComplete="current-password" placeholder="Sua senha" value={password} onChange={event => setPassword(event.target.value)} /></div></div>
          <button className="primary-button" disabled={login.isPending} type="submit">{login.isPending ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}Entrar no sistema</button>
        </form>
      </section>
    </main>
  );
}

function ProductCatalog({ rules, onSelect }: { rules: CatalogRule[]; onSelect: (key: string) => void }) {
  return (
    <div className="flow-area">
      <h1 className="section-heading justify-center text-center">Escolha o produto</h1>
      <div className="product-grid">
        {products.map((product, index) => {
          const Icon = product.icon;
          const productRules = rules.filter(rule => rule.productKey === product.key);
          const lowest = productRules.length ? Math.min(...productRules.flatMap(rule => [rule.washPrice, rule.waterproofPrice])) : null;
          return (
            <button key={product.key} className={`product-card ${index === 4 ? "full" : ""}`} onClick={() => onSelect(product.key)} disabled={!productRules.length}>
              <Icon className="product-icon" size={25} strokeWidth={1.9} />
              <span className="product-name">{product.name}</span>
              <span className="product-start">{lowest !== null ? `A partir de ${formatCurrency(lowest)}` : "Indisponível"}</span>
            </button>
          );
        })}
      </div>
      <div className="hours-card"><div className="hours-title">⏰ Horário de Atendimento</div><div>Segunda a Sexta: 08h às 18h</div><div>Sábado: 08h às 14h</div><div>Domingo: Fechado</div></div>
    </div>
  );
}

function ProductSpecifications({ productKey, rules, onBack, onContinue }: { productKey: string; rules: CatalogRule[]; onBack: () => void; onContinue: (draft: QuoteDraft) => void }) {
  const productRules = useMemo(() => rules.filter(rule => rule.productKey === productKey), [productKey, rules]);
  const [places, setPlaces] = useState("");
  const [itemType, setItemType] = useState("");
  const [fabric, setFabric] = useState("");
  const [service, setService] = useState<ServiceType>("lavagem");
  const [dirtLevel, setDirtLevel] = useState<DirtLevel>("leve");

  useEffect(() => {
    const first = productRules[0];
    if (first) { setPlaces(first.places); setItemType(first.itemType); setFabric(first.fabric); setService("lavagem"); setDirtLevel("leve"); }
  }, [productKey, productRules]);

  const placesOptions = unique(productRules.map(rule => rule.places));
  const typeOptions = unique(productRules.filter(rule => rule.places === places).map(rule => rule.itemType));
  const fabricOptions = unique(productRules.filter(rule => rule.places === places && rule.itemType === itemType).map(rule => rule.fabric));
  const selectedRule = productRules.find(rule => rule.places === places && rule.itemType === itemType && rule.fabric === fabric) || productRules[0];

  useEffect(() => { if (typeOptions.length && !typeOptions.includes(itemType)) setItemType(typeOptions[0]); }, [typeOptions.join("|"), itemType]);
  useEffect(() => { if (fabricOptions.length && !fabricOptions.includes(fabric)) setFabric(fabricOptions[0]); }, [fabricOptions.join("|"), fabric]);

  if (!selectedRule) return <div className="empty-state">Não há configurações disponíveis para este produto.</div>;
  const basePrice = service === "lavagem" ? selectedRule.washPrice : selectedRule.waterproofPrice;
  const finalPrice = calculateUnitPrice(basePrice, dirtLevel);
  return (
    <div className="flow-area">
      <div className="flex items-center gap-3"><button className="back-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button><h1 className="section-heading no-after !mb-0">Especificações — {selectedRule.productName}</h1></div>
      <div className="mt-7">
        <div className="field-group"><span className="label">Lugares</span><div className="choice-row">{placesOptions.map(option => <button key={option} className={`choice-button ${places === option ? "active" : ""}`} onClick={() => setPlaces(option)}>{option.replace(" lugares", "").replace(" lugar", "")}<small>{option.includes("1") ? "lugar" : "lugares"}</small></button>)}</div></div>
        <div className="field-group"><span className="label">Tipo</span><div className="choice-row">{typeOptions.map(option => <button key={option} className={`choice-button ${itemType === option ? "active" : ""}`} onClick={() => setItemType(option)}>{cleanLabel(option)}</button>)}</div></div>
        <div className="field-group"><span className="label">Tecido</span><div className="choice-row">{fabricOptions.map(option => <button key={option} className={`choice-button ${fabric === option ? "active" : ""}`} onClick={() => setFabric(option)}>{cleanLabel(option)}</button>)}</div></div>
        <div className="field-group"><span className="label">Nível de sujeira</span>{(["leve", "medio", "pesado"] as DirtLevel[]).map(level => <button key={level} className={`dirt-choice ${dirtLevel === level ? "active" : ""}`} onClick={() => setDirtLevel(level)}><span><span className="choice-title block">{dirtLevelInfo[level].label}</span><span className="choice-subtitle block">{dirtLevelInfo[level].description}</span></span><span className="choice-price">{dirtLevelInfo[level].surcharge ? `+${dirtLevelInfo[level].surcharge}%` : "Sem acréscimo"}</span></button>)}</div>
        <div className="field-group"><span className="label">Serviço</span>{(["lavagem", "impermeabilizacao"] as ServiceType[]).map(option => { const price = option === "lavagem" ? selectedRule.washPrice : selectedRule.waterproofPrice; return <button key={option} className={`service-choice ${service === option ? "active" : ""}`} onClick={() => setService(option)}><span><span className="choice-title block">{option === "lavagem" ? "Lavagem" : "Impermeabilização"}</span><span className="choice-subtitle block">Preço por unidade conforme tabela</span></span><span className="choice-price">{formatCurrency(price)}</span></button>; })}</div>
      </div>
      <div className="price-preview"><div className="price-preview-label">Valor unitário com sujeira</div><div className="price-preview-value">{formatCurrency(finalPrice)}</div><div className="price-preview-caption">{service === "lavagem" ? "Lavagem" : "Impermeabilização"} · {dirtLevelInfo[dirtLevel].label}</div></div>
      <button className="primary-button" onClick={() => onContinue({ pricingRuleId: selectedRule.id, productKey: selectedRule.productKey, productName: selectedRule.productName, places: selectedRule.places, itemType: selectedRule.itemType, fabric: selectedRule.fabric, service, dirtLevel, basePrice })}>Continuar</button>
    </div>
  );
}

function QuantityScreen({ draft, onBack, onAdd }: { draft: QuoteDraft | null; onBack: () => void; onAdd: (item: CartItem) => void }) {
  const [quantity, setQuantity] = useState(1);
  useEffect(() => setQuantity(1), [draft?.pricingRuleId, draft?.service, draft?.dirtLevel]);
  if (!draft) return <div className="flow-area"><div className="empty-state">Selecione um produto para continuar.</div><button className="subtle-button" onClick={onBack}>Escolher produto</button></div>;
  const unitPrice = calculateUnitPrice(draft.basePrice, draft.dirtLevel);
  const lineTotal = calculateLineTotal(draft.basePrice, draft.dirtLevel, quantity);
  return (
    <div className="flow-area">
      <div className="flex items-center gap-3"><button className="back-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button><h1 className="section-heading no-after !mb-0">Quantidade</h1></div>
      <div className="quantity-card summary-card mt-5"><div className="cart-title text-[16px]">{draft.productName}</div><div className="quantity-details">{draft.places} · {cleanLabel(draft.itemType)} · {cleanLabel(draft.fabric)} · {dirtLevelInfo[draft.dirtLevel].label} · {draft.service === "lavagem" ? "Lavagem" : "Impermeabilização"}</div><div className="stepper"><button className="stepper-button" disabled={quantity === 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}><Minus size={18} /></button><strong className="stepper-value">{quantity}</strong><button className="stepper-button" onClick={() => setQuantity(value => value + 1)}><Plus size={18} /></button></div><div className="price-preview !mb-0"><div className="price-preview-label">Valor total</div><div className="price-preview-value">{formatCurrency(lineTotal)}</div><div className="price-preview-caption">{quantity} un. × {formatCurrency(unitPrice)}</div></div></div>
      <button className="primary-button mt-5" onClick={() => onAdd({ ...draft, cartId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, quantity, unitPrice, lineTotal })}>Adicionar ao orçamento</button>
    </div>
  );
}

function QuoteSummary({ items, onBack, onRemove, onFinalize }: { items: CartItem[]; onBack: () => void; onRemove: (cartId: string) => void; onFinalize: () => void }) {
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return (
    <div className="flow-area">
      <div className="flex items-center gap-3"><button className="back-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button><h1 className="section-heading no-after !mb-0">Seu orçamento</h1></div>
      <div className="summary-card mt-5">
        {!items.length ? <div className="empty-state">Ainda não há itens neste orçamento.<br /><button className="mt-4 text-[#D4A843] underline" onClick={onBack}>Escolher produto</button></div> : <>{items.map(item => <article className="cart-item" key={item.cartId}><div><div className="cart-title">{item.productName} <span className="font-normal text-[#aba7a2]">× {item.quantity}</span></div><div className="cart-detail">{item.places} · {cleanLabel(item.itemType)} · {cleanLabel(item.fabric)}<br />{dirtLevelInfo[item.dirtLevel].label} · {item.service === "lavagem" ? "Lavagem" : "Impermeabilização"} · {formatCurrency(item.unitPrice)} por un.</div></div><div><div className="cart-price">{formatCurrency(item.lineTotal)}</div><button className="remove-link" onClick={() => onRemove(item.cartId)}>Remover</button></div></article>)}<div className="quote-total"><span className="quote-total-label">Total geral</span><span className="quote-total-value">{formatCurrency(total)}</span></div></>}
      </div>
      <div className="mt-5 grid gap-3"><button className="subtle-button" onClick={onBack}>Adicionar outro item</button><button className="primary-button" disabled={!items.length} onClick={onFinalize}>Finalizar orçamento</button></div>
    </div>
  );
}

function CustomerScreen({ items, customer, setCustomer, onBack, onComplete }: { items: CartItem[]; customer: CustomerData; setCustomer: (data: CustomerData) => void; onBack: () => void; onComplete: (data: CustomerData, whatsappWindow: Window | null) => void }) {
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});
  const validateCity = trpc.address.validateCity.useMutation();
  const municipalities = trpc.address.municipalities.useQuery({ state: (customer.customerState || "SP") as BrazilianState }, { enabled: Boolean(customer.customerState), staleTime: 1000 * 60 * 60 });
  const update = (key: keyof CustomerData, value: string) => setCustomer({ ...customer, [key]: value });
  const municipalitySuggestions = useMemo(() => {
    const typed = customer.customerCity.trim().toLocaleLowerCase("pt-BR");
    return (municipalities.data || []).filter(city => !typed || city.toLocaleLowerCase("pt-BR").includes(typed)).slice(0, 30);
  }, [customer.customerCity, municipalities.data]);
  const changeState = (value: string) => {
    setCustomer({ ...customer, customerState: value as CustomerData["customerState"], customerCity: "" });
    setErrors(current => ({ ...current, customerState: undefined, customerCity: undefined }));
  };
  const submit = async () => {
    const next: Partial<Record<keyof CustomerData, string>> = {};
    if (customer.customerName.trim().length < 3) next.customerName = "Informe o nome completo.";
    if (!/^[1-9]\d(?:9\d{8}|\d{8})$/.test(customer.customerPhone.replace(/\D/g, ""))) next.customerPhone = "Informe um telefone brasileiro válido com DDD.";
    if (customer.customerAddress.trim().length < 8 || !/\d/.test(customer.customerAddress)) next.customerAddress = "Informe rua, número e bairro.";
    if (customer.customerCity.trim().length < 2) next.customerCity = "Informe a cidade.";
    if (!customer.customerState) next.customerState = "Selecione a UF.";
    if (!customer.scheduledAt || Number.isNaN(new Date(customer.scheduledAt).getTime())) next.scheduledAt = "Selecione uma data e um horário válidos.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const whatsappWindow = window.open("about:blank", "_blank");
    try {
      await validateCity.mutateAsync({ city: customer.customerCity.trim(), state: customer.customerState as BrazilianState });
      onComplete(customer, whatsappWindow);
    } catch (error) {
      whatsappWindow?.close();
      setErrors(current => ({ ...current, customerCity: error instanceof Error ? error.message : "Não foi possível validar a cidade." }));
    }
  };
  return (
    <div className="flow-area">
      <div className="flex items-center gap-3"><button className="back-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button><h1 className="section-heading no-after !mb-0">Seus dados</h1></div>
      <div className="form-card mt-5">
        <div className="field-group"><label className="label" htmlFor="customerName">Seu nome *</label><div className="input-shell"><UserRound className="input-icon" /><input id="customerName" className="text-input" placeholder="Nome completo" value={customer.customerName} onChange={event => update("customerName", event.target.value)} /></div>{errors.customerName && <p className="field-error">{errors.customerName}</p>}</div>
        <div className="field-group"><label className="label" htmlFor="customerPhone">Seu telefone *</label><div className="input-shell"><Phone className="input-icon" /><input id="customerPhone" className="text-input" inputMode="tel" placeholder="(11) 99999-9999" value={customer.customerPhone} onChange={event => update("customerPhone", formatPhoneInput(event.target.value))} /></div>{errors.customerPhone && <p className="field-error">{errors.customerPhone}</p>}</div>
        <div className="field-group"><label className="label" htmlFor="customerAddress">Endereço *</label><textarea id="customerAddress" className="textarea-input" placeholder="Rua, número e bairro" value={customer.customerAddress} onChange={event => update("customerAddress", event.target.value)} />{errors.customerAddress && <p className="field-error">{errors.customerAddress}</p>}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_110px]"><div className="field-group"><label className="label" htmlFor="customerCity">Cidade *</label><input id="customerCity" className="text-input" list="municipality-suggestions" autoComplete="address-level2" disabled={!customer.customerState} placeholder={customer.customerState ? "Digite ou selecione uma cidade" : "Selecione a UF primeiro"} value={customer.customerCity} onChange={event => update("customerCity", event.target.value)} /><datalist id="municipality-suggestions">{municipalitySuggestions.map(city => <option key={city} value={city} />)}</datalist>{customer.customerState && <p className="mt-1 text-[10px] text-[#aaa6a1]">{municipalities.isLoading ? "Carregando cidades..." : "Sugestões oficiais conforme a UF selecionada."}</p>}{errors.customerCity && <p className="field-error">{errors.customerCity}</p>}</div><div className="field-group"><label className="label" htmlFor="customerState">UF *</label><select id="customerState" className="select-input" value={customer.customerState} onChange={event => changeState(event.target.value)}><option value="">UF</option>{brazilianStates.map(state => <option key={state} value={state}>{state}</option>)}</select>{errors.customerState && <p className="field-error">{errors.customerState}</p>}</div></div>
        <div className="field-group"><label className="label" htmlFor="scheduledAt">Data e horário do serviço *</label><div className="input-shell"><CalendarDays className="input-icon" /><input id="scheduledAt" className="text-input" type="datetime-local" value={customer.scheduledAt} onChange={event => update("scheduledAt", event.target.value)} /></div>{errors.scheduledAt && <p className="field-error">{errors.scheduledAt}</p>}</div>
        <div className="contact-card p-4 text-[11px] leading-6 text-[#b5b0ab]"><div className="flex items-center gap-2 text-[#D4A843]"><Phone size={14} />(11) 97685-7410</div><div>atendimento.casalclean@gmail.com</div></div>
      </div>
      <button className="whatsapp-button mt-5" disabled={!items.length || validateCity.isPending} onClick={submit}>{validateCity.isPending ? <Loader2 className="animate-spin" size={19} /> : <Phone size={19} />}Enviar orçamento</button>
    </div>
  );
}

function HistoryScreen({ onBack, onReopen }: { onBack: () => void; onReopen: (id: number) => void }) {
  const [search, setSearch] = useState("");
  const quoteNumber = Number(search.replace(/\D/g, "")) || undefined;
  const data = trpc.estimates.list.useQuery({ quoteNumber });
  return (
    <div>
      <div className="flex items-center gap-3"><button className="back-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button><h1 className="section-heading no-after !mb-0">Histórico de orçamentos</h1></div>
      <div className="history-card mt-5"><div className="history-topbar"><div className="input-shell"><Search className="input-icon" /><input className="text-input" inputMode="numeric" placeholder="Buscar por número do orçamento" value={search} onChange={event => setSearch(event.target.value)} /></div></div>{data.isLoading ? <div className="empty-state"><Loader2 className="mx-auto mb-2 animate-spin" />Carregando histórico...</div> : !data.data?.length ? <div className="empty-state">Nenhum orçamento encontrado.</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>#</th><th>Cliente</th><th>Agendamento</th><th>Total</th><th></th></tr></thead><tbody>{data.data.map(estimate => <tr key={estimate.id}><td>{estimate.quoteNumber}</td><td><strong>{estimate.customerName}</strong><br /><span className="text-[#aaa6a1]">{estimate.customerPhone}</span></td><td>{new Date(estimate.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td><td className="table-money">{formatCurrency(estimate.total)}</td><td><button className="table-button" onClick={() => onReopen(estimate.id)}>Reabrir</button></td></tr>)}</tbody></table></div>}</div>
    </div>
  );
}

type UserRow = { id: number; username: string | null; name: string | null; role: "admin" | "user"; active: boolean; createdAt: Date; lastSignedIn: Date };

function PriceEditor({ initial, onCancel, onSave, loading }: { initial: CatalogRule | null; onCancel: () => void; onSave: (payload: Omit<CatalogRule, "id"> & { id?: number }) => void; loading: boolean }) {
  const [form, setForm] = useState(() => ({
    id: initial?.id,
    productKey: initial?.productKey || "sofa",
    productName: initial?.productName || "Sofá",
    places: initial?.places || "2 lugares",
    itemType: initial?.itemType || "fixo",
    fabric: initial?.fabric || "suede",
    washPrice: initial?.washPrice ?? 0,
    waterproofPrice: initial?.waterproofPrice ?? 0,
    active: initial?.active ?? true,
  }));
  const set = (key: keyof typeof form, value: string | number | boolean) => setForm(current => ({ ...current, [key]: value }));
  return <div className="mt-4 rounded-[10px] border border-[#48433a] bg-[#202020] p-4"><h3 className="font-brand text-[13px] font-extrabold text-[#D4A843]">{initial ? "Editar combinação" : "Adicionar combinação"}</h3><div className="editor-grid"><label><span className="label mt-3">Chave</span><input className="text-input" value={form.productKey} onChange={event => set("productKey", event.target.value)} /></label><label><span className="label mt-3">Produto</span><input className="text-input" value={form.productName} onChange={event => set("productName", event.target.value)} /></label><label><span className="label mt-3">Lugares</span><input className="text-input" value={form.places} onChange={event => set("places", event.target.value)} /></label><label><span className="label mt-3">Tipo</span><input className="text-input" value={form.itemType} onChange={event => set("itemType", event.target.value)} /></label><label><span className="label mt-3">Tecido</span><input className="text-input" value={form.fabric} onChange={event => set("fabric", event.target.value)} /></label><label><span className="label mt-3">Lavagem (R$)</span><input className="text-input" type="number" min="0" step="0.01" value={form.washPrice} onChange={event => set("washPrice", Number(event.target.value))} /></label><label><span className="label mt-3">Impermeabilização (R$)</span><input className="text-input" type="number" min="0" step="0.01" value={form.waterproofPrice} onChange={event => set("waterproofPrice", Number(event.target.value))} /></label><label className="mt-9 flex items-center gap-2 text-[12px] text-[#d7d3ce]"><input type="checkbox" checked={form.active} onChange={event => set("active", event.target.checked)} />Combinação ativa</label></div><div className="editor-actions"><button className="subtle-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={loading} onClick={() => onSave(form)}>Salvar preços</button></div></div>;
}

function UserEditor({ initial, onCancel, onSave, loading }: { initial: UserRow | null; onCancel: () => void; onSave: (payload: { id?: number; username?: string; name: string; role: "admin" | "user"; active: boolean; password?: string }) => void; loading: boolean }) {
  const [form, setForm] = useState({ id: initial?.id, username: initial?.username || "", name: initial?.name || "", role: initial?.role || "user" as "admin" | "user", active: initial?.active ?? true, password: "" });
  return <div className="mt-4 rounded-[10px] border border-[#48433a] bg-[#202020] p-4"><h3 className="font-brand text-[13px] font-extrabold text-[#D4A843]">{initial ? "Editar usuário" : "Cadastrar usuário"}</h3><div className="editor-grid">{!initial && <label><span className="label mt-3">Usuário</span><input className="text-input" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} /></label>}<label><span className="label mt-3">Nome</span><input className="text-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label><span className="label mt-3">Perfil</span><select className="select-input" value={form.role} onChange={event => setForm({ ...form, role: event.target.value as "admin" | "user" })}><option value="user">Usuário</option><option value="admin">Administrador</option></select></label><label><span className="label mt-3">{initial ? "Nova senha (opcional)" : "Senha"}</span><input className="text-input" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} /></label><label className="mt-9 flex items-center gap-2 text-[12px] text-[#d7d3ce]"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} />Conta ativa</label></div><div className="editor-actions"><button className="subtle-button" onClick={onCancel}>Cancelar</button><button className="primary-button" disabled={loading} onClick={() => onSave({ ...form, password: form.password || undefined })}>Salvar usuário</button></div></div>;
}

function AdminScreen({ onBack }: { onBack: () => void }) {
  const utils = trpc.useUtils();
  const prices = trpc.admin.priceList.useQuery();
  const users = trpc.admin.users.useQuery();
  const [editingPrice, setEditingPrice] = useState<CatalogRule | null | undefined>(undefined);
  const [editingUser, setEditingUser] = useState<UserRow | null | undefined>(undefined);
  const savePrice = trpc.admin.savePrice.useMutation({ onSuccess: () => { toast.success("Tabela de preços atualizada."); utils.admin.priceList.invalidate(); utils.catalog.list.invalidate(); setEditingPrice(undefined); }, onError: error => toast.error(error.message) });
  const removePrice = trpc.admin.removePrice.useMutation({ onSuccess: () => { toast.success("Combinação desativada."); utils.admin.priceList.invalidate(); utils.catalog.list.invalidate(); }, onError: error => toast.error(error.message) });
  const saveUser = trpc.admin.saveUser.useMutation({ onSuccess: () => { toast.success("Usuário atualizado."); utils.admin.users.invalidate(); setEditingUser(undefined); }, onError: error => toast.error(error.message) });
  const maxReached = (users.data?.length || 0) >= 3;
  return <div><div className="flex items-center gap-3"><button className="back-button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={18} /></button><h1 className="section-heading no-after !mb-0">Administração</h1></div><div className="admin-grid mt-5"><section className="admin-card"><div className="admin-header"><div><h2 className="admin-title">Usuários autorizados</h2><p className="admin-subtitle">Limite de três contas ativas.</p></div><button className="table-button" disabled={maxReached} onClick={() => setEditingUser(null)}><Plus size={13} className="mr-1 inline" />Novo</button></div>{users.isLoading ? <div className="empty-state">Carregando...</div> : <div className="space-y-2">{users.data?.map(user => <div className="flex items-center justify-between gap-3 rounded-[9px] border border-[#3c3c3c] bg-[#292929] p-3" key={user.id}><div><div className="font-brand text-[12px] font-bold">{user.name}</div><div className="mt-1 text-[10px] text-[#aaa6a1]">{user.username} · <span className="text-[#D4A843]">{user.role === "admin" ? "Admin" : "Usuário"}</span></div></div><button className="table-button" onClick={() => setEditingUser(user)}>Editar</button></div>)}</div>}{editingUser !== undefined && <UserEditor initial={editingUser} onCancel={() => setEditingUser(undefined)} loading={saveUser.isPending} onSave={payload => saveUser.mutate(payload)} />}</section><section className="admin-card"><div className="admin-header"><div><h2 className="admin-title">Tabela de preços</h2><p className="admin-subtitle">Os valores alimentam o cálculo em tempo real.</p></div><button className="table-button" onClick={() => setEditingPrice(null)}><Plus size={13} className="mr-1 inline" />Novo</button></div><div className="text-[11px] leading-5 text-[#aaa6a1]">Cadastre ou edite as combinações de produto, lugares, tipo, tecido e os valores de cada serviço. Combinações desativadas deixam de aparecer no catálogo.</div>{editingPrice !== undefined && <PriceEditor initial={editingPrice} onCancel={() => setEditingPrice(undefined)} loading={savePrice.isPending} onSave={payload => savePrice.mutate(payload)} />}</section><section className="admin-card span-all"><div className="admin-header"><div><h2 className="admin-title">Combinações cadastradas</h2><p className="admin-subtitle">{prices.data?.length || 0} registros na tabela.</p></div></div>{prices.isLoading ? <div className="empty-state">Carregando tabela...</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Produto</th><th>Configuração</th><th>Lavagem</th><th>Impermeabilização</th><th>Status</th><th></th></tr></thead><tbody>{prices.data?.map(rule => <tr key={rule.id}><td><strong>{rule.productName}</strong></td><td>{rule.places} · {rule.itemType} · {rule.fabric}</td><td className="table-money">{formatCurrency(rule.washPrice)}</td><td className="table-money">{formatCurrency(rule.waterproofPrice)}</td><td><span className={`badge ${rule.active ? "" : "muted"}`}>{rule.active ? "Ativo" : "Inativo"}</span></td><td className="whitespace-nowrap"><button className="table-button mr-2" onClick={() => setEditingPrice(rule)}><Pencil size={12} /></button>{rule.active && <button className="table-button !text-[#f58e8e]" onClick={() => removePrice.mutate({ id: rule.id })}><Trash2 size={12} /></button>}</td></tr>)}</tbody></table></div>}</section></div></div>;
}

function RestrictedPage({ onBack }: { onBack: () => void }) {
  return <div className="flow-area"><div className="summary-card text-center"><ShieldCheck className="mx-auto text-[#D4A843]" size={32} /><h1 className="font-brand mt-4 text-[17px] font-extrabold">Acesso restrito</h1><p className="mt-2 text-[12px] text-[#aaa6a1]">Esta área está disponível apenas para administradores.</p><button className="subtle-button mt-5" onClick={onBack}>Voltar ao catálogo</button></div></div>;
}

export default function Home() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const catalog = trpc.catalog.list.useQuery(undefined, { enabled: Boolean(auth.data) });
  const [cart, setCart] = useSessionValue<CartItem[]>("casal-clean-cart", []);
  const [draft, setDraft] = useSessionValue<QuoteDraft | null>("casal-clean-draft", null);
  const [customer, setCustomer] = useSessionValue<CustomerData>("casal-clean-customer", CUSTOMER_DEFAULT);
  const saveEstimate = trpc.estimates.save.useMutation();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { setCart([]); setDraft(null); setCustomer(CUSTOMER_DEFAULT); utils.auth.me.setData(undefined, null); setLocation("/"); toast.success("Sessão encerrada."); } });

  const navigate = (path: string) => setLocation(path);
  const currentProduct = location.startsWith("/produto/") ? location.split("/")[2] : null;
  const returnToCatalog = () => navigate("/");

  const reopen = async (id: number) => {
    try {
      const data = await utils.estimates.get.fetch({ id });
      const reopened: CartItem[] = data.items.map(item => ({
        cartId: `reopen-${item.id}-${Date.now()}`,
        pricingRuleId: item.pricingRuleId || 0,
        productKey: item.productKey,
        productName: item.productName,
        places: item.places,
        itemType: item.itemType,
        fabric: item.fabric,
        service: item.service,
        dirtLevel: item.dirtLevel,
        basePrice: item.unitPrice / (1 + item.dirtSurcharge / 100),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      }));
      setCart(reopened);
      setCustomer({ customerName: data.estimate.customerName, customerPhone: formatPhoneInput(data.estimate.customerPhone), customerAddress: data.estimate.customerAddress, customerCity: data.estimate.customerCity || "", customerState: (data.estimate.customerState as BrazilianState | null) || "", scheduledAt: new Date(data.estimate.scheduledAt).toISOString().slice(0, 16) });
      toast.success("Orçamento reaberto para edição.");
      navigate("/orcamento");
    } catch {
      toast.error("Não foi possível reabrir este orçamento.");
    }
  };

  const finishEstimate = (data: CustomerData, whatsappWindow: Window | null) => {
    saveEstimate.mutate({
      ...data,
      customerState: data.customerState as BrazilianState,
      scheduledAt: new Date(data.scheduledAt).toISOString(),
      expectedTotal: cart.reduce((sum, item) => sum + item.lineTotal, 0),
      items: cart.map(item => ({ pricingRuleId: item.pricingRuleId, dirtLevel: item.dirtLevel, service: item.service, quantity: item.quantity })),
    }, {
      onSuccess: result => {
        const number = "5511976857410";
        const whatsappUrl = `https://wa.me/${number}?text=${encodeURIComponent(result.message)}`;
        if (whatsappWindow && !whatsappWindow.closed) {
          whatsappWindow.location.assign(whatsappUrl);
          try { whatsappWindow.opener = null; } catch { /* O navegador pode impedir a alteração da referência. */ }
        } else {
          window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        }
        toast.success(`Orçamento ${result.quoteNumber} salvo e encaminhado ao WhatsApp.`);
        setCart([]); setDraft(null); setCustomer(CUSTOMER_DEFAULT); setLocation("/historico");
      },
      onError: error => {
        whatsappWindow?.close();
        toast.error(error.message);
      },
    });
  };

  if (auth.isLoading) return <div className="login-screen"><Loader2 className="animate-spin text-[#D4A843]" size={32} /></div>;
  if (!auth.data) return <LoginScreen onLoggedIn={() => { utils.auth.me.invalidate(); }} />;

  const user = auth.data;
  const main = (() => {
    if (catalog.isLoading) return <div className="empty-state"><Loader2 className="mx-auto mb-2 animate-spin" />Carregando catálogo...</div>;
    if (catalog.error) return <div className="flow-area"><div className="error-banner">Não foi possível carregar a tabela de preços. Atualize a página ou tente novamente.</div></div>;
    const rules = catalog.data || [];
    if (currentProduct) return <ProductSpecifications productKey={currentProduct} rules={rules} onBack={returnToCatalog} onContinue={nextDraft => { setDraft(nextDraft); navigate("/quantidade"); }} />;
    if (location === "/quantidade") return <QuantityScreen draft={draft} onBack={() => draft ? navigate(`/produto/${draft.productKey}`) : returnToCatalog()} onAdd={item => { setCart([...cart, item]); setDraft(null); toast.success("Item adicionado ao orçamento."); navigate("/orcamento"); }} />;
    if (location === "/orcamento") return <QuoteSummary items={cart} onBack={returnToCatalog} onRemove={cartId => { setCart(cart.filter(item => item.cartId !== cartId)); toast.success("Item removido."); }} onFinalize={() => navigate("/cliente")} />;
    if (location === "/cliente") return <CustomerScreen items={cart} customer={customer} setCustomer={setCustomer} onBack={() => navigate("/orcamento")} onComplete={finishEstimate} />;
    if (location === "/historico") return <HistoryScreen onBack={returnToCatalog} onReopen={reopen} />;
    if (location === "/admin") return user.role === "admin" ? <AdminScreen onBack={returnToCatalog} /> : <RestrictedPage onBack={returnToCatalog} />;
    return <ProductCatalog rules={rules} onSelect={key => navigate(`/produto/${key}`)} />;
  })();

  return <div className="app-shell"><Header user={user} onLogout={() => logout.mutate()} onNavigate={navigate} /><main className="main-area">{main}</main><Footer /></div>;
}
