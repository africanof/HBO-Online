import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "./i18n";

/**
 * Perdidos e achados: avisos gratuitos de quem perdeu ou encontrou alguma coisa (documentos, telemóvel,
 * chaves, animais…). Não é uma venda: sem preço nem comissão; quem perdeu pode oferecer uma recompensa.
 * O telefone só se vê com sessão iniciada (lostFoundContact). Textos: LOST_FOUND_DICT (chaves «lf.*»).
 */
export const LOST_FOUND_KINDS = ["lost", "found"] as const;
export type LostFoundKind = typeof LOST_FOUND_KINDS[number];
export const LOST_FOUND_CATEGORIES = ["documentos", "telemovel", "carteira", "chaves", "animal", "veiculo", "mala", "joias", "eletronica", "outro"] as const;
export type LostFoundCategory = typeof LOST_FOUND_CATEGORIES[number];
export const LOST_FOUND_ICONS: Record<LostFoundCategory, string> = {
  documentos: "🪪", telemovel: "📱", carteira: "👛", chaves: "🔑", animal: "🐕", veiculo: "🚗", mala: "🎒", joias: "💍", eletronica: "💻", outro: "📦"
};
export type LostFoundStatus = "open" | "resolved" | "removed" | "expired";

export type LostFoundPost = {
  id: string; ref_no: number; user_id: string; kind: LostFoundKind; category: LostFoundCategory; title: string; description: string | null;
  place: string; municipality: string | null; happened_on: string; photos: string[]; reward: number | null; status: LostFoundStatus;
  resolved_at: string | null; expires_at: string; created_at: string; updated_at: string;
};
export type LostFoundInput = {
  kind: LostFoundKind; category: LostFoundCategory; title: string; description?: string; place: string; municipality?: string | null;
  happenedOn: string; photos?: string[]; reward?: number | null; phone: string;
};

/** Colunas públicas (o telefone fica de fora: só por lostFoundContact). */
export const LOST_FOUND_COLUMNS = "id,ref_no,user_id,kind,category,title,description,place,municipality,happened_on,photos,reward,status,resolved_at,expires_at,created_at,updated_at";
export const lostFoundRef = (n: number) => "PA-" + n;
const normalize = (x: any): LostFoundPost => ({ ...x, reward: x.reward == null ? null : Number(x.reward), photos: Array.isArray(x.photos) ? x.photos : [] });

/** Data de hoje no formato AAAA-MM-DD (no fuso de Angola). */
export function todayIso(now = new Date()): string {
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** «AAAA-MM-DD» → «DD/MM/AAAA». */
export function isoToDmy(iso: string): string { const [y, m, d] = iso.split("-"); return d && m && y ? `${d}/${m}/${y}` : iso; }
/** «DD/MM/AAAA» (ou «D/M/AAAA») → «AAAA-MM-DD»; devolve "" se não for uma data válida. */
export function dmyToIso(text: string): string {
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text.trim());
  if (!m) return "";
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(iso + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : "";
}
/** Dia anterior a «AAAA-MM-DD». */
export function dayBefore(iso: string): string { return new Date(new Date(iso + "T12:00:00Z").getTime() - 86400000).toISOString().slice(0, 10); }

/** Devolve a chave do texto com o problema, ou null. */
export function validateLostFound(i: LostFoundInput, today = todayIso()): string | null {
  if (!LOST_FOUND_KINDS.includes(i.kind)) return "lf.err_kind";
  if (!LOST_FOUND_CATEGORIES.includes(i.category)) return "lf.err_category";
  if (i.title.trim().length < 3) return "lf.err_title";
  if (i.place.trim().length < 3) return "lf.err_place";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.happenedOn) || i.happenedOn > today) return "lf.err_date";
  const yearAgo = String(Number(today.slice(0, 4)) - 1) + today.slice(4);
  if (i.happenedOn < yearAgo) return "lf.err_date";
  if (i.phone.replace(/\D/g, "").length < 9) return "lf.err_phone";
  if ((i.photos?.length ?? 0) > 4) return "lf.err_photos";
  if (i.reward != null && (!Number.isFinite(i.reward) || i.reward <= 0)) return "lf.err_reward";
  return null;
}

export type LostFoundFilter = { kind?: LostFoundKind | ""; category?: LostFoundCategory | ""; query?: string; limit?: number };

/** Avisos abertos, os mais recentes primeiro. */
export async function listLostFound(client: SupabaseClient, f: LostFoundFilter = {}) {
  let q = client.from("lost_found_posts").select(LOST_FOUND_COLUMNS).eq("status", "open").gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(f.limit ?? 60);
  if (f.kind) q = q.eq("kind", f.kind);
  if (f.category) q = q.eq("category", f.category);
  const words = (f.query ?? "").replace(/[%_,()]/g, " ").trim();
  if (words) q = q.or(`title.ilike.%${words}%,place.ilike.%${words}%,description.ilike.%${words}%`);
  const r = await q;
  return { data: ((r.data ?? []) as any[]).map(normalize), error: r.error };
}

export async function getLostFound(client: SupabaseClient, id: string) {
  const r = await client.from("lost_found_posts").select(LOST_FOUND_COLUMNS).eq("id", id).maybeSingle();
  return { data: r.data ? normalize(r.data) : null, error: r.error };
}

/** Os meus avisos (abertos e fechados). */
export async function myLostFound(client: SupabaseClient, userId: string) {
  const r = await client.from("lost_found_posts").select(LOST_FOUND_COLUMNS).eq("user_id", userId).neq("status", "removed").order("created_at", { ascending: false }).limit(50);
  return { data: ((r.data ?? []) as any[]).map(normalize), error: r.error };
}

export async function createLostFound(client: SupabaseClient, i: LostFoundInput) {
  const problem = validateLostFound(i);
  if (problem) return { data: null, error: new Error(problem) };
  const r = await client.rpc("lost_found_create", {
    p_kind: i.kind, p_category: i.category, p_title: i.title.trim(), p_description: i.description?.trim() || null, p_place: i.place.trim(),
    p_municipality: i.municipality || null, p_happened_on: i.happenedOn, p_photos: i.photos ?? [],
    p_reward: i.kind === "lost" && i.reward ? Math.round(i.reward) : null, p_phone: i.phone.trim()
  });
  return { data: r.data ? normalize(r.data) : null, error: r.error };
}

export const resolveLostFound = (client: SupabaseClient, id: string) => client.rpc("lost_found_resolve", { p_id: id });
export const removeLostFound = (client: SupabaseClient, id: string) => client.rpc("lost_found_remove", { p_id: id });
/** Telefone de quem publicou (precisa de sessão iniciada). */
export async function lostFoundContact(client: SupabaseClient, id: string) {
  const r = await client.rpc("lost_found_contact", { p_id: id });
  return { data: typeof r.data === "string" ? r.data : null, error: r.error };
}

/** Mensagem pronta para o WhatsApp de quem publicou. */
export function lostFoundMessage(p: Pick<LostFoundPost, "kind" | "title" | "ref_no">, t: (key: string, vars?: Record<string, string | number>) => string): string {
  return t(p.kind === "lost" ? "lf.msg_lost" : "lf.msg_found", { title: p.title, ref: lostFoundRef(p.ref_no) });
}

export const LOST_FOUND_DICT: Dictionary = {
  "lf.title": { pt: "🧳 Perdidos e achados", en: "🧳 Lost and found", zh: "🧳 失物招领", fr: "🧳 Objets perdus et trouvés" },
  "lf.intro": { pt: "Perdeu ou encontrou alguma coisa no Huambo? Publique um aviso gratuito. Documentos, telemóveis, chaves, animais… quanto mais gente vir, mais depressa volta ao dono.",
    en: "Lost or found something in Huambo? Post a free notice. Documents, phones, keys, pets… the more people see it, the sooner it gets back to its owner.",
    zh: "在万博丢失或捡到了东西？免费发布一条信息。证件、手机、钥匙、宠物……看到的人越多，越快物归原主。",
    fr: "Vous avez perdu ou trouvé quelque chose à Huambo ? Publiez un avis gratuit. Documents, téléphones, clés, animaux… plus il y a de monde qui le voit, plus vite il revient à son propriétaire." },
  "lf.post_lost": { pt: "Perdi uma coisa", en: "I lost something", zh: "我丢了东西", fr: "J'ai perdu quelque chose" },
  "lf.post_found": { pt: "Encontrei uma coisa", en: "I found something", zh: "我捡到了东西", fr: "J'ai trouvé quelque chose" },
  "lf.all": { pt: "Todos", en: "All", zh: "全部", fr: "Tous" },
  "lf.k.lost": { pt: "Perdido", en: "Lost", zh: "丢失", fr: "Perdu" },
  "lf.k.found": { pt: "Achado", en: "Found", zh: "捡到", fr: "Trouvé" },
  "lf.c.documentos": { pt: "Documentos (BI, carta, passaporte)", en: "Documents (ID, licence, passport)", zh: "证件（身份证、驾照、护照）", fr: "Documents (carte d'identité, permis, passeport)" },
  "lf.c.telemovel": { pt: "Telemóvel", en: "Phone", zh: "手机", fr: "Téléphone" },
  "lf.c.carteira": { pt: "Carteira ou dinheiro", en: "Wallet or money", zh: "钱包或现金", fr: "Portefeuille ou argent" },
  "lf.c.chaves": { pt: "Chaves", en: "Keys", zh: "钥匙", fr: "Clés" },
  "lf.c.animal": { pt: "Animal", en: "Pet", zh: "宠物", fr: "Animal" },
  "lf.c.veiculo": { pt: "Viatura ou mota", en: "Car or motorbike", zh: "汽车或摩托车", fr: "Voiture ou moto" },
  "lf.c.mala": { pt: "Mala ou mochila", en: "Bag or backpack", zh: "包或背包", fr: "Sac ou sac à dos" },
  "lf.c.joias": { pt: "Joias e relógios", en: "Jewellery and watches", zh: "首饰和手表", fr: "Bijoux et montres" },
  "lf.c.eletronica": { pt: "Computador e eletrónica", en: "Computer and electronics", zh: "电脑和电子产品", fr: "Ordinateur et électronique" },
  "lf.c.outro": { pt: "Outra coisa", en: "Something else", zh: "其他", fr: "Autre chose" },
  "lf.search_ph": { pt: "Procurar (ex.: BI, Samsung, chaves, Cidade Baixa)", en: "Search (e.g. ID, Samsung, keys, Cidade Baixa)", zh: "搜索（如：身份证、三星、钥匙、Cidade Baixa）", fr: "Rechercher (ex. : carte d'identité, Samsung, clés, Cidade Baixa)" },
  "lf.search": { pt: "Procurar", en: "Search", zh: "搜索", fr: "Rechercher" },
  "lf.empty": { pt: "Ainda não há avisos aqui.", en: "No notices here yet.", zh: "这里还没有信息。", fr: "Aucun avis ici pour l'instant." },
  "lf.lost_on": { pt: "Perdido a {date} · {place}", en: "Lost on {date} · {place}", zh: "{date} 丢失 · {place}", fr: "Perdu le {date} · {place}" },
  "lf.found_on": { pt: "Encontrado a {date} · {place}", en: "Found on {date} · {place}", zh: "{date} 捡到 · {place}", fr: "Trouvé le {date} · {place}" },
  "lf.reward": { pt: "Recompensa: {value}", en: "Reward: {value}", zh: "酬谢：{value}", fr: "Récompense : {value}" },
  "lf.contact": { pt: "Ver o contacto", en: "See the contact", zh: "查看联系方式", fr: "Voir le contact" },
  "lf.call": { pt: "Ligar", en: "Call", zh: "打电话", fr: "Appeler" },
  "lf.whatsapp": { pt: "WhatsApp", en: "WhatsApp", zh: "WhatsApp", fr: "WhatsApp" },
  "lf.login_contact": { pt: "Entre na sua conta para ver o contacto.", en: "Log in to see the contact.", zh: "请登录以查看联系方式。", fr: "Connectez-vous pour voir le contact." },
  "lf.login_post": { pt: "Entre na sua conta para publicar um aviso.", en: "Log in to post a notice.", zh: "请登录以发布信息。", fr: "Connectez-vous pour publier un avis." },
  "lf.safety": { pt: "🛡️ Para devolver ou receber: encontrem-se num sítio movimentado (esquadra, banco, supermercado). Peça uma prova de que é o dono (por exemplo, o que está dentro da carteira ou a cor da capa). Nunca pague antes de ver o objeto.",
    en: "🛡️ To return or collect: meet in a busy place (police station, bank, supermarket). Ask for proof of ownership (for example, what is inside the wallet or the colour of the case). Never pay before seeing the item.",
    zh: "🛡️ 归还或领取时：请在人多的地方见面（警察局、银行、超市）。请对方证明是失主（例如钱包里有什么或手机壳的颜色）。见到物品之前不要付钱。",
    fr: "🛡️ Pour rendre ou récupérer : retrouvez-vous dans un lieu fréquenté (commissariat, banque, supermarché). Demandez une preuve que c'est le propriétaire (par exemple ce qu'il y a dans le portefeuille ou la couleur de la coque). Ne payez jamais avant de voir l'objet." },
  "lf.doc_tip": { pt: "Documentos: não mostre o número nem a fotografia da pessoa. Tape os dados na fotografia; o dono confirma pelo nome.",
    en: "Documents: do not show the number or the person's photo. Cover the details in the photo; the owner confirms by name.",
    zh: "证件：不要展示证件号码或本人照片。请在照片中遮住信息；失主可通过姓名确认。",
    fr: "Documents : ne montrez ni le numéro ni la photo de la personne. Masquez les données sur la photo ; le propriétaire confirme par son nom." },
  "lf.form_title_lost": { pt: "Perdi uma coisa", en: "I lost something", zh: "我丢了东西", fr: "J'ai perdu quelque chose" },
  "lf.form_title_found": { pt: "Encontrei uma coisa", en: "I found something", zh: "我捡到了东西", fr: "J'ai trouvé quelque chose" },
  "lf.f_category": { pt: "O que é", en: "What is it", zh: "物品类别", fr: "De quoi s'agit-il" },
  "lf.f_title": { pt: "Título", en: "Title", zh: "标题", fr: "Titre" },
  "lf.f_title_ph": { pt: "Ex.: BI em nome de João, capa azul", en: "E.g. ID card in the name of João, blue cover", zh: "例如：João 的身份证，蓝色封套", fr: "Ex. : carte d'identité au nom de João, étui bleu" },
  "lf.f_description": { pt: "Mais pormenores (opcional)", en: "More details (optional)", zh: "更多细节（可选）", fr: "Plus de détails (facultatif)" },
  "lf.f_place": { pt: "Onde (bairro, rua, ponto de referência)", en: "Where (neighbourhood, street, landmark)", zh: "地点（街区、街道、参照物）", fr: "Où (quartier, rue, point de repère)" },
  "lf.f_place_ph": { pt: "Ex.: Mercado do Kapango, perto da paragem", en: "E.g. Kapango market, near the bus stop", zh: "例如：Kapango 市场，靠近车站", fr: "Ex. : marché du Kapango, près de l'arrêt" },
  "lf.f_date": { pt: "Quando", en: "When", zh: "时间", fr: "Quand" },
  "lf.f_date_ph": { pt: "DD/MM/AAAA", en: "DD/MM/YYYY", zh: "日/月/年", fr: "JJ/MM/AAAA" },
  "lf.today": { pt: "Hoje", en: "Today", zh: "今天", fr: "Aujourd'hui" },
  "lf.yesterday": { pt: "Ontem", en: "Yesterday", zh: "昨天", fr: "Hier" },
  "lf.camera": { pt: "📷 Fotografar", en: "📷 Take photo", zh: "📷 拍照", fr: "📷 Prendre une photo" },
  "lf.remove_photo": { pt: "Tirar", en: "Remove", zh: "移除", fr: "Retirer" },
  "lf.f_reward": { pt: "Recompensa em Kz (opcional)", en: "Reward in Kz (optional)", zh: "酬谢金额（宽扎，可选）", fr: "Récompense en Kz (facultatif)" },
  "lf.f_phone": { pt: "Telefone para contacto", en: "Contact phone", zh: "联系电话", fr: "Téléphone de contact" },
  "lf.f_phone_note": { pt: "Só quem tem conta no Huambo Online vê o telefone.", en: "Only Huambo Online members can see the phone number.", zh: "只有 Huambo Online 用户能看到电话号码。", fr: "Seuls les membres de Huambo Online voient le numéro." },
  "lf.f_photos": { pt: "Fotografias (até 4)", en: "Photos (up to 4)", zh: "照片（最多 4 张）", fr: "Photos (jusqu'à 4)" },
  "lf.publish": { pt: "Publicar aviso", en: "Post notice", zh: "发布信息", fr: "Publier l'avis" },
  "lf.cancel": { pt: "Cancelar", en: "Cancel", zh: "取消", fr: "Annuler" },
  "lf.published": { pt: "Aviso publicado. Boa sorte!", en: "Notice posted. Good luck!", zh: "信息已发布。祝您好运！", fr: "Avis publié. Bonne chance !" },
  "lf.mine": { pt: "Os meus avisos", en: "My notices", zh: "我的信息", fr: "Mes avis" },
  "lf.resolve_lost": { pt: "Já apareceu", en: "It turned up", zh: "已找回", fr: "Retrouvé" },
  "lf.resolve_found": { pt: "Já foi entregue", en: "Returned to owner", zh: "已归还", fr: "Rendu au propriétaire" },
  "lf.remove": { pt: "Retirar", en: "Remove", zh: "撤下", fr: "Retirer" },
  "lf.confirm_remove": { pt: "Retirar este aviso?", en: "Remove this notice?", zh: "撤下此信息？", fr: "Retirer cet avis ?" },
  "lf.s.open": { pt: "Aberto", en: "Open", zh: "进行中", fr: "Ouvert" },
  "lf.s.resolved": { pt: "Resolvido 🎉", en: "Solved 🎉", zh: "已解决 🎉", fr: "Résolu 🎉" },
  "lf.s.removed": { pt: "Retirado", en: "Removed", zh: "已撤下", fr: "Retiré" },
  "lf.s.expired": { pt: "Fechado (90 dias)", en: "Closed (90 days)", zh: "已关闭（90 天）", fr: "Fermé (90 jours)" },
  "lf.share": { pt: "Partilhar", en: "Share", zh: "分享", fr: "Partager" },
  "lf.msg_lost": { pt: "Olá! Vi o seu aviso no Huambo Online ({ref}): «{title}». Acho que encontrei.", en: "Hello! I saw your notice on Huambo Online ({ref}): \"{title}\". I think I found it.",
    zh: "您好！我在 Huambo Online 上看到您的信息（{ref}）：「{title}」。我想我捡到了。", fr: "Bonjour ! J'ai vu votre avis sur Huambo Online ({ref}) : « {title} ». Je crois l'avoir trouvé." },
  "lf.msg_found": { pt: "Olá! Vi o seu aviso no Huambo Online ({ref}): «{title}». Acho que é meu.", en: "Hello! I saw your notice on Huambo Online ({ref}): \"{title}\". I think it's mine.",
    zh: "您好！我在 Huambo Online 上看到您的信息（{ref}）：「{title}」。我想那是我的。", fr: "Bonjour ! J'ai vu votre avis sur Huambo Online ({ref}) : « {title} ». Je crois que c'est à moi." },
  "lf.err_kind": { pt: "Escolha se perdeu ou encontrou.", en: "Choose whether you lost or found it.", zh: "请选择是丢失还是捡到。", fr: "Choisissez si vous l'avez perdu ou trouvé." },
  "lf.err_category": { pt: "Escolha o que é.", en: "Choose what it is.", zh: "请选择物品类别。", fr: "Choisissez de quoi il s'agit." },
  "lf.err_title": { pt: "Escreva o que perdeu ou encontrou.", en: "Write what you lost or found.", zh: "请写下您丢失或捡到的物品。", fr: "Écrivez ce que vous avez perdu ou trouvé." },
  "lf.err_place": { pt: "Escreva onde foi (bairro, rua ou ponto de referência).", en: "Write where it was (neighbourhood, street or landmark).", zh: "请写下地点（街区、街道或参照物）。", fr: "Écrivez où c'était (quartier, rue ou point de repère)." },
  "lf.err_date": { pt: "A data tem de ser de hoje ou do último ano.", en: "The date must be today or within the last year.", zh: "日期必须是今天或过去一年内。", fr: "La date doit être aujourd'hui ou dans l'année écoulée." },
  "lf.err_phone": { pt: "Indique um telefone válido (9 dígitos).", en: "Enter a valid phone number (9 digits).", zh: "请输入有效的电话号码（9 位数字）。", fr: "Indiquez un numéro valide (9 chiffres)." },
  "lf.err_photos": { pt: "No máximo 4 fotografias.", en: "At most 4 photos.", zh: "最多 4 张照片。", fr: "4 photos au maximum." },
  "lf.err_reward": { pt: "A recompensa tem de ser um valor em Kz.", en: "The reward must be an amount in Kz.", zh: "酬谢必须是以宽扎计的金额。", fr: "La récompense doit être un montant en Kz." }
};
