// Campos próprios de viaturas e imóveis (iguais no Site e na APP).
// As chaves são as que a base de dados valida ao publicar (validate_classified_attributes):
// viatura → brand (obrigatória), year, mileage; imóvel → area_m2, bedrooms, bathrooms.
// Os textos vêm dos dicionários das apps: «attr.<chave>» e «attr.<chave>.<valor>».

export type DetailField = { key: string; kind: "text" | "int" | "number" | "select"; required?: boolean; options?: readonly string[]; min?: number; max?: number; unit?: string };

const THIS_YEAR = new Date().getFullYear();
export const VEHICLE_FIELDS: readonly DetailField[] = [
  { key: "brand", kind: "text", required: true },
  { key: "model", kind: "text" },
  { key: "year", kind: "int", min: 1900, max: THIS_YEAR + 1 },
  { key: "mileage", kind: "int", min: 0, max: 5_000_000, unit: "km" },
  { key: "fuel", kind: "select", options: ["gasolina", "gasoleo", "hibrido", "eletrico", "gas"] },
  { key: "transmission", kind: "select", options: ["manual", "automatica"] }
];
export const REAL_ESTATE_FIELDS: readonly DetailField[] = [
  { key: "propertyType", kind: "select", options: ["casa", "apartamento", "vivenda", "terreno", "loja", "escritorio", "armazem", "quarto"] },
  { key: "area_m2", kind: "number", min: 1, max: 10_000_000, unit: "m2" },
  { key: "bedrooms", kind: "int", min: 0, max: 50 },
  { key: "bathrooms", kind: "int", min: 0, max: 50 }
];
const ALL_KEYS = [...VEHICLE_FIELDS, ...REAL_ESTATE_FIELDS].map(f => f.key);

export function detailFieldsFor(listingType: string | null | undefined): readonly DetailField[] {
  return listingType === "vehicle" ? VEHICLE_FIELDS : listingType === "real_estate" ? REAL_ESTATE_FIELDS : [];
}
/** Valores guardados no anúncio → textos para o formulário. */
export function detailValuesFrom(attributes: unknown): Record<string, string> {
  const a = (attributes && typeof attributes === "object" ? attributes : {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of ALL_KEYS) if (a[k] != null && a[k] !== "") out[k] = String(a[k]);
  return out;
}
/** Tira dos atributos guardados os campos de viatura/imóvel (para os substituir pelos do formulário). */
export function withoutDetailKeys(attributes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(attributes).filter(([k]) => !ALL_KEYS.includes(k)));
}
const toNumber = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."));

/** Chave do texto de erro («attr.err.brand», «attr.err.year»…) ou null se está tudo bem. */
export function validateDetails(listingType: string | null | undefined, values: Record<string, string>): string | null {
  for (const f of detailFieldsFor(listingType)) {
    const v = (values[f.key] ?? "").trim();
    if (!v) { if (f.required) return "attr.err." + f.key; continue; }
    if (f.kind === "text" && v.length > 60) return "attr.err." + f.key;
    if (f.kind === "select" && !f.options!.includes(v)) return "attr.err." + f.key;
    if (f.kind === "int" || f.kind === "number") {
      const n = toNumber(v);
      if (!Number.isFinite(n) || (f.kind === "int" && !Number.isInteger(n)) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) return "attr.err." + f.key;
    }
  }
  return null;
}
/** Textos do formulário → atributos a gravar (números como números; vazios saem). */
export function buildDetailAttributes(listingType: string | null | undefined, values: Record<string, string>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of detailFieldsFor(listingType)) {
    const v = (values[f.key] ?? "").trim();
    if (!v) continue;
    out[f.key] = f.kind === "int" || f.kind === "number" ? toNumber(v) : v;
  }
  return out;
}
/** Linhas «chave → valor» para mostrar no anúncio; select devolve o valor (traduzir com «attr.<chave>.<valor>»). */
export function detailFacts(listingType: string | null | undefined, attributes: unknown): { key: string; value: string; option: boolean; unit?: string }[] {
  const vals = detailValuesFrom(attributes);
  return detailFieldsFor(listingType).filter(f => vals[f.key]).map(f => ({ key: f.key, value: vals[f.key], option: f.kind === "select", unit: f.unit }));
}
