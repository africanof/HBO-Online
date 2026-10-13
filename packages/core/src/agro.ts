import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";

/**
 * Agricultura e campo (igual no Site e na APP): anúncios de produtos do campo, gado e insumos, com
 * unidade de venda (saco, kg, tonelada…), quantidade disponível e «disponível a partir de» (colheitas futuras).
 * Fica nos atributos do anúncio: { agro: true, agroCategory, unit, quantity, availableFrom }.
 */
export type AgroCategory = "cereais" | "tuberculos" | "horticolas" | "frutas" | "leguminosas" | "gado" | "aves" | "insumos" | "maquinas" | "servicos";
export type AgroUnit = "kg" | "saco25" | "saco50" | "tonelada" | "caixa" | "cesto" | "unidade" | "cabeca" | "litro" | "molho";
export type AgroInfo = { category: AgroCategory; unit: AgroUnit; quantity: number | null; availableFrom: string | null };

export const AGRO_CATEGORIES: { value: AgroCategory; label: string; icon: string }[] = [
  { value: "cereais", label: "Cereais (milho, massambala…)", icon: "🌽" },
  { value: "tuberculos", label: "Tubérculos (batata, mandioca, batata-doce)", icon: "🥔" },
  { value: "horticolas", label: "Hortícolas (tomate, cebola, couve…)", icon: "🥬" },
  { value: "frutas", label: "Frutas", icon: "🍌" },
  { value: "leguminosas", label: "Feijão e leguminosas", icon: "🫘" },
  { value: "gado", label: "Gado (bois, cabras, porcos)", icon: "🐄" },
  { value: "aves", label: "Aves e ovos", icon: "🐔" },
  { value: "insumos", label: "Sementes, adubos e rações", icon: "🌱" },
  { value: "maquinas", label: "Máquinas e ferramentas", icon: "🚜" },
  { value: "servicos", label: "Serviços agrícolas (lavrar, colher, transporte)", icon: "🧑‍🌾" }
];
export const AGRO_UNITS: { value: AgroUnit; label: string; short: string; plural: string }[] = [
  { value: "kg", label: "Quilo (kg)", short: "kg", plural: "kg" },
  { value: "saco25", label: "Saco de 25 kg", short: "saco 25 kg", plural: "sacos de 25 kg" },
  { value: "saco50", label: "Saco de 50 kg", short: "saco 50 kg", plural: "sacos de 50 kg" },
  { value: "tonelada", label: "Tonelada", short: "tonelada", plural: "toneladas" },
  { value: "caixa", label: "Caixa", short: "caixa", plural: "caixas" },
  { value: "cesto", label: "Cesto / bacia", short: "cesto", plural: "cestos" },
  { value: "molho", label: "Molho", short: "molho", plural: "molhos" },
  { value: "unidade", label: "Unidade", short: "unidade", plural: "unidades" },
  { value: "cabeca", label: "Cabeça (animal)", short: "cabeça", plural: "cabeças" },
  { value: "litro", label: "Litro", short: "litro", plural: "litros" }
];
const CAT = Object.fromEntries(AGRO_CATEGORIES.map(c => [c.value, c])) as Record<AgroCategory, (typeof AGRO_CATEGORIES)[number]>;
const UNIT = Object.fromEntries(AGRO_UNITS.map(u => [u.value, u])) as Record<AgroUnit, (typeof AGRO_UNITS)[number]>;
export const agroCategoryInfo = (c: string | null | undefined) => (c && CAT[c as AgroCategory]) || null;
export const agroUnitInfo = (u: string | null | undefined) => (u && UNIT[u as AgroUnit]) || null;

/** Lê os dados agrícolas de um anúncio (ou null se não for do campo). */
export function readAgro(attributes: unknown): AgroInfo | null {
  const a = (attributes ?? {}) as Record<string, unknown>;
  if (a.agro !== true || !agroCategoryInfo(String(a.agroCategory ?? ""))) return null;
  const q = Number(a.quantity);
  return {
    category: a.agroCategory as AgroCategory,
    unit: (agroUnitInfo(String(a.unit ?? "")) ? a.unit : "unidade") as AgroUnit,
    quantity: Number.isFinite(q) && q > 0 ? q : null,
    availableFrom: typeof a.availableFrom === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.availableFrom) ? a.availableFrom : null
  };
}
export type AgroInput = { category: string; unit: string; quantity?: string | number | null; availableFrom?: string | null };
export function validateAgro(input: AgroInput, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!agroCategoryInfo(input.category)) return "Escolha o tipo de produto do campo.";
  if (!agroUnitInfo(input.unit)) return "Escolha a unidade de venda (kg, saco, cabeça…).";
  if (input.quantity !== null && input.quantity !== undefined && String(input.quantity).trim() !== "") {
    const q = Number(String(input.quantity).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(q) || q <= 0 || q > 1e9) return "Indique uma quantidade válida.";
  }
  if (input.availableFrom) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.availableFrom)) return "Indique a data em que fica disponível.";
    if (input.availableFrom < today) return "A data «disponível a partir de» não pode ser no passado.";
  }
  return null;
}
/** Atributos a guardar no anúncio. */
export function agroAttributes(input: AgroInput): Record<string, unknown> {
  const q = input.quantity === null || input.quantity === undefined || String(input.quantity).trim() === "" ? null : Number(String(input.quantity).replace(/\s/g, "").replace(",", "."));
  return { agro: true, agroCategory: input.category, unit: input.unit, quantity: q, availableFrom: input.availableFrom || null };
}
function formatDay(iso: string): string { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; }
function formatQty(n: number): string { return (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",")).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
/** «12 000 Kz / saco 50 kg». */
export function agroPriceLabel(price: number | string | null | undefined, info: AgroInfo | null, currency = "AOA"): string | null {
  if (!info || price === null || price === undefined || price === "") return null;
  return `${formatPrice(price, currency)} / ${UNIT[info.unit].short}`;
}
/** «🌽 Cereais · 200 sacos de 50 kg · Disponível a partir de 01/11/2026». */
export function agroSummary(info: AgroInfo, today = new Date().toISOString().slice(0, 10)): string {
  const cat = CAT[info.category];
  const parts = [`${cat.icon} ${cat.label.replace(/ \(.*\)$/, "")}`];
  if (info.quantity) parts.push(`${formatQty(info.quantity)} ${info.quantity === 1 ? UNIT[info.unit].short + " disponível" : UNIT[info.unit].plural + " disponíveis"}`);
  if (info.availableFrom && info.availableFrom > today) parts.push(`Disponível a partir de ${formatDay(info.availableFrom)}`);
  else parts.push("Disponível já");
  return parts.join(" · ");
}
/** Anúncios do campo publicados (destaques primeiro). */
export async function listAgroListings(client: SupabaseClient, f: { category?: AgroCategory | ""; query?: string; limit?: number } = {}) {
  let q = client.from("classified_listings").select("id,ref_no,owner_id,listing_type,purpose,title,price,currency,attributes,media,status,featured,featured_until,created_at,video_url,sale_mode")
    .eq("status", "published").contains("attributes", f.category ? { agro: true, agroCategory: f.category } : { agro: true });
  if (f.query?.trim()) q = q.ilike("title", `%${f.query.trim().replace(/[%_]/g, "")}%`);
  const r = await q.order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(f.limit ?? 60);
  return { data: (r.data ?? []) as any[], error: r.error };
}
