import type { SupabaseClient } from "@supabase/supabase-js";
import { placeColumns, type GeoPoint } from "./places";
import type { ClassifiedListingType, ClassifiedPurpose, ClassifiedStatus } from "@huambo-online/types";

export const CLASSIFIED_MAX_PHOTOS = 10;
export const CLASSIFIED_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const CLASSIFIED_MEDIA_BUCKET = "classified-media";

export const LISTING_TYPE_LABELS: Record<ClassifiedListingType, string> = {
  classified: "Classificado", product: "Produto", vehicle: "Veículo", real_estate: "Imóvel", service: "Serviço"
};
export const PURPOSE_LABELS: Record<ClassifiedPurpose, string> = {
  sale: "Venda", rent: "Arrendamento", lease: "Aluguer", wanted: "Procuro", service: "Serviço", auction: "Leilão"
};
export const STATUS_LABELS: Record<ClassifiedStatus, string> = {
  draft: "Rascunho", published: "Publicado", paused: "Pausado", sold: "Vendido", rented: "Arrendado", closed: "Fechado", cancelled: "Cancelado"
};
export const PUBLISHABLE_PURPOSES: ClassifiedPurpose[] = ["sale", "rent", "lease", "wanted", "service"];

export function formatPrice(price: number | string | null | undefined, currency = "AOA"): string {
  if (price === null || price === undefined || price === "") return "Preço sob consulta";
  const n = Number(price);
  if (!Number.isFinite(n)) return "Preço sob consulta";
  const whole = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return whole + " " + (currency === "AOA" ? "Kz" : currency);
}

export interface ClassifiedDraftInput {
  ownerId: string; categoryId?: string; addressId?: string; listingType: ClassifiedListingType;
  purpose: ClassifiedPurpose; title: string; description?: string; price?: number;
  provinceId?: string; municipalityId?: string; marketId?: string; videoUrl?: string; budgetMin?: number; budgetMax?: number;
  attributes?: Record<string, unknown>; media?: string[];
  /** Código do agente no terreno que ajudou a pôr o anúncio (opcional, ex.: AG1001). */
  agentCode?: string;
  /** «Como chegar» e ponto no mapa (o Supabase arredonda o ponto dos anúncios a ~100 m). */
  directions?: string; point?: GeoPoint | null;
  /** Declaração de conformidade (obrigatória para publicar, exceto «Procura-se»). */
  conformity?: boolean;
  /** Como vende: preço fixo, negociável, aberto a propostas, leilão ou só troca. */
  saleMode?: "fixed" | "negotiable" | "offers" | "auction" | "trade"; acceptsTrade?: boolean; tradeWants?: string;
}

/** Valida o formulário antes de enviar. Devolve a mensagem de erro ou null. */
export function validateClassifiedDraft(input: Omit<ClassifiedDraftInput, "ownerId" | "media"> & { photoCount?: number }): string | null {
  const title = input.title.trim();
  if (!title) return "Indique um título.";
  if (title.length < 3) return "O título é demasiado curto.";
  if (title.length > 140) return "O título não pode ter mais de 140 caracteres.";
  if ((input.description ?? "").length > 5000) return "A descrição é demasiado longa.";
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) return "Indique um preço válido.";
  if (!input.provinceId) return "Escolha a província.";
  if (!input.municipalityId) return "Escolha o município.";
  if ((input.photoCount ?? 0) > CLASSIFIED_MAX_PHOTOS) return `Pode juntar no máximo ${CLASSIFIED_MAX_PHOTOS} fotografias.`;
  return null;
}

/** Converte o texto do preço ("15 000", "15000,50") num número, ou undefined se vazio. */
export function parsePrice(raw: string): number | undefined {
  const clean = raw.replace(/\s/g, "").replace(",", ".");
  if (!clean) return undefined;
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
}

/** O território fica guardado em attributes (provinceId/municipalityId) para o Site e a APP lerem igual. */
export function listingTerritory(listing: { attributes?: unknown } | null | undefined): { provinceId?: string; municipalityId?: string } {
  const a = (listing?.attributes ?? {}) as Record<string, unknown>;
  return {
    provinceId: typeof a.provinceId === "string" && a.provinceId ? a.provinceId : undefined,
    municipalityId: typeof a.municipalityId === "string" && a.municipalityId ? a.municipalityId : undefined
  };
}

function buildAttributes(input: Pick<ClassifiedDraftInput, "attributes" | "provinceId" | "municipalityId">) {
  const attrs: Record<string, unknown> = { ...(input.attributes ?? {}) };
  if (input.provinceId) attrs.provinceId = input.provinceId;
  if (input.municipalityId) attrs.municipalityId = input.municipalityId;
  return attrs;
}

const errorMessages: [RegExp, string][] = [
  [/row-level security|Unauthorized|403/i, "Sem permissão para esta operação. Inicie sessão novamente."],
  [/LOCATION_REQUIRED/, "Indique a localização do anúncio."],
  [/TITLE_REQUIRED/, "Indique um título."],
  [/INVALID_ATTRIBUTES/, "Há dados inválidos no anúncio (ex.: marca do veículo)."],
  [/TOO_MANY_PHOTOS/, `Pode juntar no máximo ${CLASSIFIED_MAX_PHOTOS} fotografias.`],
  [/NOT_LISTING_OWNER/, "Só o dono do anúncio pode fazer isto."],
  [/LISTING_NOT_FOUND/, "Anúncio não encontrado ou já não está publicado."],
  [/CANNOT_CONTACT_SELF/, "Este anúncio é seu."],
  [/AUTH_REQUIRED|JWT|not authenticated/i, "Inicie sessão para continuar."],
  [/ACCOUNT_SUSPENDED/, "A sua conta está suspensa. Contacte o apoio Huambo Online."],
  [/CANNOT_REVIEW_SELF/, "Não pode avaliar o seu próprio perfil."],
  [/INVALID_RATING/, "Escolha de 1 a 5 estrelas."],
  [/USE_REVIEW_FUNCTION/, "Use o formulário de avaliação."],
  [/provider_profiles_phone|duplicate key.*phone/i, "Este telefone já está a ser usado."],
  [/STOCK_CHANGED/, "Algum produto já não tem stock suficiente. Reveja o carrinho."],
  [/CART_EMPTY/, "O carrinho está vazio."],
  [/CANNOT_BUY_OWN_PRODUCT/, "Não pode comprar o seu próprio produto."],
  [/DELIVERY_ADDRESS_REQUIRED/, "Indique a morada para a entrega."],
  [/PHONE_REQUIRED/, "Indique um telefone."],
  [/LISTING_NOT_PUBLISHED/, "Só pode destacar anúncios publicados."],
  [/BOOST_NOT_FOUND/, "Destaque não encontrado."],
  [/CANNOT_BLOCK_SELF/, "Não se pode bloquear a si próprio."],
  [/\bBLOCKED\b/, "Não pode enviar mensagens nesta conversa: uma das pessoas bloqueou a outra."],
  [/AGENT_NOT_FOUND/, "Código de agente não encontrado. Confirme o código (ex.: AG1001) com o agente."],
  [/CANNOT_BE_OWN_AGENT/, "Não pode usar o seu próprio código de agente nos seus anúncios."],
  [/AGENT_LOCKED/, "Este anúncio já tem a comissão do agente registada: o agente já não pode ser mudado."],
  [/AGENT_SUSPENDED/, "A sua conta de agente está suspensa. Fale com a administração."],
  [/MARKET_REQUIRED/, "Escolha a praça onde trabalha."],
  [/INVALID_LOCATION/, "O ponto tem de ser em Angola."],
  [/EVENT_NEEDS_TICKETS/, "Junte pelo menos um tipo de bilhete antes de publicar o evento."],
  [/EVENT_NEEDS_PAYMENT_INFO/, "Indique o IBAN ou o Multicaixa Express para receber o dinheiro dos bilhetes."],
  [/EVENT_IN_PAST/, "O evento tem de ser no futuro."],
  [/EVENT_FEES_OVERDUE/, "Tem comissões de eventos anteriores por pagar. Pague-as para publicar eventos novos."],
  [/EVENT_CANCELLED/, "Este evento foi cancelado."],
  [/USE_CANCEL_FUNCTION/, "Use o botão «Cancelar evento»."],
  [/TICKET_TYPE_HAS_ORDERS/, "Este tipo de bilhete já tem reservas: não pode ser apagado."],
  [/TICKETS_ALREADY_SOLD/, "Não pode pôr menos bilhetes do que os já reservados ou vendidos."],
  [/TICKET_PRICE_LOCKED/, "Não pode mudar o preço de um bilhete que já tem reservas."],
  [/TICKET_TYPE_NOT_FOUND/, "Este bilhete já não está à venda."],
  [/EVENT_NOT_ON_SALE/, "Este evento já não está à venda."],
  [/CANNOT_BUY_OWN_TICKETS/, "Não pode comprar bilhetes do seu próprio evento."],
  [/INVALID_TICKET_QUANTITY/, "Escolha uma quantidade válida de bilhetes."],
  [/NOT_ENOUGH_TICKETS/, "Já não há bilhetes suficientes. Escolha menos."],
  [/TICKET_ORDER_OPEN/, "Já tem uma reserva por pagar neste evento. Pague-a ou cancele-a em «Os meus bilhetes»."],
  [/TICKET_ORDER_NOT_FOUND/, "Reserva não encontrada."],
  [/TICKET_RESERVATION_EXPIRED/, "A reserva caducou. Faça uma nova reserva."],
  [/\bREFERENCE_REQUIRED\b/, "Escreva a referência do pagamento (ou junte o comprovativo)."],
  [/\bINVALID_METHOD\b/, "Escolha como pagou."],
  [/\bINVALID_PROOF\b/, "O comprovativo não é válido. Envie outra vez."],
  [/NOT_SUBJECT_OWNER/, "Só pode publicar em nome do seu perfil, empresa ou loja."],
  [/VIDEO_REQUIRED/, "Envie o vídeo ou cole a ligação do YouTube, Facebook, TikTok ou Instagram."],
  [/LIVE_LINK_REQUIRED/, "Cole a ligação da live (YouTube, Facebook, TikTok ou Instagram)."],
  [/LIVE_TIME_REQUIRED/, "Indique o dia e a hora da live."],
  [/LIVE_DURATION_INVALID/, "Escolha quanto tempo dura a live."],
  [/LIVE_IN_PAST/, "A live tem de ser agora ou no futuro."],
  [/LIVE_TOO_FAR/, "Só pode anunciar lives até 60 dias antes."],
  [/LIVE_ENDED/, "Esta live já terminou."],
  [/TOO_MANY_POSTS/, "Já publicou 5 vídeos ou lives hoje. Tente amanhã."],
  [/POST_NOT_FOUND/, "Vídeo não encontrado."],
  [/POST_HIDDEN/, "Este vídeo foi escondido pela administração."],
  [/BOOST_PENDING/, "Já há um pedido de destaque à espera de confirmação."],
  [/CANNOT_CHANGE_KIND/, "Não pode mudar o tipo nem o perfil de uma publicação. Crie outra."],
  [/promo_posts_external_url_check/, "A ligação tem de ser do YouTube, Facebook, TikTok ou Instagram (começa por https://)."],
  [/TOO_MANY_STATIONS/, "Já registou 10 postos. Fale connosco para registar mais."],
  [/FUEL_NOT_FOUND/, "Posto ou produto não encontrado."],
  [/FUEL_NO_RESERVATIONS/, "Este posto não aceita reservas neste momento."],
  [/FUEL_NO_PREPAY/, "Este posto não aceita pagamento adiantado. Escolha «Reservar e pagar no posto»."],
  [/FUEL_NOT_AVAILABLE/, "Já não há este produto neste posto. Peça «Avisar-me quando houver»."],
  [/FUEL_NO_PRICE/, "O posto ainda não indicou o preço. Tente mais tarde ou ligue para o posto."],
  [/FUEL_INVALID_QUANTITY/, "Quantidade inválida (veja o máximo por pessoa; botijas sem vírgulas)."],
  [/FUEL_NOT_ENOUGH/, "Já não há quantidade suficiente para reservar. Escolha menos."],
  [/FUEL_ORDER_OPEN/, "Já tem uma reserva ativa deste produto. Levante-a ou cancele-a primeiro."],
  [/FUEL_ORDER_NOT_FOUND/, "Pedido não encontrado."],
  [/INSPECTION_NOT_OWNER/, "Só o dono pode pedir a inspeção (a loja precisa de ter produtos)."],
  [/INSPECTION_ADDRESS_REQUIRED/, "Escreva a morada ou o ponto de referência para a visita."],
  [/INSPECTION_OPEN/, "Já tem um pedido de inspeção aberto. Aguarde a visita."],
  [/INSPECTION_STILL_VALID/, "O selo ainda está válido. Pode pedir nova inspeção no último mês."],
  [/INSPECTION_CHECKLIST/, "Só pode aprovar se confirmou que existe mesmo no local."],
  [/INSPECTION_DATE_REQUIRED/, "Escolha o dia e a hora da visita."],
  [/INSPECTION_NOT_FOUND/, "Este pedido de inspeção já não está aberto."],
  [/FUEL_PROOF_REQUIRED/, "Junte a fotografia do comprovativo de pagamento."],
  [/FUEL_REFERENCE_USED/, "Esta referência de pagamento já foi usada noutro pedido. Se é um engano, fale com o posto."],
  [/FUEL_PROOF_USED/, "Este comprovativo já foi enviado noutro pedido. Envie o comprovativo deste pagamento."],
  [/FUEL_ORDER_EXPIRED/, "O tempo para pagar acabou. Faça uma nova reserva."],
  [/FUEL_REPORT_TOO_SOON/, "Já deu a sua informação sobre este posto há pouco. Obrigado!"],
  [/NOT_STATION_OWNER/, "Só o dono do posto pode fazer isto."],
  [/CANNOT_BUY_OWN/, "Não pode reservar no seu próprio posto ou estabelecimento."],
  [/VENUE_NOT_FOUND/, "Estabelecimento não encontrado (ou ainda à espera de aprovação)."],
  [/VENUE_NO_RESERVATIONS/, "Este estabelecimento não aceita reservas neste momento."],
  [/VENUE_NO_PAY_AT_PLACE/, "Este estabelecimento só aceita pagamento adiantado. Escolha «Pagar já»."],
  [/VENUE_NO_PREPAY/, "Este estabelecimento não aceita pagamento adiantado. Escolha «Pagar no local»."],
  [/VENUE_ONE_ROOM_TYPE/, "Escolha um tipo de quarto de cada vez."],
  [/VENUE_INVALID_DATES/, "Datas inválidas: a saída tem de ser depois da entrada (máximo 60 noites)."],
  [/VENUE_INVALID_GUESTS/, "Indique quantas pessoas são."],
  [/VENUE_TOO_MANY_GUESTS/, "São pessoas a mais para estes quartos. Escolha mais quartos ou outro tipo."],
  [/VENUE_NO_ROOMS/, "Já não há quartos livres deste tipo nestas datas. Experimente outras datas ou outro tipo."],
  [/VENUE_INVALID_TIME/, "Escolha um dia e uma hora válidos (no futuro)."],
  [/VENUE_EMPTY_ORDER/, "Escolha pelo menos um produto."],
  [/VENUE_TOO_MANY_LINES/, "Encomenda com produtos a mais. Divida em duas."],
  [/VENUE_ITEM_NOT_FOUND/, "Um dos produtos já não existe. Atualize a página."],
  [/VENUE_ITEM_NOT_AVAILABLE/, "Um dos produtos já não está disponível. Atualize a página."],
  [/VENUE_INVALID_QUANTITY/, "Quantidade inválida."],
  [/VENUE_DUPLICATE_ITEM/, "O mesmo produto aparece duas vezes."],
  [/VENUE_BELOW_MINIMUM/, "Quantidade abaixo do mínimo deste produto (venda a grosso)."],
  [/VENUE_NOT_ENOUGH/, "Já não há quantidade suficiente. Escolha menos."],
  [/VENUE_ORDER_OPEN/, "Já tem 3 pedidos em aberto neste estabelecimento. Termine ou cancele um primeiro."],
  [/VENUE_NOTHING_TO_PAY/, "Não há nada a pagar adiantado. Escolha «Pagar no local»."],
  [/VENUE_ORDER_NOT_FOUND/, "Pedido não encontrado."],
  [/VENUE_ORDER_EXPIRED/, "O tempo para pagar acabou. Faça um novo pedido."],
  [/VENUE_PROOF_REQUIRED/, "Junte a fotografia do comprovativo de pagamento."],
  [/VENUE_REFERENCE_USED/, "Esta referência de pagamento já foi usada noutro pedido. Se é um engano, fale com o estabelecimento."],
  [/VENUE_PROOF_USED/, "Este comprovativo já foi enviado noutro pedido. Envie o comprovativo deste pagamento."],
  [/NOT_VENUE_OWNER/, "Só o dono do estabelecimento pode fazer isto."],
  [/NOT_BUSINESS_OWNER/, "Só pode registar uma empresa que é sua."],
  [/TOO_MANY_VENUES/, "Já tem 10 estabelecimentos registados."],
  [/INVALID_KIND/, "Este tipo de pedido não existe neste estabelecimento."],
  [/FULFILLMENT_REQUIRED/, "Escolha levantamento ou entrega para cada vendedor antes de encomendar."],
  [/SELLER_NO_PICKUP/, "Este vendedor não tem levantamento no local. Escolha entrega."],
  [/SELLER_NO_DELIVERY/, "Este vendedor não faz entregas. Escolha levantamento no local."],
  [/DELIVERY_BELOW_MINIMUM/, "A compra a este vendedor está abaixo do valor mínimo para entrega. Junte mais artigos ou escolha levantamento."],
  [/DELIVERY_AREA_NOT_COVERED/, "Este vendedor não entrega no município escolhido. Escolha levantamento ou outro município."],
  [/DELIVERY_AREA_REQUIRED/, "Escolha o município da entrega para calcular o preço."],
  [/seller_delivery_settings_check/, "Escolha pelo menos uma opção: levantamento no local ou entrega."],
  [/venues_business_id_key/, "Esta empresa já está registada para reservas."],
  [/IDENTITY_NEEDS_SELFIE/, "Para verificar a identidade, tire a frente e o verso do BI e uma selfie com o BI."],
  [/IDENTITY_PHOTOS_REQUIRED/, "Faltam fotografias: frente do BI, verso do BI e selfie com o BI."],
  [/INVALID_BI_NUMBER/, "Número do BI inválido (9 algarismos, 2 letras e 3 algarismos, ex.: 004512345LA042)."],
  [/BI_ALREADY_USED/, "Este BI já está a ser usado noutra conta. Se é seu, fale com a administração."],
  [/verification_id_number_once/, "Este BI já está a ser usado noutra conta. Se é seu, fale com a administração."],
  [/ALREADY_VERIFIED/, "A sua identidade já está verificada ✔"],
  [/NOT_EVENT_ORGANIZER/, "Só o organizador do evento pode fazer isto."],
  [/CONFORMITY_REQUIRED/, "Para publicar, confirme que o anúncio descreve o artigo com verdade (incluindo defeitos)."],
  [/CLAIM_NOT_ALLOWED/, "Só quem comprou ou arrendou pode reclamar, até 7 dias depois do negócio."],
  [/CLAIM_ALREADY_OPEN/, "Já tem uma reclamação aberta sobre este anúncio."],
  [/CLAIM_DESCRIPTION_REQUIRED/, "Explique o problema (pelo menos 10 letras)."],
  [/CLAIM_NOT_FOUND/, "Reclamação não encontrada."],
  [/REFERRAL_NOT_FOUND/, "Código de convite não encontrado. Confirme as 6 letras e números."],
  [/REFERRAL_SELF/, "Não pode usar o seu próprio convite."],
  [/REFERRAL_ALREADY/, "Já entrou com um convite."],
  [/REFERRAL_TOO_LATE/, "O código de convite só se pode usar nos primeiros 14 dias da conta."],
  [/\bNAME_REQUIRED\b/, "Escreva o nome completo."],
  [/CANNOT_FOLLOW_SELF/, "Não pode seguir o seu próprio perfil."],
  [/INVALID_FOLLOW/, "Não é possível seguir este perfil."],
  [/INVALID_WHATSAPP/, "Escreva um número de WhatsApp válido (ex.: 923 000 000)."],
  [/PROTECTED_DISABLED/, "O pagamento protegido ainda não está disponível. Escolha outra forma de pagamento."],
  [/PROTECTED_PAID_BY_PLATFORM/, "Nesta encomenda o pagamento é confirmado pelo Huambo Online, não pelo vendedor."],
  [/AWAITING_PAYMENT/, "O cliente ainda não pagou: espere pelo aviso «Pagamento recebido» antes de preparar ou enviar."],
  [/PAYMENT_NOT_EXPECTED/, "Esta encomenda já não está à espera de pagamento."],
  [/PAYMENT_ALREADY_DECIDED/, "Este pagamento já foi decidido."],
  [/PAYMENT_NOT_FOUND/, "Pagamento não encontrado."],
  [/PROVIDER_NOT_CONFIGURED/, "O pagamento por referência ainda não está ligado. Pague por transferência ou Multicaixa Express."],
  [/NOT_PROTECTED/, "Esta encomenda não tem pagamento protegido."],
  [/NOTHING_TO_RELEASE/, "Não há dinheiro guardado para libertar nesta encomenda."],
  [/REFUND_ACCOUNT_REQUIRED/, "O comprador ainda não indicou para onde devolver o dinheiro."],
  [/INVALID_REFUND_ACCOUNT/, "Escreva um IBAN angolano válido (AO06 + 21 algarismos) ou um número Multicaixa Express (9 algarismos)."],
  [/INVALID_IBAN/, "O IBAN não está certo. Confira os 21 algarismos (pode escrever com ou sem AO06)."],
  [/INVALID_EXPRESS_NUMBER/, "Escreva o número Multicaixa Express (9 algarismos, começa por 9)."],
  [/HOLDER_REQUIRED/, "Escreva o nome do titular da conta."],
  [/PAYOUT_ACCOUNT_REQUIRED/, "Primeiro indique a conta para onde quer receber (IBAN ou Multicaixa Express)."],
  [/PAYOUT_OPEN/, "Já tem um levantamento em curso. Espere que seja pago."],
  [/PAYOUT_TOO_SMALL/, "O valor é menor do que o mínimo para levantar."],
  [/NOT_ENOUGH_BALANCE/, "Não tem saldo disponível suficiente."],
  [/PAYOUT_IN_PROGRESS/, "Este levantamento já está a ser pago e não pode ser cancelado."],
  [/PAYOUT_ALREADY_DECIDED/, "Este levantamento já foi decidido."],
  [/PAYOUT_NOT_FOUND/, "Levantamento não encontrado."],
  [/NO_PAYOUTS/, "Não há pedidos de levantamento novos."],
  [/ORDER_CLOSED/, "Esta encomenda já está fechada."],
  [/DISPUTE_NOT_ALLOWED/, "Ainda não pode pedir devolução ou reembolso desta encomenda (tem de estar paga ou entregue)."],
  [/DISPUTE_WINDOW_CLOSED/, "Já passaram mais de 14 dias desde a entrega: fale com o vendedor pelas mensagens."],
  [/DISPUTE_OPEN/, "Já tem um pedido de devolução ou reembolso aberto para esta encomenda."],
  [/DISPUTE_ALREADY_DECIDED/, "Esta encomenda já teve um pedido de devolução ou reembolso decidido."],
  [/DISPUTE_CLOSED/, "Este pedido já está fechado."],
  [/DISPUTE_NOT_FOUND/, "Pedido não encontrado."],
  [/NOT_ORDER_PARTY/, "Esta encomenda não é sua."],
  [/INVALID_BUY_NOW_PRICE/, "O preço «Comprar já» tem de ser maior que o preço inicial e não menor que o preço mínimo de venda."],
  [/BUY_NOW_NOT_AVAILABLE/, "«Comprar já» já não está disponível: alguém licitou primeiro."],
  [/INVALID_PERIOD/, "Escolha um período válido (até 13 meses)."],
  [/EXAMPLE_ITEM/, "Este é um exemplo para mostrar como o Huambo Online funciona: não pode ser comprado, reservado nem contactado."],
  [/COMMISSION_OVERDUE/, "Tem comissões de vendas em atraso. Pague em «A sua conta» → «Comissões» para voltar a publicar anúncios."],
  [/STORE_UNAVAILABLE/, "Esta Loja não está disponível de momento."],
  [/NOTHING_TO_PAY/, "Não há comissões por pagar nesta escolha."],
  [/COMMISSION_NOT_FOUND/, "Comissão não encontrada."],
  [/PROFILE_UNAVAILABLE/, "Este perfil não está disponível de momento."],
  [/PAYMENT_PROOF_REQUIRED/, "Escreva a referência do pagamento ou junte o comprovativo."],
  [/PAYMENT_PENDING/, "Já tem um pagamento à espera de confirmação."],
  [/SUBSCRIPTION_NOT_FOUND/, "Plano não encontrado."],
  [/INVALID_MONTHS/, "Escolha de 1 a 12 meses."],
  [/PORTFOLIO_FULL/, "Já tem 40 trabalhos no portfólio. Apague um para juntar outro."],
  [/MAX_MUST_INCREASE/, "Já está a ganhar: para mudar, escreva um máximo maior do que o atual."],
  [/RETRACT_TOO_LATE/, "Faltam menos de 12 horas para o fim do leilão: só pode retirar um lance feito há menos de 1 hora."],
  [/NO_BID_TO_RETRACT/, "Não tem lances para retirar neste leilão."],
  [/TOO_MANY_RETRACTIONS/, "Já retirou lances 3 vezes nos últimos 30 dias. Licite só quando tiver a certeza."],
  [/BIDDER_BLOCKED/, "O vendedor cancelou os seus lances neste leilão: não pode voltar a licitar."],
  [/NOT_AUCTION_SELLER/, "Só o vendedor pode cancelar lances."],
  [/BID_NOT_FOUND/, "Lance não encontrado."],
  [/INVALID_REASON/, "Escolha o motivo."],
  [/ESCALATE_TOO_EARLY/, "Ainda não pode chamar a administração: espere 3 dias pela resposta da outra pessoa."],
  [/DESCRIPTION_REQUIRED/, "Explique o que aconteceu."],
  [/INVALID_AMOUNT/, "O valor pedido não é válido (não pode passar do que pagou)."],
  [/INVALID_PHOTO/, "Fotografia inválida. Tente juntá-la de novo."],
  [/REASON_REQUIRED/, "Escreva o motivo."],
  [/MESSAGE_REQUIRED/, "Escreva uma mensagem ou junte uma fotografia."],
  [/BUYER_CAN_ONLY_CANCEL_PENDING/, "Só pode cancelar enquanto a encomenda está pendente."],
  [/USE_ORDER_FUNCTIONS/, "Operação não permitida."],
  [/BID_TOO_LOW/, "O lance é inferior ao mínimo permitido."],
  [/AUCTION_NOT_LIVE/, "Este leilão não está a decorrer."],
  [/SELLER_CANNOT_BID/, "Não pode licitar no seu próprio leilão."],
  [/NOT_APPROVED_COURIER/, "A sua conta de estafeta ainda não foi aprovada."],
  [/DELIVERY_ALREADY_TAKEN/, "Outro estafeta já aceitou esta entrega."],
  [/DELIVERY_ALREADY_REQUESTED/, "Já foi pedido um estafeta para esta encomenda."],
  [/DELIVERY_IN_PROGRESS/, "A entrega já está a decorrer e não pode ser cancelada."],
  [/INVALID_DELIVERY_STEP/, "Este passo não é possível agora. Atualize a página."],
  [/ORDER_IS_PICKUP/, "Esta encomenda é para levantar na loja."],
  [/NOT_COURIER/, "Ainda não está registado como estafeta."],
  [/NOT_DELIVERY_PARTY/, "Esta entrega não é sua."],
  [/MARKET_EXISTS/, "Essa praça já existe na lista."],
  [/TOO_MANY_SUGGESTIONS/, "Já tem 5 sugestões à espera de aprovação."],
  [/INVALID_MARKET/, "Indique o nome da praça."],
  [/AUCTION_HAS_BIDS/, "Já há licitações: o leilão não pode ser cancelado."],
  [/LISTING_NOT_AUCTIONABLE|LISTING_TYPE_NOT_AUCTIONABLE/, "Este anúncio não pode ir a leilão."],
  [/RENTAL_WINDOW_UNAVAILABLE/, "Essas datas já estão ocupadas."],
  [/LISTING_NOT_RENTABLE/, "Este anúncio não está disponível para aluguer."],
  [/CANNOT_RENT_OWN_LISTING/, "Não pode alugar o seu próprio anúncio."],
  [/INVALID_RENTAL_REQUEST/, "Verifique as datas e o valor."],
  [/RENTAL_ALREADY_ANSWERED/, "Este pedido já foi respondido."],
  [/DEAL_NOT_COMPLETED/, "Só pode avaliar depois de o negócio estar concluído."],
  [/NOT_DEAL_PARTY/, "Só quem fez o negócio pode avaliar."],
  [/ALREADY_REPORTED/, "Já denunciou isto. A administração vai analisar."],
  [/CANNOT_REPORT_SELF/, "Não pode denunciar o seu próprio perfil ou produto."],
  [/REASON_REQUIRED/, "Escolha ou escreva o motivo da denúncia."],
  [/VERIFICATION_PENDING/, "Já tem um pedido de verificação à espera de análise."],
  [/DOCUMENT_REQUIRED|INVALID_DOCUMENT/, "Envie a fotografia ou o PDF do documento."],
  [/NO_PROVIDER_PROFILE/, "Crie primeiro o seu perfil profissional."],
  [/NOT_BUSINESS_OWNER/, "Esta empresa não é sua."],
  [/NOT_REVIEW_TARGET/, "Só quem foi avaliado pode responder."],
  [/INVALID_DATE/, "Escolha uma data a partir de hoje."],
  [/OFFERS_NOT_ACCEPTED/, "Este anúncio tem preço fixo e não aceita propostas."],
  [/TRADE_NOT_ACCEPTED/, "Este vendedor não aceita troca."],
  [/TRADE_REQUIRED/, "Este anúncio é só para troca: diga o que oferece em troca."],
  [/OFFER_REQUIRED/, "Indique o valor ou o que oferece em troca."],
  [/INVALID_OFFER/, "Indique um valor válido."],
  [/OFFER_PENDING/, "Já tem uma proposta à espera de resposta neste anúncio."],
  [/CANNOT_OFFER_OWN_LISTING/, "Não pode fazer proposta ao seu próprio anúncio."],
  [/DEAL_ALREADY_SET/, "Já indicou com quem fez este negócio."],
  [/NOT_A_DEAL_PARTNER/, "Escolha uma pessoa que lhe enviou mensagem sobre este anúncio."],
  [/CANNOT_REQUEST_OWN_SERVICE/, "Não pode pedir um serviço a si próprio."],
  [/TOO_MANY_REQUESTS/, "Já fez muitos pedidos hoje. Tente amanhã."],
  [/DESCRIPTION_REQUIRED/, "Descreva o serviço de que precisa."],
  [/NOT_SERVICE_PROVIDER/, "Este pedido não é para si."],
  [/NOT_SERVICE_CLIENT/, "Só quem pediu o serviço pode fazer isto."],
  [/INVALID_TRANSITION/, "Este passo já não é possível. Atualize a página."],
  [/TARGET_NOT_FOUND/, "Este perfil já não está disponível."],
  [/USE_SERVER_FUNCTIONS/, "Operação não permitida."],
  [/DOCUMENTS_ONLY_FOR_JOBS/, "Só pode enviar documentos nas conversas sobre vagas de emprego e estágios."],
  [/PROTECTED_ADMIN/, "Só um administrador pode alterar uma conta de administrador."],
  [/PROVINCE_NEEDS_MUNICIPALITIES/, "Junte primeiro os municípios desta província; depois pode desbloqueá-la."],
  [/LAST_ACTIVE_PROVINCE/, "Tem de ficar pelo menos uma província desbloqueada."],
  [/MUNICIPALITY_IN_USE/, "Este município já está a ser usado (anúncios, empresas, moradas…) e não pode ser apagado. Pode mudar-lhe o nome."],
  [/MUNICIPALITY_EXISTS/, "Já existe um município com esse nome nesta província."],
  [/ADMIN_ONLY/, "Só a administração pode fazer isto."],
  [/CANNOT_CHANGE_SELF/, "Não pode alterar a sua própria conta aqui."],
  [/duplicate key.*slug|categories_slug/i, "Já existe uma categoria com esse nome."],
  [/Payload too large|exceeded the maximum allowed size/i, "A fotografia é demasiado grande (máximo 5 MB)."],
  [/mime type|invalid_mime/i, "Só são aceites imagens (JPG, PNG, WEBP)."],
  [/failed to fetch|network request failed/i, "Sem ligação à internet. Tente novamente."]
];

/** Mensagem clara em português para erros do Supabase. */
export function friendlyError(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  const raw = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as any).message) : String(error ?? "");
  for (const [re, msg] of errorMessages) if (re.test(raw)) return msg;
  return raw || fallback;
}


const saleColumns = (input: Pick<ClassifiedDraftInput, "purpose" | "saleMode" | "acceptsTrade" | "tradeWants">) => input.purpose === "wanted"
  ? { sale_mode: null, accepts_trade: false, trade_wants: null }
  : { sale_mode: input.saleMode ?? null, accepts_trade: input.saleMode === "trade" || !!input.acceptsTrade,
      trade_wants: input.saleMode === "trade" || input.acceptsTrade ? input.tradeWants?.trim() || null : null };

export async function createClassifiedListing(client: SupabaseClient, input: ClassifiedDraftInput) {
  return client.from("classified_listings").insert({
    owner_id: input.ownerId, category_id: input.categoryId || null, address_id: input.addressId || null,
    listing_type: input.listingType, purpose: input.purpose, title: input.title.trim(),
    description: input.description?.trim() || null, price: input.price ?? null,
    attributes: buildAttributes(input), media: input.media || [], market_id: input.marketId || null, video_url: input.videoUrl || null,
    budget_min: input.purpose === "wanted" ? input.budgetMin ?? null : null, budget_max: input.purpose === "wanted" ? input.budgetMax ?? null : null,
    ...saleColumns(input), ...placeColumns(input.directions, input.point),
    conformity_accepted_at: input.conformity ? new Date().toISOString() : null
  }).select().single();
}

/** Grava o anúncio e publica-o logo (o Supabase valida antes de publicar). */
export async function createAndPublishClassifiedListing(client: SupabaseClient, input: ClassifiedDraftInput) {
  const created = await createClassifiedListing(client, input);
  if (created.error || !created.data) return { data: null, draftId: null as string | null, error: created.error };
  const agent = (input.agentCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (agent) {
    const a = await client.rpc("set_listing_agent", { p_listing_id: created.data.id, p_code: agent });
    if (a.error) return { data: created.data, draftId: created.data.id as string, error: a.error };
  }
  const published = await client.rpc("publish_classified_listing", { p_listing_id: created.data.id });
  if (published.error) return { data: created.data, draftId: created.data.id as string, error: published.error };
  return { data: published.data ?? created.data, draftId: null, error: null };
}

export async function updateClassifiedListing(client: SupabaseClient, id: string, input: Omit<ClassifiedDraftInput, "ownerId">) {
  const updated = await client.from("classified_listings").update({
    category_id: input.categoryId || null, listing_type: input.listingType, purpose: input.purpose,
    title: input.title.trim(), description: input.description?.trim() || null, price: input.price ?? null,
    attributes: buildAttributes(input), media: input.media || [], market_id: input.marketId || null, video_url: input.videoUrl || null,
    budget_min: input.purpose === "wanted" ? input.budgetMin ?? null : null, budget_max: input.purpose === "wanted" ? input.budgetMax ?? null : null,
    ...saleColumns(input), ...(input.conformity ? { conformity_accepted_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString()
  }).eq("id", id).select().single();
  if (updated.error) return updated;
  const place = await setListingPrivatePlace(client, id, input.directions, input.point);
  return place.error ? { ...updated, data: null, error: place.error } : updated;
}

/**
 * Localização do anúncio (indicações e ponto no mapa): privada.
 * Só o dono e a equipa (administradores e moderadores) a veem; para os outros devolve null.
 */
export async function getListingPrivatePlace(client: SupabaseClient, id: string) {
  const r = await client.rpc("listing_private_place", { p_listing_id: id });
  const row = Array.isArray(r.data) ? r.data[0] : null;
  return row ? { directions: (row.directions as string | null) ?? null, geo_lat: row.geo_lat == null ? null : Number(row.geo_lat), geo_lng: row.geo_lng == null ? null : Number(row.geo_lng) } : null;
}
/** Grava (ou apaga) a localização privada do próprio anúncio. */
export async function setListingPrivatePlace(client: SupabaseClient, id: string, directions: string | null | undefined, point: GeoPoint | null | undefined) {
  const c = placeColumns(directions, point);
  return client.rpc("set_listing_private_place", { p_listing_id: id, p_directions: c.directions, p_geo_lat: c.geo_lat, p_geo_lng: c.geo_lng });
}

export async function deleteClassifiedListing(client: SupabaseClient, id: string) {
  return client.from("classified_listings").delete().eq("id", id);
}

export async function listMyClassifiedListings(client: SupabaseClient, ownerId: string) {
  return client.from("classified_listings").select(LISTING_COLUMNS + ",deal_with,deal_at").eq("owner_id", ownerId).order("created_at", { ascending: false });
}

const LISTING_COLUMNS = "id,ref_no,owner_id,category_id,address_id,listing_type,purpose,title,description,price,currency,attributes,media,status,featured,featured_until,created_at,updated_at,market_id,video_url,budget_min,budget_max,sale_mode,accepts_trade,trade_wants,directions,geo_lat,geo_lng,conformity_accepted_at";

export async function listClassifiedListings(client: SupabaseClient, filters: {
  listingType?: ClassifiedListingType; purpose?: ClassifiedPurpose; categoryId?: string; limit?: number;
} = {}) {
  let q = client.from("classified_listings").select(LISTING_COLUMNS).eq("status", "published").order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(filters.limit ?? 30);
  if (filters.listingType) q = q.eq("listing_type", filters.listingType);
  if (filters.purpose) q = q.eq("purpose", filters.purpose);
  if (filters.categoryId) q = q.eq("category_id", filters.categoryId);
  return q;
}

export async function listClassifiedListingsByIds(client: SupabaseClient, ids: string[]) {
  const clean = [...new Set(ids.filter(id => typeof id === "string" && id.length > 0))];
  if (!clean.length) return { data: [], error: null };
  return client.from("classified_listings").select(LISTING_COLUMNS).in("id", clean).eq("status", "published").order("created_at", { ascending: false });
}

/** Anúncio publicado, ou do próprio dono (rascunho/pausado) — as regras do Supabase decidem. */
export async function getClassifiedListing(client: SupabaseClient, id: string) {
  const r = await client.from("classified_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
  if (!r.data) return r;
  // A localização só chega ao dono e à equipa.
  const place = await getListingPrivatePlace(client, id).catch(() => null);
  return place ? { ...r, data: { ...r.data, ...place } } : r;
}

export async function updateClassifiedStatus(client: SupabaseClient, id: string, status: Exclude<ClassifiedStatus, "published">) {
  return client.from("classified_listings").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select().single();
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  const clean = base64.replace(/^data:[^,]*,/, "").replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes = new Uint8Array(Math.floor((len * 3) / 4));
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lookup[clean.charCodeAt(i)], b = lookup[clean.charCodeAt(i + 1)];
    const c = lookup[clean.charCodeAt(i + 2)], d = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (a << 2) | (b >> 4);
    if (i + 2 < len) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < len) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes.buffer.slice(0, p);
}

function randomId() {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Envia uma fotografia para a pasta do utilizador no bucket classified-media e devolve o URL público. */
export async function uploadClassifiedMedia(client: SupabaseClient, file: Blob | ArrayBuffer, ownerId: string, filename?: string, contentType?: string, bucket = CLASSIFIED_MEDIA_BUCKET) {
  const ext = ((filename || "image.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const type = contentType || (file instanceof ArrayBuffer ? "" : file.type) || "image/jpeg";
  const path = ownerId + "/" + randomId() + "." + ext;
  const uploaded = await client.storage.from(bucket).upload(path, file, { upsert: false, contentType: type });
  if (uploaded.error) return { data: null, error: uploaded.error };
  const url = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return { data: url, error: null };
}

/** Caminho no Storage a partir do URL público (para apagar fotografias removidas). */
export function storagePathFromPublicUrl(url: string, bucket = CLASSIFIED_MEDIA_BUCKET): string | null {
  const marker = "/storage/v1/object/public/" + bucket + "/";
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length));
}

export async function removeClassifiedMedia(client: SupabaseClient, urls: string[]) {
  const paths = urls.map(u => storagePathFromPublicUrl(u)).filter((p): p is string => !!p);
  if (!paths.length) return { data: [], error: null };
  return client.storage.from(CLASSIFIED_MEDIA_BUCKET).remove(paths);
}
