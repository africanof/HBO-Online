import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_FIELDS, REAL_ESTATE_FIELDS, VEHICLE_FIELDS, detailFieldsFor, type DetailField } from "./listing-details";
import { termsPage, privacyPage, returnsPage, deleteAccountPage, HELP_FAQ } from "./legal";

/**
 * Assistente de IA (OpenAI gpt-4o-mini, na Edge Function «ai-assist»): preencher anúncio pela foto,
 * pesquisa em linguagem normal, ajuda, tradução de anúncios e ferramentas da equipa.
 * Limites por pessoa e por dia (consume_ai na base de dados).
 */
export const AI_LIMITS = { photo_fill: 15, smart_search: 30, help: 30, staff_reply: 300, dispute_summary: 100 } as const;

export type AiErrorCode = "AUTH_REQUIRED" | "AI_LIMIT" | "AI_NOT_CONFIGURED" | "AI_NEEDS_TEXT" | "AI_FAILED" | "NETWORK" | "INVALID_IMAGE" | "ADMIN_ONLY" | "NOT_FOUND";
const MESSAGES: Record<AiErrorCode, string> = {
  AUTH_REQUIRED: "Inicie sessão para usar o assistente de IA.",
  AI_LIMIT: "Já usou o assistente de IA as vezes permitidas hoje. Volte amanhã.",
  AI_NOT_CONFIGURED: "O assistente de IA ainda não está ativo. Tente mais tarde.",
  AI_NEEDS_TEXT: "Escreva primeiro o que procura ou a sua pergunta.",
  AI_FAILED: "O assistente de IA não conseguiu responder agora. Tente de novo.",
  NETWORK: "Sem ligação à internet. Verifique os dados móveis ou o Wi-Fi.",
  INVALID_IMAGE: "Não foi possível ler a fotografia. Tente outra.",
  ADMIN_ONLY: "Só a equipa (administração e moderadores) pode usar isto.",
  NOT_FOUND: "Não encontrámos o que procura. Atualize a página."
};
export function aiMessage(code: string | null | undefined): string {
  return MESSAGES[code as AiErrorCode] ?? MESSAGES.AI_FAILED;
}

type AiResult<T> = { data: T | null; error: AiErrorCode | null };
async function callAi<T>(client: SupabaseClient, body: Record<string, unknown>, needsSession = true): Promise<AiResult<T>> {
  if (needsSession) {
    const { data: s } = await client.auth.getSession();
    if (!s.session) return { data: null, error: "AUTH_REQUIRED" };
  }
  try {
    const r = await client.functions.invoke("ai-assist", { body });
    if (r.error) {
      let code = "AI_FAILED";
      const ctx = (r.error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") { try { code = (await ctx.json())?.error ?? code; } catch { /* resposta sem JSON */ } }
      else if (/fetch|network/i.test(String((r.error as Error).message))) code = "NETWORK";
      return { data: null, error: (code in MESSAGES ? code : "AI_FAILED") as AiErrorCode };
    }
    return { data: r.data as T, error: null };
  } catch { return { data: null, error: "NETWORK" }; }
}

// ---------------------------------------------------------------------------------------------
// Catálogo para a IA (categorias e campos que pode preencher)
export type CategoryRef = { slug?: string | null; name: string };
function fieldLine(f: DetailField): string {
  return f.kind === "select" ? `${f.key} (uma de: ${f.options!.join("|")})` : `${f.key} (${f.kind === "text" ? "texto" : "número"})`;
}
/** Texto curto com as categorias e os campos de cada uma, enviado à IA. */
export function aiCatalog(categories: CategoryRef[]): string {
  const lines = [
    "Categorias (slug = nome): " + categories.filter(c => c.slug).map(c => `${c.slug} = ${c.name}`).join("; "),
    "Viaturas (listing_type vehicle): " + VEHICLE_FIELDS.map(fieldLine).join(", "),
    "Imóveis (listing_type real_estate): " + REAL_ESTATE_FIELDS.map(fieldLine).join(", ")
  ];
  for (const [slug, fields] of Object.entries(CATEGORY_FIELDS)) lines.push(`${slug}: ${fields.map(fieldLine).join(", ")}`);
  return lines.join("\n");
}
const LISTING_TYPES = ["product", "vehicle", "real_estate", "service", "classified"] as const;
const PURPOSES = ["sale", "rent", "lease", "wanted", "service", "auction"] as const;
/** Fica só com os campos e valores válidos para o tipo e a categoria (a IA pode enganar-se). */
export function cleanDetails(listingType: string | null | undefined, categorySlug: string | null | undefined, details: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of detailFieldsFor(listingType, categorySlug)) {
    const raw = details?.[f.key]; if (raw === null || raw === undefined) continue;
    const v = String(raw).trim(); if (!v) continue;
    if (f.kind === "select") { if (f.options!.includes(v)) out[f.key] = v; }
    else if (f.kind === "int" || f.kind === "number") {
      const n = Number(v.replace(/\s/g, "").replace(",", "."));
      if (Number.isFinite(n) && (f.min === undefined || n >= f.min) && (f.max === undefined || n <= f.max)) out[f.key] = String(f.kind === "int" ? Math.round(n) : n);
    } else out[f.key] = v.slice(0, 60);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Preencher o anúncio a partir de uma fotografia
export type PhotoFill = { found: boolean; title: string; description: string; listingType: string | null; categorySlug: string | null; details: Record<string, string>; remaining: number };
export async function fillFromPhoto(client: SupabaseClient, imageBase64: string, mediaType: string, categories: CategoryRef[]): Promise<AiResult<PhotoFill>> {
  const r = await callAi<any>(client, { task: "photo_fill", image: imageBase64.replace(/^data:[^,]*,/, ""), mediaType, catalog: aiCatalog(categories) });
  if (r.error || !r.data) return { data: null, error: r.error ?? "AI_FAILED" };
  const d = r.data;
  const listingType = (LISTING_TYPES as readonly string[]).includes(d.listing_type) ? d.listing_type : null;
  const categorySlug = categories.some(c => c.slug === d.category_slug) ? d.category_slug : null;
  return { data: { found: !!d.found, title: String(d.title ?? ""), description: String(d.description ?? ""), listingType, categorySlug,
    details: cleanDetails(listingType, categorySlug, d.details), remaining: Number(d.remaining ?? 0) }, error: null };
}

// ---------------------------------------------------------------------------------------------
// Pesquisa em linguagem normal
export type SmartSearch = { query: string; listingType: string; purpose: string; categorySlug: string; minPrice: string; maxPrice: string; attributes: Record<string, string>; remaining: number };
export async function smartSearch(client: SupabaseClient, text: string, categories: CategoryRef[]): Promise<AiResult<SmartSearch>> {
  if (text.trim().length < 2) return { data: null, error: "AI_NEEDS_TEXT" };
  const r = await callAi<any>(client, { task: "smart_search", query: text.trim().slice(0, 300), catalog: aiCatalog(categories) });
  if (r.error || !r.data) return { data: null, error: r.error ?? "AI_FAILED" };
  return { data: smartSearchFrom(r.data, categories), error: null };
}
/** Resposta da IA → filtros válidos da Explorar. */
export function smartSearchFrom(d: any, categories: CategoryRef[]): SmartSearch {
  const listingType = (LISTING_TYPES as readonly string[]).includes(d?.listing_type) ? d.listing_type : "";
  const purpose = (PURPOSES as readonly string[]).includes(d?.purpose) ? d.purpose : "";
  const categorySlug = categories.some(c => c.slug && c.slug === d?.category_slug) ? d.category_slug : "";
  const price = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? String(Math.round(v)) : "");
  const attributes: Record<string, string> = {};
  for (const f of detailFieldsFor(listingType, categorySlug)) {
    const v = d?.attributes?.[f.key];
    if (f.kind === "select" && typeof v === "string" && f.options!.includes(v)) attributes[f.key] = v;
  }
  return { query: String(d?.keywords ?? "").trim().slice(0, 80), listingType, purpose, categorySlug, minPrice: price(d?.min_price), maxPrice: price(d?.max_price), attributes, remaining: Number(d?.remaining ?? 0) };
}

// ---------------------------------------------------------------------------------------------
// Assistente de ajuda
export type HelpTurn = { role: "user" | "assistant"; content: string };
export async function askHelp(client: SupabaseClient, question: string, lang: string, history: HelpTurn[] = []): Promise<AiResult<{ answer: string; handoff: boolean; remaining: number }>> {
  if (question.trim().length < 2) return { data: null, error: "AI_NEEDS_TEXT" };
  return callAi(client, { task: "help", question: question.trim().slice(0, 600), lang, history: history.slice(-6) });
}
/** Texto da Ajuda, Termos, Privacidade e Devoluções que o assistente conhece (copiado para a Edge Function). */
export function aiKnowledgeText(): string {
  const pages = [termsPage(), privacyPage(), returnsPage(), deleteAccountPage()];
  let out = "# Perguntas frequentes\n" + HELP_FAQ.map(f => `P: ${f.q}\nR: ${f.a}`).join("\n\n");
  for (const p of pages) out += `\n\n# ${p.title}\n${p.intro}\n` + p.sections.map(s => `## ${s.title}\n${s.paragraphs.join("\n")}`).join("\n");
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tradução de anúncios (fica guardada; qualquer visitante pode pedir)
export type ListingTranslation = { title: string; description: string | null };
export async function translateListing(client: SupabaseClient, listingId: string, lang: string): Promise<AiResult<ListingTranslation>> {
  const cached = await client.from("listing_translations").select("title,description,source_hash").eq("listing_id", listingId).eq("lang", lang).maybeSingle();
  if (cached.data) {
    const hash = await client.rpc("listing_text_hash", { p_listing_id: listingId });
    if (!hash.error && hash.data === cached.data.source_hash) return { data: { title: cached.data.title, description: cached.data.description }, error: null };
  }
  const r = await callAi<any>(client, { task: "translate", listingId, lang }, false);
  if (r.error || !r.data) return { data: null, error: r.error ?? "AI_FAILED" };
  return { data: { title: String(r.data.title ?? ""), description: r.data.description ?? null }, error: null };
}

// ---------------------------------------------------------------------------------------------
// Ajuda no preço (sem IA)
export type PriceHint = { samples: number; low: number; median: number; high: number };
export async function priceHint(client: SupabaseClient, categoryId: string | null | undefined, listingType: string, purpose: string): Promise<PriceHint | null> {
  if (!listingType || purpose === "wanted" || purpose === "auction") return null;
  const r = await client.rpc("price_hint", { p_category_id: categoryId || null, p_listing_type: listingType, p_purpose: purpose || "sale" });
  const row = Array.isArray(r.data) ? r.data[0] : r.data;
  if (r.error || !row || !row.samples) return null;
  return { samples: Number(row.samples), low: Number(row.low), median: Number(row.median), high: Number(row.high) };
}

// ---------------------------------------------------------------------------------------------
// Equipa: resposta sugerida, resumo de disputas e triagem de anúncios
export async function suggestTeamReply(client: SupabaseClient, conversationId: string, audienceId: string, subject?: string | null): Promise<AiResult<{ reply: string; note: string; remaining: number }>> {
  return callAi(client, { task: "staff_reply", conversationId, audienceId, subject: subject ?? "" });
}
export async function summarizeDispute(client: SupabaseClient, disputeId: string): Promise<AiResult<{ summary: string; points: string[]; missing: string; remaining: number }>> {
  return callAi(client, { task: "dispute_summary", disputeId });
}
export type AiFlag = { listing_id: string; ref_no: number | null; title: string; status: string; owner_id: string; owner_name: string | null; price: number | null;
  risk: "attention" | "high"; reasons: string[]; suggested_category: string | null; summary: string | null; checked_at: string };
export async function listAiFlags(client: SupabaseClient, limit = 50) {
  const r = await client.rpc("admin_list_ai_flags", { p_limit: limit });
  return { data: (r.data ?? []) as AiFlag[], error: r.error };
}
export function dismissAiFlag(client: SupabaseClient, listingId: string) {
  return client.rpc("admin_dismiss_ai_flag", { p_listing_id: listingId });
}
