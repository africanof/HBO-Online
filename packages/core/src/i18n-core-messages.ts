import type { CoreRow } from "./i18n-core-errors";

/**
 * Mensagens dos validate*() e frases que as funções do core devolvem (passos, avisos).
 * Cada linha: [português exato, inglês, chinês simplificado].
 */
export const CORE_MESSAGE_ROWS: CoreRow[] = [
  // --- Classificados (classified-listings.ts) ---
  ["O título é demasiado curto.", "The title is too short.", "标题太短。"],
  ["O título não pode ter mais de 140 caracteres.", "The title can't be longer than 140 characters.", "标题不能超过140个字符。"],
  ["A descrição é demasiado longa.", "The description is too long.", "描述太长。"],
  ["Indique um preço válido.", "Enter a valid price.", "请填写有效的价格。"],
  ["Escolha a província.", "Choose the province.", "请选择省份。"],
  ["Escolha o município.", "Choose the municipality.", "请选择市镇。"],

  // --- Devoluções (disputes.ts) ---
  ["A encomenda ainda está pendente: pode cancelá-la.", "The order is still pending: you can cancel it.", "订单仍在待处理：您可以取消。"],
  ["Encomenda cancelada.", "Order cancelled.", "订单已取消。"],
  ["Ainda não pagou esta encomenda.", "You haven't paid for this order yet.", "您尚未支付此订单。"],
  ["Já tem um pedido aberto para esta encomenda.", "You already have an open request for this order.", "该订单已有一个进行中的申请。"],
  ["Esta encomenda já teve um pedido decidido.", "This order has already had a request decided.", "该订单的申请已有处理结果。"],
  ["Se não recebeu a encomenda, só pode pedir o reembolso.", "If you didn't receive the order, you can only ask for a refund.", "如果您没有收到订单，只能申请退款。"],
  ["Explique o que aconteceu (pelo menos 5 letras).", "Explain what happened (at least 5 characters).", "请说明发生了什么（至少5个字符）。"],
  ["A explicação é demasiado longa (máximo 1000 letras).", "The explanation is too long (maximum 1000 characters).", "说明太长（最多1000个字符）。"],
  ["O Huambo Online vai devolver o dinheiro guardado. Indique abaixo para onde (IBAN ou Multicaixa Express).", "Huambo Online will return the held money. Enter below where to send it (IBAN or Multicaixa Express).", "Huambo Online 将退还托管款项。请在下方填写退款账户（IBAN 或 Multicaixa Express）。"],
  ["O Huambo Online vai devolver ao comprador o dinheiro que estava guardado. Não precisa de enviar dinheiro.", "Huambo Online will return the held money to the buyer. You don't need to send any money.", "Huambo Online 将把托管款项退还给买家。您无需汇款。"],
  ["O Huambo Online enviou o reembolso. Confirme quando receber.", "Huambo Online has sent the refund. Confirm when you receive it.", "Huambo Online 已发出退款。收到后请确认。"],
  ["O Huambo Online enviou o reembolso ao comprador.", "Huambo Online has sent the refund to the buyer.", "Huambo Online 已向买家发出退款。"],
  ["O vendedor tem de responder. Se não responder em 3 dias, pode chamar a administração.", "The seller must reply. If they don't reply within 3 days, you can call in the administration.", "卖家需要回复。如果3天内未回复，您可以请管理员介入。"],
  ["Responda ao pedido: aceite ou explique porque recusa.", "Reply to the request: accept it or explain why you decline.", "请回复申请：接受，或说明拒绝的理由。"],
  ["O vendedor recusou. Se não concorda, chame a administração.", "The seller declined. If you don't agree, call in the administration.", "卖家已拒绝。如果您不同意，请管理员介入。"],
  ["Recusou o pedido. O comprador pode chamar a administração.", "You declined the request. The buyer can call in the administration.", "您已拒绝申请。买家可以请管理员介入。"],
  ["Devolva o artigo ao vendedor (combine pelas mensagens) e carregue em «Já devolvi o artigo».", "Return the item to the seller (arrange it through messages) and tap «I've returned the item».", "请将物品退回卖家（通过消息约定），然后点击「我已退回物品」。"],
  ["Espere que o comprador devolva o artigo.", "Wait for the buyer to return the item.", "请等待买家退回物品。"],
  ["O vendedor vai confirmar que recebeu o artigo.", "The seller will confirm they received the item.", "卖家将确认已收到物品。"],
  ["Confirme quando receber o artigo devolvido.", "Confirm when you receive the returned item.", "收到退回的物品后请确认。"],
  ["O vendedor tem de lhe devolver o dinheiro.", "The seller must refund your money.", "卖家需要向您退款。"],
  ["Devolva o dinheiro ao comprador e carregue em «Já devolvi o dinheiro».", "Refund the buyer and tap «I've refunded the money».", "请向买家退款，然后点击「我已退款」。"],
  ["Confirme quando receber o dinheiro. Se não chegou em 3 dias, chame a administração.", "Confirm when you receive the money. If it hasn't arrived within 3 days, call in the administration.", "收到款项后请确认。如果3天内未到账，请管理员介入。"],
  ["Espere que o comprador confirme que recebeu.", "Wait for the buyer to confirm they received it.", "请等待买家确认收到。"],
  ["O vendedor vai enviar outro artigo. Confirme quando o receber.", "The seller will send another item. Confirm when you receive it.", "卖家将寄出另一件物品。收到后请确认。"],
  ["Envie o artigo novo ao comprador.", "Send the new item to the buyer.", "请将新物品寄给买家。"],
  ["A administração está a analisar e vai decidir. Pode juntar mensagens e fotografias.", "The administration is reviewing and will decide. You can add messages and photos.", "管理员正在审核并将作出裁决。您可以补充消息和照片。"],

  // --- Reservas (venues.ts) ---
  ["Escolha a sua empresa (registe-a primeiro em «Empresas»).", "Choose your business (register it first in «Businesses»).", "请选择您的企业（请先在「企业」中登记）。"],
  ["Escolha o tipo de estabelecimento.", "Choose the type of venue.", "请选择商家类型。"],
  ["Escolha pelo menos uma forma de pagamento (no local ou adiantado).", "Choose at least one payment method (on site or in advance).", "请至少选择一种付款方式（到店或预付）。"],
  ["O tempo de tolerância tem de ser entre 15 minutos e 24 horas.", "The grace period must be between 15 minutes and 24 hours.", "保留时间必须在15分钟到24小时之间。"],
  ["Hora de entrada inválida (ex.: 14:00).", "Invalid check-in time (e.g. 14:00).", "入住时间无效（例如：14:00）。"],
  ["Hora de saída inválida (ex.: 12:00).", "Invalid check-out time (e.g. 12:00).", "退房时间无效（例如：12:00）。"],
  ["As regras são demasiado longas (máximo 600 letras).", "The rules are too long (maximum 600 characters).", "规则太长（最多600个字符）。"],
  ["Para receber pagamentos adiantados, indique o IBAN ou o número Multicaixa Express.", "To receive advance payments, enter the IBAN or Multicaixa Express number.", "如需接收预付款，请填写 IBAN 或 Multicaixa Express 号码。"],
  ["Indique o nome do titular da conta.", "Enter the account holder's name.", "请填写账户持有人姓名。"],
  ["Escreva o tipo de quarto (ex.: «Quarto duplo»).", "Enter the room type (e.g. «Double room»).", "请填写房型（例如：「双人间」）。"],
  ["Escreva o nome.", "Enter the name.", "请填写名称。"],
  ["O nome é demasiado longo.", "The name is too long.", "名称太长。"],
  ["Indique o preço.", "Enter the price.", "请填写价格。"],
  ["Pode juntar no máximo 6 fotografias.", "You can add up to 6 photos.", "最多可添加6张照片。"],
  ["Quantos quartos deste tipo tem? (número inteiro)", "How many rooms of this type do you have? (whole number)", "此房型有多少间？（整数）"],
  ["Quantas pessoas cabem em cada quarto?", "How many people fit in each room?", "每间房可住几人？"],
  ["A quantidade mínima tem de ser maior que zero.", "The minimum quantity must be greater than zero.", "最低数量必须大于零。"],
  ["Este tipo de pedido não existe aqui.", "This type of order isn't available here.", "此处没有这种类型的订单。"],
  ["Este estabelecimento só aceita pagamento adiantado.", "This venue only accepts advance payment.", "该商家只接受预付款。"],
  ["Este estabelecimento não aceita pagamento adiantado.", "This venue doesn't accept advance payment.", "该商家不接受预付款。"],
  ["Escreva o seu nome.", "Enter your name.", "请填写您的姓名。"],
  ["Já não há quartos livres suficientes nestas datas.", "There aren't enough free rooms left on these dates.", "这些日期的空房已不足。"],
  ["Escolha um tipo de quarto.", "Choose a room type.", "请选择房型。"],
  ["Indique o número de quartos.", "Enter the number of rooms.", "请填写房间数量。"],
  ["Escolha as datas de entrada e de saída.", "Choose the check-in and check-out dates.", "请选择入住和退房日期。"],
  ["A data de entrada já passou.", "The check-in date has already passed.", "入住日期已过。"],
  ["A saída tem de ser depois da entrada.", "Check-out must be after check-in.", "退房日期必须晚于入住日期。"],
  ["Máximo de 60 noites por reserva.", "Maximum of 60 nights per booking.", "每次预订最多60晚。"],
  ["São pessoas a mais para estes quartos. Escolha mais quartos.", "Too many people for these rooms. Choose more rooms.", "这些房间容纳不了这么多人。请选择更多房间。"],
  ["Indique para quantas pessoas é a mesa.", "Enter how many people the table is for.", "请填写用餐人数。"],
  ["Escolha o dia e a hora.", "Choose the date and time.", "请选择日期和时间。"],
  ["Escolha o dia e a hora para levantar.", "Choose the date and time for collection.", "请选择自取的日期和时间。"],
  ["Esse dia e hora já passaram.", "That date and time have already passed.", "该日期和时间已过。"],
  ["Escreva a referência ou o número da operação (como está no comprovativo).", "Enter the reference or transaction number (as shown on the proof).", "请填写参考号或交易编号（与付款凭证一致）。"],
  ["Escreva o motivo (ex.: não recebi o dinheiro).", "Enter the reason (e.g. I didn't receive the money).", "请填写原因（例如：我没有收到款项）。"],
  ["Escreva o motivo (o dono vai ler).", "Enter the reason (the owner will read it).", "请填写原因（所有者将会看到）。"],

  // --- Eventos (events.ts) ---
  ["Escreva o nome do evento.", "Enter the name of the event.", "请填写活动名称。"],
  ["Escolha o dia e a hora do início.", "Choose the start date and time.", "请选择开始日期和时间。"],
  ["O fim tem de ser depois do início.", "The end must be after the start.", "结束时间必须晚于开始时间。"],
  ["Escreva o local (ex.: Cine Ruacaná).", "Enter the venue (e.g. Cine Ruacaná).", "请填写地点（例如：Cine Ruacaná）。"],
  ["Junte pelo menos um tipo de bilhete (pode ser grátis).", "Add at least one ticket type (it can be free).", "请至少添加一种门票（可以免费）。"],
  ["Indique o IBAN ou o número Multicaixa Express para receber o dinheiro dos bilhetes.", "Enter the IBAN or Multicaixa Express number to receive the ticket money.", "请填写用于接收门票款项的 IBAN 或 Multicaixa Express 号码。"],
  ["Escreva o motivo do cancelamento.", "Enter the reason for cancelling.", "请填写取消原因。"],
  ["Escolha quantos bilhetes quer.", "Choose how many tickets you want.", "请选择所需门票数量。"],
  ["Escreva o seu nome (aparece no bilhete).", "Enter your name (it appears on the ticket).", "请填写您的姓名（将显示在门票上）。"],
  ["Escreva a referência ou o número da operação.", "Enter the reference or transaction number.", "请填写参考号或交易编号。"],

  // --- Combustível (fuel.ts) ---
  ["Escreva o nome do posto ou do ponto de venda.", "Enter the name of the station or point of sale.", "请填写站点或销售点名称。"],
  ["Escolha pelo menos um produto que vende.", "Choose at least one product you sell.", "请至少选择一种您销售的产品。"],
  ["Marcou gás: escolha «Combustível e gás».", "You ticked gas: choose «Fuel and gas».", "您勾选了燃气：请选择「燃油和燃气」。"],
  ["Marcou combustível: escolha «Combustível e gás».", "You ticked fuel: choose «Fuel and gas».", "您勾选了燃油：请选择「燃油和燃气」。"],
  ["O tempo para levantar tem de ser entre 15 minutos e 24 horas.", "The collection time must be between 15 minutes and 24 hours.", "提取时间必须在15分钟到24小时之间。"],
  ["Indique a quantidade.", "Enter the quantity.", "请填写数量。"],
  ["Indique o número de botijas (sem vírgulas).", "Enter the number of gas bottles (whole number).", "请填写气罐数量（整数）。"],
  ["Preço inválido.", "Invalid price.", "价格无效。"],
  ["O máximo por pessoa tem de ser maior que zero.", "The maximum per person must be greater than zero.", "每人上限必须大于零。"],

  // --- Pagamento protegido (protected-payments.ts) ---
  ["Encomenda cancelada. Não pague.", "Order cancelled. Don't pay.", "订单已取消。请勿付款。"],
  ["Recebemos o seu comprovativo. Vamos confirmar e avisá-lo.", "We've received your proof. We'll confirm it and let you know.", "我们已收到您的付款凭证。确认后会通知您。"],
  ["Pague a referência no Multicaixa Express, num ATM ou no banco. A confirmação é automática.", "Pay the reference on Multicaixa Express, at an ATM or at the bank. Confirmation is automatic.", "请通过 Multicaixa Express、ATM 或银行支付该参考号。确认会自动完成。"],
  ["Tem um pedido de devolução/reembolso aberto: o dinheiro fica guardado até se resolver.", "You have an open return/refund request: the money stays held until it's resolved.", "您有一个进行中的退货/退款申请：款项将保持托管直至解决。"],
  ["O dinheiro está guardado. Quando receber a encomenda, confirme a receção.", "The money is held. When you receive the order, confirm receipt.", "款项已托管。收到订单后请确认收货。"],
  ["Concluído: o pagamento foi entregue ao vendedor.", "Completed: the payment was released to the seller.", "已完成：款项已交给卖家。"],
  ["O dinheiro foi-lhe devolvido.", "The money has been returned to you.", "款项已退还给您。"],
  ["Encomenda cancelada antes do pagamento.", "Order cancelled before payment.", "订单在付款前已取消。"],
  ["À espera do pagamento do cliente. Não envie ainda: vai receber o aviso «Pagamento recebido».", "Waiting for the customer's payment. Don't ship yet: you'll get the «Payment received» notice.", "等待客户付款。请暂不发货：您将收到「已收到付款」通知。"],
  ["Encomenda cancelada: o Huambo Online devolve o dinheiro ao cliente.", "Order cancelled: Huambo Online returns the money to the customer.", "订单已取消：Huambo Online 将款项退还给客户。"],
  ["Pago ✔ O dinheiro está guardado pelo Huambo Online. Prepare e entregue a encomenda; depois marque como «Entregue».", "Paid ✔ The money is held by Huambo Online. Prepare and deliver the order; then mark it as «Delivered».", "已付款 ✔ 款项由 Huambo Online 托管。请备货并送达订单，然后标记为「已送达」。"],
  ["O dinheiro foi devolvido ao cliente.", "The money was returned to the customer.", "款项已退还给客户。"],
  ["Escreva o valor a levantar.", "Enter the amount to withdraw.", "请填写提现金额。"],

  // --- Denúncias e verificação (trust.ts) ---
  ["Envie uma fotografia (JPG, PNG, WEBP) ou um PDF.", "Send a photo (JPG, PNG, WEBP) or a PDF.", "请发送照片（JPG、PNG、WEBP）或 PDF。"],
  ["O documento é demasiado grande (máximo 5 MB).", "The document is too large (maximum 5 MB).", "证件文件太大（最大5 MB）。"],
  ["Tire a fotografia da frente do BI.", "Take the photo of the front of the ID card.", "请拍摄身份证正面照片。"],
  ["Tire a fotografia do verso do BI.", "Take the photo of the back of the ID card.", "请拍摄身份证背面照片。"],
  ["Tire a selfie a segurar o BI.", "Take the selfie holding the ID card.", "请拍摄手持身份证的自拍。"],
  ["Escreva o número do BI como está no documento (9 algarismos, 2 letras e 3 algarismos, ex.: 004512345LA042).", "Enter the ID card number as it appears on the document (9 digits, 2 letters and 3 digits, e.g. 004512345LA042).", "请按证件上的样式填写身份证号码（9位数字、2个字母和3位数字，例如：004512345LA042）。"],

  // --- Inspeções (inspections.ts) ---
  ["Escreva um telefone para combinar a visita.", "Enter a phone number to arrange the visit.", "请填写电话以便约定上门时间。"],

  // --- Administração (admin.ts) ---
  ["Indique o nome da categoria.", "Enter the category name.", "请填写分类名称。"],

  // --- Campo (agro.ts) ---
  ["Escolha o tipo de produto do campo.", "Choose the type of farm product.", "请选择农产品类型。"],
  ["Escolha a unidade de venda (kg, saco, cabeça…).", "Choose the sales unit (kg, bag, head…).", "请选择销售单位（公斤、袋、头…）。"],
  ["Indique uma quantidade válida.", "Enter a valid quantity.", "请填写有效的数量。"],
  ["Indique a data em que fica disponível.", "Enter the date it becomes available.", "请填写可供货日期。"],
  ["A data «disponível a partir de» não pode ser no passado.", "The «available from» date can't be in the past.", "「供货起始日期」不能早于今天。"],

  // --- Serviços e avaliações (deal-reviews.ts) ---
  ["O comentário é demasiado longo (máximo 1000 letras).", "The comment is too long (maximum 1000 characters).", "评论太长（最多1000个字符）。"],
  ["A descrição é demasiado longa (máximo 1000 letras).", "The description is too long (maximum 1000 characters).", "描述太长（最多1000个字符）。"],

  // --- Planos (plans.ts) ---
  ["A referência é demasiado longa.", "The reference is too long.", "参考号太长。"],
  ["No máximo 6 contas.", "Up to 6 accounts.", "最多6个账户。"],

  // --- Vídeos e lives (promo.ts) ---
  ["Escolha em nome de quem publica (perfil, empresa ou loja).", "Choose who you're posting on behalf of (profile, business or shop).", "请选择以谁的名义发布（个人资料、企业或商店）。"],
  ["Escreva um título (pelo menos 4 letras).", "Enter a title (at least 4 characters).", "请填写标题（至少4个字符）。"],

  // --- Modos de venda (sale-modes.ts) ---
  ["Escolha como quer vender: preço fixo, negociável, propostas, leilão ou troca.", "Choose how you want to sell: fixed price, negotiable, offers, auction or swap.", "请选择出售方式：固定价格、可议价、接受报价、拍卖或交换。"],
  ["Indique o preço inicial do leilão.", "Enter the auction's starting price.", "请填写拍卖起拍价。"],
  ["O leilão dura de 1 a 30 dias.", "The auction lasts from 1 to 30 days.", "拍卖时长为1到30天。"],
  ["Diga o que aceita em troca.", "Say what you'll accept in exchange.", "请说明您接受用什么交换。"],
  ["Diga o que oferece em troca.", "Say what you're offering in exchange.", "请说明您用什么来交换。"],
  ["Indique o valor da proposta.", "Enter the offer amount.", "请填写报价金额。"],

  // --- Agentes (agents.ts) ---
  ["Escreva um telefone com 9 algarismos.", "Enter a 9-digit phone number.", "请填写9位数的电话号码。"],
  ["Escolha pelo menos uma comissão.", "Choose at least one commission.", "请至少选择一项佣金。"],

  // --- Comissões e destaques ---
  ["Escolha a comissão que quer pagar.", "Choose the commission you want to pay.", "请选择要支付的佣金。"],

  // --- Conformidade (conformity.ts) ---
  ["Escolha o que está errado.", "Choose what's wrong.", "请选择问题所在。"],
  ["Escolha o que quer: troca, devolução ou reembolso.", "Choose what you want: exchange, return or refund.", "请选择您的诉求：换货、退货或退款。"],
  ["A explicação é demasiado longa.", "The explanation is too long.", "说明太长。"],
  ["O valor a reembolsar tem de ser maior que zero.", "The amount to refund must be greater than zero.", "退款金额必须大于零。"],
  ["Escreva o motivo da recusa.", "Enter the reason for rejecting.", "请填写拒绝原因。"],
  ["Escreva a decisão e o motivo.", "Enter the decision and the reason.", "请填写裁决和理由。"],

  // --- Entregas (delivery.ts) / perfil (profile.ts) / empresas (directory.ts) ---
  ["Indique o seu nome.", "Enter your name.", "请填写您的姓名。"],
  ["Indique um telefone válido.", "Enter a valid phone number.", "请填写有效的电话号码。"],
  ["Escolha o meio de transporte.", "Choose your means of transport.", "请选择交通工具。"],
  ["Telefone inválido. Use apenas números (ex.: 923 000 000).", "Invalid phone number. Use numbers only (e.g. 923 000 000).", "电话号码无效。请只使用数字（例如：923 000 000）。"],
  ["Este telefone já está associado a outra conta.", "This phone number is already linked to another account.", "该电话号码已关联其他账户。"],
  ["Escreva a sua área de atividade.", "Enter your field of work.", "请填写您的业务领域。"],
  ["A área de atividade é demasiado longa (máximo 60 letras).", "The field of work is too long (maximum 60 characters).", "业务领域太长（最多60个字符）。"],
  ["Indique o nome profissional.", "Enter your professional name.", "请填写您的职业名称。"],
  ["Escolha a área de atividade.", "Choose the field of work.", "请选择业务领域。"],
  ["Escolha o município onde trabalha.", "Choose the municipality where you work.", "请选择您工作的市镇。"],
  ["Telefone inválido.", "Invalid phone number.", "电话号码无效。"],
  ["Número de WhatsApp inválido.", "Invalid WhatsApp number.", "WhatsApp 号码无效。"],
  ["Indique o nome do serviço.", "Enter the name of the service.", "请填写服务名称。"],
  ["Indique o nome da empresa.", "Enter the business name.", "请填写企业名称。"],
  ["Escolha a categoria.", "Choose the category.", "请选择分类。"],
  ["Escreva a sua mensagem.", "Write your message.", "请填写您的消息。"],

  // --- Leilões (listing-auctions.ts) ---
  ["Indique o preço inicial.", "Enter the starting price.", "请填写起拍价。"],
  ["O preço mínimo de venda não pode ser menor que o inicial.", "The reserve price can't be lower than the starting price.", "最低成交价不能低于起拍价。"],
  ["Indique um incremento válido.", "Enter a valid increment.", "请填写有效的加价幅度。"],
  ["A duração tem de ser entre 1 e 30 dias.", "The duration must be between 1 and 30 days.", "时长必须在1到30天之间。"],
  ["Indique o valor do lance.", "Enter the bid amount.", "请填写出价金额。"],
  ["O leilão já terminou.", "The auction has already ended.", "拍卖已结束。"],
  ["Não tem lances neste leilão.", "You have no bids in this auction.", "您在该拍卖中没有出价。"],

  // --- Praças (markets.ts) ---
  ["A morada é demasiado longa.", "The address is too long.", "地址太长。"],
  ["O horário é demasiado longo.", "The opening hours text is too long.", "营业时间太长。"],
  ["O endereço da fotografia tem de começar por https://", "The photo address must start with https://", "照片地址必须以 https:// 开头"],

  // --- Portfólio (portfolio.ts) ---
  ["Dê um título ao trabalho (ex.: «Casa de banho remodelada»).", "Give the work a title (e.g. «Renovated bathroom»).", "请为作品填写标题（例如：「翻新的浴室」）。"],
  ["O título é demasiado longo (máximo 120 letras).", "The title is too long (maximum 120 characters).", "标题太长（最多120个字符）。"],
  ["Junte pelo menos uma fotografia do trabalho.", "Add at least one photo of the work.", "请至少添加一张作品照片。"],
  ["Pode juntar no máximo 8 fotografias por trabalho.", "You can add up to 8 photos per work.", "每件作品最多可添加8张照片。"],
  ["Data inválida.", "Invalid date.", "日期无效。"],
  ["A data do trabalho não pode ser no futuro.", "The date of the work can't be in the future.", "作品日期不能晚于今天。"],

  // --- Convites (referrals.ts) ---
  ["O código de convite tem 6 letras e números (ex.: K7M2QX).", "The invite code has 6 letters and numbers (e.g. K7M2QX).", "邀请码由6位字母和数字组成（例如：K7M2QX）。"],

  // --- Alugueres (rentals.ts) ---
  ["Escolha a data de início.", "Choose the start date.", "请选择开始日期。"],
  ["Escolha a data de fim.", "Choose the end date.", "请选择结束日期。"],
  ["A data de início já passou.", "The start date has already passed.", "开始日期已过。"],
  ["A data de fim tem de ser depois do início.", "The end date must be after the start.", "结束日期必须晚于开始日期。"],

  // --- Segurança (safety.ts) ---
  ["No máximo 20 pontos de encontro.", "Up to 20 meeting points.", "最多20个见面地点。"],

  // --- Loja (shop.ts) ---
  ["Indique o nome do produto.", "Enter the product name.", "请填写商品名称。"],
  ["Indique a quantidade em stock (número inteiro).", "Enter the quantity in stock (whole number).", "请填写库存数量（整数）。"],
  ["Indique um telefone válido para o vendedor o contactar.", "Enter a valid phone number so the seller can contact you.", "请填写有效的电话号码，以便卖家联系您。"],
  ["Indique a morada ou ponto de referência para a entrega.", "Enter the address or a landmark for delivery.", "请填写收货地址或参考地标。"],

  // --- Orçamento (wanted.ts) ---
  ["Indique um orçamento mínimo válido.", "Enter a valid minimum budget.", "请填写有效的最低预算。"],
  ["Indique um orçamento máximo válido.", "Enter a valid maximum budget.", "请填写有效的最高预算。"],
  ["O orçamento mínimo não pode ser maior que o máximo.", "The minimum budget can't be higher than the maximum.", "最低预算不能高于最高预算。"]
];
