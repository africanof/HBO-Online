// Ajudantes da ProxyPay (referências Multicaixa / EMIS), sem nada específico do Deno para poderem ser testados.
// Confirmar estes pormenores com a documentação v2 da ProxyPay quando o contrato estiver assinado.

export const PROXYPAY_URLS = { production: "https://api.proxypay.co.ao", sandbox: "https://api.sandbox.proxypay.co.ao" } as const;
export type ProxyPayEnv = keyof typeof PROXYPAY_URLS;

export function proxypayBase(env: string | undefined | null): string {
  return env === "production" ? PROXYPAY_URLS.production : PROXYPAY_URLS.sandbox;
}
export function proxypayHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Token ${apiKey}`, Accept: "application/vnd.proxypay.v2+json", "Content-Type": "application/json" };
}
/** Fim da referência: o prazo da encomenda, mas no máximo 7 dias e no mínimo 1 hora a partir de agora. */
export function referenceEnd(payBy: string | null | undefined, now = Date.now()): Date {
  const t = Date.parse(payBy ?? "");
  const max = now + 7 * 86400000, min = now + 3600000;
  return new Date(Math.min(max, Math.max(min, Number.isFinite(t) ? t : max)));
}
export function referenceBody(amount: number | string, end: Date, orderRef: string) {
  return { amount: Number(amount).toFixed(2), end_datetime: end.toISOString(), custom_fields: { order_number: orderRef, app_description: "Huambo Online" } };
}
/** Número da referência (ProxyPay devolve um número; guardamos como texto de 9 algarismos). */
export function referenceId(raw: unknown): string | null {
  const s = String(raw ?? "").trim().replace(/^"|"$/g, "");
  return /^\d{6,12}$/.test(s) ? s : null;
}
export type PaymentEvent = { id: string; reference: string; amount: number };
/** Lê o aviso de pagamento (campos id, reference_id, amount). */
export function parsePaymentEvent(body: unknown): PaymentEvent | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const id = b.id != null ? String(b.id) : "";
  const reference = referenceId(b.reference_id);
  const amount = Number(b.amount);
  if (!id || !reference || !Number.isFinite(amount) || amount <= 0) return null;
  return { id, reference, amount };
}
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export async function hmacSha256Hex(key: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", k, enc.encode(body)));
}
/** O aviso tem de vir assinado (cabeçalho X-Signature = HMAC-SHA256 do corpo com a chave da API). */
export async function verifySignature(body: string, signature: string | null | undefined, apiKey: string): Promise<boolean> {
  if (!signature || !apiKey) return false;
  const expected = await hmacSha256Hex(apiKey, body);
  const got = signature.trim().toLowerCase();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
