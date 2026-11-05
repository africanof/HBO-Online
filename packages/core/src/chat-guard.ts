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

/** Nome público da própria conta: o nome verdadeiro (só a pessoa e a equipa o veem) e a alcunha escolhida. */
export async function getMyPublicName(client: SupabaseClient, userId: string) {
  const r = await client.from("profiles").select("full_name,public_name").eq("id", userId).maybeSingle();
  return { data: (r.data ?? null) as { full_name: string | null; public_name: string | null } | null, error: r.error };
}
/** Grava a alcunha (vazio = volta a «Nome I.»); devolve o nome que os outros passam a ver. */
export const setPublicName = (client: SupabaseClient, name: string) => client.rpc("set_public_name", { p_name: name.trim() });
/** Como os outros veem a pessoa sem alcunha: «Adão Domingos Neto» → «Adão N.» (igual a public.shown_name). */
export function shortPublicName(fullName: string | null | undefined): string {
  const w = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "Utilizador";
  return w.length > 1 ? `${w[0]} ${w[w.length - 1][0].toLocaleUpperCase()}.` : w[0];
}

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
  "pn.title": { pt: "🪪 Nome público", en: "🪪 Public name", zh: "🪪 公开名称", fr: "🪪 Nom public" },
  "pn.text": { pt: "É o nome que os outros utilizadores veem nas mensagens, anúncios e avaliações. O seu nome completo e a sua fotografia só são vistos pela equipa do Huambo Online, para não ser procurado nas redes sociais.", en: "This is the name other users see in messages, listings and reviews. Your full name and photo are only seen by the Huambo Online team, so you cannot be looked up on social media.", zh: "这是其他用户在消息、信息和评价中看到的名称。您的全名和照片只有 Huambo Online 团队可以看到，以免在社交网络上被搜索到。", fr: "C'est le nom que les autres utilisateurs voient dans les messages, annonces et avis. Votre nom complet et votre photo ne sont vus que par l'équipe Huambo Online, pour qu'on ne puisse pas vous chercher sur les réseaux sociaux." },
  "pn.now": { pt: "Os outros veem: {name}", en: "Others see: {name}", zh: "其他人看到：{name}", fr: "Les autres voient : {name}" },
  "pn.label": { pt: "Alcunha (opcional, 3 a 30 letras)", en: "Nickname (optional, 3 to 30 letters)", zh: "昵称（可选，3 至 30 个字符）", fr: "Pseudo (facultatif, 3 à 30 lettres)" },
  "pn.placeholder": { pt: "Ex.: Vendas do Bairro, Tia Rosa", en: "E.g. Neighbourhood Sales, Auntie Rosa", zh: "例如：街区小卖、罗莎阿姨", fr: "Ex. : Ventes du quartier, Tata Rosa" },
  "pn.rules": { pt: "Sem telefones, @, redes sociais nem o seu apelido. A IA também revê o nome.", en: "No phone numbers, @, social media or your surname. AI also reviews the name.", zh: "不得包含电话、@、社交网络或您的姓氏。AI 也会审核该名称。", fr: "Pas de téléphone, de @, de réseaux sociaux ni votre nom de famille. L'IA vérifie aussi le nom." },
  "pn.save": { pt: "Guardar nome público", en: "Save public name", zh: "保存公开名称", fr: "Enregistrer le nom public" },
  "pn.saved": { pt: "Guardado. Os outros passam a ver: {name}", en: "Saved. Others now see: {name}", zh: "已保存。其他人现在看到：{name}", fr: "Enregistré. Les autres voient maintenant : {name}" },
  "cg.ctx.support": { pt: "suporte", en: "support", zh: "客服", fr: "assistance" },
  "sp.short": { pt: "Falar com o suporte", en: "Contact support", zh: "联系客服", fr: "Contacter l'assistance" },
  "sp.title": { pt: "🆘 Falar com o suporte", en: "🆘 Contact support", zh: "🆘 联系客服", fr: "🆘 Contacter l'assistance" },
  "sp.intro": { pt: "O assistente responde-lhe primeiro, a qualquer hora. Se não resolver, carregue em «Falar com um agente» e uma pessoa da equipa continua a conversa nas Mensagens.", en: "The assistant answers first, at any time. If it doesn't solve it, tap «Talk to an agent» and a person from the team continues the conversation in Messages.", zh: "助手会先随时回答您。如果没有解决，请点击「与客服人员交谈」，团队成员会在消息中继续对话。", fr: "L'assistant répond d'abord, à toute heure. S'il ne résout pas le problème, appuyez sur « Parler à un agent » et une personne de l'équipe poursuit la conversation dans Messages." },
  "sp.agent": { pt: "👤 Falar com um agente", en: "👤 Talk to an agent", zh: "👤 与客服人员交谈", fr: "👤 Parler à un agent" },
  "sp.agent_working": { pt: "A abrir a conversa…", en: "Opening the conversation…", zh: "正在打开对话…", fr: "Ouverture de la conversation…" },
  "sp.agent_note": { pt: "Uma pessoa da equipa responde-lhe nas Mensagens. A conversa com o assistente segue junto, não precisa de repetir.", en: "A person from the team replies in Messages. Your conversation with the assistant goes along, so you don't need to repeat it.", zh: "团队成员会在消息中回复您。与助手的对话会一并发送，无需重复。", fr: "Une personne de l'équipe vous répond dans Messages. La conversation avec l'assistant est jointe, inutile de la répéter." },
  "sp.email": { pt: "Também pode escrever para {email}.", en: "You can also write to {email}.", zh: "您也可以写信至 {email}。", fr: "Vous pouvez aussi écrire à {email}." },
  "sp.team_chat": { pt: "Conversa com a equipa de suporte. Aqui pode dar o seu telefone à equipa.", en: "Conversation with the support team. Here you may give your phone number to the team.", zh: "与客服团队的对话。在这里您可以把电话号码告诉团队。", fr: "Conversation avec l'équipe d'assistance. Ici, vous pouvez donner votre téléphone à l'équipe." },
  "cg.ctx.provider": { pt: "profissional", en: "professional", zh: "专业人士", fr: "professionnel" },
  "cg.ctx.service": { pt: "serviço", en: "service", zh: "服务", fr: "service" },
  "cg.ctx.business": { pt: "empresa", en: "business", zh: "企业", fr: "entreprise" },
  "cg.ctx.classified": { pt: "anúncio", en: "listing", zh: "信息", fr: "annonce" },
  "cg.ctx.product": { pt: "produto", en: "product", zh: "商品", fr: "produit" },
  "cg.ctx.order": { pt: "encomenda", en: "order", zh: "订单", fr: "commande" },
  "cg.ctx.general": { pt: "conversa", en: "conversation", zh: "对话", fr: "conversation" },
  "pn.pro_hint": { pt: "Pode escrever o seu nome completo: só a equipa do Huambo Online o vê. Os clientes veem a versão protegida (ex.: «Adão N.») e falam consigo pelas mensagens do Huambo Online.", en: "You can write your full name: only the Huambo Online team sees it. Customers see the protected version (e.g. «Adão N.») and contact you through Huambo Online messages.", zh: "您可以填写全名：只有 Huambo Online 团队能看到。客户看到的是受保护的版本（例如「Adão N.」），并通过 Huambo Online 消息联系您。", fr: "Vous pouvez écrire votre nom complet : seule l'équipe Huambo Online le voit. Les clients voient la version protégée (ex. : « Adão N. ») et vous contactent par les messages Huambo Online." },
  "cg.search": { pt: "Pesquisar conversas", en: "Search conversations", zh: "搜索对话", fr: "Rechercher des conversations" },
  "cg.view_listing": { pt: "Ver anúncio", en: "View listing", zh: "查看信息", fr: "Voir l'annonce" },
  "cg.back": { pt: "Voltar às conversas", en: "Back to conversations", zh: "返回对话列表", fr: "Retour aux conversations" },
  "cg.empty": { pt: "Ainda não tem conversas. Abra um anúncio e carregue em «Enviar mensagem».", en: "You have no conversations yet. Open a listing and tap «Send message».", zh: "您还没有对话。打开一条信息并点击「发送消息」。", fr: "Vous n'avez encore aucune conversation. Ouvrez une annonce et touchez « Envoyer un message »." },
  "cg.say_hi": { pt: "Diga olá 👋", en: "Say hello 👋", zh: "打个招呼 👋", fr: "Dites bonjour 👋" },
  "cg.you_prefix": { pt: "Você: ", en: "You: ", zh: "您：", fr: "Vous : " },
  "cg.send": { pt: "Enviar", en: "Send", zh: "发送", fr: "Envoyer" },
  "cg.safety": { pt: "Segurança", en: "Safety", zh: "安全", fr: "Sécurité" },
  "cg.enter_hint": { pt: "Enter envia · Shift+Enter muda de linha", en: "Enter sends · Shift+Enter for a new line", zh: "Enter 发送 · Shift+Enter 换行", fr: "Entrée envoie · Maj+Entrée pour aller à la ligne" },
  "cg.team": { pt: "Equipa Huambo Online", en: "Huambo Online Team", zh: "Huambo Online 团队", fr: "Équipe Huambo Online" },
  "cg.r.other": { pt: "contacto", en: "contact details", zh: "联系方式", fr: "coordonnées" }
};
