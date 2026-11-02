import type { CoreRow } from "./i18n-core-errors";

/**
 * Mensagens dos validate*() e frases que as funções do core devolvem (passos, avisos).
 * Cada linha: [português exato, inglês, chinês simplificado].
 */
export const CORE_MESSAGE_ROWS: CoreRow[] = [
  // --- Classificados (classified-listings.ts) ---
  ["O título é demasiado curto.", "The title is too short.", "标题太短。", "Le titre est trop court."],
  ["O título não pode ter mais de 140 caracteres.", "The title can't be longer than 140 characters.", "标题不能超过140个字符。", "Le titre ne peut pas dépasser 140 caractères."],
  ["A descrição é demasiado longa.", "The description is too long.", "描述太长。", "La description est trop longue."],
  ["Indique um preço válido.", "Enter a valid price.", "请填写有效的价格。", "Indiquez un prix valide."],
  ["Escolha a província.", "Choose the province.", "请选择省份。", "Choisissez la province."],
  ["Escolha o município.", "Choose the municipality.", "请选择市镇。", "Choisissez la municipalité."],

  // --- Devoluções (disputes.ts) ---
  ["A encomenda ainda está pendente: pode cancelá-la.", "The order is still pending: you can cancel it.", "订单仍在待处理：您可以取消。", "La commande est encore en attente : vous pouvez l'annuler."],
  ["Encomenda cancelada.", "Order cancelled.", "订单已取消。", "Commande annulée."],
  ["Ainda não pagou esta encomenda.", "You haven't paid for this order yet.", "您尚未支付此订单。", "Vous n'avez pas encore payé cette commande."],
  ["Já tem um pedido aberto para esta encomenda.", "You already have an open request for this order.", "该订单已有一个进行中的申请。", "Vous avez déjà une demande ouverte pour cette commande."],
  ["Esta encomenda já teve um pedido decidido.", "This order has already had a request decided.", "该订单的申请已有处理结果。", "Une demande a déjà été décidée pour cette commande."],
  ["Se não recebeu a encomenda, só pode pedir o reembolso.", "If you didn't receive the order, you can only ask for a refund.", "如果您没有收到订单，只能申请退款。", "Si vous n'avez pas reçu la commande, vous ne pouvez demander qu'un remboursement."],
  ["Explique o que aconteceu (pelo menos 5 letras).", "Explain what happened (at least 5 characters).", "请说明发生了什么（至少5个字符）。", "Expliquez ce qui s'est passé (au moins 5 caractères)."],
  ["A explicação é demasiado longa (máximo 1000 letras).", "The explanation is too long (maximum 1000 characters).", "说明太长（最多1000个字符）。", "L'explication est trop longue (1000 caractères maximum)."],
  ["O Huambo Online vai devolver o dinheiro guardado. Indique abaixo para onde (IBAN ou Multicaixa Express).", "Huambo Online will return the held money. Enter below where to send it (IBAN or Multicaixa Express).", "Huambo Online 将退还托管款项。请在下方填写退款账户（IBAN 或 Multicaixa Express）。", "Huambo Online va rendre l'argent retenu. Indiquez ci-dessous où l'envoyer (IBAN ou Multicaixa Express)."],
  ["O Huambo Online vai devolver ao comprador o dinheiro que estava guardado. Não precisa de enviar dinheiro.", "Huambo Online will return the held money to the buyer. You don't need to send any money.", "Huambo Online 将把托管款项退还给买家。您无需汇款。", "Huambo Online va rendre l'argent retenu à l'acheteur. Vous n'avez pas besoin d'envoyer d'argent."],
  ["O Huambo Online enviou o reembolso. Confirme quando receber.", "Huambo Online has sent the refund. Confirm when you receive it.", "Huambo Online 已发出退款。收到后请确认。", "Huambo Online a envoyé le remboursement. Confirmez quand vous le recevez."],
  ["O Huambo Online enviou o reembolso ao comprador.", "Huambo Online has sent the refund to the buyer.", "Huambo Online 已向买家发出退款。", "Huambo Online a envoyé le remboursement à l'acheteur."],
  ["O vendedor tem de responder. Se não responder em 3 dias, pode chamar a administração.", "The seller must reply. If they don't reply within 3 days, you can call in the administration.", "卖家需要回复。如果3天内未回复，您可以请管理员介入。", "Le vendeur doit répondre. S'il ne répond pas sous 3 jours, vous pouvez faire appel à l'administration."],
  ["Responda ao pedido: aceite ou explique porque recusa.", "Reply to the request: accept it or explain why you decline.", "请回复申请：接受，或说明拒绝的理由。", "Répondez à la demande : acceptez-la ou expliquez pourquoi vous la refusez."],
  ["O vendedor recusou. Se não concorda, chame a administração.", "The seller declined. If you don't agree, call in the administration.", "卖家已拒绝。如果您不同意，请管理员介入。", "Le vendeur a refusé. Si vous n'êtes pas d'accord, faites appel à l'administration."],
  ["Recusou o pedido. O comprador pode chamar a administração.", "You declined the request. The buyer can call in the administration.", "您已拒绝申请。买家可以请管理员介入。", "Vous avez refusé la demande. L'acheteur peut faire appel à l'administration."],
  ["Devolva o artigo ao vendedor (combine pelas mensagens) e carregue em «Já devolvi o artigo».", "Return the item to the seller (arrange it through messages) and tap «I've returned the item».", "请将物品退回卖家（通过消息约定），然后点击「我已退回物品」。", "Rendez l'article au vendeur (arrangez-vous par messages) et touchez «J'ai retourné l'article»."],
  ["Espere que o comprador devolva o artigo.", "Wait for the buyer to return the item.", "请等待买家退回物品。", "Attendez que l'acheteur retourne l'article."],
  ["O vendedor vai confirmar que recebeu o artigo.", "The seller will confirm they received the item.", "卖家将确认已收到物品。", "Le vendeur confirmera avoir reçu l'article."],
  ["Confirme quando receber o artigo devolvido.", "Confirm when you receive the returned item.", "收到退回的物品后请确认。", "Confirmez quand vous recevez l'article retourné."],
  ["O vendedor tem de lhe devolver o dinheiro.", "The seller must refund your money.", "卖家需要向您退款。", "Le vendeur doit vous rembourser."],
  ["Devolva o dinheiro ao comprador e carregue em «Já devolvi o dinheiro».", "Refund the buyer and tap «I've refunded the money».", "请向买家退款，然后点击「我已退款」。", "Remboursez l'acheteur et touchez «J'ai remboursé l'argent»."],
  ["Confirme quando receber o dinheiro. Se não chegou em 3 dias, chame a administração.", "Confirm when you receive the money. If it hasn't arrived within 3 days, call in the administration.", "收到款项后请确认。如果3天内未到账，请管理员介入。", "Confirmez quand vous recevez l'argent. S'il n'est pas arrivé sous 3 jours, faites appel à l'administration."],
  ["Espere que o comprador confirme que recebeu.", "Wait for the buyer to confirm they received it.", "请等待买家确认收到。", "Attendez que l'acheteur confirme la réception."],
  ["O vendedor vai enviar outro artigo. Confirme quando o receber.", "The seller will send another item. Confirm when you receive it.", "卖家将寄出另一件物品。收到后请确认。", "Le vendeur va envoyer un autre article. Confirmez quand vous le recevez."],
  ["Envie o artigo novo ao comprador.", "Send the new item to the buyer.", "请将新物品寄给买家。", "Envoyez le nouvel article à l'acheteur."],
  ["A administração está a analisar e vai decidir. Pode juntar mensagens e fotografias.", "The administration is reviewing and will decide. You can add messages and photos.", "管理员正在审核并将作出裁决。您可以补充消息和照片。", "L'administration examine et va décider. Vous pouvez ajouter des messages et des photos."],

  // --- Reservas (venues.ts) ---
  ["Escolha a sua empresa (registe-a primeiro em «Empresas»).", "Choose your business (register it first in «Businesses»).", "请选择您的企业（请先在「企业」中登记）。", "Choisissez votre entreprise (enregistrez-la d'abord dans «Entreprises»)."],
  ["Escolha o tipo de estabelecimento.", "Choose the type of venue.", "请选择商家类型。", "Choisissez le type d'établissement."],
  ["Escolha pelo menos uma forma de pagamento (no local ou adiantado).", "Choose at least one payment method (on site or in advance).", "请至少选择一种付款方式（到店或预付）。", "Choisissez au moins un mode de paiement (sur place ou d'avance)."],
  ["O tempo de tolerância tem de ser entre 15 minutos e 24 horas.", "The grace period must be between 15 minutes and 24 hours.", "保留时间必须在15分钟到24小时之间。", "Le délai de tolérance doit être compris entre 15 minutes et 24 heures."],
  ["Hora de entrada inválida (ex.: 14:00).", "Invalid check-in time (e.g. 14:00).", "入住时间无效（例如：14:00）。", "Heure d'arrivée invalide (ex. : 14:00)."],
  ["Hora de saída inválida (ex.: 12:00).", "Invalid check-out time (e.g. 12:00).", "退房时间无效（例如：12:00）。", "Heure de départ invalide (ex. : 12:00)."],
  ["As regras são demasiado longas (máximo 600 letras).", "The rules are too long (maximum 600 characters).", "规则太长（最多600个字符）。", "Le règlement est trop long (600 caractères maximum)."],
  ["Para receber pagamentos adiantados, indique o IBAN ou o número Multicaixa Express.", "To receive advance payments, enter the IBAN or Multicaixa Express number.", "如需接收预付款，请填写 IBAN 或 Multicaixa Express 号码。", "Pour recevoir des paiements anticipés, indiquez l'IBAN ou le numéro Multicaixa Express."],
  ["Indique o nome do titular da conta.", "Enter the account holder's name.", "请填写账户持有人姓名。", "Indiquez le nom du titulaire du compte."],
  ["Escreva o tipo de quarto (ex.: «Quarto duplo»).", "Enter the room type (e.g. «Double room»).", "请填写房型（例如：「双人间」）。", "Indiquez le type de chambre (ex. : «Chambre double»)."],
  ["Escreva o nome.", "Enter the name.", "请填写名称。", "Indiquez le nom."],
  ["O nome é demasiado longo.", "The name is too long.", "名称太长。", "Le nom est trop long."],
  ["Indique o preço.", "Enter the price.", "请填写价格。", "Indiquez le prix."],
  ["Pode juntar no máximo 6 fotografias.", "You can add up to 6 photos.", "最多可添加6张照片。", "Vous pouvez ajouter jusqu'à 6 photos."],
  ["Quantos quartos deste tipo tem? (número inteiro)", "How many rooms of this type do you have? (whole number)", "此房型有多少间？（整数）", "Combien de chambres de ce type avez-vous ? (nombre entier)"],
  ["Quantas pessoas cabem em cada quarto?", "How many people fit in each room?", "每间房可住几人？", "Combien de personnes par chambre ?"],
  ["A quantidade mínima tem de ser maior que zero.", "The minimum quantity must be greater than zero.", "最低数量必须大于零。", "La quantité minimale doit être supérieure à zéro."],
  ["Este tipo de pedido não existe aqui.", "This type of order isn't available here.", "此处没有这种类型的订单。", "Ce type de commande n'est pas disponible ici."],
  ["Este estabelecimento só aceita pagamento adiantado.", "This venue only accepts advance payment.", "该商家只接受预付款。", "Cet établissement n'accepte que le paiement anticipé."],
  ["Este estabelecimento não aceita pagamento adiantado.", "This venue doesn't accept advance payment.", "该商家不接受预付款。", "Cet établissement n'accepte pas le paiement anticipé."],
  ["Escreva o seu nome.", "Enter your name.", "请填写您的姓名。", "Indiquez votre nom."],
  ["Já não há quartos livres suficientes nestas datas.", "There aren't enough free rooms left on these dates.", "这些日期的空房已不足。", "Il ne reste pas assez de chambres libres à ces dates."],
  ["Escolha um tipo de quarto.", "Choose a room type.", "请选择房型。", "Choisissez un type de chambre."],
  ["Indique o número de quartos.", "Enter the number of rooms.", "请填写房间数量。", "Indiquez le nombre de chambres."],
  ["Escolha as datas de entrada e de saída.", "Choose the check-in and check-out dates.", "请选择入住和退房日期。", "Choisissez les dates d'arrivée et de départ."],
  ["A data de entrada já passou.", "The check-in date has already passed.", "入住日期已过。", "La date d'arrivée est déjà passée."],
  ["A saída tem de ser depois da entrada.", "Check-out must be after check-in.", "退房日期必须晚于入住日期。", "Le départ doit être après l'arrivée."],
  ["Máximo de 60 noites por reserva.", "Maximum of 60 nights per booking.", "每次预订最多60晚。", "60 nuits maximum par réservation."],
  ["São pessoas a mais para estes quartos. Escolha mais quartos.", "Too many people for these rooms. Choose more rooms.", "这些房间容纳不了这么多人。请选择更多房间。", "Trop de personnes pour ces chambres. Choisissez plus de chambres."],
  ["Indique para quantas pessoas é a mesa.", "Enter how many people the table is for.", "请填写用餐人数。", "Indiquez pour combien de personnes est la table."],
  ["Escolha o dia e a hora.", "Choose the date and time.", "请选择日期和时间。", "Choisissez la date et l'heure."],
  ["Escolha o dia e a hora para levantar.", "Choose the date and time for collection.", "请选择自取的日期和时间。", "Choisissez la date et l'heure du retrait."],
  ["Esse dia e hora já passaram.", "That date and time have already passed.", "该日期和时间已过。", "Cette date et cette heure sont déjà passées."],
  ["Escreva a referência ou o número da operação (como está no comprovativo).", "Enter the reference or transaction number (as shown on the proof).", "请填写参考号或交易编号（与付款凭证一致）。", "Indiquez la référence ou le numéro de transaction (tel qu'il figure sur le justificatif)."],
  ["Escreva o motivo (ex.: não recebi o dinheiro).", "Enter the reason (e.g. I didn't receive the money).", "请填写原因（例如：我没有收到款项）。", "Indiquez le motif (ex. : je n'ai pas reçu l'argent)."],
  ["Escreva o motivo (o dono vai ler).", "Enter the reason (the owner will read it).", "请填写原因（所有者将会看到）。", "Indiquez le motif (le propriétaire le lira)."],

  // --- Eventos (events.ts) ---
  ["Escreva o nome do evento.", "Enter the name of the event.", "请填写活动名称。", "Indiquez le nom de l'événement."],
  ["Escolha o dia e a hora do início.", "Choose the start date and time.", "请选择开始日期和时间。", "Choisissez la date et l'heure de début."],
  ["O fim tem de ser depois do início.", "The end must be after the start.", "结束时间必须晚于开始时间。", "La fin doit être après le début."],
  ["Escreva o local (ex.: Cine Ruacaná).", "Enter the venue (e.g. Cine Ruacaná).", "请填写地点（例如：Cine Ruacaná）。", "Indiquez le lieu (ex. : Cine Ruacaná)."],
  ["Junte pelo menos um tipo de bilhete (pode ser grátis).", "Add at least one ticket type (it can be free).", "请至少添加一种门票（可以免费）。", "Ajoutez au moins un type de billet (il peut être gratuit)."],
  ["Indique o IBAN ou o número Multicaixa Express para receber o dinheiro dos bilhetes.", "Enter the IBAN or Multicaixa Express number to receive the ticket money.", "请填写用于接收门票款项的 IBAN 或 Multicaixa Express 号码。", "Indiquez l'IBAN ou le numéro Multicaixa Express pour recevoir l'argent des billets."],
  ["Escreva o motivo do cancelamento.", "Enter the reason for cancelling.", "请填写取消原因。", "Indiquez le motif de l'annulation."],
  ["Escolha quantos bilhetes quer.", "Choose how many tickets you want.", "请选择所需门票数量。", "Choisissez combien de billets vous voulez."],
  ["Escreva o seu nome (aparece no bilhete).", "Enter your name (it appears on the ticket).", "请填写您的姓名（将显示在门票上）。", "Indiquez votre nom (il figure sur le billet)."],
  ["Escreva a referência ou o número da operação.", "Enter the reference or transaction number.", "请填写参考号或交易编号。", "Indiquez la référence ou le numéro de transaction."],

  // --- Combustível (fuel.ts) ---
  ["Escreva o nome do posto ou do ponto de venda.", "Enter the name of the station or point of sale.", "请填写站点或销售点名称。", "Indiquez le nom de la station ou du point de vente."],
  ["Escolha pelo menos um produto que vende.", "Choose at least one product you sell.", "请至少选择一种您销售的产品。", "Choisissez au moins un produit que vous vendez."],
  ["Marcou gás: escolha «Combustível e gás».", "You ticked gas: choose «Fuel and gas».", "您勾选了燃气：请选择「燃油和燃气」。", "Vous avez coché le gaz : choisissez «Carburant et gaz»."],
  ["Marcou combustível: escolha «Combustível e gás».", "You ticked fuel: choose «Fuel and gas».", "您勾选了燃油：请选择「燃油和燃气」。", "Vous avez coché le carburant : choisissez «Carburant et gaz»."],
  ["O tempo para levantar tem de ser entre 15 minutos e 24 horas.", "The collection time must be between 15 minutes and 24 hours.", "提取时间必须在15分钟到24小时之间。", "Le délai de retrait doit être compris entre 15 minutes et 24 heures."],
  ["Indique a quantidade.", "Enter the quantity.", "请填写数量。", "Indiquez la quantité."],
  ["Indique o número de botijas (sem vírgulas).", "Enter the number of gas bottles (whole number).", "请填写气罐数量（整数）。", "Indiquez le nombre de bouteilles de gaz (nombre entier)."],
  ["Preço inválido.", "Invalid price.", "价格无效。", "Prix invalide."],
  ["O máximo por pessoa tem de ser maior que zero.", "The maximum per person must be greater than zero.", "每人上限必须大于零。", "Le maximum par personne doit être supérieur à zéro."],

  // --- Pagamento protegido (protected-payments.ts) ---
  ["Encomenda cancelada. Não pague.", "Order cancelled. Don't pay.", "订单已取消。请勿付款。", "Commande annulée. Ne payez pas."],
  ["Recebemos o seu comprovativo. Vamos confirmar e avisá-lo.", "We've received your proof. We'll confirm it and let you know.", "我们已收到您的付款凭证。确认后会通知您。", "Nous avons reçu votre justificatif. Nous allons le confirmer et vous prévenir."],
  ["Pague a referência no Multicaixa Express, num ATM ou no banco. A confirmação é automática.", "Pay the reference on Multicaixa Express, at an ATM or at the bank. Confirmation is automatic.", "请通过 Multicaixa Express、ATM 或银行支付该参考号。确认会自动完成。", "Payez la référence sur Multicaixa Express, à un distributeur ou à la banque. La confirmation est automatique."],
  ["Tem um pedido de devolução/reembolso aberto: o dinheiro fica guardado até se resolver.", "You have an open return/refund request: the money stays held until it's resolved.", "您有一个进行中的退货/退款申请：款项将保持托管直至解决。", "Vous avez une demande de retour/remboursement ouverte : l'argent reste retenu jusqu'à sa résolution."],
  ["O dinheiro está guardado. Quando receber a encomenda, confirme a receção.", "The money is held. When you receive the order, confirm receipt.", "款项已托管。收到订单后请确认收货。", "L'argent est retenu. Quand vous recevez la commande, confirmez la réception."],
  ["Concluído: o pagamento foi entregue ao vendedor.", "Completed: the payment was released to the seller.", "已完成：款项已交给卖家。", "Terminée : le paiement a été versé au vendeur."],
  ["O dinheiro foi-lhe devolvido.", "The money has been returned to you.", "款项已退还给您。", "L'argent vous a été rendu."],
  ["Encomenda cancelada antes do pagamento.", "Order cancelled before payment.", "订单在付款前已取消。", "Commande annulée avant le paiement."],
  ["À espera do pagamento do cliente. Não envie ainda: vai receber o aviso «Pagamento recebido».", "Waiting for the customer's payment. Don't ship yet: you'll get the «Payment received» notice.", "等待客户付款。请暂不发货：您将收到「已收到付款」通知。", "En attente du paiement du client. N'envoyez pas encore : vous recevrez l'avis «Paiement reçu»."],
  ["Encomenda cancelada: o Huambo Online devolve o dinheiro ao cliente.", "Order cancelled: Huambo Online returns the money to the customer.", "订单已取消：Huambo Online 将款项退还给客户。", "Commande annulée : Huambo Online rend l'argent au client."],
  ["Pago ✔ O dinheiro está guardado pelo Huambo Online. Prepare e entregue a encomenda; depois marque como «Entregue».", "Paid ✔ The money is held by Huambo Online. Prepare and deliver the order; then mark it as «Delivered».", "已付款 ✔ 款项由 Huambo Online 托管。请备货并送达订单，然后标记为「已送达」。", "Payé ✔ L'argent est retenu par Huambo Online. Préparez et livrez la commande ; marquez-la ensuite comme «Livrée»."],
  ["O dinheiro foi devolvido ao cliente.", "The money was returned to the customer.", "款项已退还给客户。", "L'argent a été rendu au client."],
  ["Escreva o valor a levantar.", "Enter the amount to withdraw.", "请填写提现金额。", "Indiquez le montant à retirer."],

  // --- Denúncias e verificação (trust.ts) ---
  ["Envie uma fotografia (JPG, PNG, WEBP) ou um PDF.", "Send a photo (JPG, PNG, WEBP) or a PDF.", "请发送照片（JPG、PNG、WEBP）或 PDF。", "Envoyez une photo (JPG, PNG, WEBP) ou un PDF."],
  ["O documento é demasiado grande (máximo 5 MB).", "The document is too large (maximum 5 MB).", "证件文件太大（最大5 MB）。", "Le document est trop volumineux (5 Mo maximum)."],
  ["Tire a fotografia da frente do BI.", "Take the photo of the front of the ID card.", "请拍摄身份证正面照片。", "Prenez la photo du recto de la carte d'identité."],
  ["Tire a fotografia do verso do BI.", "Take the photo of the back of the ID card.", "请拍摄身份证背面照片。", "Prenez la photo du verso de la carte d'identité."],
  ["Tire a selfie a segurar o BI.", "Take the selfie holding the ID card.", "请拍摄手持身份证的自拍。", "Prenez le selfie en tenant la carte d'identité."],
  ["Escreva o número do BI como está no documento (9 algarismos, 2 letras e 3 algarismos, ex.: 004512345LA042).", "Enter the ID card number as it appears on the document (9 digits, 2 letters and 3 digits, e.g. 004512345LA042).", "请按证件上的样式填写身份证号码（9位数字、2个字母和3位数字，例如：004512345LA042）。", "Indiquez le numéro de la carte d'identité tel qu'il figure sur le document (9 chiffres, 2 lettres et 3 chiffres, ex. : 004512345LA042)."],

  // --- Inspeções (inspections.ts) ---
  ["Escreva um telefone para combinar a visita.", "Enter a phone number to arrange the visit.", "请填写电话以便约定上门时间。", "Indiquez un téléphone pour convenir de la visite."],

  // --- Administração (admin.ts) ---
  ["Indique o nome da categoria.", "Enter the category name.", "请填写分类名称。", "Indiquez le nom de la catégorie."],

  // --- Campo (agro.ts) ---
  ["Escolha o tipo de produto do campo.", "Choose the type of farm product.", "请选择农产品类型。", "Choisissez le type de produit agricole."],
  ["Escolha a unidade de venda (kg, saco, cabeça…).", "Choose the sales unit (kg, bag, head…).", "请选择销售单位（公斤、袋、头…）。", "Choisissez l'unité de vente (kg, sac, tête…)."],
  ["Indique uma quantidade válida.", "Enter a valid quantity.", "请填写有效的数量。", "Indiquez une quantité valide."],
  ["Indique a data em que fica disponível.", "Enter the date it becomes available.", "请填写可供货日期。", "Indiquez la date de disponibilité."],
  ["A data «disponível a partir de» não pode ser no passado.", "The «available from» date can't be in the past.", "「供货起始日期」不能早于今天。", "La date «disponible à partir du» ne peut pas être dans le passé."],

  // --- Serviços e avaliações (deal-reviews.ts) ---
  ["O comentário é demasiado longo (máximo 1000 letras).", "The comment is too long (maximum 1000 characters).", "评论太长（最多1000个字符）。", "Le commentaire est trop long (1000 caractères maximum)."],
  ["A descrição é demasiado longa (máximo 1000 letras).", "The description is too long (maximum 1000 characters).", "描述太长（最多1000个字符）。", "La description est trop longue (1000 caractères maximum)."],

  // --- Planos (plans.ts) ---
  ["A referência é demasiado longa.", "The reference is too long.", "参考号太长。", "La référence est trop longue."],
  ["No máximo 6 contas.", "Up to 6 accounts.", "最多6个账户。", "Jusqu'à 6 comptes."],

  // --- Vídeos e lives (promo.ts) ---
  ["Escolha em nome de quem publica (perfil, empresa ou loja).", "Choose who you're posting on behalf of (profile, business or shop).", "请选择以谁的名义发布（个人资料、企业或商店）。", "Choisissez au nom de qui vous publiez (profil, entreprise ou boutique)."],
  ["Escreva um título (pelo menos 4 letras).", "Enter a title (at least 4 characters).", "请填写标题（至少4个字符）。", "Indiquez un titre (au moins 4 caractères)."],

  // --- Modos de venda (sale-modes.ts) ---
  ["Escolha como quer vender: preço fixo, negociável, propostas, leilão ou troca.", "Choose how you want to sell: fixed price, negotiable, offers, auction or swap.", "请选择出售方式：固定价格、可议价、接受报价、拍卖或交换。", "Choisissez comment vous voulez vendre : prix fixe, négociable, offres, enchère ou échange."],
  ["Indique o preço inicial do leilão.", "Enter the auction's starting price.", "请填写拍卖起拍价。", "Indiquez le prix de départ de l'enchère."],
  ["O leilão dura de 1 a 30 dias.", "The auction lasts from 1 to 30 days.", "拍卖时长为1到30天。", "L'enchère dure de 1 à 30 jours."],
  ["Diga o que aceita em troca.", "Say what you'll accept in exchange.", "请说明您接受用什么交换。", "Dites ce que vous acceptez en échange."],
  ["Diga o que oferece em troca.", "Say what you're offering in exchange.", "请说明您用什么来交换。", "Dites ce que vous proposez en échange."],
  ["Indique o valor da proposta.", "Enter the offer amount.", "请填写报价金额。", "Indiquez le montant de l'offre."],

  // --- Agentes (agents.ts) ---
  ["Escreva um telefone com 9 algarismos.", "Enter a 9-digit phone number.", "请填写9位数的电话号码。", "Indiquez un numéro de téléphone à 9 chiffres."],
  ["Escolha pelo menos uma comissão.", "Choose at least one commission.", "请至少选择一项佣金。", "Choisissez au moins une commission."],

  // --- Comissões e destaques ---
  ["Escolha a comissão que quer pagar.", "Choose the commission you want to pay.", "请选择要支付的佣金。", "Choisissez la commission que vous voulez payer."],

  // --- Conformidade (conformity.ts) ---
  ["Escolha o que está errado.", "Choose what's wrong.", "请选择问题所在。", "Choisissez ce qui ne va pas."],
  ["Escolha o que quer: troca, devolução ou reembolso.", "Choose what you want: exchange, return or refund.", "请选择您的诉求：换货、退货或退款。", "Choisissez ce que vous voulez : échange, retour ou remboursement."],
  ["A explicação é demasiado longa.", "The explanation is too long.", "说明太长。", "L'explication est trop longue."],
  ["O valor a reembolsar tem de ser maior que zero.", "The amount to refund must be greater than zero.", "退款金额必须大于零。", "Le montant à rembourser doit être supérieur à zéro."],
  ["Escreva o motivo da recusa.", "Enter the reason for rejecting.", "请填写拒绝原因。", "Indiquez le motif du refus."],
  ["Escreva a decisão e o motivo.", "Enter the decision and the reason.", "请填写裁决和理由。", "Indiquez la décision et le motif."],

  // --- Entregas (delivery.ts) / perfil (profile.ts) / empresas (directory.ts) ---
  ["Indique o seu nome.", "Enter your name.", "请填写您的姓名。", "Indiquez votre nom."],
  ["Indique um telefone válido.", "Enter a valid phone number.", "请填写有效的电话号码。", "Indiquez un téléphone valide."],
  ["Escolha o meio de transporte.", "Choose your means of transport.", "请选择交通工具。", "Choisissez votre moyen de transport."],
  ["Telefone inválido. Use apenas números (ex.: 923 000 000).", "Invalid phone number. Use numbers only (e.g. 923 000 000).", "电话号码无效。请只使用数字（例如：923 000 000）。", "Numéro de téléphone invalide. Utilisez uniquement des chiffres (ex. : 923 000 000)."],
  ["Este telefone já está associado a outra conta.", "This phone number is already linked to another account.", "该电话号码已关联其他账户。", "Ce numéro de téléphone est déjà lié à un autre compte."],
  ["Escreva a sua área de atividade.", "Enter your field of work.", "请填写您的业务领域。", "Indiquez votre domaine d'activité."],
  ["A área de atividade é demasiado longa (máximo 60 letras).", "The field of work is too long (maximum 60 characters).", "业务领域太长（最多60个字符）。", "Le domaine d'activité est trop long (60 caractères maximum)."],
  ["Indique o nome profissional.", "Enter your professional name.", "请填写您的职业名称。", "Indiquez votre nom professionnel."],
  ["Escolha a área de atividade.", "Choose the field of work.", "请选择业务领域。", "Choisissez le domaine d'activité."],
  ["Escolha o município onde trabalha.", "Choose the municipality where you work.", "请选择您工作的市镇。", "Choisissez la municipalité où vous travaillez."],
  ["Telefone inválido.", "Invalid phone number.", "电话号码无效。", "Téléphone invalide."],
  ["Número de WhatsApp inválido.", "Invalid WhatsApp number.", "WhatsApp 号码无效。", "Numéro WhatsApp invalide."],
  ["Indique o nome do serviço.", "Enter the name of the service.", "请填写服务名称。", "Indiquez le nom du service."],
  ["Indique o nome da empresa.", "Enter the business name.", "请填写企业名称。", "Indiquez le nom de l'entreprise."],
  ["Escolha a categoria.", "Choose the category.", "请选择分类。", "Choisissez la catégorie."],
  ["Escreva a sua mensagem.", "Write your message.", "请填写您的消息。", "Écrivez votre message."],

  // --- Leilões (listing-auctions.ts) ---
  ["Indique o preço inicial.", "Enter the starting price.", "请填写起拍价。", "Indiquez le prix de départ."],
  ["O preço mínimo de venda não pode ser menor que o inicial.", "The reserve price can't be lower than the starting price.", "最低成交价不能低于起拍价。", "Le prix de réserve ne peut pas être inférieur au prix de départ."],
  ["Indique um incremento válido.", "Enter a valid increment.", "请填写有效的加价幅度。", "Indiquez un incrément valide."],
  ["A duração tem de ser entre 1 e 30 dias.", "The duration must be between 1 and 30 days.", "时长必须在1到30天之间。", "La durée doit être comprise entre 1 et 30 jours."],
  ["Indique o valor do lance.", "Enter the bid amount.", "请填写出价金额。", "Indiquez le montant de l'enchère."],
  ["O leilão já terminou.", "The auction has already ended.", "拍卖已结束。", "L'enchère est déjà terminée."],
  ["Não tem lances neste leilão.", "You have no bids in this auction.", "您在该拍卖中没有出价。", "Vous n'avez pas d'enchères dans cette vente."],

  // --- Praças (markets.ts) ---
  ["A morada é demasiado longa.", "The address is too long.", "地址太长。", "L'adresse est trop longue."],
  ["O horário é demasiado longo.", "The opening hours text is too long.", "营业时间太长。", "Le texte des horaires est trop long."],
  ["O endereço da fotografia tem de começar por https://", "The photo address must start with https://", "照片地址必须以 https:// 开头", "L'adresse de la photo doit commencer par https://"],

  // --- Portfólio (portfolio.ts) ---
  ["Dê um título ao trabalho (ex.: «Casa de banho remodelada»).", "Give the work a title (e.g. «Renovated bathroom»).", "请为作品填写标题（例如：「翻新的浴室」）。", "Donnez un titre à la réalisation (ex. : «Salle de bain rénovée»)."],
  ["O título é demasiado longo (máximo 120 letras).", "The title is too long (maximum 120 characters).", "标题太长（最多120个字符）。", "Le titre est trop long (120 caractères maximum)."],
  ["Junte pelo menos uma fotografia do trabalho.", "Add at least one photo of the work.", "请至少添加一张作品照片。", "Ajoutez au moins une photo de la réalisation."],
  ["Pode juntar no máximo 8 fotografias por trabalho.", "You can add up to 8 photos per work.", "每件作品最多可添加8张照片。", "Vous pouvez ajouter jusqu'à 8 photos par réalisation."],
  ["Data inválida.", "Invalid date.", "日期无效。", "Date invalide."],
  ["A data do trabalho não pode ser no futuro.", "The date of the work can't be in the future.", "作品日期不能晚于今天。", "La date de la réalisation ne peut pas être dans le futur."],

  // --- Convites (referrals.ts) ---
  ["O código de convite tem 6 letras e números (ex.: K7M2QX).", "The invite code has 6 letters and numbers (e.g. K7M2QX).", "邀请码由6位字母和数字组成（例如：K7M2QX）。", "Le code d'invitation a 6 lettres et chiffres (ex. : K7M2QX)."],

  // --- Alugueres (rentals.ts) ---
  ["Escolha a data de início.", "Choose the start date.", "请选择开始日期。", "Choisissez la date de début."],
  ["Escolha a data de fim.", "Choose the end date.", "请选择结束日期。", "Choisissez la date de fin."],
  ["A data de início já passou.", "The start date has already passed.", "开始日期已过。", "La date de début est déjà passée."],
  ["A data de fim tem de ser depois do início.", "The end date must be after the start.", "结束日期必须晚于开始日期。", "La date de fin doit être après le début."],

  // --- Segurança (safety.ts) ---
  ["No máximo 20 pontos de encontro.", "Up to 20 meeting points.", "最多20个见面地点。", "Jusqu'à 20 points de rencontre."],

  // --- Loja (shop.ts) ---
  ["Indique o nome do produto.", "Enter the product name.", "请填写商品名称。", "Indiquez le nom du produit."],
  ["Indique a quantidade em stock (número inteiro).", "Enter the quantity in stock (whole number).", "请填写库存数量（整数）。", "Indiquez la quantité en stock (nombre entier)."],
  ["Indique um telefone válido para o vendedor o contactar.", "Enter a valid phone number so the seller can contact you.", "请填写有效的电话号码，以便卖家联系您。", "Indiquez un numéro de téléphone valide pour que le vendeur puisse vous contacter."],
  ["Indique a morada ou ponto de referência para a entrega.", "Enter the address or a landmark for delivery.", "请填写收货地址或参考地标。", "Indiquez l'adresse ou un point de repère pour la livraison."],

  // --- Orçamento (wanted.ts) ---
  ["Indique um orçamento mínimo válido.", "Enter a valid minimum budget.", "请填写有效的最低预算。", "Indiquez un budget minimum valide."],
  ["Indique um orçamento máximo válido.", "Enter a valid maximum budget.", "请填写有效的最高预算。", "Indiquez un budget maximum valide."],
  ["O orçamento mínimo não pode ser maior que o máximo.", "The minimum budget can't be higher than the maximum.", "最低预算不能高于最高预算。", "Le budget minimum ne peut pas être supérieur au maximum."]
];
