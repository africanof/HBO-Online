import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "./i18n";

/**
 * WhatsApp da equipa (API oficial da Meta): vários números, a IA responde primeiro e passa à equipa quando é
 * preciso. A equipa vê e responde na administração (separador «WhatsApp»). Textos: WHATSAPP_DICT («wa.*»).
 */
export type WhatsappArea = "support" | "imports" | "inspections" | "sales" | "other";
export const WHATSAPP_AREAS: WhatsappArea[] = ["support", "imports", "inspections", "sales", "other"];
export type WhatsappNumber = { id: string; phone_number_id: string; display_phone: string | null; label: string; area: WhatsappArea;
  ai_enabled: boolean; ai_instructions: string | null; active: boolean; sort: number };
export type WhatsappThread = { id: string; number_id: string; wa_id: string; contact_name: string | null; user_id: string | null;
  status: "ai" | "human" | "closed"; last_message_at: string; last_inbound_at: string | null; unread: number;
  number_label: string; number_area: WhatsappArea; display_phone: string | null; account_name: string | null; last_body: string | null; window_open: boolean };
export type WhatsappMessage = { id: string; thread_id: string; direction: "in" | "out"; author: "customer" | "ai" | "team" | "system";
  body: string | null; media_type: string | null; status: string | null; error: string | null; created_at: string };

export async function listWhatsappNumbers(client: SupabaseClient) {
  const r = await client.from("whatsapp_numbers").select("*").order("sort").order("label");
  return { data: (r.data ?? []) as WhatsappNumber[], error: r.error };
}
export function saveWhatsappNumber(client: SupabaseClient, n: Partial<WhatsappNumber> & { phone_number_id: string; label: string }) {
  return client.rpc("admin_save_whatsapp_number", { p_id: n.id ?? null, p_phone_number_id: n.phone_number_id.replace(/\D/g, ""), p_display_phone: n.display_phone ?? null,
    p_label: n.label, p_area: n.area ?? "support", p_ai_enabled: n.ai_enabled ?? true, p_ai_instructions: n.ai_instructions ?? null, p_active: n.active ?? true, p_sort: n.sort ?? 100 });
}
export async function listWhatsappThreads(client: SupabaseClient, onlyWaiting = false, numberId: string | null = null) {
  const r = await client.rpc("admin_list_whatsapp_threads", { p_only_waiting: onlyWaiting, p_number: numberId, p_limit: 150 });
  return { data: (r.data ?? []) as WhatsappThread[], error: r.error };
}
export async function whatsappMessages(client: SupabaseClient, threadId: string) {
  const r = await client.rpc("admin_whatsapp_messages", { p_thread: threadId });
  return { data: (r.data ?? []) as WhatsappMessage[], error: r.error };
}
export const setWhatsappThreadStatus = (client: SupabaseClient, threadId: string, status: "ai" | "human" | "closed") =>
  client.rpc("admin_whatsapp_set_status", { p_thread: threadId, p_status: status });
export async function whatsappWaitingCount(client: SupabaseClient): Promise<number> {
  const r = await client.rpc("whatsapp_waiting_count");
  return Number(r.data ?? 0);
}
/** Equipa: responder no WhatsApp. Devolve um código de erro («WHATSAPP_WINDOW_CLOSED», …) ou null. */
export async function sendWhatsappReply(client: SupabaseClient, threadId: string, text: string): Promise<string | null> {
  try {
    const r = await client.functions.invoke("whatsapp-send", { body: { thread_id: threadId, text } });
    if (!r.error) return null;
    const ctx = (r.error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") { try { return (await ctx.json())?.error ?? "WHATSAPP_SEND_FAILED"; } catch { /* sem JSON */ } }
    return "WHATSAPP_SEND_FAILED";
  } catch { return "NETWORK"; }
}
/** Número em formato legível: 244923456789 → +244 923 456 789. */
export function formatWaId(waId: string): string {
  const d = waId.replace(/\D/g, "");
  return d.startsWith("244") && d.length === 12 ? `+244 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : "+" + d;
}

export const WHATSAPP_DICT: Dictionary = {
  "ad.tab.whatsapp": { pt: "💬 WhatsApp", en: "💬 WhatsApp", zh: "💬 WhatsApp", fr: "💬 WhatsApp" },
  "wa.title": { pt: "💬 WhatsApp da equipa", en: "💬 Team WhatsApp", zh: "💬 团队 WhatsApp", fr: "💬 WhatsApp de l'équipe" },
  "wa.intro": { pt: "A IA responde primeiro. As conversas que precisam de uma pessoa aparecem em cima, a laranja. Pode responder durante 24 horas depois da última mensagem do cliente (regra da Meta).", en: "The AI answers first. Conversations that need a person appear at the top, in orange. You can reply for 24 hours after the customer's last message (Meta rule).", zh: "AI 先回复。需要人工处理的对话显示在顶部（橙色）。客户最后一条消息后 24 小时内可以回复（Meta 规则）。", fr: "L'IA répond d'abord. Les conversations qui ont besoin d'une personne apparaissent en haut, en orange. Vous pouvez répondre pendant 24 heures après le dernier message du client (règle de Meta)." },
  "wa.waiting_only": { pt: "Só as que esperam pela equipa", en: "Only those waiting for the team", zh: "只看等待团队的", fr: "Seulement celles qui attendent l'équipe" },
  "wa.all_numbers": { pt: "Todos os números", en: "All numbers", zh: "所有号码", fr: "Tous les numéros" },
  "wa.none": { pt: "Ainda não há conversas.", en: "No conversations yet.", zh: "还没有对话。", fr: "Pas encore de conversations." },
  "wa.st.ai": { pt: "🤖 IA a responder", en: "🤖 AI answering", zh: "🤖 AI 回复中", fr: "🤖 L'IA répond" },
  "wa.st.human": { pt: "🙋 Espera pela equipa", en: "🙋 Waiting for the team", zh: "🙋 等待团队", fr: "🙋 Attend l'équipe" },
  "wa.st.closed": { pt: "✓ Arrumada", en: "✓ Done", zh: "✓ 已处理", fr: "✓ Terminée" },
  "wa.a.customer": { pt: "Cliente", en: "Customer", zh: "客户", fr: "Client" },
  "wa.a.ai": { pt: "🤖 IA", en: "🤖 AI", zh: "🤖 AI", fr: "🤖 IA" },
  "wa.a.team": { pt: "👤 Equipa", en: "👤 Team", zh: "👤 团队", fr: "👤 Équipe" },
  "wa.a.system": { pt: "⚙️ Automático", en: "⚙️ Automatic", zh: "⚙️ 自动", fr: "⚙️ Automatique" },
  "wa.account": { pt: "Conta: {n}", en: "Account: {n}", zh: "账户：{n}", fr: "Compte : {n}" },
  "wa.no_account": { pt: "Sem conta ligada a este número", en: "No account linked to this number", zh: "此号码未关联账户", fr: "Aucun compte lié à ce numéro" },
  "wa.reply_ph": { pt: "Escreva a resposta…", en: "Write the reply…", zh: "输入回复…", fr: "Écrivez la réponse…" },
  "wa.send": { pt: "Enviar no WhatsApp", en: "Send on WhatsApp", zh: "通过 WhatsApp 发送", fr: "Envoyer sur WhatsApp" },
  "wa.window_closed": { pt: "Passaram mais de 24 horas desde a última mensagem do cliente: a Meta não deixa responder até o cliente voltar a escrever.", en: "More than 24 hours have passed since the customer's last message: Meta does not allow replies until the customer writes again.", zh: "距离客户最后一条消息已超过 24 小时：在客户再次发消息前，Meta 不允许回复。", fr: "Plus de 24 heures depuis le dernier message du client : Meta n'autorise pas de réponse tant que le client n'a pas réécrit." },
  "wa.take": { pt: "🙋 Assumir (a IA deixa de responder)", en: "🙋 Take over (the AI stops answering)", zh: "🙋 接管（AI 停止回复）", fr: "🙋 Prendre en charge (l'IA arrête de répondre)" },
  "wa.back_ai": { pt: "🤖 Devolver à IA", en: "🤖 Hand back to the AI", zh: "🤖 交回 AI", fr: "🤖 Rendre à l'IA" },
  "wa.close": { pt: "✓ Arrumar", en: "✓ Mark as done", zh: "✓ 标记为已处理", fr: "✓ Marquer comme terminée" },
  "wa.back": { pt: "← Conversas", en: "← Conversations", zh: "← 对话", fr: "← Conversations" },
  "wa.failed": { pt: "não entregue", en: "not delivered", zh: "未送达", fr: "non remis" },
  "wa.err.WHATSAPP_WINDOW_CLOSED": { pt: "Passaram mais de 24 horas: espere que o cliente volte a escrever.", en: "More than 24 hours have passed: wait for the customer to write again.", zh: "已超过 24 小时：请等待客户再次发消息。", fr: "Plus de 24 heures : attendez que le client réécrive." },
  "wa.err.WHATSAPP_NOT_CONFIGURED": { pt: "O WhatsApp ainda não está ligado (faltam as chaves da Meta no Supabase).", en: "WhatsApp is not connected yet (the Meta keys are missing in Supabase).", zh: "WhatsApp 尚未连接（Supabase 中缺少 Meta 密钥）。", fr: "WhatsApp n'est pas encore connecté (les clés Meta manquent dans Supabase)." },
  "wa.err.WHATSAPP_SEND_FAILED": { pt: "A Meta não aceitou a mensagem. Tente outra vez.", en: "Meta did not accept the message. Try again.", zh: "Meta 未接受该消息。请重试。", fr: "Meta n'a pas accepté le message. Réessayez." },
  "wa.err.ADMIN_ONLY": { pt: "Só a equipa pode responder.", en: "Only the team can reply.", zh: "只有团队可以回复。", fr: "Seule l'équipe peut répondre." },
  "wa.err.NETWORK": { pt: "Sem ligação à internet.", en: "No internet connection.", zh: "没有网络连接。", fr: "Pas de connexion internet." },
  "wa.numbers": { pt: "📱 Números de WhatsApp", en: "📱 WhatsApp numbers", zh: "📱 WhatsApp 号码", fr: "📱 Numéros WhatsApp" },
  "wa.numbers_hint": { pt: "O «Phone number ID» está na app da Meta, em WhatsApp → Configuração da API. Só administradores podem alterar.", en: "The «Phone number ID» is in the Meta app, under WhatsApp → API Setup. Only administrators can change it.", zh: "「Phone number ID」在 Meta 应用的 WhatsApp → API 设置中。只有管理员可以更改。", fr: "Le «Phone number ID» se trouve dans l'app Meta, sous WhatsApp → Configuration de l'API. Seuls les administrateurs peuvent le modifier." },
  "wa.n.label": { pt: "Nome (ex.: Atendimento geral)", en: "Name (e.g. General support)", zh: "名称（例如：一般客服）", fr: "Nom (ex. : Assistance générale)" },
  "wa.n.phone": { pt: "Número visível (ex.: +244 9XX XXX XXX)", en: "Visible number (e.g. +244 9XX XXX XXX)", zh: "显示号码（例如 +244 9XX XXX XXX）", fr: "Numéro visible (ex. : +244 9XX XXX XXX)" },
  "wa.n.id": { pt: "Phone number ID (da Meta)", en: "Phone number ID (from Meta)", zh: "Phone number ID（来自 Meta）", fr: "Phone number ID (de Meta)" },
  "wa.n.area": { pt: "Área", en: "Area", zh: "领域", fr: "Domaine" },
  "wa.n.ai": { pt: "A IA responde primeiro", en: "The AI answers first", zh: "AI 先回复", fr: "L'IA répond d'abord" },
  "wa.n.instructions": { pt: "Instruções para a IA neste número (opcional)", en: "Instructions for the AI on this number (optional)", zh: "此号码的 AI 指令（可选）", fr: "Instructions pour l'IA sur ce numéro (facultatif)" },
  "wa.n.active": { pt: "Ativo", en: "Active", zh: "启用", fr: "Actif" },
  "wa.n.add": { pt: "➕ Adicionar número", en: "➕ Add number", zh: "➕ 添加号码", fr: "➕ Ajouter un numéro" },
  "wa.n.save": { pt: "Guardar", en: "Save", zh: "保存", fr: "Enregistrer" },
  "wa.n.edit": { pt: "✏️ Editar", en: "✏️ Edit", zh: "✏️ 编辑", fr: "✏️ Modifier" },
  "wa.n.cancel": { pt: "Cancelar", en: "Cancel", zh: "取消", fr: "Annuler" },
  "wa.n.saved": { pt: "Guardado.", en: "Saved.", zh: "已保存。", fr: "Enregistré." },
  "wa.area.support": { pt: "Atendimento geral", en: "General support", zh: "一般客服", fr: "Assistance générale" },
  "wa.area.imports": { pt: "Importação", en: "Imports", zh: "进口代购", fr: "Importation" },
  "wa.area.inspections": { pt: "Inspeções e entregas", en: "Inspections and deliveries", zh: "检验和配送", fr: "Inspections et livraisons" },
  "wa.area.sales": { pt: "Vendas e anúncios", en: "Sales and listings", zh: "销售和信息", fr: "Ventes et annonces" },
  "wa.area.other": { pt: "Outro", en: "Other", zh: "其他", fr: "Autre" }
};
