import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "./i18n";

/**
 * Mensagens diretas com bloqueio de contactos: a base de dados não entrega mensagens com telefones,
 * e-mails, WhatsApp, @, ligações, IBAN ou contas, e a IA revê as suspeitas. À 3.ª tentativa em 7 dias,
 * 24 horas sem poder enviar mensagens. Aqui: o que a equipa vê e faz.
 */
export type ChatSuspension = { user_id: string; name: string; until: string; strikes: number; last_reason: string | null; last_excerpt: string | null };
export async function listChatSuspensions(client: SupabaseClient) {
  const r = await client.rpc("admin_list_chat_suspensions");
  return { data: (r.data ?? []) as ChatSuspension[], error: r.error };
}
export const liftChatSuspension = (client: SupabaseClient, userId: string) => client.rpc("admin_lift_chat_suspension", { p_user: userId });

/** Chave do texto do motivo («cg.r.phone», …); os motivos da IA começam por «ai_». */
export function chatBlockReasonKey(reason: string | null | undefined): string {
  const r = (reason ?? "").replace(/^ai_/, "");
  return "cg.r." + (["phone", "email", "link", "app", "handle", "bank", "number", "split", "social", "offplatform"].includes(r) ? r : "other");
}

export const CHAT_GUARD_DICT: Dictionary = {
  "cg.title": { pt: "🚫 Suspensos das mensagens (24 h)", en: "🚫 Suspended from messages (24 h)", zh: "🚫 被暂停发送消息（24 小时）", fr: "🚫 Suspendus des messages (24 h)" },
  "cg.none": { pt: "Ninguém suspenso.", en: "No one is suspended.", zh: "没有被暂停的用户。", fr: "Personne n'est suspendu." },
  "cg.until": { pt: "até {d}", en: "until {d}", zh: "直至 {d}", fr: "jusqu'au {d}" },
  "cg.strikes": { pt: "{n} tentativas", en: "{n} attempts", zh: "{n} 次尝试", fr: "{n} tentatives" },
  "cg.lift": { pt: "Levantar suspensão", en: "Lift suspension", zh: "解除暂停", fr: "Lever la suspension" },
  "cg.by_ai": { pt: "(detetado pela IA)", en: "(detected by AI)", zh: "（由 AI 检测）", fr: "(détecté par l'IA)" },
  "cg.r.phone": { pt: "telefone", en: "phone number", zh: "电话", fr: "téléphone" },
  "cg.r.email": { pt: "e-mail", en: "e-mail", zh: "电子邮件", fr: "e-mail" },
  "cg.r.link": { pt: "ligação", en: "link", zh: "链接", fr: "lien" },
  "cg.r.app": { pt: "WhatsApp/Telegram", en: "WhatsApp/Telegram", zh: "WhatsApp/Telegram", fr: "WhatsApp/Telegram" },
  "cg.r.handle": { pt: "@utilizador", en: "@username", zh: "@用户名", fr: "@utilisateur" },
  "cg.r.social": { pt: "rede social", en: "social media", zh: "社交网络", fr: "réseau social" },
  "cg.r.bank": { pt: "dados bancários", en: "bank details", zh: "银行信息", fr: "données bancaires" },
  "cg.r.number": { pt: "número de conta", en: "account number", zh: "账号", fr: "numéro de compte" },
  "cg.r.split": { pt: "telefone partido em várias mensagens", en: "phone number split across messages", zh: "分成多条消息的电话", fr: "téléphone découpé en plusieurs messages" },
  "cg.r.offplatform": { pt: "pagamento fora da plataforma", en: "payment outside the platform", zh: "平台外付款", fr: "paiement hors plateforme" },
  "cg.r.other": { pt: "contacto", en: "contact details", zh: "联系方式", fr: "coordonnées" }
};
