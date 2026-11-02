/**
 * «Fundo branco»: tira o fundo de uma fotografia de produto e põe um fundo branco (ou o fundo claro da
 * Huambo Online). Corre na função Python /api/fundo do Site, com o modelo «silueta» do rembg (U²-Net,
 * código aberto): não há custo por fotografia. Limite por pessoa e por dia (consume_ai('bg_remove')).
 */
export const BG_REMOVE_LIMIT = 40;
export type PhotoBackgroundStyle = "branco" | "marca";
export const PHOTO_BACKGROUND_STYLES: { value: PhotoBackgroundStyle; label: string }[] = [
  { value: "branco", label: "Fundo branco" },
  { value: "marca", label: "Fundo Huambo Online" }
];

export type PhotoBackgroundError = "AUTH_REQUIRED" | "ACCOUNT_SUSPENDED" | "AI_LIMIT" | "INVALID_IMAGE" | "TOO_LARGE" | "NO_OBJECT"
  | "NOT_CONFIGURED" | "SERVER_ERROR" | "NETWORK";
const MESSAGES: Record<PhotoBackgroundError, string> = {
  AUTH_REQUIRED: "Inicie sessão para pôr o fundo branco nas fotografias.",
  ACCOUNT_SUSPENDED: "A sua conta está suspensa. Contacte a administração.",
  AI_LIMIT: "Já tratou as 40 fotografias permitidas hoje. Volte amanhã.",
  INVALID_IMAGE: "Não foi possível ler a fotografia. Tente outra.",
  TOO_LARGE: "A fotografia é grande demais (máximo 8 MB).",
  NO_OBJECT: "Não encontrámos um artigo nesta fotografia. Tire-a mais perto, com o artigo ao centro.",
  NOT_CONFIGURED: "O fundo branco ainda não está ativo. Tente mais tarde.",
  SERVER_ERROR: "Não conseguimos tratar a fotografia agora. Tente de novo.",
  NETWORK: "Sem ligação à internet. Verifique os dados móveis ou o Wi-Fi."
};

/** Mensagem (em português; passa por tc() para as outras línguas). */
export function photoBackgroundMessage(code: string | null | undefined): string {
  return MESSAGES[code as PhotoBackgroundError] ?? MESSAGES.SERVER_ERROR;
}

/** Endereço da função no Site (a APP usa o endereço público do Site). */
export function photoBackgroundUrl(siteUrl: string, style: PhotoBackgroundStyle = "branco"): string {
  return `${siteUrl.replace(/\/+$/, "")}/api/fundo?estilo=${style === "marca" ? "marca" : "branco"}`;
}

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: any }) => Promise<{
  ok: boolean; status: number; headers: { get(name: string): string | null }; json(): Promise<any>; blob(): Promise<Blob>;
}>;
type Result<T> = { data: T | null; error: PhotoBackgroundError | null };

async function errorOf(r: { status: number; json(): Promise<any> }): Promise<PhotoBackgroundError> {
  let code = "";
  try { code = (await r.json())?.error ?? ""; } catch { /* resposta sem JSON */ }
  if (code in MESSAGES) return code as PhotoBackgroundError;
  if (r.status === 401) return "AUTH_REQUIRED";
  if (r.status === 429) return "AI_LIMIT";
  if (r.status === 413) return "TOO_LARGE";
  return "SERVER_ERROR";
}

/** Site: envia a fotografia tal como está e recebe a nova em JPG. */
export async function removePhotoBackground(fetchFn: FetchFn, opts: { siteUrl: string; token: string | null | undefined; image: Blob; style?: PhotoBackgroundStyle }): Promise<Result<{ image: Blob; remaining: number }>> {
  if (!opts.token) return { data: null, error: "AUTH_REQUIRED" };
  if (opts.image.size > 8 * 1024 * 1024) return { data: null, error: "TOO_LARGE" };
  try {
    const r = await fetchFn(photoBackgroundUrl(opts.siteUrl, opts.style), {
      method: "POST", headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": opts.image.type || "image/jpeg" }, body: opts.image
    });
    if (!r.ok) return { data: null, error: await errorOf(r) };
    return { data: { image: await r.blob(), remaining: Number(r.headers.get("X-Remaining") ?? 0) }, error: null };
  } catch { return { data: null, error: "NETWORK" }; }
}

/** APP: envia a fotografia em base64 e recebe a nova em base64 (JPG). */
export async function removePhotoBackgroundBase64(fetchFn: FetchFn, opts: { siteUrl: string; token: string | null | undefined; base64: string; style?: PhotoBackgroundStyle }): Promise<Result<{ base64: string; remaining: number }>> {
  if (!opts.token) return { data: null, error: "AUTH_REQUIRED" };
  if (!opts.base64) return { data: null, error: "INVALID_IMAGE" };
  if (opts.base64.length * 0.75 > 8 * 1024 * 1024) return { data: null, error: "TOO_LARGE" };
  try {
    const style = opts.style === "marca" ? "marca" : "branco";
    const r = await fetchFn(photoBackgroundUrl(opts.siteUrl, style), {
      method: "POST", headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image: opts.base64, estilo: style })
    });
    if (!r.ok) return { data: null, error: await errorOf(r) };
    const j = await r.json();
    if (!j?.image) return { data: null, error: "SERVER_ERROR" };
    return { data: { base64: String(j.image), remaining: Number(j.remaining ?? 0) }, error: null };
  } catch { return { data: null, error: "NETWORK" }; }
}
