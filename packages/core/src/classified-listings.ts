import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClassifiedListingType, ClassifiedPurpose, ClassifiedStatus } from "@huambo-online/types";

export const CLASSIFIED_MAX_PHOTOS = 10;
export const CLASSIFIED_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const CLASSIFIED_MEDIA_BUCKET = "classified-media";

export const LISTING_TYPE_LABELS: Record<ClassifiedListingType, string> = {
  classified: "Classificado", product: "Produto", vehicle: "Veículo", real_estate: "Imóvel", service: "Serviço"
};
export const PURPOSE_LABELS: Record<ClassifiedPurpose, string> = {
  sale: "Venda", rent: "Arrendamento", lease: "Aluguer", wanted: "Procuro", service: "Serviço", auction: "Leilão"
};
export const STATUS_LABELS: Record<ClassifiedStatus, string> = {
  draft: "Rascunho", published: "Publicado", paused: "Pausado", sold: "Vendido", rented: "Arrendado", closed: "Fechado", cancelled: "Cancelado"
};
export const PUBLISHABLE_PURPOSES: ClassifiedPurpose[] = ["sale", "rent", "lease", "wanted", "service"];

export function formatPrice(price: number | string | null | undefined, currency = "AOA"): string {
  if (price === null || price === undefined || price === "") return "Preço sob consulta";
  const n = Number(price);
  if (!Number.isFinite(n)) return "Preço sob consulta";
  const whole = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return whole + " " + (currency === "AOA" ? "Kz" : currency);
}

export interface ClassifiedDraftInput {
  ownerId: string; categoryId?: string; addressId?: string; listingType: ClassifiedListingType;
  purpose: ClassifiedPurpose; title: string; description?: string; price?: number;
  provinceId?: string; municipalityId?: string;
  attributes?: Record<string, unknown>; media?: string[];
}

/** Valida o formulário antes de enviar. Devolve a mensagem de erro ou null. */
export function validateClassifiedDraft(input: Omit<ClassifiedDraftInput, "ownerId" | "media"> & { photoCount?: number }): string | null {
  const title = input.title.trim();
  if (!title) return "Indique um título.";
  if (title.length < 3) return "O título é demasiado curto.";
  if (title.length > 140) return "O título não pode ter mais de 140 caracteres.";
  if ((input.description ?? "").length > 5000) return "A descrição é demasiado longa.";
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) return "Indique um preço válido.";
  if (!input.provinceId) return "Escolha a província.";
  if (!input.municipalityId) return "Escolha o município.";
  if ((input.photoCount ?? 0) > CLASSIFIED_MAX_PHOTOS) return `Pode juntar no máximo ${CLASSIFIED_MAX_PHOTOS} fotografias.`;
  return null;
}

/** Converte o texto do preço ("15 000", "15000,50") num número, ou undefined se vazio. */
export function parsePrice(raw: string): number | undefined {
  const clean = raw.replace(/\s/g, "").replace(",", ".");
  if (!clean) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
}

/** O território fica guardado em attributes (provinceId/municipalityId) para o Site e a APP lerem igual. */
export function listingTerritory(listing: { attributes?: unknown } | null | undefined): { provinceId?: string; municipalityId?: string } {
  const a = (listing?.attributes ?? {}) as Record<string, unknown>;
  return {
    provinceId: typeof a.provinceId === "string" && a.provinceId ? a.provinceId : undefined,
    municipalityId: typeof a.municipalityId === "string" && a.municipalityId ? a.municipalityId : undefined
  };
}

function buildAttributes(input: Pick<ClassifiedDraftInput, "attributes" | "provinceId" | "municipalityId">) {
  const attrs: Record<string, unknown> = { ...(input.attributes ?? {}) };
  if (input.provinceId) attrs.provinceId = input.provinceId;
  if (input.municipalityId) attrs.municipalityId = input.municipalityId;
  return attrs;
}

const errorMessages: [RegExp, string][] = [
  [/row-level security|Unauthorized|403/i, "Sem permissão para esta operação. Inicie sessão novamente."],
  [/LOCATION_REQUIRED/, "Indique a localização do anúncio."],
  [/TITLE_REQUIRED/, "Indique um título."],
  [/INVALID_ATTRIBUTES/, "Há dados inválidos no anúncio (ex.: marca do veículo)."],
  [/TOO_MANY_PHOTOS/, `Pode juntar no máximo ${CLASSIFIED_MAX_PHOTOS} fotografias.`],
  [/NOT_LISTING_OWNER/, "Só o dono do anúncio pode fazer isto."],
  [/LISTING_NOT_FOUND/, "Anúncio não encontrado ou já não está publicado."],
  [/CANNOT_CONTACT_SELF/, "Este anúncio é seu."],
  [/AUTH_REQUIRED|JWT|not authenticated/i, "Inicie sessão para continuar."],
  [/ACCOUNT_SUSPENDED/, "A sua conta está suspensa. Contacte o apoio Huambo Online."],
  [/ADMIN_ONLY/, "Só a administração pode fazer isto."],
  [/CANNOT_CHANGE_SELF/, "Não pode alterar a sua própria conta aqui."],
  [/duplicate key.*slug|categories_slug/i, "Já existe uma categoria com esse nome."],
  [/Payload too large|exceeded the maximum allowed size/i, "A fotografia é demasiado grande (máximo 5 MB)."],
  [/mime type|invalid_mime/i, "Só são aceites imagens (JPG, PNG, WEBP)."],
  [/failed to fetch|network request failed/i, "Sem ligação à internet. Tente novamente."]
];

/** Mensagem clara em português para erros do Supabase. */
export function friendlyError(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as any).message) : String(error ?? "");
  for (const [re, msg] of errorMessages) if (re.test(raw)) return msg;
  return raw || fallback;
}

export async function createClassifiedListing(client: SupabaseClient, input: ClassifiedDraftInput) {
  return client.from("classified_listings").insert({
    owner_id: input.ownerId, category_id: input.categoryId || null, address_id: input.addressId || null,
    listing_type: input.listingType, purpose: input.purpose, title: input.title.trim(),
    description: input.description?.trim() || null, price: input.price ?? null,
    attributes: buildAttributes(input), media: input.media || []
  }).select().single();
}

/** Grava o anúncio e publica-o logo (o Supabase valida antes de publicar). */
export async function createAndPublishClassifiedListing(client: SupabaseClient, input: ClassifiedDraftInput) {
  const created = await createClassifiedListing(client, input);
  if (created.error || !created.data) return { data: null, draftId: null as string | null, error: created.error };
  const published = await client.rpc("publish_classified_listing", { p_listing_id: created.data.id });
  if (published.error) return { data: created.data, draftId: created.data.id as string, error: published.error };
  return { data: published.data ?? created.data, draftId: null, error: null };
}

export async function updateClassifiedListing(client: SupabaseClient, id: string, input: Omit<ClassifiedDraftInput, "ownerId">) {
  return client.from("classified_listings").update({
    category_id: input.categoryId || null, listing_type: input.listingType, purpose: input.purpose,
    title: input.title.trim(), description: input.description?.trim() || null, price: input.price ?? null,
    attributes: buildAttributes(input), media: input.media || [], updated_at: new Date().toISOString()
  }).eq("id", id).select().single();
}

export async function deleteClassifiedListing(client: SupabaseClient, id: string) {
  return client.from("classified_listings").delete().eq("id", id);
}

export async function listMyClassifiedListings(client: SupabaseClient, ownerId: string) {
  return client.from("classified_listings").select(LISTING_COLUMNS).eq("owner_id", ownerId).order("created_at", { ascending: false });
}

const LISTING_COLUMNS = "id,owner_id,category_id,address_id,listing_type,purpose,title,description,price,currency,attributes,media,status,featured,created_at,updated_at";

export async function listClassifiedListings(client: SupabaseClient, filters: {
  listingType?: ClassifiedListingType; purpose?: ClassifiedPurpose; categoryId?: string; limit?: number;
} = {}) {
  let q = client.from("classified_listings").select(LISTING_COLUMNS).eq("status", "published").order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(filters.limit ?? 30);
  if (filters.listingType) q = q.eq("listing_type", filters.listingType);
  if (filters.purpose) q = q.eq("purpose", filters.purpose);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  return q;
}

export async function listClassifiedListingsByIds(client: SupabaseClient, ids: string[]) {
  const clean = [...new Set(ids.filter(id => typeof id === "string" && id.length > 0))];
  if (!clean.length) return { data: [], error: null };
  return client.from("classified_listings").select(LISTING_COLUMNS).in("id", clean).eq("status", "published").order("created_at", { ascending: false });
}

/** Anúncio publicado, ou do próprio dono (rascunho/pausado) — as regras do Supabase decidem. */
export async function getClassifiedListing(client: SupabaseClient, id: string) {
  return client.from("classified_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
}

export async function updateClassifiedStatus(client: SupabaseClient, id: string, status: Exclude<ClassifiedStatus, "published">) {
  return client.from("classified_listings").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select().single();
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = base64.replace(/^data:[^,]*,/, "").replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[clean.charCodeAt(i)], b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)], d = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.buffer.slice(0, p);
}

function randomId() {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Envia uma fotografia para a pasta do utilizador no bucket classified-media e devolve o URL público. */
export async function uploadClassifiedMedia(client: SupabaseClient, file: Blob | ArrayBuffer, ownerId: string, filename?: string, contentType?: string, bucket = CLASSIFIED_MEDIA_BUCKET) {
  const ext = ((filename || "image.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const type = contentType || (file instanceof ArrayBuffer ? "" : file.type) || "image/jpeg";
  const path = ownerId + "/" + randomId() + "." + ext;
  const uploaded = await client.storage.from(bucket).upload(path, file, { upsert: false, contentType: type });
  if (uploaded.error) return { data: null, error: uploaded.error };
  const url = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { data: url, error: null };
}

/** Caminho no Storage a partir do URL público (para apagar fotografias removidas). */
export function storagePathFromPublicUrl(url: string, bucket = CLASSIFIED_MEDIA_BUCKET): string | null {
  const marker = "/storage/v1/object/public/" + bucket + "/";
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export async function removeClassifiedMedia(client: SupabaseClient, urls: string[]) {
  const paths = urls.map(u => storagePathFromPublicUrl(u)).filter((p): p is string => !!p);
  if (!paths.length) return { data: [], error: null };
  return client.storage.from(CLASSIFIED_MEDIA_BUCKET).remove(paths);
}
