// WhatsApp Cloud API (Meta): enviar texto e confirmar que os pedidos vêm mesmo da Meta.
// Segredos (só nas Edge Functions): WHATSAPP_TOKEN (token permanente de um utilizador do sistema),
// WHATSAPP_APP_SECRET (chave secreta da app Meta) e WHATSAPP_VERIFY_TOKEN (palavra escolhida por nós para o webhook).
// WHATSAPP_GRAPH_VERSION é opcional (por omissão v24.0).

export function graphBase(): string {
  const v = (Deno.env.get("WHATSAPP_GRAPH_VERSION") ?? "v24.0").replace(/[^v0-9.]/g, "");
  return `https://graph.facebook.com/${v || "v24.0"}`;
}

/** Envia uma mensagem de texto. Devolve o id da mensagem na Meta, ou o erro. */
export async function sendText(token: string, phoneNumberId: string, to: string, body: string): Promise<{ id: string | null; error: string | null }> {
  try {
    const r = await fetch(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: body.slice(0, 4096) } }),
      signal: AbortSignal.timeout(15_000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { id: null, error: String(data?.error?.message ?? `HTTP ${r.status}`).slice(0, 300) };
    return { id: data?.messages?.[0]?.id ?? null, error: null };
  } catch (e) {
    return { id: null, error: String((e as Error)?.message ?? e).slice(0, 300) };
  }
}

/** Marca a mensagem do cliente como lida (os dois vistos azuis). Falhas são ignoradas. */
export async function markRead(token: string, phoneNumberId: string, messageId: string): Promise<void> {
  try {
    await fetch(`${graphBase()}/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
      signal: AbortSignal.timeout(8_000)
    });
  } catch { /* não é importante */ }
}

/** Confirma a assinatura X-Hub-Signature-256 (HMAC-SHA256 do corpo com a chave secreta da app). */
export async function verifySignature(raw: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(sig, b => b.toString(16).padStart(2, "0")).join("");
  const given = header.slice(7).toLowerCase();
  if (given.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
