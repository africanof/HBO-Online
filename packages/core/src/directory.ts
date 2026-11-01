import type { SupabaseClient } from "@supabase/supabase-js";
import { placeColumns, type GeoPoint } from "./places";

/** Profissionais, serviços, empresas e avaliações — mesma lógica no Site e na APP. */

export type DirectoryFilters = { query?: string; categoryId?: string; municipalityId?: string; limit?: number };
export type ProviderInput = { displayName: string; headline?: string; bio?: string; categoryId?: string; customCategory?: string; municipalityId?: string; phone?: string; whatsapp?: string; active?: boolean; directions?: string; point?: GeoPoint | null };
export type ServiceInput = { title: string; description?: string; priceFrom?: number; categoryId?: string };
export type BusinessInput = { name: string; description?: string; categoryId?: string; customCategory?: string; municipalityId?: string; phone?: string; whatsapp?: string; addressText?: string; marketId?: string; active?: boolean; directions?: string; point?: GeoPoint | null };

const PHONE_RE = /^\+?[0-9 ]{9,15}$/;

/** Valor da opção "Outra" no campo da área de atividade: a pessoa escreve a sua área. */
export const OTHER_CATEGORY = "outra";

/** Valida a área: da lista, ou "Outra" com texto escrito (2 a 60 letras). */
export function validateCategoryChoice(categoryId: string | undefined, customCategory: string | undefined, missing: string): string | null {
  if (!categoryId) return missing;
  if (categoryId === OTHER_CATEGORY) {
    const t = (customCategory ?? "").trim();
    if (t.length < 2) return "Escreva a sua área de atividade.";
    if (t.length > 60) return "A área de atividade é demasiado longa (máximo 60 letras).";
  }
  return null;
}
/** Colunas a gravar: category_id da lista, ou custom_category quando é "Outra". */
export function categoryColumns(categoryId: string | undefined, customCategory: string | undefined): { category_id: string | null; custom_category: string | null } {
  return categoryId === OTHER_CATEGORY
    ? { category_id: null, custom_category: (customCategory ?? "").trim() }
    : { category_id: categoryId || null, custom_category: null };
}
/** Para editar: transforma a linha guardada nos valores do formulário. */
export function categoryFormValues(row: { category_id?: string | null; custom_category?: string | null }) {
  return !row.category_id && row.custom_category ? { categoryId: OTHER_CATEGORY, customCategory: row.custom_category } : { categoryId: row.category_id ?? "", customCategory: "" };
}
/** Nome da área a mostrar (da lista ou escrita pela pessoa). */
export function categoryLabel(row: { categories?: { name?: string } | null; custom_category?: string | null; category_name?: string | null }) {
  return row.category_name || row.categories?.name || row.custom_category || "";
}

export function validateProviderInput(input: ProviderInput): string | null {
  if (!input.displayName.trim()) return "Indique o nome profissional.";
  if (input.displayName.trim().length > 80) return "O nome é demasiado longo.";
  const cat = validateCategoryChoice(input.categoryId, input.customCategory, "Escolha a área de atividade.");
  if (cat) return cat;
  if (!input.municipalityId) return "Escolha o município onde trabalha.";
  if (input.phone?.trim() && !PHONE_RE.test(input.phone.trim())) return "Telefone inválido.";
  if (input.whatsapp?.trim() && !PHONE_RE.test(input.whatsapp.trim())) return "Número de WhatsApp inválido.";
  return null;
}
export function validateServiceInput(input: ServiceInput): string | null {
  if (!input.title.trim()) return "Indique o nome do serviço.";
  if (input.priceFrom !== undefined && (!Number.isFinite(input.priceFrom) || input.priceFrom < 0)) return "Indique um preço válido.";
  return null;
}
export function validateBusinessInput(input: BusinessInput): string | null {
  if (!input.name.trim()) return "Indique o nome da empresa.";
  const cat = validateCategoryChoice(input.categoryId, input.customCategory, "Escolha a categoria.");
  if (cat) return cat;
  if (!input.municipalityId) return "Escolha o município.";
  if (input.phone?.trim() && !PHONE_RE.test(input.phone.trim())) return "Telefone inválido.";
  if (input.whatsapp?.trim() && !PHONE_RE.test(input.whatsapp.trim())) return "Número de WhatsApp inválido.";
  return null;
}

/** "★★★★☆ 4.0 (12)" */
export function ratingLabel(rating: number | string | null | undefined, count: number | string | null | undefined): string {
  const n = Number(count ?? 0);
  if (!n) return "Sem avaliações";
  const r = Math.max(0, Math.min(5, Number(rating ?? 0)));
  const full = Math.round(r);
  return "★".repeat(full) + "☆".repeat(5 - full) + " " + r.toFixed(1) + " (" + n + ")";
}

/** Link de WhatsApp com indicativo de Angola por omissão. */
export function whatsappLink(number: string | null | undefined, text = ""): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length < 9) return null;
  const full = digits.length === 9 ? "244" + digits : digits;
  return "https://wa.me/" + full + (text ? "?text=" + encodeURIComponent(text) : "");
}

// Profissionais
export async function listProviders(client: SupabaseClient, f: DirectoryFilters = {}) {
  return client.rpc("provider_directory", { p_query: f.query?.trim() ?? "", p_category_id: f.categoryId || null, p_municipality_id: f.municipalityId || null, p_limit: f.limit ?? 30 });
}
export async function getProvider(client: SupabaseClient, userId: string) {
  const r = await client.from("provider_profiles").select("user_id,display_name,headline,bio,category_id,custom_category,municipality_id,phone,whatsapp,avatar_url,verified,active,created_at,directions,geo_lat,geo_lng,categories(name),municipalities(name)").eq("user_id", userId).maybeSingle();
  if (!r.data) return r;
  // Telefone, WhatsApp e localização só chegam ao próprio e à equipa.
  const contact = await getProviderPrivateContact(client, userId).catch(() => null);
  return contact ? { ...r, data: { ...r.data, ...contact } } : r;
}
/** Contactos e localização de um profissional: só o próprio e a equipa (administradores e moderadores). */
export async function getProviderPrivateContact(client: SupabaseClient, userId: string) {
  const r = await client.rpc("provider_private_contact", { p_user_id: userId });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return row ? { phone: (row.phone as string | null) ?? null, whatsapp: (row.whatsapp as string | null) ?? null, directions: (row.directions as string | null) ?? null,
    geo_lat: row.geo_lat == null ? null : Number(row.geo_lat), geo_lng: row.geo_lng == null ? null : Number(row.geo_lng) } : null;
}
export async function saveMyProviderProfile(client: SupabaseClient, userId: string, input: ProviderInput) {
  const invalid = validateProviderInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const saved = await client.from("provider_profiles").upsert({
    user_id: userId, display_name: input.displayName.trim(), headline: input.headline?.trim() || null, bio: input.bio?.trim() || null,
    ...categoryColumns(input.categoryId, input.customCategory), municipality_id: input.municipalityId,
    active: input.active ?? true, updated_at: new Date().toISOString()
  }, { onConflict: "user_id" }).select().single();
  if (saved.error) return saved;
  // Contactos e localização ficam numa tabela privada (só o próprio e a equipa os veem).
  const keepPlace = input.directions === undefined && input.point === undefined;
  const current = keepPlace ? await getProviderPrivateContact(client, userId).catch(() => null) : null;
  const place = keepPlace ? { directions: current?.directions ?? null, geo_lat: current?.geo_lat ?? null, geo_lng: current?.geo_lng ?? null }
    : placeColumns(input.directions, input.point);
  const c = await client.rpc("set_my_provider_contact", { p_phone: input.phone?.trim() || null, p_whatsapp: input.whatsapp?.trim() || null,
    p_directions: place.directions, p_geo_lat: place.geo_lat, p_geo_lng: place.geo_lng });
  return c.error ? { ...saved, data: null, error: c.error } : saved;
}
export async function listProviderServices(client: SupabaseClient, providerId: string, includeInactive = false) {
  let q = client.from("services").select("id,provider_id,title,description,price_from,currency,category_id,active,created_at").eq("provider_id", providerId).order("created_at");
  if (!includeInactive) q = q.eq("active", true);
  return q;
}
export async function saveService(client: SupabaseClient, providerId: string, input: ServiceInput, id?: string) {
  const invalid = validateServiceInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const row = { provider_id: providerId, title: input.title.trim(), description: input.description?.trim() || null, price_from: input.priceFrom ?? null, category_id: input.categoryId || null, active: true };
  return id ? client.from("services").update(row).eq("id", id).select().single() : client.from("services").insert(row).select().single();
}
export async function deleteService(client: SupabaseClient, id: string) { return client.from("services").delete().eq("id", id); }

// Empresas
export async function listBusinesses(client: SupabaseClient, f: DirectoryFilters = {}) {
  return client.rpc("business_directory", { p_query: f.query?.trim() ?? "", p_category_id: f.categoryId || null, p_municipality_id: f.municipalityId || null, p_limit: f.limit ?? 30 });
}
export async function getBusiness(client: SupabaseClient, id: string) {
  const r = await client.from("businesses").select("id,owner_id,name,description,category_id,custom_category,municipality_id,phone,whatsapp,logo_url,address_text,market_id,verified,active,created_at,directions,geo_lat,geo_lng,categories(name),municipalities(name),markets(id,name)").eq("id", id).maybeSingle();
  if (!r.data) return r;
  // Telefone e WhatsApp só chegam ao dono e à equipa; a localização continua pública.
  const contact = await getBusinessPrivateContact(client, id).catch(() => null);
  return contact ? { ...r, data: { ...r.data, ...contact } } : r;
}
/** Telefone e WhatsApp de uma empresa: só o dono e a equipa (administradores e moderadores). */
export async function getBusinessPrivateContact(client: SupabaseClient, id: string) {
  const r = await client.rpc("business_private_contact", { p_business_id: id });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return row ? { phone: (row.phone as string | null) ?? null, whatsapp: (row.whatsapp as string | null) ?? null } : null;
}
export async function listMyBusinesses(client: SupabaseClient, ownerId: string) {
  const r = await client.from("businesses").select("id,name,description,category_id,custom_category,municipality_id,phone,whatsapp,address_text,market_id,verified,active,logo_url,directions,geo_lat,geo_lng").eq("owner_id", ownerId).order("created_at");
  if (!r.data?.length) return r;
  const withContacts = await Promise.all(r.data.map(async (b: any) => ({ ...b, ...((await getBusinessPrivateContact(client, b.id).catch(() => null)) ?? {}) })));
  return { ...r, data: withContacts };
}
export async function saveBusiness(client: SupabaseClient, ownerId: string, input: BusinessInput, id?: string) {
  const invalid = validateBusinessInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const row = { owner_id: ownerId, name: input.name.trim(), description: input.description?.trim() || null, ...categoryColumns(input.categoryId, input.customCategory),
    municipality_id: input.municipalityId,
    address_text: input.addressText?.trim() || null, market_id: input.marketId || null, active: input.active ?? true, updated_at: new Date().toISOString(),
    ...(input.directions !== undefined || input.point !== undefined ? placeColumns(input.directions, input.point) : {}) };
  const saved = id ? await client.from("businesses").update(row).eq("id", id).select().single() : await client.from("businesses").insert(row).select().single();
  if (saved.error || !saved.data) return saved;
  // Telefone e WhatsApp ficam numa tabela privada (só o dono e a equipa os veem).
  const c = await client.rpc("set_business_private_contact", { p_business_id: (saved.data as any).id, p_phone: input.phone?.trim() || null, p_whatsapp: input.whatsapp?.trim() || null });
  return c.error ? { ...saved, data: null, error: c.error } : saved;
}
export async function deleteBusiness(client: SupabaseClient, id: string) { return client.from("businesses").delete().eq("id", id); }

// Avaliações e contacto
export type ReviewTarget = { providerId: string } | { businessId: string };
const targetArgs = (t: ReviewTarget) => ({ p_provider_id: "providerId" in t ? t.providerId : null, p_business_id: "businessId" in t ? t.businessId : null });

export async function listReviewsFor(client: SupabaseClient, target: ReviewTarget) { return client.rpc("list_reviews", targetArgs(target)); }
export async function submitReview(client: SupabaseClient, target: ReviewTarget, rating: number, comment: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { data: null, error: new Error("Escolha de 1 a 5 estrelas.") };
  return client.rpc("submit_review", { ...targetArgs(target), p_rating: rating, p_comment: comment.trim() });
}
export async function contactDirectoryOwner(client: SupabaseClient, target: ReviewTarget, message: string) {
  if (!message.trim()) return { data: null, error: new Error("Escreva a sua mensagem.") };
  return client.rpc("start_directory_conversation", { ...targetArgs(target), p_message: message.trim() });
}

/** Categorias do diretório (profissionais/serviços ou empresas). */
/** Categoria pedida na ligação («?categoria=fabricas»): devolve o id, ou "" se não existir. */
export function categoryIdFromSlug(categories: { id: string; slug?: string | null }[], slug: string | null | undefined): string {
  if (!slug) return "";
  return categories.find(c => c.slug === slug.trim().toLowerCase())?.id ?? "";
}
/** Textos especiais quando a lista de empresas está filtrada por «Fábricas». */
/** Categoria de empresas que leva à área «Combustível e gás». */
export const FUEL_CATEGORY_SLUG = "combustivel-gas";
export function directoryHeading(slug: string | null | undefined): { title: string; cta: string } | null {
  if (slug === "fabricas") return { title: "🏭 Fábricas do Huambo", cta: "Registar a minha fábrica" };
  if (slug === FUEL_CATEGORY_SLUG) return { title: "⛽ Postos de combustível e gás", cta: "Registar a minha empresa" };
  if (slug === "hoteis") return { title: "🏨 Hotéis e hospedagem", cta: "Registar o meu hotel" };
  if (slug === "restaurantes") return { title: "🍽️ Restaurantes", cta: "Registar o meu restaurante" };
  if (slug === "armazens") return { title: "🏬 Armazéns (comércio a grosso)", cta: "Registar o meu armazém" };
  return null;
}
export async function listDirectoryCategories(client: SupabaseClient, kind: "providers" | "businesses") {
  const types = kind === "providers" ? ["professional", "service"] : ["business", "product"];
  return client.from("categories").select("id,name,type,slug").eq("active", true).in("type", types).order("name");
}
