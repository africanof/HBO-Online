import type { CoreRow } from "./i18n-core-errors";

/**
 * Textos do core com partes variáveis (números, datas, preços, nomes). $1, $2… são as partes apanhadas,
 * que também passam por tc() (ex.: «há 3 h» dentro de «atualizado há 3 h»).
 * A ordem conta: os casos específicos primeiro; no fim, as regras gerais (« · » e emoji no início).
 */
export type CorePattern = { re: RegExp; en: string; zh: string };

const D = "(segundas|terças|quartas|quintas|sextas|sábados|domingos)";
const WD = "(dom|seg|ter|qua|qui|sex|sáb)";
const WDD = "(dom\\.|seg\\.|ter\\.|qua\\.|qui\\.|sex\\.|sáb\\.)";
const MON = "(jan\\.|fev\\.|mar\\.|abr\\.|mai\\.|jun\\.|jul\\.|ago\\.|set\\.|out\\.|nov\\.|dez\\.)";
const NUM = "(\\d[\\d ]*(?:,\\d+)?)";
const MONEY = "(\\d[\\d ]*(?:,\\d+)? (?:Kz|[A-Z]{3}))";
const p = (re: string, en: string, zh: string, flags = ""): CorePattern => ({ re: new RegExp(re, flags), en, zh });

export const CORE_PATTERNS_LIST: CorePattern[] = [
  // --- Tempo («há 3 h», «faltam 2 dias», contagem do leilão) ---
  p("^há (\\d+) min$", "$1 min ago", "$1分钟前"),
  p("^há (\\d+) h$", "$1 h ago", "$1小时前"),
  p("^há (\\d+) dias$", "$1 days ago", "$1天前"),
  p("^guardado há (\\d+) min$", "saved $1 min ago", "$1分钟前已保存"),
  p("^guardado há (\\d+) h$", "saved $1 h ago", "$1小时前已保存"),
  p("^guardado há (\\d+) dia\\(s\\)$", "saved $1 day(s) ago", "$1天前已保存"),
  p("^atualizado (.+)$", "updated $1", "更新于$1"),
  p("^faltam (\\d+) horas$", "$1 hours left", "还剩$1小时"),
  p("^faltam (\\d+) dias$", "$1 days left", "还剩$1天"),
  p("^(\\d+) d (\\d+) h$", "$1 d $2 h", "$1天$2小时"),
  p("^(\\d+) h (\\d+) min$", "$1 h $2 min", "$1小时$2分钟"),
  p("^(\\d+) min$", "$1 min", "$1分钟"),
  p("^(\\d+) meses$", "$1 months", "$1个月"),
  p("^(\\d+) dias$", "$1 days", "$1天"),
  p("^(\\d+) dias grátis$", "$1 free days", "$1天免费"),
  p("^às (\\d\\d:\\d\\d)$", "at $1", "$1"),
  p("^ontem às (\\d\\d:\\d\\d)$", "yesterday at $1", "昨天$1"),
  p("^📡 Sem internet — a mostrar o que foi guardado (.+)\\.$", "📡 No internet — showing what was saved $1.", "📡 无网络——正在显示$1保存的内容。"),

  // --- Datas («sáb, 18/10/2026», «qua. 15/10», «Membro desde out. 2026») ---
  p(`^${WD}, (\\d\\d/\\d\\d/\\d{4})$`, "$1, $2", "$2（$1）"),
  p(`^${WDD} (\\d\\d/\\d\\d)$`, "$1 $2", "$1 $2"),
  p(`^Membro desde ${MON} (\\d{4})$`, "Member since $1 $2", "$2年$1加入"),
  p("^Para (\\d\\d/\\d\\d/\\d{4})$", "For $1", "预约日期：$1"),
  p("^Pode reclamar até (\\d\\d/\\d\\d/\\d{4})\\.$", "You can make a claim until $1.", "可在$1之前投诉。"),
  p("^Visitado pela administração em (\\S+)$", "Visited by the administration on $1", "管理员于$1实地核查"),
  p("^válido até (\\S+)$", "valid until $1", "有效期至$1"),

  // --- Preços e quantidades ---
  p(`^até ${MONEY}$`, "up to $1", "最高$1"),
  p("^até (.+)$", "until $1", "截至$1"),
  p("^a partir de (.+)$", "from $1", "$1起"),
  p("^Desde (.+)$", "From $1", "$1起"),
  p(`^${MONEY} / (.+)$`, "$1 / $2", "$1 / $2"),
  p("^Vendido por (.+)$", "Sold for $1", "售价$1"),
  p("^(.+) \\+ (troca por .+)$", "$1 + $2", "$1 + $2"),
  p("^troca por (.+)$", "swap for $1", "交换：$1"),
  p("^(\\d+(?:,\\d+)?) (botija|botijas)$", "$1 $2", "$1$2"),
  p("^(\\d+) (noite|noites)$", "$1 $2", "$1$2"),
  p("^(\\d+) (pessoa|pessoas)$", "$1 $2", "$1$2"),
  p(`^${NUM} (.+) disponíve(?:l|is)$`, "$1 $2 available", "可供$1$2"),
  p("^Disponível a partir de (.+)$", "Available from $1", "$1起有货"),
  p(`^${NUM} seguidores$`, "$1 followers", "$1位关注者"),
  p(`^${NUM} visualizações$`, "$1 views", "$1次观看"),
  p("^(\\d+) (avaliação|avaliações)$", "$1 $2", "$1$2"),
  p("^(\\d+) (anúncio|anúncios|produto|produtos|loja|lojas)$", "$1 $2", "$1个$2"),
  p("^(\\d+) (mensagem|mensagens|chamada|chamadas|proposta|propostas|encomenda ou pedido|encomendas e pedidos|partilha|partilhas)$", "$1 $2", "$1$2"),
  p("^(\\d+) WhatsApp$", "$1 WhatsApp", "$1次 WhatsApp"),

  // --- Reservas (venues.ts) ---
  p("^Há (\\d+) quartos livres$", "$1 rooms free", "有$1间空房"),
  p("^Há (.+)$", "$1 available", "有货：$1"),
  p("^(\\d+) quartos livres hoje$", "$1 rooms free today", "今天有$1间空房"),
  p("^Mesa para (\\d+)$", "Table for $1", "$1人餐桌"),
  p("^levantar (.+)$", "collect $1", "自取：$1"),
  p("^(.+ → .+) \\((\\d+ noites?)\\)$", "$1 ($2)", "$1（$2）"),
  p("^O total inclui (\\d+(?:[.,]\\d+)?)% de taxa de serviço do Huambo Online\\. Paga tudo ao estabelecimento \\(no local ou para a conta do estabelecimento\\)\\.$",
    "The total includes a $1% Huambo Online service fee. You pay everything to the venue (on site or to the venue's account).",
    "总价包含 Huambo Online $1% 的服务费。所有款项都付给商家（到店或转入商家账户）。"),
  p("^O total inclui (\\d+(?:[.,]\\d+)?)% de taxa de serviço do Huambo Online\\. Paga tudo ao posto \\(no posto ou para a conta do posto\\)\\.$",
    "The total includes a $1% Huambo Online service fee. You pay everything to the station (at the station or to the station's account).",
    "总价包含 Huambo Online $1% 的服务费。所有款项都付给站点（在站点或转入站点账户）。"),
  p("^Taxa do Huambo Online: (\\S+)% de cada pedido concluído — (\\S+)% já vêm pagos pelo cliente \\(somados ao preço\\) e (\\S+)% saem do seu preço\\. Recebe tudo e entrega os (\\S+)% à plataforma\\.$",
    "Huambo Online fee: $1% of each completed order — $2% is already paid by the customer (added to the price) and $3% comes out of your price. You receive everything and hand the $4% to the platform.",
    "Huambo Online 服务费：每笔已完成订单的$1%——其中$2%已由客户支付（加在价格上），$3%从您的价格中扣除。您收取全部款项后，将$4%交给平台。"),
  p("^Escreva no descritivo da transferência: (.+)$", "Write in the transfer description: $1", "请在转账备注中填写：$1"),
  p("^«(.+)» já não está disponível\\.$", "«$1» is no longer available.", "「$1」已无货。"),
  p("^Indique a quantidade de «(.+)»\\.$", "Enter the quantity of «$1».", "请填写「$1」的数量。"),
  p("^«(.+)»: o mínimo é (.+)\\.$", "«$1»: the minimum is $2.", "「$1」：最低$2。"),
  p("^«(.+)»: só há (.+)\\.$", "«$1»: only $2 left.", "「$1」：仅剩$2。"),

  // --- Combustível (fuel.ts) ---
  p("^(.+) \\(últimas 2 h\\)$", "$1 (last 2 h)", "$1（最近2小时）"),
  p("^(\\d+) (?:pessoa confirmou|pessoas confirmaram) que há$", "$1 confirmed it's available", "$1人确认有货"),
  p("^(\\d+) (?:disse|disseram) que acabou$", "$1 said it ran out", "$1人说已售完"),
  p("^O máximo por pessoa é (.+)\\.$", "The maximum per person is $1.", "每人上限为$1。"),
  p("^Só há (.+) para reservar\\.$", "Only $1 left to reserve.", "仅剩$1可预订。"),

  // --- Eventos (events.ts) ---
  p("^Últimos (\\d+) bilhetes?$", "Last $1 tickets", "最后$1张门票"),
  p("^(\\d+) bilhetes disponíveis$", "$1 tickets available", "剩余$1张门票"),
  p("^Bilhete (\\d+): escreva o nome \\(ex\\.: Normal, VIP\\)\\.$", "Ticket $1: enter the name (e.g. Standard, VIP).", "门票$1：请填写名称（例如：普通、VIP）。"),
  p("^Bilhete (\\d+): preço inválido \\(0 = grátis\\)\\.$", "Ticket $1: invalid price (0 = free).", "门票$1：价格无效（0 = 免费）。"),
  p("^Bilhete (\\d+): indique quantos bilhetes há\\.$", "Ticket $1: enter how many tickets there are.", "门票$1：请填写门票数量。"),

  // --- Devoluções e pagamento protegido ---
  p("^Já passaram mais de (\\d+) dias desde a entrega\\.$", "More than $1 days have passed since delivery.", "距送达已超过$1天。"),
  p("^O valor não pode passar de (.+) Kz\\.$", "The amount can't be more than $1 Kz.", "金额不能超过$1 Kz。"),
  p("^Pode juntar no máximo (\\d+) fotografias\\.$", "You can add up to $1 photos.", "最多可添加$1张照片。"),
  p("^Pode juntar no máximo (\\d+) fotografias por trabalho\\.$", "You can add up to $1 photos per work.", "每件作品最多可添加$1张照片。"),
  p("^O Huambo Online vai devolver o dinheiro para (.+)\\.$", "Huambo Online will return the money to $1.", "Huambo Online 将把款项退至 $1。"),
  p("^Pague (.+) ao Huambo Online \\((.+)\\)\\. Sem pagamento a tempo, a encomenda é cancelada\\.$",
    "Pay $1 to Huambo Online ($2). Without payment in time, the order is cancelled.", "请向 Huambo Online 支付$1（$2）。未按时付款，订单将被取消。"),
  p("^Pague (.+) ao Huambo Online\\. Sem pagamento a tempo, a encomenda é cancelada\\.$",
    "Pay $1 to Huambo Online. Without payment in time, the order is cancelled.", "请向 Huambo Online 支付$1。未按时付款，订单将被取消。"),
  p("^O vendedor diz que entregou\\. Confirme a receção ou peça reembolso \\((.+); depois o pagamento vai para o vendedor\\)\\.$",
    "The seller says it was delivered. Confirm receipt or ask for a refund ($1; after that the payment goes to the seller).",
    "卖家表示已送达。请确认收货或申请退款（$1；之后款项将交给卖家）。"),
  p("^Entregue\\. O dinheiro passa para o seu saldo quando o cliente confirmar, ou sozinho \\((.+)\\) se não houver reclamação\\.$",
    "Delivered. The money moves to your balance when the customer confirms, or automatically ($1) if there's no complaint.",
    "已送达。客户确认后款项将转入您的余额；如无投诉，也会自动转入（$1）。"),
  p("^💰 (.+) passaram para o seu saldo \\(comissão: (.+)\\)\\.$", "💰 $1 moved to your balance (commission: $2).", "💰 $1已转入您的余额（佣金：$2）。"),
  p("^💰 (.+) passaram para o seu saldo\\.$", "💰 $1 moved to your balance.", "💰 $1已转入您的余额。"),
  p("^Só tem (.+) disponíveis\\.$", "You only have $1 available.", "您只有$1可用。"),
  p("^O mínimo para levantar é (.+)\\.$", "The minimum withdrawal is $1.", "最低提现金额为$1。"),
  p(`^${D}-feiras$`, "$1", "$1"),
  p(`^((?:${D}, )*${D}) e ${D}(?:-feiras)?$`, "$1 and $4", "$1和$4"),
  p(`^${D}, (.+)$`, "$1, $2", "$1、$2"),

  // --- Planos (plans.ts) ---
  p("^O período terminou a (\\S+)\\. Pague (.+) Kz por mês para voltar a aparecer aos clientes\\.$",
    "The period ended on $1. Pay $2 Kz per month to be shown to customers again.", "期限已于$1结束。请每月支付$2 Kz以重新向客户显示。"),
  p("^(Grátis|Pago) até (\\S+) \\((.+)\\)\\. Depois: (.+) Kz por mês\\.$", "$1 until $2 ($3). Then: $4 Kz per month.", "$1至$2（$3）。之后：每月$4 Kz。"),
  p("^Conta (\\d+): escreva o nome do banco\\.$", "Account $1: enter the bank name.", "账户$1：请填写银行名称。"),
  p("^Conta (\\d+): o IBAN parece incompleto\\.$", "Account $1: the IBAN looks incomplete.", "账户$1：IBAN 似乎不完整。"),
  p("^Conta (\\d+): escreva o titular\\.$", "Account $1: enter the holder.", "账户$1：请填写持有人。"),
  p("^No máximo (\\d+) contas\\.$", "Up to $1 accounts.", "最多$1个账户。"),

  // --- Conta, agentes, destaques, convites ---
  p("^A palavra-passe deve ter pelo menos (\\d+) caracteres\\.$", "The password must have at least $1 characters.", "密码至少需要$1个字符。"),
  p("^A palavra-passe é fraca\\. Use pelo menos (\\d+) caracteres\\.$", "The password is weak. Use at least $1 characters.", "密码强度太弱。请至少使用$1个字符。"),
  p("^Ganhe (\\S+)% do valor de cada venda dos anúncios que ajudou a pôr\\.$", "Earn $1% of the value of each sale from the listings you helped post.", "您协助发布的信息每成交一笔，可获得成交金额的$1%。"),
  p("^⭐ Destacar por (.+) \\((\\d+) (dia|dias)\\)$", "⭐ Feature for $1 ($2 $3)", "⭐ 推荐$2$3：$1"),
  p("^Ganhe (.+) na sua mensalidade por cada amigo que entrar com o seu convite e pagar a primeira mensalidade \\(profissional, empresa ou loja\\)\\.$",
    "Earn $1 on your monthly fee for every friend who joins with your invite and pays their first monthly fee (professional, business or shop).",
    "每有一位好友通过您的邀请加入并支付首月月费（专业人士、企业或商店），您的月费即可获得$1。"),
  p("^Já fez as (\\d+) pesquisas por fotografia de hoje\\. Volte amanhã ou pesquise por texto\\.$",
    "You've used today's $1 photo searches. Come back tomorrow or search by text.", "您今天的$1次拍照搜索已用完。请明天再来或使用文字搜索。"),
  p("^«Como chegar» pode ter no máximo (\\d+) letras\\.$", "«How to get there» can have at most $1 characters.", "「如何到达」最多$1个字符。"),
  p("^Ponto (\\d+): escreva o nome do lugar\\.$", "Point $1: enter the name of the place.", "地点$1：请填写地点名称。"),
  p("^Ponto (\\d+): o texto é demasiado longo\\.$", "Point $1: the text is too long.", "地点$1：文字太长。"),

  // --- Ficheiros (chat-media.ts, videos.ts, data-saver.ts) ---
  p("^O vídeo tem (\\d+) segundos\\. O máximo é (\\d+) segundos\\.$", "The video is $1 seconds long. The maximum is $2 seconds.", "视频时长$1秒。最长$2秒。"),
  p("^A mensagem de voz pode ter no máximo (.+) minutos\\.$", "The voice message can be at most $1 minutes long.", "语音消息最长$1分钟。"),
  p("^O vídeo tem (\\d+) MB\\. O máximo é 30 MB — grave um vídeo mais curto\\.$", "The video is $1 MB. The maximum is 30 MB — record a shorter video.", "视频大小为$1 MB。最大30 MB——请录制更短的视频。"),
  p("^Poupou cerca de (.+) \\(1 fotografia não carregada\\)\\.$", "You saved about $1 (1 photo not loaded).", "约节省了$1（1张照片未加载）。"),
  p("^Poupou cerca de (.+) \\((\\d+) fotografias não carregadas\\)\\.$", "You saved about $1 ($2 photos not loaded).", "约节省了$1（$2张照片未加载）。"),

  // --- Vídeos e lives (promo.ts) ---
  p("^O (.+) não deixa ver dentro de outros sites: as pessoas vão abrir o (.+)\\.$", "$1 doesn't allow viewing inside other sites: people will open $2.", "$1不允许在其他网站内观看：观众将跳转到$2打开。"),

  // --- Estatísticas (stats.ts) ---
  p("^Últimos (\\d+) dias$", "Last $1 days", "最近$1天"),
  p("^últimos (\\d+) dias$", "last $1 days", "最近$1天"),
  p("^(\\d+) em cada 100 pessoas que viram entraram em contacto\\.$", "$1 in every 100 people who viewed got in touch.", "每100位浏览者中有$1位联系了您。"),
  p("^(\\d+) (item ainda não foi visto|itens ainda não foram vistos) nos (.+)\\. Partilhe no WhatsApp e ponha boas fotos\\.$",
    "$1 $2 in the $3. Share on WhatsApp and add good photos.", "$3内有$1件还没有人看过。请分享到 WhatsApp 并配上好照片。"),
  p("^«(.+)» tem muitas vistas mas nenhum contacto\\. Reveja o preço, as fotos e a descrição\\.$",
    "«$1» has lots of views but no contacts. Check the price, photos and description.", "「$1」浏览量很高但无人联系。请检查价格、照片和描述。"),
  p("^«(.+)» é o seu anúncio mais visto\\. Um «⭐ Destaque» pode trazer ainda mais pessoas\\.$",
    "«$1» is your most viewed listing. A «⭐ Featured» boost can bring even more people.", "「$1」是您浏览量最高的信息。使用「⭐ 推荐」可以吸引更多人。"),

  // --- Fila de avisos (cache.ts: jobQueueText) ---
  p("^Fila atrasada: (\\d+) por enviar \\(há (\\d+) min\\)$", "Queue delayed: $1 waiting to send ($2 min behind)", "队列延迟：$1条待发送（已延迟$2分钟）"),
  p("^(\\d+) avisos a sair$", "$1 notifications going out", "$1条通知正在发送"),
  p("^(\\d+) tratadas na última hora$", "$1 handled in the last hour", "最近一小时处理了$1条"),
  p("^(\\d+) falharam$", "$1 failed", "$1条失败"),

  // --- Registo da administração (trust.ts: auditLabel) ---
  p("^((?:Escondeu|Voltou a mostrar|Alterou|Aprovou a verificação de|Recusou a verificação de) \\S+): (.+ → .*)$", "$1: $2", "$1：$2"),
  p("^(Escondeu|Voltou a mostrar|Alterou|Aprovou a verificação de|Recusou a verificação de) (conta|papel|denúncia|anúncio|estafeta|categoria|produto|empresa|profissional|identidade)$", "$1 $2", "$1$2"),

  // --- Contacto (legal.ts) ---
  p("^Pode contactar-nos pelo e-mail (\\S+)\\.$", "You can contact us by email at $1.", "您可以通过电子邮箱 $1 联系我们。"),

  // --- Regras gerais (no fim) ---
  p("^(.+?) · (.+)$", "$1 · $2", "$1 · $2"),
  p("^([^\\p{L}\\p{N}\\s«(\"']+) (.+)$", "$1 $2", "$1 $2", "u")
];

/** Palavras soltas que só aparecem dentro dos textos com partes variáveis. */
export const CORE_PATTERN_WORD_ROWS: CoreRow[] = [
  ["dia", "day", "天"], ["dias", "days", "天"],
  ["avaliação", "review", "条评价"], ["avaliações", "reviews", "条评价"],
  ["anúncios", "listings", "信息"], ["produtos", "products", "商品"], ["loja", "shop", "商店"], ["lojas", "shops", "商店"],
  ["mensagem", "message", "条消息"], ["mensagens", "messages", "条消息"],
  ["chamada", "call", "次通话"], ["chamadas", "calls", "次通话"],
  ["proposta", "offer", "个报价"], ["propostas", "offers", "个报价"],
  ["encomenda ou pedido", "order or request", "个订单或请求"], ["encomendas e pedidos", "orders and requests", "个订单和请求"],
  ["partilha", "share", "次分享"], ["partilhas", "shares", "次分享"],
  ["item ainda não foi visto", "item hasn't been seen yet", "件还没有人看过"],
  ["itens ainda não foram vistos", "items haven't been seen yet", "件还没有人看过"]
];
