import type { Dictionary } from "@huambo-online/core";

/** Textos da área «services» (APP). */
export const DICT_SERVICES: Dictionary = {
  // Denúncias, respostas, QR, vídeo
  "sv.report": { pt: "Denunciar", en: "Report", zh: "举报" },
  "sv.report_login": { pt: "Inicie sessão para denunciar.", en: "Sign in to report.", zh: "请登录后再举报。" },
  "sv.report_sent": { pt: "Denúncia enviada. Obrigado — a administração vai analisar.", en: "Report sent. Thank you — the admins will review it.", zh: "举报已提交。谢谢——管理员会进行审核。" },
  "sv.report_why": { pt: "Porque quer denunciar?", en: "Why do you want to report this?", zh: "您为什么要举报？" },
  "sv.report_details_ph": { pt: "Explique o que aconteceu (opcional)", en: "Explain what happened (optional)", zh: "请说明发生了什么（可选）" },
  "sv.report_send": { pt: "Enviar denúncia", en: "Send report", zh: "提交举报" },
  "sv.reply_label": { pt: "Resposta: ", en: "Reply: ", zh: "回复：" },
  "sv.reply_edit": { pt: "Editar resposta", en: "Edit reply", zh: "编辑回复" },
  "sv.reply": { pt: "↩ Responder", en: "↩ Reply", zh: "↩ 回复" },
  "sv.reply_ph": { pt: "Escreva a sua resposta (fica pública)", en: "Write your reply (it will be public)", zh: "写下您的回复（将公开显示）" },
  "sv.reply_publish": { pt: "Publicar resposta", en: "Publish reply", zh: "发布回复" },
  "sv.qr_scan": { pt: "📷 Ler QR do cliente", en: "📷 Scan customer's QR", zh: "📷 扫描客户二维码" },
  "sv.qr_camera_perm": { pt: "Autorize a câmara para ler o QR.", en: "Allow camera access to scan the QR code.", zh: "请允许使用相机以扫描二维码。" },
  "sv.qr_point": { pt: "Aponte a câmara para o QR", en: "Point the camera at the QR code", zh: "将相机对准二维码" },
  "sv.watch": { pt: "Ver: {title}", en: "Watch: {title}", zh: "观看：{title}" },
  "sv.video_gallery_perm": { pt: "Autorize o acesso à galeria para escolher um vídeo.", en: "Allow gallery access to choose a video.", zh: "请允许访问相册以选择视频。" },
  "sv.video_login": { pt: "Inicie sessão para enviar vídeos.", en: "Sign in to upload videos.", zh: "请登录后再上传视频。" },
  "sv.video_upload_fail": { pt: "Falha no envio do vídeo.", en: "Video upload failed.", zh: "视频上传失败。" },
  "sv.video_upload_error": { pt: "Não foi possível enviar o vídeo.", en: "Could not upload the video.", zh: "无法上传视频。" },
  "sv.video_optional": { pt: "🎬 Vídeo (opcional)", en: "🎬 Video (optional)", zh: "🎬 视频（可选）" },
  "sv.video_hint": { pt: "1 vídeo, até {s} segundos e 30 MB. Os vídeos de artigos fechados ou vendidos são apagados automaticamente.", en: "1 video, up to {s} seconds and 30 MB. Videos of closed or sold items are deleted automatically.", zh: "1 个视频，最长 {s} 秒、不超过 30 MB。已关闭或已售出物品的视频会被自动删除。" },
  "sv.video_ready": { pt: "✔ Vídeo pronto", en: "✔ Video ready", zh: "✔ 视频已就绪" },
  "sv.video_remove": { pt: "Remover vídeo", en: "Remove video", zh: "移除视频" },
  "sv.video_uploading": { pt: "A enviar o vídeo…", en: "Uploading video…", zh: "正在上传视频…" },
  "sv.video_choose": { pt: "🎬 Escolher vídeo", en: "🎬 Choose video", zh: "🎬 选择视频" },
  "sv.video_watch": { pt: "Ver vídeo", en: "Watch video", zh: "观看视频" },
  "sv.info_updated": { pt: "Última atualização: {date}", en: "Last updated: {date}", zh: "最后更新：{date}" },
  "sv.link_help": { pt: "Ajuda", en: "Help", zh: "帮助" },
  "sv.link_safety": { pt: "Segurança", en: "Safety", zh: "安全" },
  "sv.link_terms": { pt: "Termos", en: "Terms", zh: "条款" },
  "sv.link_privacy": { pt: "Privacidade", en: "Privacy", zh: "隐私" },
  "sv.link_returns": { pt: "Devoluções", en: "Returns", zh: "退货" },
  "sv.link_delete": { pt: "Apagar conta", en: "Delete account", zh: "删除账户" },
  "sv.home_back": { pt: "← Início", en: "← Home", zh: "← 首页" },
  "sv.contact_email": { pt: "Pode contactar-nos pelo e-mail {email}.", en: "You can contact us by email at {email}.", zh: "您可以通过电子邮件 {email} 联系我们。" },
  "sv.contact_none": { pt: "Pode contactar-nos através da sua conta (Conta → Ajuda) ou denunciando o conteúdo em causa.", en: "You can contact us through your account (Account → Help) or by reporting the content in question.", zh: "您可以通过您的账户（账户 → 帮助）联系我们，或举报相关内容。" },
  // Ajuda e Segurança
  "sv.help_title": { pt: "❓ Ajuda", en: "❓ Help", zh: "❓ 帮助" },
  "sv.help_intro": { pt: "Respostas às perguntas mais comuns. Toque numa pergunta para ver a resposta.", en: "Answers to the most common questions. Tap a question to see the answer.", zh: "常见问题解答。点击问题即可查看答案。" },
  "sv.help_safety_link": { pt: "🛡️ Segurança: pontos de encontro e sinais de burla", en: "🛡️ Safety: meeting points and scam warning signs", zh: "🛡️ 安全：见面地点和诈骗迹象" },
  "sv.help_more": { pt: "Precisa de mais ajuda?", en: "Need more help?", zh: "需要更多帮助？" },
  "sv.help_back": { pt: "← Ajuda", en: "← Help", zh: "← 帮助" },
  "sv.safety_title": { pt: "🛡️ Comprar e vender em segurança", en: "🛡️ Buying and selling safely", zh: "🛡️ 安全买卖" },
  "sv.safety_intro": { pt: "A maior parte das pessoas é honesta. Estas regras simples protegem-no das poucas que não são.", en: "Most people are honest. These simple rules protect you from the few who aren't.", zh: "大多数人是诚实的。这些简单的规则可以保护您免受少数不诚实者的伤害。" },
  "sv.safety_rules": { pt: "✅ Regras de ouro", en: "✅ Golden rules", zh: "✅ 黄金法则" },
  "sv.safety_spots": { pt: "📍 Pontos de encontro seguros", en: "📍 Safe meeting points", zh: "📍 安全见面地点" },
  "sv.safety_spots_text": { pt: "Para ver o artigo e pagar, combine num destes lugares:", en: "To see the item and pay, meet at one of these places:", zh: "查看物品和付款时，请约在以下地点之一：" },
  "sv.safety_scam": { pt: "⚠️ Sinais de burla", en: "⚠️ Scam warning signs", zh: "⚠️ 诈骗迹象" },
  "sv.safety_scam_text": { pt: "Nas mensagens, o Huambo Online avisa-o quando a outra pessoa:", en: "In messages, Huambo Online warns you when the other person:", zh: "在消息中，当对方出现以下情况时，Huambo Online 会提醒您：" },
  "sv.safety_block": { pt: "🚫 Bloquear e 🚩 Denunciar", en: "🚫 Block and 🚩 Report", zh: "🚫 屏蔽和 🚩 举报" },
  "sv.safety_block_text": { pt: "Numa conversa, carregue em «🚫 Bloquear» para deixar de receber mensagens dessa pessoa e em «🚩 Denunciar» para avisar a administração. Na Loja, use o Pagamento protegido quando estiver disponível: o dinheiro só chega ao vendedor depois de receber a encomenda.", en: "In a conversation, tap “🚫 Block” to stop receiving messages from that person and “🚩 Report” to alert the admins. In the Shop, use Protected payment when available: the money only reaches the seller after you receive the order.", zh: "在对话中，点击“🚫 屏蔽”即可不再接收此人的消息，点击“🚩 举报”可通知管理员。在商店中，如有担保付款请使用：您收到订单后，款项才会转给卖方。" },
};

/** Página de informação traduzida; «{contact}» é trocado pela linha de contacto. */
export type LocalInfoPage = { title: string; intro: string; sections: { title: string; paragraphs: string[] }[] };

/** Termos de Uso e Política de Privacidade em inglês e mandarim (o português vem do core). */
export const INFO_PAGES_I18N: Record<string, { en: LocalInfoPage; zh: LocalInfoPage }> = {
  termos: {
    en: {
      title: "Terms of Use",
      intro: "These rules apply to the Huambo Online website and app. By creating an account or using the service, you accept these terms.",
      sections: [
        { title: "1. What Huambo Online is", paragraphs: [
          "A place to buy, sell, trade and rent, find professionals and businesses, and request services in Huambo and across Angola.",
          "Huambo Online connects people. Deals are made between buyer and seller (or client and professional), who are responsible for what they agree."] },
        { title: "2. Your account", paragraphs: [
          "You must be at least 18 years old, or have permission from the person responsible for you.",
          "Your account details must be true. Keep your password safe: everything done in your account is your responsibility.",
          "You can delete your account whenever you want (see “How to delete my account”)."] },
        { title: "3. Listings, products and services", paragraphs: [
          "You may only advertise what is yours or what you are authorised to sell, rent, trade or provide.",
          "The title, price, photos and description must be truthful. State whether the price is fixed, negotiable, open to offers, an auction or a trade.",
          "Conformity guarantee: when you publish, you declare that the listing describes the item truthfully and completely, including defects and anything missing. If something is left out or wrong, whoever bought or rented it is entitled to an exchange, a return with refund, or a refund (full or partial). Claims can be made up to 7 days after the deal, under “Returns and refunds”; the owner replies within 3 days and, if they refuse or do not reply, the admins decide. Anyone who does not comply with the decision may have their account suspended.",
          "It is forbidden to advertise: weapons, drugs, unauthorised medicines, protected animals, stolen or counterfeit goods, documents, sexual content, and anything else prohibited by Angolan law.",
          "The admins may hide or remove listings, products and profiles that break these rules, and suspend accounts."] },
        { title: "4. Offers, auctions, trades and orders", paragraphs: [
          "An accepted offer, a winning bid or a confirmed order is a commitment between the two people. Keep your word.",
          "You can withdraw an offer while it has no answer. A bid can only be withdrawn with a reason, if there are more than 12 hours left in the auction or if it was placed less than 1 hour ago; people who withdraw bids often may be blocked from bidding.",
          "Never pay in advance to someone you don't know. Prefer meeting in a public place, seeing the item and paying on delivery.",
          "For Shop orders, the buyer can request a return, refund or exchange up to 14 days after delivery, and the seller must respond. See “Returns and refunds”."] },
        { title: "5. Monthly fees and commissions", paragraphs: [
          "Professional and business profiles get one free month. After that, they pay a monthly fee to the platform: 2,000 Kz per month for professionals and 5,000 Kz per month for businesses (the current amounts appear under “My plan”).",
          "Payment is made by bank transfer or Multicaixa Express, with the reference or the receipt, and becomes valid once the admins confirm it.",
          "Shops (products sold in the Shop without a business) follow the same rule as businesses: one free month and then 5,000 Kz per month. A business's products are covered by that business's monthly fee.",
          "Without a free month or an up-to-date payment, the profile or Shop stops being shown to customers, but it is not deleted. It reappears when the payment is confirmed.",
          "Classified listings pay no monthly fee: when an item is sold (including auctions), the seller pays the platform a 5% commission on the sale value, within 7 days. The same applies to renting and hiring out movable and immovable property: 5% of the rent stated when marking “Rented”, or of the total value of an accepted hire request. With overdue commissions, you cannot publish new listings.",
          "Featured listings (optional): the seller can pay for the listing to appear at the top of the lists, with the “⭐ Featured” badge, for the stated number of days (500 Kz for 7 days, unless another amount is announced). The feature starts when the admins confirm the payment and ends on its own at the end of the period. It does not guarantee a sale."] },
        { title: "6. Protected payment", paragraphs: [
          "When available, you can choose “Protected payment” for Shop purchases. You pay Huambo Online, which holds the money and only releases it to the seller after the buyer confirms they received the order.",
          "If the buyer neither confirms nor complains within the stated period after delivery (3 days, unless another period is announced), the money is released to the seller. A return or refund request opened in time freezes the money until it is resolved.",
          "Protected orders that are not paid within the stated period (48 hours, unless another period is announced) are cancelled. Refunds of money still being held are made by Huambo Online, to the IBAN or Multicaixa Express number given by the buyer.",
          "The seller receives released sales in their balance and requests a withdrawal to their account. Withdrawals are paid by transfer on the days announced under “My balance”. If there is a commission on protected payment, it is shown before selling and deducted from the balance.",
          "Huambo Online acts only as a technology and payment intermediary: it is not the seller of the products and is not responsible for their quality, but it follows the return rules described in “Returns and refunds”."] },
        { title: "7. Reviews and reports", paragraphs: [
          "Only people who made a deal can leave a review. Reviews must be honest and free of insults.",
          "If you see something wrong, use “Report”. The admins review reports and may remove content."] },
        { title: "8. Profile verification", paragraphs: [
          "The “Verified” badge means the admins have seen a document. It is not a guarantee about the person or the business: keep being careful."] },
        { title: "9. Liability", paragraphs: [
          "Huambo Online does its best to keep the service running and safe, but does not guarantee it will always be available and is not responsible for deals made between users.",
          "These terms may change. When they do, the date at the top is updated."] },
        { title: "10. Contact", paragraphs: ["{contact}"] }
      ]
    },
    zh: {
      title: "使用条款",
      intro: "本规则适用于 Huambo Online 网站和应用。创建账户或使用本服务即表示您接受这些条款。",
      sections: [
        { title: "1. Huambo Online 是什么", paragraphs: [
          "一个在万博（Huambo）及安哥拉各地买卖、交换和租赁物品，寻找专业人士和企业，以及预约服务的平台。",
          "Huambo Online 负责连接人与人。交易在买方与卖方（或客户与专业人士）之间进行，双方对各自约定的内容负责。"] },
        { title: "2. 您的账户", paragraphs: [
          "您必须年满 18 岁，或获得监护人的许可。",
          "账户资料必须真实。请妥善保管您的密码：在您账户中进行的一切操作均由您负责。",
          "您可以随时删除账户（参见“如何删除我的账户”）。"] },
        { title: "3. 信息、商品和服务", paragraphs: [
          "您只能发布属于您的物品，或您有权出售、出租、交换或提供的物品与服务。",
          "标题、价格、照片和描述必须真实。请注明价格是固定、可议价、接受报价、拍卖还是交换。",
          "合规保证：发布时，您声明信息真实、完整地描述了物品，包括缺陷和缺少的部分。如有遗漏或错误，购买或租用的一方有权要求换货、退货退款或（全部或部分）退款。可在交易后 7 天内通过“退货和退款”提出申诉；物主须在 3 天内答复，如拒绝或未答复，由管理员裁决。不执行裁决者的账户可能被暂停。",
          "禁止发布：武器、毒品、未经许可的药品、受保护动物、被盗或假冒商品、证件、色情内容，以及安哥拉法律禁止的一切物品。",
          "管理员可以隐藏或删除违反这些规则的信息、商品和资料，并暂停账户。"] },
        { title: "4. 报价、拍卖、交换和订单", paragraphs: [
          "被接受的报价、中标的出价或已确认的订单是双方之间的承诺。请遵守约定。",
          "在报价尚未得到答复前，您可以撤回报价。出价只有在说明理由，且距拍卖结束超过 12 小时或出价不到 1 小时的情况下才能撤回；经常撤回出价的人可能被禁止参与竞拍。",
          "切勿向不认识的人预先付款。最好在公共场所见面，查看物品后当面付款。",
          "对于商店订单，买方可在收货后 14 天内申请退货、退款或换货，卖方必须答复。参见“退货和退款”。"] },
        { title: "5. 月费和佣金", paragraphs: [
          "专业人士和企业资料可免费使用一个月。之后需向平台支付月费：专业人士每月 2 000 Kz，企业每月 5 000 Kz（现行金额见“我的套餐”）。",
          "付款可通过银行转账或 Multicaixa Express 完成，需附上参考号或凭证，经管理员确认后生效。",
          "商店（不属于企业、在商店中销售的商品）与企业规则相同：免费一个月，之后每月 5 000 Kz。企业的商品包含在该企业的月费中。",
          "如果没有免费月且未按时付款，资料或商店将不再向客户显示，但不会被删除。付款确认后会重新显示。",
          "分类信息无需缴纳月费：物品售出时（包括拍卖），卖方须在 7 天内向平台支付成交金额 5% 的佣金。动产和不动产的出租和租用同样适用：按标记“已出租”时填写的租金，或已接受租用申请的总金额收取 5%。佣金逾期未付时不能发布新信息。",
          "置顶（可选）：卖方可以付费让信息在列表顶部显示，并带有“⭐ 精选”标志，持续所示天数（7 天 500 Kz，另有公告的除外）。置顶在管理员确认付款后开始，到期自动结束。置顶不保证售出。"] },
        { title: "6. 担保付款", paragraphs: [
          "在可用时，您可以在商店购物时选择“担保付款”。您将款项付给 Huambo Online，平台代为保管，买方确认收货后才转给卖方。",
          "如果买方在收货后的规定期限内（3 天，另有公告的除外）既未确认也未投诉，款项将转给卖方。及时提出的退货或退款申请会冻结款项，直至问题解决。",
          "未在规定期限内（48 小时，另有公告的除外）付款的担保订单将被取消。仍由平台保管的款项由 Huambo Online 退还至买方提供的 IBAN 或 Multicaixa Express 号码。",
          "卖方在余额中收到已放款的销售款，并申请提现到自己的账户。提现在“我的余额”中公布的日期通过转账支付。如担保付款收取佣金，会在销售前显示并从余额中扣除。",
          "Huambo Online 仅作为技术和支付中介：它不是商品的卖方，也不对商品质量负责，但会遵守“退货和退款”中所述的退货规则。"] },
        { title: "7. 评价和举报", paragraphs: [
          "只有完成交易的人才能评价。评价必须诚实，不得含有侮辱。",
          "如果发现问题，请使用“举报”。管理员会审核举报，并可能删除相关内容。"] },
        { title: "8. 资料认证", paragraphs: [
          "“已认证”标志表示管理员看过一份证件。这并不是对个人或业务的担保：请继续保持谨慎。"] },
        { title: "9. 责任", paragraphs: [
          "Huambo Online 尽力保持服务正常、安全地运行，但不保证服务始终可用，也不对用户之间的交易负责。",
          "这些条款可能会变更。变更时，顶部的日期会更新。"] },
        { title: "10. 联系方式", paragraphs: ["{contact}"] }
      ]
    }
  },
  privacidade: {
    en: {
      title: "Privacy Policy",
      intro: "We explain what data we keep, what for and who can see it. We follow Angola's Personal Data Protection Law (Law no. 22/11).",
      sections: [
        { title: "1. What data we keep", paragraphs: [
          "Account: name, email, phone (if you give it), profile photo, municipality.",
          "What you publish: listings, products, photos, videos, prices, offers, reviews and replies.",
          "Conversations: the messages you exchange with other people.",
          "Deals: orders, service requests, rentals, deliveries and the history of each.",
          "Verification (only if you request it): the photo of the document (ID card, business licence or tax number).",
          "On your phone: we store the listings you viewed and your last search on the device itself, so you can see them without internet."] },
        { title: "2. What we use the data for", paragraphs: [
          "To make the service work: show listings, connect buyers and sellers, send notifications and messages, calculate reviews and profile figures.",
          "For safety: review reports, verify profiles and prevent abuse.",
          "We do not sell your data to anyone and we do not show advertising based on it."] },
        { title: "3. What is public", paragraphs: [
          "Published listings, products, professional and business profiles, your name, profile photo, reviews and profile figures (sales, services provided).",
          "Your email is not shown. Your phone only appears if you put it in the listing or the profile.",
          "Your WhatsApp number only appears if you choose “Show the Chat on WhatsApp button” in “Your account”, and only to signed-in users. You can hide or delete it whenever you want."] },
        { title: "4. What is private", paragraphs: [
          "Messages, offers, orders and service requests: only the people involved can see them.",
          "Verification documents are kept in a private space: only you and the admins can open them, through a temporary link."] },
        { title: "5. Where the data is kept and who helps us", paragraphs: [
          "The database and files are on Supabase, on servers in the European Union (Ireland).",
          "The website is hosted on Render. The app is built with Expo.",
          "Search by photo (when active): the photo is sent to Claude (Anthropic) to say what the item is, and is not stored by us."] },
        { title: "6. How long we keep it", paragraphs: [
          "For as long as the account exists. Videos of closed or sold listings are deleted automatically after 7 days, and those of hidden products after 30 days.",
          "When you delete your account, your data is deleted. Some of the provider's backups may last a little longer until they are replaced."] },
        { title: "7. Your rights", paragraphs: [
          "You can view and correct your data in “Your account”, and delete listings, products and the account itself whenever you want.",
          "You can ask for information about your data or object to its processing. If you think your rights have not been respected, you can complain to Angola's Data Protection Agency (APD)."] },
        { title: "8. Contact", paragraphs: ["{contact}"] }
      ]
    },
    zh: {
      title: "隐私政策",
      intro: "我们说明保存哪些数据、用途是什么以及谁可以查看。我们遵守安哥拉《个人数据保护法》（第 22/11 号法律）。",
      sections: [
        { title: "1. 我们保存哪些数据", paragraphs: [
          "账户：姓名、电子邮件、电话（如您提供）、头像、所在市镇。",
          "您发布的内容：信息、商品、照片、视频、价格、报价、评价和回复。",
          "对话：您与他人互发的消息。",
          "交易：订单、服务请求、租赁、配送及其各自的记录。",
          "认证（仅在您申请时）：证件照片（身份证、营业执照或税号）。",
          "在手机上：我们在设备本地保存您浏览过的信息和最近一次搜索，以便在没有网络时查看。"] },
        { title: "2. 我们如何使用数据", paragraphs: [
          "为了让服务运作：显示信息、连接买卖双方、发送通知和消息、计算评价和资料数据。",
          "为了安全：审核举报、认证资料和防止滥用。",
          "我们不会把您的数据卖给任何人，也不会根据这些数据投放广告。"] },
        { title: "3. 哪些内容是公开的", paragraphs: [
          "已发布的信息、商品、专业人士和企业资料、您的姓名、头像、评价和资料数据（销量、已提供的服务）。",
          "您的电子邮件不会显示。电话只有在您写入信息或资料时才会显示。",
          "您的 WhatsApp 号码只有在您于“您的账户”中选择“显示‘在 WhatsApp 上聊天’按钮”时才会显示，并且只对已登录的用户可见。您可以随时隐藏或删除它。"] },
        { title: "4. 哪些内容是私密的", paragraphs: [
          "消息、报价、订单和服务请求：只有相关人员可以看到。",
          "认证证件保存在私密空间：只有您本人和管理员可以通过临时链接打开。"] },
        { title: "5. 数据存放在哪里以及谁为我们提供帮助", paragraphs: [
          "数据库和文件存放在 Supabase 上，服务器位于欧盟（爱尔兰）。",
          "网站托管在 Render。应用使用 Expo 开发。",
          "以图搜索（启用时）：照片会发送给 Claude（Anthropic）以识别物品，我们不会保存该照片。"] },
        { title: "6. 我们保存多长时间", paragraphs: [
          "在账户存在期间一直保存。已关闭或已售出信息的视频会在 7 天后自动删除，已隐藏商品的视频在 30 天后删除。",
          "删除账户后，您的数据会被删除。服务商的部分备份可能会多保留一段时间，直到被替换。"] },
        { title: "7. 您的权利", paragraphs: [
          "您可以在“您的账户”中查看和更正您的数据，并可随时删除信息、商品以及账户本身。",
          "您可以要求了解有关您数据的信息，或反对对其进行处理。如果您认为您的权利未受到尊重，可以向安哥拉数据保护局（APD）投诉。"] },
        { title: "8. 联系方式", paragraphs: ["{contact}"] }
      ]
    }
  }
};

/** Perguntas frequentes da Ajuda em inglês e mandarim, pela mesma ordem de HELP_FAQ (core). */
export const HELP_FAQ_I18N: Record<"en" | "zh", { q: string; a: string }[]> = {
  en: [
    { q: "How do I publish a listing?", a: "Tap “Sell” or “Post listing”, choose the type and purpose, say how you want to sell (fixed price, negotiable, offers, auction or trade), add photos and publish." },
    { q: "What do “Fixed price”, “Negotiable” and “Open to offers” mean?", a: "Fixed price: anyone who wants it buys at the stated price (“I want to buy”). Negotiable: the buyer can make a lower offer. Open to offers: the price is only a reference and buyers say how much they will pay." },
    { q: "How do trades work?", a: "Choose “Trade only” or tick “I also accept trades” and say what you accept. Anyone interested offers an item (and can add money). See them all under “Trades”." },
    { q: "How do I make an offer?", a: "On the listing, tap “Make an offer” and enter the amount and/or what you offer in exchange. The seller accepts or declines and gets a notification; follow it under “My offers”." },
    { q: "How do I withdraw an offer?", a: "Under “My offers”, tap “Withdraw offer”. This is only possible while the seller has not replied; once accepted, arrange it with them through messages." },
    { q: "How do auctions work?", a: "Like on eBay: enter the MAXIMUM you are willing to pay. Huambo Online bids for you only as much as needed to stay ahead, up to that maximum, which nobody sees. If someone else offers more than your maximum, you get an alert and can go higher. In case of a tie, whoever bid first wins. The winner pays the final price, which is often lower than their maximum. Some auctions have “Buy now”: you can buy straight away at that price until someone bids. Follow everything under “My bids”; you get an alert when less than 1 hour is left." },
    { q: "How do I cancel a bid in an auction?", a: "On the auction listing, open “See bids” and tap “Withdraw my bid”, choosing the reason. You can do this if there are more than 12 hours to the end, or if the bid was placed less than 1 hour ago. At most 3 times in 30 days. The seller can also cancel a person's bids, explaining why." },
    { q: "What is the listing number (e.g. A-1001)?", a: "Every listing (A-…), product (P-…) and order (E-…) has a short number shown on its page. Use it when talking to the seller or the admins, or type it in search to open the item directly." },
    { q: "How do I show my work (portfolio)?", a: "Professionals: in “Your account” → “Professional profile” → “Portfolio”, tap “Add work”, give it a title and add up to 8 photos. Businesses: in “My businesses” → “Logo and portfolio”. The work appears on your public page under “Completed work”, and you can change the order." },
    { q: "How much does a professional or business profile cost?", a: "The first month is free. After that, professionals pay 2,000 Kz per month and businesses 5,000 Kz per month. Pay in “Your account” → “My plan”, with the reference or the receipt of the transfer or Multicaixa Express. You get reminders 7 days and 1 day before the end. Without payment, the profile stops being shown to customers until you pay." },
    { q: "How much does it cost to sell in the Shop and in listings?", a: "Shop: the first month is free, then 5,000 Kz per month (if the products belong to a business, the business's monthly fee is enough). Listings: publishing is free; when you sell, rent or hire out, you pay a 5% commission on the value within 7 days, in “Your account” → “Commissions”. When you mark “Sold” or “Rented” you enter the amount and see the commission straight away; for a hire request, the commission is on the total accepted value." },
    { q: "How do I feature my listing?", a: "In “My listings”, on the published listing, tap “⭐ Feature”. Pay the stated amount (500 Kz for 7 days) by transfer or Multicaixa Express and enter the reference or attach the receipt. When the admins confirm, the listing appears at the top of the lists with the “⭐ Featured” badge. You can extend it before it ends." },
    { q: "How do I follow a professional, a business or a shop?", a: "On the page of the professional, business or seller, tap “➕ Follow”. You get an alert when they publish a new listing, product or work (at most one alert per hour from each). See who you follow in “Your account” → “Following”; to unfollow, tap “✔ Following”." },
    { q: "How do I sell farm produce (maize, potatoes, livestock…)?", a: "In “Sell”, choose the type “Item” or “Other” and turn on “🌾 Farm produce”. Give the kind (cereals, tubers, livestock…), the unit of sale (kg, 50 kg bag, tonne, head…), the quantity and, if you have not harvested yet, the “available from” date. The price is shown per unit (e.g. 12,000 Kz / 50 kg bag) and the listing goes into the “🌾 Farming” section." },
    { q: "How do I request a service from a professional?", a: "Open the page of the professional or business and use “Request service”. When the service is finished, confirm and review it — the review is marked “Service confirmed”." },
    { q: "How do I review a seller or buyer?", a: "After a completed order, or when the listing is marked as sold to the right person, it appears under “Reviews” for you to rate." },
    { q: "How do I get the “Verified” badge?", a: "In “Your account”, open “Verify profile” and send a photo of your ID card (or the business licence/tax number). The document stays private; the admins reply by notification." },
    { q: "What is “Protected payment”?", a: "For Shop purchases, you can pay Huambo Online instead of paying the seller. We hold the money and the seller only gets it after you confirm you received the order. If there is a problem, request a refund in “Orders”: the money stays frozen until it is resolved. If you neither confirm nor complain a few days after delivery, the payment goes to the seller." },
    { q: "I sell in the Shop: how do I get protected payment money?", a: "Wait for the “Payment received” alert before shipping. After delivering, mark the order as “Delivered”. When the customer confirms (or the period passes without a complaint), the money moves to “Your account” → “My balance”. Enter your IBAN or Multicaixa Express number and tap “Request withdrawal”." },
    { q: "How do I share a listing on WhatsApp?", a: "Open the listing or product and tap “📲 Share on WhatsApp”. The message includes the title, the price, the listing number (e.g. A-1023) and the link, and the photo appears in WhatsApp. Choose the contact or group." },
    { q: "How do I get messages from buyers on WhatsApp?", a: "In “Your account” → “WhatsApp”, enter your number and turn on “Show the Chat on WhatsApp button”. The button appears on your listings and products, only for signed-in users, with a ready message saying which listing it is about." },
    { q: "How does “Invite a friend” work?", a: "In “Account” → “Invite friends” you have your code and your link. Anyone who creates an account with your invitation (within the first 14 days) is linked to you. When that person pays their first monthly fee (professional, business or shop), you get 1 free month on your monthly fee. If you don't have a monthly fee yet, the reward is kept for you." },
    { q: "What is a field agent?", a: "A person from the market (for example, Kapango) who helps sellers put listings on Huambo Online. The listing always stays in the seller's account; when publishing, the seller enters the agent's code (e.g. AG1001). When that listing is sold, the agent earns a percentage of the sale value, which the admins confirm and which goes into the agent's balance. To become an agent, open “Account” → “Become an agent”." },
    { q: "What if the item does not match the listing?", a: "All listings have a conformity guarantee: whoever publishes declares that the description is true and complete, including defects. If the item you bought or rented has a hidden defect or is different, open the listing and tap “The item does not match the listing” (up to 7 days after the deal). You can ask for an exchange, a return and refund, or a refund. If the owner refuses or does not reply within 3 days, the admins decide. For Shop purchases, use “Returns and refunds” on the order." },
    { q: "How do I avoid scams?", a: "Meet in a busy public place (see “Safe meeting points” under “Safety”), see the item and pay on delivery, or use Protected payment in the Shop. Never pay in advance or give out codes you receive by SMS or your PIN. In messages, Huambo Online warns you when someone asks for advance payment or codes. If you are suspicious, use “Block” and “Report”." },
    { q: "How do I request a return or refund?", a: "In “Orders”, choose the order and tap “Request return or refund” (up to 14 days after delivery). Explain the problem and add photos. If the seller refuses or does not reply, you can call in the admins. See “Returns and refunds”." },
    { q: "How do I use less data?", a: "Turn on “📉 Data saver” at the top of the website, on the app's home page or in “Your account”. Photos in lists stop loading (an icon appears) and, in listings, they only load when you tap “See the photos”. Videos only load when you press ▶. On the website, “Automatic” turns on by itself when the phone is in data saver mode." },
    { q: "Can I use it without internet?", a: "You can see the home page, your last search and the last listings you opened. To publish, send messages or offers you need a connection." },
    { q: "How do I delete my account?", a: "In “Your account”, at the bottom of the page, type ELIMINAR and confirm. See the details in “How to delete my account”." }
  ],
  zh: [
    { q: "如何发布信息？", a: "点击“出售”或“发布信息”，选择类型和用途，说明出售方式（固定价格、可议价、接受报价、拍卖或交换），添加照片后发布。" },
    { q: "“固定价格”、“可议价”和“接受报价”是什么意思？", a: "固定价格：想要的人按标价购买（“我要购买”）。可议价：买方可以提出更低的报价。接受报价：价格仅供参考，由买方说出愿意支付的金额。" },
    { q: "交换如何进行？", a: "选择“仅交换”或勾选“也接受交换”，并说明您接受什么。感兴趣的人会提出一件物品（也可以加钱）。在“交换”中查看全部。" },
    { q: "如何提出报价？", a: "在信息页点击“提出报价”，填写金额和/或用于交换的物品。卖方接受或拒绝，并会收到通知；可在“我的报价”中跟进。" },
    { q: "如何撤回报价？", a: "在“我的报价”中点击“撤回报价”。只有在卖方尚未答复时才能撤回；被接受后，请通过消息与卖方协商。" },
    { q: "拍卖如何进行？", a: "和 eBay 一样：输入您愿意支付的最高金额。Huambo Online 会替您自动出价，只出保持领先所需的金额，最高不超过您的上限，而且没有人能看到这个上限。如果别人出价超过您的上限，您会收到提醒并可以加价。出价相同时，先出价者获胜。获胜者支付最终价格，通常低于其上限。部分拍卖有“立即购买”：在有人出价之前，您可以按该价格直接购买。在“我的竞拍”中跟进一切；距结束不到 1 小时时您会收到提醒。" },
    { q: "如何取消拍卖中的出价？", a: "在拍卖信息页打开“查看出价”，点击“撤回我的出价”并选择理由。距结束超过 12 小时，或出价不到 1 小时时可以撤回。30 天内最多 3 次。卖方也可以取消某人的出价，但须说明原因。" },
    { q: "信息编号（例如 A-1001）是什么？", a: "每条信息（A-…）、商品（P-…）和订单（E-…）都有一个显示在页面上的简短编号。与卖方或管理员沟通时可使用该编号，也可以在搜索中输入编号直接打开。" },
    { q: "如何展示我的作品（作品集）？", a: "专业人士：在“您的账户” → “专业资料” → “作品集”中点击“添加作品”，填写标题并添加最多 8 张照片。企业：在“我的企业” → “标志和作品集”中操作。作品会显示在您的公开页面“已完成作品”中，并可调整顺序。" },
    { q: "专业人士或企业资料要多少钱？", a: "第一个月免费。之后专业人士每月 2 000 Kz，企业每月 5 000 Kz。在“您的账户” → “我的套餐”中付款，附上转账或 Multicaixa Express 的参考号或凭证。到期前 7 天和 1 天您会收到提醒。未付款时，资料将不再向客户显示，直到付款为止。" },
    { q: "在商店和信息中销售要多少钱？", a: "商店：第一个月免费，之后每月 5 000 Kz（如果商品属于企业，只需支付企业月费）。信息：发布免费；售出、出租或租出时，需在 7 天内于“您的账户” → “佣金”中支付金额 5% 的佣金。标记“已售出”或“已出租”时填写金额即可看到佣金；租用申请的佣金按已接受的总金额计算。" },
    { q: "如何让我的信息置顶？", a: "在“我的信息”中，对已发布的信息点击“⭐ 置顶”。通过转账或 Multicaixa Express 支付所示金额（7 天 500 Kz），并填写参考号或附上凭证。管理员确认后，信息会以“⭐ 精选”标志显示在列表顶部。到期前可以续期。" },
    { q: "如何关注专业人士、企业或店铺？", a: "在专业人士、企业或卖家的页面上点击“➕ 关注”。对方发布新信息、新商品或新作品时您会收到提醒（每个对象每小时最多一次）。在“您的账户” → “关注中”查看您关注的对象；要取消关注，请点击“✔ 关注中”。" },
    { q: "如何出售农产品（玉米、土豆、牲畜…）？", a: "在“出售”中选择“物品”或“其他”类型，并开启“🌾 农产品”。填写种类（谷物、块茎、牲畜…）、销售单位（公斤、50 公斤袋、吨、头…）、数量，如尚未收获，再填写“可供应日期”。价格按单位显示（例如 12 000 Kz / 50 公斤袋），信息会进入“🌾 农业”栏目。" },
    { q: "如何向专业人士预约服务？", a: "打开专业人士或企业的页面，使用“预约服务”。服务完成后，确认并评价——该评价会标记为“服务已确认”。" },
    { q: "如何评价卖方或买方？", a: "订单完成后，或信息被标记为已售给正确的人时，会出现在“评价”中供您评分。" },
    { q: "如何获得“已认证”标志？", a: "在“您的账户”中打开“认证资料”，发送身份证照片（或企业的营业执照/税号）。证件保持私密；管理员会通过通知答复。" },
    { q: "什么是“担保付款”？", a: "在商店购物时，您可以把钱付给 Huambo Online，而不是直接付给卖方。我们会保管款项，您确认收到订单后卖方才能收到。如有问题，请在“订单”中申请退款：款项会被冻结直至问题解决。如果您在收货后几天内既未确认也未投诉，款项将转给卖方。" },
    { q: "我在商店销售：如何收到担保付款的钱？", a: "收到“已收到付款”提醒后再发货。送达后，将订单标记为“已送达”。客户确认后（或期限届满且无投诉），款项会转入“您的账户” → “我的余额”。填写您的 IBAN 或 Multicaixa Express 号码，然后点击“申请提现”。" },
    { q: "如何在 WhatsApp 上分享信息？", a: "打开信息或商品，点击“📲 分享到 WhatsApp”。消息包含标题、价格、信息编号（例如 A-1023）和链接，照片会显示在 WhatsApp 中。选择联系人或群组即可。" },
    { q: "如何通过 WhatsApp 接收买家的消息？", a: "在“您的账户” → “WhatsApp”中填写您的号码，并开启“显示‘在 WhatsApp 上聊天’按钮”。该按钮会出现在您的信息和商品上，仅对已登录用户显示，并附带一条说明是哪条信息的预设消息。" },
    { q: "“邀请好友”如何运作？", a: "在“账户” → “邀请好友”中有您的邀请码和链接。使用您的邀请（在头 14 天内）创建账户的人会与您关联。当此人首次支付月费（专业人士、企业或店铺）时，您的月费可获赠 1 个月免费。如果您还没有月费，奖励会为您保留。" },
    { q: "什么是实地代理？", a: "来自市场（例如 Kapango）的人，帮助卖家在 Huambo Online 上发布信息。信息始终保留在卖家账户中；发布时，卖家填写代理的代码（例如 AG1001）。该信息售出后，代理可获得成交金额的一定比例，经管理员确认后计入代理的余额。要成为代理，请打开“账户” → “成为代理”。" },
    { q: "如果物品与信息描述不符怎么办？", a: "所有信息都有合规保证：发布者声明描述真实、完整，包括缺陷。如果您购买或租用的物品有隐藏缺陷或与描述不同，请打开该信息并点击“物品与信息描述不符”（交易后 7 天内）。您可以要求换货、退货退款或退款。如果物主拒绝或在 3 天内未答复，由管理员裁决。商店购物请在订单中使用“退货和退款”。" },
    { q: "如何避免诈骗？", a: "在人多的公共场所见面（参见“安全”中的“安全见面地点”），查看物品后当面付款，或在商店使用担保付款。切勿预先付款，也不要透露通过短信收到的验证码或 PIN。在消息中，如有人要求预付款或验证码，Huambo Online 会提醒您。如有怀疑，请使用“屏蔽”和“举报”。" },
    { q: "如何申请退货或退款？", a: "在“订单”中选择订单并点击“申请退货或退款”（收货后 14 天内）。说明问题并附上照片。如果卖方拒绝或未答复，您可以请求管理员介入。参见“退货和退款”。" },
    { q: "如何节省流量？", a: "在网站顶部、应用首页或“您的账户”中开启“📉 节省流量”。列表中的照片不再加载（显示一个图标），在信息详情中只有点击“查看照片”才会加载。视频只在按下 ▶ 后加载。在网站上，当手机处于省流模式时，“自动”会自行开启。" },
    { q: "没有网络可以使用吗？", a: "可以查看首页、最近一次搜索和最近打开的信息。发布、发送消息或报价需要网络连接。" },
    { q: "如何删除我的账户？", a: "在“您的账户”页面底部输入 ELIMINAR 并确认。详情请参见“如何删除我的账户”。" }
  ]
};
