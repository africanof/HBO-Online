import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Segurança (igual no Site e na APP): avisos automáticos de burla nas mensagens, dicas, pontos de encontro
 * seguros (definidos pela administração) e bloquear pessoas.
 */
export type ScamWarning = "advance_payment" | "codes" | "abroad" | "pressure" | "deposit_first";
export type SafeSpot = { name: string; note?: string | null };

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
const RULES: [ScamWarning, RegExp][] = [
  // «manda primeiro o dinheiro», «paga adiantado», «transfere antes»
  ["advance_payment", /\b(paga|pague|pagar|pagamento|manda|mande|mandar|envia|envie|enviar|transfere|transfira|transferir|transferencia|deposita|deposite|depositar|dinheiro|valor)\b.{0,40}\b(primeiro|antes|adiantad[oa]|antecipad[oa]|ja hoje)\b/],
  ["advance_payment", /\b(primeiro|antes)\b.{0,25}\b(paga|pague|pagar|manda|mande|transfere|transfira|deposita|deposite|o dinheiro|o valor)\b/],
  ["deposit_first", /\b(sinal|caucao|reserva|taxa de (envio|entrega|desalfandegamento|transporte|alfandega))\b.{0,40}\b(paga|pague|pagar|manda|mande|transfere|transfira|kz|kwanzas?)\b/],
  // códigos do banco/Multicaixa/SMS
  ["codes", /\b(codigo|pin|otp|senha|palavra[- ]passe|cvv)\b.{0,40}\b(sms|multicaixa|express|banco|cartao|confirmacao|recebeu|chegou|mand|envi|diz|dig)/],
  ["codes", /\b(mand|envi|dig|diz|passa)\w*\b.{0,20}\b(o|me o|-me o)?\s?(codigo|pin|otp)\b/],
  // «estou fora do país», «a transportadora entrega»
  ["abroad", /\b(estou|estamos|vivo|trabalho) (fora do pais|no estrangeiro|em portugal|no brasil|na africa do sul|na namibia|na europa)\b|\btransportadora\b.{0,40}\b(entrega|envia|manda)\b/],
  // pressa
  ["pressure", /\b(so hoje|ultima oportunidade|tem de ser agora|urgente|ja ja|outro comprador)\b.{0,40}\b(paga|pague|pagar|transfere|transfira|manda|mande|dinheiro)\b/]
];
export const SCAM_WARNING_TEXT: Record<ScamWarning, string> = {
  advance_payment: "Pede para pagar antes de ver o artigo. Nunca pague adiantado a quem não conhece: pague na entrega ou use o Pagamento protegido.",
  deposit_first: "Pede um sinal, reserva ou «taxa de envio» antes da entrega. É um truque comum de burla.",
  codes: "Fala de códigos (SMS, PIN, Multicaixa). Nunca dê a ninguém os códigos que recebe por SMS nem o PIN: com eles podem tirar o seu dinheiro.",
  abroad: "Diz estar fora do país ou usar uma «transportadora». Desconfie: prefira ver o artigo e pagar em mão.",
  pressure: "Está a pressionar para pagar depressa. Não tenha pressa: um negócio honesto espera por si."
};
/** Avisos de burla para um texto (sem repetir). */
export function scamWarnings(text: string | null | undefined): ScamWarning[] {
  const t = norm(text ?? "");
  if (t.length < 6) return [];
  const out: ScamWarning[] = [];
  for (const [w, re] of RULES) if (re.test(t) && !out.includes(w)) out.push(w);
  return out;
}
/** Avisos das mensagens da OUTRA pessoa numa conversa. */
export function conversationWarnings(messages: { sender_id: string; body: string | null }[], me: string): ScamWarning[] {
  const out: ScamWarning[] = [];
  for (const m of messages) if (m.sender_id !== me) for (const w of scamWarnings(m.body)) if (!out.includes(w)) out.push(w);
  return out;
}

export const SAFETY_TIPS = [
  "Encontre-se num lugar público e movimentado, de dia. Leve alguém consigo.",
  "Veja e experimente o artigo antes de pagar.",
  "Nunca pague adiantado a quem não conhece. Na Loja, use o Pagamento protegido.",
  "Nunca dê códigos que recebe por SMS, o PIN ou a palavra-passe.",
  "Desconfie de preços muito baixos e de quem tem muita pressa.",
  "Se algo não estiver bem, use «Denunciar» e «Bloquear»."
];
export const DEFAULT_SAFE_SPOTS: SafeSpot[] = [
  { name: "À porta de uma esquadra da Polícia Nacional", note: "Há sempre agentes por perto." },
  { name: "Numa agência bancária ou caixa Multicaixa movimentada", note: "Tem câmaras e seguranças, e dá para levantar dinheiro na hora." },
  { name: "Num supermercado ou centro comercial", note: "Muita gente, luz e câmaras." },
  { name: "Num posto de combustível", note: "Aberto até tarde e com câmaras." }
];
export function validateSafeSpots(list: SafeSpot[]): string | null {
  if (list.length > 20) return "No máximo 20 pontos de encontro.";
  for (const [i, s] of list.entries()) {
    if (s.name.trim().length < 3) return `Ponto ${i + 1}: escreva o nome do lugar.`;
    if (s.name.trim().length > 120 || (s.note ?? "").trim().length > 200) return `Ponto ${i + 1}: o texto é demasiado longo.`;
  }
  return null;
}

// --- Servidor ---------------------------------------------------------------------------------
export async function getSafeSpots(client: SupabaseClient): Promise<SafeSpot[]> {
  const r = await client.from("platform_settings").select("safe_spots").eq("id", 1).maybeSingle();
  const list = (r.data as { safe_spots?: SafeSpot[] } | null)?.safe_spots;
  return Array.isArray(list) && list.length ? list : DEFAULT_SAFE_SPOTS;
}
export function saveSafeSpots(client: SupabaseClient, list: SafeSpot[]) {
  const bad = validateSafeSpots(list);
  if (bad) return Promise.resolve({ data: null, error: new Error(bad) });
  const clean = list.map(s => ({ name: s.name.trim(), note: s.note?.trim() || null }));
  return client.from("platform_settings").update({ safe_spots: clean, updated_at: new Date().toISOString() }).eq("id", 1);
}
/** Bloquear / desbloquear uma pessoa. Devolve true se ficou bloqueada. */
export async function toggleBlock(client: SupabaseClient, userId: string) {
  const r = await client.rpc("toggle_block", { p_user_id: userId });
  return { data: r.error ? null : !!r.data, error: r.error };
}
export async function listMyBlocks(client: SupabaseClient) {
  const r = await client.rpc("my_blocks");
  return { data: (r.data ?? []) as { user_id: string; name: string; created_at: string }[], error: r.error };
}
