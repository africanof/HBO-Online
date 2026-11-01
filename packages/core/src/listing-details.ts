// Campos próprios de viaturas, imóveis e de cada categoria de anúncio (iguais no Site e na APP).
// As chaves são as que a base de dados valida ao publicar (validate_classified_attributes):
// viatura → brand (obrigatória), year, mileage; imóvel → area_m2, bedrooms, bathrooms.
// Os textos vêm dos dicionários das apps: «attr.<chave>» e «attr.<chave>.<valor>».

export type DetailField = { key: string; kind: "text" | "int" | "number" | "select"; required?: boolean; options?: readonly string[]; min?: number; max?: number; unit?: string };

const THIS_YEAR = new Date().getFullYear();
export const VEHICLE_FIELDS: readonly DetailField[] = [
  { key: "vehicleType", kind: "select", options: ["ligeiro", "suv", "pickup", "carrinha", "camiao", "mota", "outro"] },
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
/**
 * Campos de cada categoria de anúncio (pelo slug). O primeiro, quando é «…Type», é a subcategoria
 * (ex.: Informática → Portátil, Computador, Impressora…). Os valores das listas filtram a pesquisa.
 */
export const CATEGORY_FIELDS: Readonly<Record<string, readonly DetailField[]>> = {
  "telemoveis-e-tablets": [{ key: "phoneType", kind: "select", options: ["telemovel", "tablet", "smartwatch", "acessorio"] }, { key: "brand", kind: "text" }, { key: "model", kind: "text" }, { key: "storage", kind: "select", options: ["16", "32", "64", "128", "256", "512", "1024"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "informatica": [{ key: "computerType", kind: "select", options: ["portatil", "computador", "monitor", "impressora", "componentes", "acessorios"] }, { key: "brand", kind: "text" }, { key: "model", kind: "text" }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "eletrodomesticos": [{ key: "applianceType", kind: "select", options: ["frigorifico", "arca", "fogao", "maquina_lavar", "micro_ondas", "ar_condicionado", "ventoinha", "pequenos"] }, { key: "brand", kind: "text" }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "tv-som-e-imagem": [{ key: "avType", kind: "select", options: ["televisao", "colunas", "auscultadores", "camara", "consola"] }, { key: "brand", kind: "text" }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "moveis-e-decoracao": [{ key: "furnitureType", kind: "select", options: ["sala", "quarto", "cozinha", "escritorio", "colchoes", "decoracao"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "casa-e-jardim": [{ key: "homeType", kind: "select", options: ["utensilios", "iluminacao", "jardim", "limpeza", "outros"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "moda-e-acessorios": [{ key: "fashionType", kind: "select", options: ["roupa", "calcado", "malas", "relogios", "joias", "outros"] }, { key: "gender", kind: "select", options: ["homem", "mulher", "crianca", "unissexo"] }, { key: "size", kind: "text" }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "bebe-e-crianca": [{ key: "kidsType", kind: "select", options: ["carrinhos", "roupa", "brinquedos", "mobilia", "alimentacao"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "desporto-e-lazer": [{ key: "sportType", kind: "select", options: ["bicicletas", "ginasio", "futebol", "campismo", "musica", "outros"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "animais": [{ key: "animalType", kind: "select", options: ["caes", "gatos", "aves", "gado", "peixes", "outros"] }, { key: "breed", kind: "text" }, { key: "age", kind: "text" }],
  "materiais-de-construcao": [{ key: "buildType", kind: "select", options: ["cimento", "blocos", "ferro", "madeira", "tintas", "canalizacao", "eletricidade", "outros"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "pecas-e-acessorios-auto": [{ key: "partType", kind: "select", options: ["motor", "pneus", "baterias", "carrocaria", "eletrica", "acessorios"] }, { key: "brand", kind: "text" }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "maquinas-e-ferramentas": [{ key: "toolType", kind: "select", options: ["geradores", "eletricas", "manuais", "agricolas", "industriais"] }, { key: "brand", kind: "text" }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "livros-e-material-escolar": [{ key: "bookType", kind: "select", options: ["escolares", "livros", "material", "uniformes"] }, { key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }],
  "outros": [{ key: "condition", kind: "select", options: ["novo", "como_novo", "usado", "para_pecas"] }]
};
const ALL_KEYS = [...new Set([...VEHICLE_FIELDS, ...REAL_ESTATE_FIELDS, ...Object.values(CATEGORY_FIELDS).flat()].map(f => f.key))];

/** Campos para o tipo de anúncio e a categoria: viatura e imóvel pelo tipo; os outros pela categoria. */
export function detailFieldsFor(listingType: string | null | undefined, categorySlug?: string | null): readonly DetailField[] {
  if (listingType === "vehicle") return VEHICLE_FIELDS;
  if (listingType === "real_estate") return REAL_ESTATE_FIELDS;
  if (listingType === "service") return [];
  return (categorySlug && CATEGORY_FIELDS[categorySlug]) || [];
}
/** Campos de lista (subcategoria, estado, combustível…) que servem de filtro na pesquisa. */
export function filterFieldsFor(listingType: string | null | undefined, categorySlug?: string | null): readonly DetailField[] {
  return detailFieldsFor(listingType, categorySlug).filter(f => f.kind === "select");
}
/** Filtros escolhidos → atributos para a pesquisa (só chaves e valores válidos). */
export function attributeFilters(listingType: string | null | undefined, categorySlug: string | null | undefined, chosen: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of filterFieldsFor(listingType, categorySlug)) { const v = chosen[f.key]; if (v && f.options!.includes(v)) out[f.key] = v; }
  return out;
}
/** Valida atributos de filtro vindos de fora (endereço da API pública): só chaves e valores conhecidos. */
export function safeAttributeFilters(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return out;
  const known = new Map<string, readonly string[]>();
  for (const f of [...VEHICLE_FIELDS, ...REAL_ESTATE_FIELDS, ...Object.values(CATEGORY_FIELDS).flat()]) if (f.kind === "select") known.set(f.key, [...(known.get(f.key) ?? []), ...f.options!]);
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string" && known.get(k)?.includes(v)) out[k] = v;
  return out;
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
export function validateDetails(listingType: string | null | undefined, values: Record<string, string>, categorySlug?: string | null): string | null {
  for (const f of detailFieldsFor(listingType, categorySlug)) {
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
export function buildDetailAttributes(listingType: string | null | undefined, values: Record<string, string>, categorySlug?: string | null): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const f of detailFieldsFor(listingType, categorySlug)) {
    const v = (values[f.key] ?? "").trim();
    if (!v) continue;
    out[f.key] = f.kind === "int" || f.kind === "number" ? toNumber(v) : v;
  }
  return out;
}
/** Linhas «chave → valor» para mostrar no anúncio; select devolve o valor (traduzir com «attr.<chave>.<valor>»). */
export function detailFacts(listingType: string | null | undefined, attributes: unknown, categorySlug?: string | null): { key: string; value: string; option: boolean; unit?: string }[] {
  const vals = detailValuesFrom(attributes);
  return detailFieldsFor(listingType, categorySlug).filter(f => vals[f.key]).map(f => ({ key: f.key, value: vals[f.key], option: f.kind === "select", unit: f.unit }));
}
