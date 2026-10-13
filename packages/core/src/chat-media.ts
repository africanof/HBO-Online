import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Fotografias, vídeos e mensagens de voz no chat (igual no Site e na APP).
 * Ficam no bucket PRIVADO «chat-media», na pasta «conversa/remetente/…»: só quem está na conversa os vê.
 */
export type ChatAttachmentKind = "image" | "video" | "audio";
export type ChatAttachment = { kind: ChatAttachmentKind; path: string; seconds?: number | null };
export type ChatMessage = {
  id: string; conversation_id: string; sender_id: string; body: string; created_at: string; edited_at?: string | null;
  attachment_kind?: ChatAttachmentKind | null; attachment_path?: string | null; attachment_seconds?: number | null;
};

export const CHAT_MEDIA_BUCKET = "chat-media";
export const CHAT_LIMITS: Record<ChatAttachmentKind, { bytes: number; seconds?: number }> = {
  image: { bytes: 5 * 1024 * 1024 },
  video: { bytes: 30 * 1024 * 1024, seconds: 60 },
  audio: { bytes: 5 * 1024 * 1024, seconds: 180 }
};
export const CHAT_KIND_LABELS: Record<ChatAttachmentKind, string> = { image: "📷 Fotografia", video: "🎬 Vídeo", audio: "🎤 Mensagem de voz" };
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/3gpp": "3gp",
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/m4a": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/3gpp": "3gp", "audio/wav": "wav"
};

/** Tipo de ficheiro sem «;codecs=…» (o gravador do navegador acrescenta isso). */
export function baseMime(type: string | null | undefined): string { return (type ?? "").split(";")[0].trim().toLowerCase(); }
export function chatAttachmentKind(type: string | null | undefined): ChatAttachmentKind | null {
  const t = baseMime(type);
  if (!TYPES[t]) return null;
  return t.startsWith("image/") ? "image" : t.startsWith("video/") ? "video" : "audio";
}
export function chatFileExt(type: string | null | undefined): string { return TYPES[baseMime(type)] ?? "bin"; }

/** «0:07», «1:30». */
export function formatSeconds(s: number | null | undefined): string {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

/** Valida o ficheiro escolhido ou gravado. Devolve a mensagem de erro ou null. */
export function validateChatFile(f: { type?: string | null; size?: number | null; seconds?: number | null }): string | null {
  const kind = chatAttachmentKind(f.type);
  if (!kind) return "Este tipo de ficheiro não pode ser enviado. Envie uma fotografia, um vídeo ou uma mensagem de voz.";
  const lim = CHAT_LIMITS[kind];
  if (f.size != null && f.size > lim.bytes) return kind === "image" ? "A fotografia é grande demais (máximo 5 MB)." : kind === "video" ? "O vídeo é grande demais (máximo 30 MB). Grave um vídeo mais curto." : "A mensagem de voz é grande demais.";
  if (lim.seconds && f.seconds != null && Number.isFinite(f.seconds) && f.seconds > lim.seconds + 0.5)
    return kind === "video" ? `O vídeo tem ${Math.round(f.seconds)} segundos. O máximo é ${lim.seconds} segundos.` : `A mensagem de voz pode ter no máximo ${formatSeconds(lim.seconds)} minutos.`;
  if (kind === "audio" && f.seconds != null && f.seconds < 1) return "A mensagem de voz é curta demais. Carregue e fale um pouco mais.";
  return null;
}

/** Texto curto para listas e avisos: o texto da mensagem ou o tipo do anexo. */
export function messagePreview(m: Pick<ChatMessage, "body" | "attachment_kind" | "attachment_seconds"> | null | undefined): string {
  if (!m) return "";
  const text = (m.body ?? "").trim();
  if (!m.attachment_kind) return text;
  const label = CHAT_KIND_LABELS[m.attachment_kind] + (m.attachment_kind !== "image" && m.attachment_seconds ? ` (${formatSeconds(m.attachment_seconds)})` : "");
  return text ? `${label} · ${text}` : label;
}

function randomId() {
  const c = (globalThis as any).crypto;
  return c?.randomUUID ? c.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
/** Envia o ficheiro para a pasta da conversa e devolve o caminho. */
export async function uploadChatFile(client: SupabaseClient, conversationId: string, senderId: string, file: Blob | ArrayBuffer, type: string, seconds?: number | null) {
  const size = file instanceof ArrayBuffer ? file.byteLength : file.size;
  const bad = validateChatFile({ type, size, seconds });
  if (bad) return { data: null, error: new Error(bad) };
  const path = `${conversationId}/${senderId}/${randomId()}.${chatFileExt(type)}`;
  const r = await client.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, { upsert: false, contentType: baseMime(type) });
  if (r.error) return { data: null, error: r.error };
  return { data: path, error: null };
}
/** Mensagem com anexo (o texto é opcional). */
export async function sendAttachmentMessage(client: SupabaseClient, conversationId: string, senderId: string, a: ChatAttachment, caption = "") {
  return client.from("messages").insert({ conversation_id: conversationId, sender_id: senderId, body: caption.trim(), attachment_kind: a.kind,
    attachment_path: a.path, attachment_seconds: a.seconds != null ? Math.round(a.seconds) : null }).select().single();
}
/** Endereços temporários (1 hora) para mostrar os anexos. */
export async function chatMediaUrls(client: SupabaseClient, paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const r = await client.storage.from(CHAT_MEDIA_BUCKET).createSignedUrls(unique, 3600);
  const out: Record<string, string> = {};
  for (const x of r.data ?? []) if (x.path && x.signedUrl) out[x.path] = x.signedUrl;
  return out;
}
