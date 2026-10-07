import type { SupabaseClient } from "@supabase/supabase-js";

/** Profissionais, serviços, empresas e avaliações — mesma lógica no Site e na APP. */

export type DirectoryFilters = { query?: string; categoryId?: string; municipalityId?: string; limit?: number };
export type ProviderInput = { displayName: string; headline?: string; bio?: string; categoryId?: string; municipalityId?: string; phone?: string; whatsapp?: string; active?: boolean };
export type ServiceInput = { title: string; description?: string; priceFrom?: number; categoryId?: string };
export type BusinessInput = { name: string; description?: string; categoryId?: string; municipalityId?: string; phone?: string; whatsapp?: string; addressText?: string; active?: boolean };

const PHONE_RE = /^\+?[0-9 ]{9,15}$/;

export function validateProviderInput(input: ProviderInput): string | null {
  if (!input.displayName.trim()) return "Indique o nome profissional.";
  if (input.displayName.trim().length > 80) return "O nome é demasiado longo.";
  if (!input.categoryId) return "Escolha a área de atividade.";
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
  if (!input.categoryId) return "Escolha a categoria.";
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
  return client.from("provider_profiles").select("user_id,display_name,headline,bio,category_id,municipality_id,phone,whatsapp,avatar_url,verified,active,created_at,categories(name),municipalities(name)").eq("user_id", userId).maybeSingle();
}
export async function saveMyProviderProfile(client: SupabaseClient, userId: string, input: ProviderInput) {
  const invalid = validateProviderInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  return client.from("provider_profiles").upsert({
    user_id: userId, display_name: input.displayName.trim(), headline: input.headline?.trim() || null, bio: input.bio?.trim() || null,
    category_id: input.categoryId, municipality_id: input.municipalityId, phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null, active: input.active ?? true, updated_at: new Date().toISOString()
  }, { onConflict: "user_id" }).select().single();
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
  return client.from("businesses").select("id,owner_id,name,description,category_id,municipality_id,phone,whatsapp,logo_url,address_text,verified,active,created_at,categories(name),municipalities(name)").eq("id", id).maybeSingle();
}
export async function listMyBusinesses(client: SupabaseClient, ownerId: string) {
  return client.from("businesses").select("id,name,description,category_id,municipality_id,phone,whatsapp,address_text,verified,active").eq("owner_id", ownerId).order("created_at");
}
export async function saveBusiness(client: SupabaseClient, ownerId: string, input: BusinessInput, id?: string) {
  const invalid = validateBusinessInput(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  const row = { owner_id: ownerId, name: input.name.trim(), description: input.description?.trim() || null, category_id: input.categoryId,
    municipality_id: input.municipalityId, phone: input.phone?.trim() || null, whatsapp: input.whatsapp?.trim() || null,
    address_text: input.addressText?.trim() || null, active: input.active ?? true, updated_at: new Date().toISOString() };
  return id ? client.from("businesses").update(row).eq("id", id).select().single() : client.from("businesses").insert(row).select().single();
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
export async function listDirectoryCategories(client: SupabaseClient, kind: "providers" | "businesses") {
  const types = kind === "providers" ? ["professional", "service"] : ["business", "product"];
  return client.from("categories").select("id,name,type").eq("active", true).in("type", types).order("name");
}
