import type { SupabaseClient } from "@supabase/supabase-js";
import { formatEventDate, localInputToIso } from "./events";
import type { PaymentMethodPlan } from "./plans";

/**
 * Vídeos de publicidade e lives de profissionais, lojas e empresas (igual no Site e na APP).
 * A live acontece no YouTube, Facebook, TikTok ou Instagram: aqui fica o anúncio, a hora e a ligação.
 * Destaque pago opcional (confirmado pela administração).
 */
export type PromoSubjectKind = "provider" | "business" | "store";
export type PromoKind = "video" | "live";
export type LiveState = "upcoming" | "live" | "ended";
export type PromoSubject = { kind: PromoSubjectKind; id: string; name: string };
export type PromoPost = {
  id: string; ref_no: number; subject_kind: PromoSubjectKind; subject_id: string; subject_name: string; subject_picture: string | null; kind: PromoKind;
  title: string; description: string | null; video_url: string | null; external_url: string | null; cover_url: string | null;
  live_starts_at: string | null; live_ends_at: string | null; live_state: LiveState | null; featured: boolean; views: number; created_at: string;
  owner_id?: string; featured_until?: string | null; status?: "published" | "hidden"; hidden_reason?: string | null;
};
export type MyPromoPost = {
  id: string; ref_no: number; subject_kind: PromoSubjectKind; subject_id: string; subject_name: string; kind: PromoKind; title: string;
  live_starts_at: string | null; live_ends_at: string | null; status: "published" | "hidden"; hidden_reason: string | null; featured_until: string | null;
  views: number; created_at: string; boost_status: "pending" | "confirmed" | "rejected" | null; boost_note: string | null;
};
export type AdminPromoBoost = {
  id: string; ref_no: number; post_id: string; post_ref: number; post_title: string; post_kind: PromoKind; owner_name: string; amount: number; days: number;
  method: PaymentMethodPlan; reference: string | null; proof_path: string | null; status: "pending" | "confirmed" | "rejected"; admin_note: string | null; created_at: string;
};
export type AdminPromoPost = {
  id: string; ref_no: number; kind: PromoKind; title: string; subject_kind: PromoSubjectKind; subject_id: string; subject_name: string; video_url: string | null;
  external_url: string | null; status: "published" | "hidden"; hidden_reason: string | null; views: number; featured_until: string | null; created_at: string; reports: number;
};

export const PROMO_KIND_LABELS: Record<PromoKind, string> = { video: "🎬 Vídeo", live: "🔴 Live" };
export const PROMO_SUBJECT_LABELS: Record<PromoSubjectKind, string> = { provider: "Profissional", business: "Empresa", store: "Loja" };
export const LIVE_DURATIONS: { minutes: number; label: string }[] = [
  { minutes: 30, label: "30 minutos" }, { minutes: 60, label: "1 hora" }, { minutes: 90, label: "1 hora e meia" }, { minutes: 120, label: "2 horas" }, { minutes: 180, label: "3 horas" }
];
export const PROMO_DAILY_LIMIT = 5;

export function promoRef(n: number | null | undefined) { return n ? `V-${n}` : ""; }
export function promoSubjectHref(kind: PromoSubjectKind, id: string): string {
  return kind === "provider" ? "/profissionais/" + id : kind === "business" ? "/empresas/" + id : "/vendedor/" + id;
}

const PLATFORMS: [RegExp, string][] = [[/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"], [/(^|\.)(facebook\.com|fb\.watch)$/, "Facebook"], [/(^|\.)tiktok\.com$/, "TikTok"], [/(^|\.)instagram\.com$/, "Instagram"]];
/** «YouTube», «Facebook», «TikTok», «Instagram» — ou null se a ligação não for aceite. */
export function videoPlatform(url: string | null | undefined): string | null {
  try {
    const u = new URL((url ?? "").trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    for (const [re, name] of PLATFORMS) if (re.test(host)) return name;
  } catch { /* ligação inválida */ }
  return null;
}
/** Identificador do vídeo do YouTube (para a miniatura), se for do YouTube. */
export function youtubeId(url: string | null | undefined): string | null {
  try {
    const u = new URL((url ?? "").trim()); const host = u.hostname.replace(/^www\.|^m\./, "");
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0]
      : host === "youtube.com" ? (u.searchParams.get("v") || /^\/(live|shorts|embed)\/([^/?]+)/.exec(u.pathname)?.[2] || "") : "";
    return /^[\w-]{6,20}$/.test(id) ? id : null;
  } catch { return null; }
}
/**
 * Endereço para ver o vídeo ou a live DENTRO do Site e da APP (só YouTube e Facebook deixam).
 * TikTok e Instagram (ou ligações de canal sem identificador) devolvem null: abre-se a rede social.
 */
export function embedUrl(url: string | null | undefined): string | null {
  const platform = videoPlatform(url);
  if (platform === "YouTube") {
    const id = youtubeId(url);
    if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
    const channel = /\/channel\/(UC[\w-]{10,40})(\/live)?\/?$/.exec(new URL(url!.trim()).pathname)?.[1];
    return channel ? `https://www.youtube-nocookie.com/embed/live_stream?channel=${channel}&autoplay=1&playsinline=1` : null;
  }
  if (platform === "Facebook") {
    const u = new URL(url!.trim());
    const isVideo = u.hostname.endsWith("fb.watch") || /\/(videos|watch|live|reel)(\/|$)/.test(u.pathname) || u.searchParams.has("v");
    return isVideo ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.toString())}&show_text=false&autoplay=true&allowfullscreen=true` : null;
  }
  return null;
}
/** Aviso no formulário: se a ligação vai poder ser vista dentro do Huambo Online. */
export function embedHint(url: string | null | undefined): { ok: boolean; text: string } | null {
  if (!url?.trim()) return null;
  const platform = videoPlatform(url);
  if (!platform) return null;
  if (embedUrl(url)) return { ok: true, text: "✔ Vai poder ser vista dentro do Huambo Online (Site e APP)." };
  if (platform === "YouTube") return { ok: false, text: "Esta ligação abre no YouTube. Para ser vista aqui dentro, cole a ligação da própria live ou vídeo (ex.: youtube.com/live/…, youtu.be/…)." };
  if (platform === "Facebook") return { ok: false, text: "Esta ligação abre no Facebook. Para ser vista aqui dentro, cole a ligação do próprio vídeo ou live (ex.: facebook.com/…/videos/…)." };
  return { ok: false, text: `O ${platform} não deixa ver dentro de outros sites: as pessoas vão abrir o ${platform}.` };
}
export function youtubeThumb(url: string | null | undefined): string | null {
  const id = youtubeId(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/** Estado da live calculado no telemóvel (o servidor também o devolve). */
export function liveStateAt(p: { kind: PromoKind; live_starts_at: string | null; live_ends_at: string | null }, now = Date.now()): LiveState | null {
  if (p.kind !== "live" || !p.live_starts_at || !p.live_ends_at) return null;
  return now < Date.parse(p.live_starts_at) ? "upcoming" : now <= Date.parse(p.live_ends_at) ? "live" : "ended";
}
export function liveStateText(p: { kind: PromoKind; live_starts_at: string | null; live_ends_at: string | null }, now = Date.now()): string {
  const s = liveStateAt(p, now);
  if (s === "live") return "🔴 Em direto agora";
  if (s === "upcoming") return "⏰ " + formatEventDate(p.live_starts_at!);
  if (s === "ended") return "Live terminada";
  return "";
}
export function viewsText(n: number): string { return n === 1 ? "1 visualização" : `${(n || 0).toLocaleString("pt-AO").replace(/\s|\./g, " ")} visualizações`; }
export function promoShareMessage(siteUrl: string, p: Pick<PromoPost, "id" | "title" | "subject_name" | "kind" | "live_starts_at" | "live_ends_at">): string {
  const when = p.kind === "live" ? "\n" + liveStateText(p as any) : "";
  return `${p.kind === "live" ? "🔴" : "🎬"} ${p.title} — ${p.subject_name}${when}\n👉 ${siteUrl.replace(/\/$/, "")}/videos/${p.id}`;
}

export type PromoInput = {
  subjectKind: PromoSubjectKind | ""; subjectId: string; kind: PromoKind; title: string; description?: string;
  videoUrl?: string | null; externalUrl?: string; coverUrl?: string | null; liveStartsAt?: string; liveMinutes?: number;
};
export function validatePromo(i: PromoInput, now = Date.now()): string | null {
  if (!i.subjectKind || !i.subjectId) return "Escolha em nome de quem publica (perfil, empresa ou loja).";
  if (i.title.trim().length < 4) return "Escreva um título (pelo menos 4 letras).";
  const link = i.externalUrl?.trim();
  if (link && !videoPlatform(link)) return "A ligação tem de ser do YouTube, Facebook, TikTok ou Instagram (começa por https://).";
  if (i.kind === "video" && !i.videoUrl && !link) return "Envie o vídeo ou cole a ligação do YouTube, Facebook, TikTok ou Instagram.";
  if (i.kind === "live") {
    if (!link) return "Cole a ligação da live (YouTube, Facebook, TikTok ou Instagram).";
    const s = localInputToIso(i.liveStartsAt ?? "");
    if (!s) return "Indique o dia e a hora da live.";
    if (Date.parse(s) < now - 10 * 60000) return "A live tem de ser agora ou no futuro.";
    if (!i.liveMinutes || i.liveMinutes < 10) return "Escolha quanto tempo dura a live.";
  }
  return null;
}

// --- Servidor ---------------------------------------------------------------------------------
const num = (v: unknown) => Number(v) || 0;
const fix = (p: PromoPost): PromoPost => ({ ...p, views: num(p.views) });
export async function listMyPromoSubjects(client: SupabaseClient) {
  const r = await client.rpc("my_promo_subjects");
  return { data: (r.data ?? []) as PromoSubject[], error: r.error };
}
export async function promoFeed(client: SupabaseClient, f: { kind?: PromoKind | ""; subjectKind?: PromoSubjectKind; subjectId?: string; limit?: number } = {}) {
  const r = await client.rpc("promo_feed", { p_kind: f.kind || null, p_subject_kind: f.subjectKind ?? null, p_subject_id: f.subjectId ?? null, p_limit: f.limit ?? 40 });
  return { data: ((r.data ?? []) as PromoPost[]).map(fix), error: r.error };
}
export async function getPromoPost(client: SupabaseClient, id: string) {
  const r = await client.rpc("get_promo_post", { p_id: id });
  const row = ((r.data ?? []) as PromoPost[])[0];
  return { data: row ? fix(row) : null, error: r.error };
}
export async function recordPromoView(client: SupabaseClient, id: string) { return await client.rpc("record_promo_view", { p_id: id }); }
export async function savePromoPost(client: SupabaseClient, i: PromoInput, id?: string) {
  const bad = validatePromo(i, id ? 0 : Date.now());
  if (bad) return { data: null, error: new Error(bad) };
  const r = await client.rpc("save_promo_post", {
    p_id: id ?? null, p_subject_kind: i.subjectKind, p_subject_id: i.subjectId, p_kind: i.kind, p_title: i.title.trim(), p_description: i.description?.trim() || null,
    p_video_url: i.kind === "video" ? i.videoUrl || null : null, p_external_url: i.externalUrl?.trim() || null, p_cover_url: i.coverUrl || null,
    p_live_starts_at: i.kind === "live" ? localInputToIso(i.liveStartsAt ?? "") : null, p_live_minutes: i.kind === "live" ? i.liveMinutes ?? null : null
  });
  return { data: (r.data ?? null) as { id: string } | null, error: r.error };
}
export function deletePromoPost(client: SupabaseClient, id: string) { return client.rpc("delete_promo_post", { p_id: id }); }
export async function myPromoPosts(client: SupabaseClient) {
  const r = await client.rpc("my_promo_posts");
  return { data: ((r.data ?? []) as MyPromoPost[]).map(p => ({ ...p, views: num(p.views) })), error: r.error };
}
export function submitPromoBoost(client: SupabaseClient, postId: string, i: { method: PaymentMethodPlan; reference?: string; proofPath?: string | null }) {
  if (!i.reference?.trim() && !i.proofPath) return Promise.resolve({ data: null, error: new Error("Escreva a referência do pagamento ou junte o comprovativo.") });
  return client.rpc("submit_promo_boost", { p_post_id: postId, p_method: i.method, p_reference: i.reference?.trim() || null, p_proof_path: i.proofPath || null });
}
export async function listPromoBoostsForAdmin(client: SupabaseClient, status: "pending" | "confirmed" | "rejected" | "" = "pending") {
  const r = await client.rpc("admin_list_promo_boosts", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminPromoBoost[]).map(b => ({ ...b, amount: num(b.amount) })), error: r.error };
}
export function decidePromoBoost(client: SupabaseClient, id: string, confirm: boolean, note?: string) {
  if (!confirm && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo.") });
  return client.rpc("admin_decide_promo_boost", { p_boost_id: id, p_confirm: confirm, p_note: note?.trim() || null });
}
export async function listPromoPostsForAdmin(client: SupabaseClient, status: "published" | "hidden" | "" = "") {
  const r = await client.rpc("admin_list_promo_posts", { p_status: status || null });
  return { data: ((r.data ?? []) as AdminPromoPost[]).map(p => ({ ...p, reports: num(p.reports), views: num(p.views) })), error: r.error };
}
export function setPromoHidden(client: SupabaseClient, id: string, hidden: boolean, reason?: string) {
  if (hidden && !reason?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (o dono vai ler).") });
  return client.rpc("admin_set_promo_hidden", { p_id: id, p_hidden: hidden, p_reason: reason?.trim() || null });
}
