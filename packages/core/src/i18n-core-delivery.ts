import type { CoreRow } from "./i18n-core-errors";

/** Textos das regras de entrega dos vendedores (seller-delivery.ts) e dos erros da encomenda: [pt, en, zh]. */
export const CORE_DELIVERY_ROWS: CoreRow[] = [
  ["Este vendedor não faz entregas (só levantamento no local).", "This seller doesn't deliver (pickup only).", "该卖家不提供配送（仅限自取）。", "Ce vendeur ne livre pas (retrait sur place uniquement)."],
  ["Abaixo do valor mínimo para entrega deste vendedor.", "Below this seller's minimum order for delivery.", "低于该卖家的最低配送金额。", "En dessous de la commande minimale de ce vendeur pour la livraison."],
  ["Este vendedor não entrega no município escolhido.", "This seller doesn't deliver to the chosen municipality.", "该卖家不配送到所选市镇。", "Ce vendeur ne livre pas dans la municipalité choisie."],
  ["Escolha o município da entrega para ver o preço.", "Choose the delivery municipality to see the price.", "请选择配送市镇以查看价格。", "Choisissez la municipalité de livraison pour voir le prix."],
  ["Escolha pelo menos uma opção: levantamento no local ou entrega.", "Choose at least one option: pickup or delivery.", "请至少选择一项：到店自取或配送。", "Choisissez au moins une option : retrait ou livraison."],
  ["O local de levantamento é demasiado longo (máximo 300 letras).", "The pickup place is too long (300 characters max).", "自取地点过长（最多300个字符）。", "Le lieu de retrait est trop long (300 caractères max.)."],
  ["Indique o preço da entrega: por município ou um preço para todos os municípios.", "Enter the delivery price: per municipality or one price for all municipalities.", "请填写配送价格：按市镇设置，或为所有市镇设置统一价格。", "Indiquez le prix de livraison : par municipalité ou un prix pour toutes les municipalités."],
  ["Preço de entrega inválido.", "Invalid delivery price.", "配送价格无效。", "Prix de livraison invalide."],
  ["Há um preço de entrega por município inválido.", "One of the per-municipality delivery prices is invalid.", "有一个市镇的配送价格无效。", "L'un des prix de livraison par municipalité est invalide."],
  ["O mesmo município aparece duas vezes.", "The same municipality appears twice.", "同一市镇出现了两次。", "La même municipalité apparaît deux fois."],
  ["O valor para entrega grátis tem de ser maior que zero.", "The free-delivery amount must be greater than zero.", "免费配送金额必须大于零。", "Le montant pour la livraison gratuite doit être supérieur à zéro."],
  ["O valor mínimo para entrega tem de ser maior que zero.", "The minimum order for delivery must be greater than zero.", "最低配送金额必须大于零。", "La commande minimale pour la livraison doit être supérieure à zéro."],
  ["A entrega grátis não pode começar abaixo do valor mínimo para entrega.", "Free delivery can't start below the minimum order for delivery.", "免费配送门槛不能低于最低配送金额。", "La livraison gratuite ne peut pas commencer en dessous de la commande minimale pour la livraison."],
  ["O prazo é demasiado longo (máximo 120 letras).", "The delivery time is too long (120 characters max).", "配送时间说明过长（最多120个字符）。", "Le délai de livraison est trop long (120 caractères max.)."],
  ["A nota é demasiado longa (máximo 300 letras).", "The note is too long (300 characters max).", "备注过长（最多300个字符）。", "La note est trop longue (300 caractères max.)."],
  ["🤝 Entrega ou levantamento a combinar com o vendedor.", "🤝 Delivery or pickup to be arranged with the seller.", "🤝 配送或自取请与卖家商定。", "🤝 Livraison ou retrait à convenir avec le vendeur."],
  ["🏪 Levantamento no local", "🏪 Pickup available", "🏪 可到店自取", "🏪 Retrait sur place disponible"],
  ["🚚 Entrega grátis", "🚚 Free delivery", "🚚 免费配送", "🚚 Livraison gratuite"],
  ["🚫 Não faz entregas", "🚫 No delivery", "🚫 不提供配送", "🚫 Pas de livraison"],
  ["Entrega a combinar com o vendedor", "Delivery to be arranged with the seller", "配送请与卖家商定", "Livraison à convenir avec le vendeur"],
  ["Entrega grátis 🎁", "Free delivery 🎁", "免费配送 🎁", "Livraison gratuite 🎁"],
  ["Escolha levantamento ou entrega para cada vendedor.", "Choose pickup or delivery for each seller.", "请为每个卖家选择自取或配送。", "Choisissez retrait ou livraison pour chaque vendeur."],
  ["Escolha o município da entrega.", "Choose the delivery municipality.", "请选择配送市镇。", "Choisissez la municipalité de livraison."],
  ["Indique a morada ou ponto de referência para a entrega.", "Enter the address or a landmark for delivery.", "请填写配送地址或参考地标。", "Indiquez l'adresse ou un point de repère pour la livraison."],
  ["Indique um telefone válido para o vendedor o contactar.", "Enter a valid phone number so the seller can contact you.", "请填写有效的电话号码，以便卖家联系您。", "Indiquez un numéro de téléphone valide pour que le vendeur puisse vous contacter."],
  ["Escolha levantamento ou entrega para cada vendedor antes de encomendar.", "Choose pickup or delivery for each seller before ordering.", "下单前请为每个卖家选择自取或配送。", "Choisissez retrait ou livraison pour chaque vendeur avant de commander."],
  ["Este vendedor não tem levantamento no local. Escolha entrega.", "This seller doesn't offer pickup. Choose delivery.", "该卖家不提供自取，请选择配送。", "Ce vendeur ne propose pas le retrait. Choisissez la livraison."],
  ["Este vendedor não faz entregas. Escolha levantamento no local.", "This seller doesn't deliver. Choose pickup.", "该卖家不提供配送，请选择自取。", "Ce vendeur ne livre pas. Choisissez le retrait."],
  ["A compra a este vendedor está abaixo do valor mínimo para entrega. Junte mais artigos ou escolha levantamento.", "Your purchase from this seller is below the minimum for delivery. Add more items or choose pickup.", "您在该卖家的购买金额低于最低配送金额。请添加更多商品或选择自取。", "Votre achat chez ce vendeur est inférieur au minimum pour la livraison. Ajoutez des articles ou choisissez le retrait."],
  ["Este vendedor não entrega no município escolhido. Escolha levantamento ou outro município.", "This seller doesn't deliver to the chosen municipality. Choose pickup or another municipality.", "该卖家不配送到所选市镇。请选择自取或其他市镇。", "Ce vendeur ne livre pas dans la municipalité choisie. Choisissez le retrait ou une autre municipalité."],
  ["Escolha o município da entrega para calcular o preço.", "Choose the delivery municipality to calculate the price.", "请选择配送市镇以计算价格。", "Choisissez la municipalité de livraison pour calculer le prix."]
];
export const CORE_DELIVERY_PATTERNS: { re: RegExp; en: string; zh: string; fr?: string }[] = [
  { re: /^🏪 Levantamento no local: (.+)$/, en: "🏪 Pickup at: $1", zh: "🏪 自取地点：$1", fr: "🏪 Retrait sur place : $1" },
  { re: /^🚚 Entrega: de (.+) a (.+), conforme o município$/, en: "🚚 Delivery: $1 to $2, depending on the municipality", zh: "🚚 配送费：$1 至 $2，视市镇而定", fr: "🚚 Livraison : de $1 à $2, selon la municipalité" },
  { re: /^🚚 Entrega: (.+)$/, en: "🚚 Delivery: $1", zh: "🚚 配送费：$1", fr: "🚚 Livraison : $1" },
  { re: /^📍 Entrega em: (.+)$/, en: "📍 Delivers to: $1", zh: "📍 配送范围：$1", fr: "📍 Livre à : $1" },
  { re: /^🎁 Entrega grátis a partir de (.+)$/, en: "🎁 Free delivery from $1", zh: "🎁 满 $1 免费配送", fr: "🎁 Livraison gratuite à partir de $1" },
  { re: /^🧾 Entrega só a partir de (.+)$/, en: "🧾 Delivery only from $1", zh: "🧾 满 $1 才配送", fr: "🧾 Livraison seulement à partir de $1" },
  { re: /^⏱️ Prazo: (.+)$/, en: "⏱️ Delivery time: $1", zh: "⏱️ 配送时间：$1", fr: "⏱️ Délai de livraison : $1" },
  { re: /^ℹ️ (.+)$/, en: "ℹ️ $1", zh: "ℹ️ $1", fr: "ℹ️ $1" },
  { re: /^Entrega: (.+)$/, en: "Delivery: $1", zh: "配送费：$1", fr: "Livraison : $1" },
  { re: /^Faltam (.+) para a entrega ser grátis\.$/, en: "$1 more for free delivery.", zh: "再买 $1 即可免费配送。", fr: "Encore $1 pour la livraison gratuite." },
  { re: /^Recebeu uma encomenda de (.+) Kz \(levantamento no local\)\.(.*)$/, en: "You received an order of $1 Kz (pickup).$2", zh: "您收到一笔 $1 Kz 的订单（自取）。$2", fr: "Vous avez reçu une commande de $1 Kz (retrait sur place).$2" },
  { re: /^Recebeu uma encomenda de (.+) Kz \(inclui entrega: (.+) Kz\)\.(.*)$/, en: "You received an order of $1 Kz (includes delivery: $2 Kz).$3", zh: "您收到一笔 $1 Kz 的订单（含配送费 $2 Kz）。$3", fr: "Vous avez reçu une commande de $1 Kz (livraison incluse : $2 Kz).$3" },
  { re: /^Recebeu uma encomenda de (.+) Kz \(entrega grátis\)\.(.*)$/, en: "You received an order of $1 Kz (free delivery).$2", zh: "您收到一笔 $1 Kz 的订单（免费配送）。$2", fr: "Vous avez reçu une commande de $1 Kz (livraison gratuite).$2" }
];

/** Textos do código QR dos perfis (profile-qr.ts). */
export const CORE_PROFILE_QR_ROWS: CoreRow[] = [
  ["Profissional", "Professional", "专业人士", "Professionnel"], ["Empresa", "Business", "企业", "Entreprise"], ["Loja", "Shop", "商店", "Boutique"],
  ["Estabelecimento", "Venue", "商家", "Établissement"], ["Posto de combustível", "Fuel station", "加油站", "Station-service"], ["Praça", "Market", "市场", "Marché"],
  ["Leia com a câmara do telemóvel", "Scan with your phone camera", "用手机相机扫描", "Scannez avec l'appareil photo de votre téléphone"]
];
export const CORE_PROFILE_QR_PATTERNS: { re: RegExp; en: string; zh: string; fr?: string }[] = [
  { re: /^(.+) no Huambo Online — veja o perfil, os produtos e onde fica:\n👉 (.+)$/s, en: "$1 on Huambo Online — see the profile, products and location:\n👉 $2", zh: "$1 在 Huambo Online —— 查看资料、商品和位置：\n👉 $2", fr: "$1 sur Huambo Online — voir le profil, les produits et l'adresse :\n👉 $2" }
];
