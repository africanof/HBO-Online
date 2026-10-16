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
