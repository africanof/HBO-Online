import { describe, expect, it, vi } from "vitest";
import {
  angolaIbanDigits, formatAngolaIban, expressNumber, cleanRefundDestination, validatePayoutAccount, payoutDaysText, nextPayoutDate, formatDay,
  timeLeftText, canConfirmReceived, canPayOrder, escrowBuyerStep, escrowSellerStep, validatePayoutAmount, payoutsCsv, payoutsTotal, walletBalance,
  submitOrderPayment, savePayoutAccount, requestPayout, setDisputeRefundAccount, confirmOrderReceived, markPayoutsPaid, requestPaymentReference,
  placeOrders, listOrders, listMyDisputes, listDisputesForAdmin, disputeActions, disputeNextStep, platformRefunds, getNotificationLink, friendlyError,
  termsPage, returnsPage, HELP_FAQ, REVENUE_KIND_LABELS, type ProtectedOrderFields
} from "./index";

const NOW = Date.parse("2026-10-13T10:00:00Z"); // terça-feira, 11h em Angola
const rpcClient = () => { const rpc = vi.fn(async () => ({ data: null, error: null })); return { client: { rpc } as any, rpc }; };

describe("IBAN angolano e Multicaixa Express", () => {
  it("aceita os IBAN verdadeiros com e sem AO06 e recusa um algarismo errado", () => {
    expect(angolaIbanDigits("0066 0000 07341533101 37")).toBe("006600000734153310137");
    expect(angolaIbanDigits("AO06 0060 0101 0100 4635 1176 8")).toBe("006001010100463511768");
    expect(angolaIbanDigits("ao06.0066.0000.0734.1533.1013.7")).toBe("006600000734153310137");
    expect(angolaIbanDigits("0066 0000 07341533101 38")).toBeNull();
    expect(angolaIbanDigits("0066 0000 0734")).toBeNull();
    expect(formatAngolaIban("006600000734153310137")).toBe("AO06 0066 0000 0734 1533 1013 7");
  });
  it("número Express com ou sem +244", () => {
    expect(expressNumber("932 806 332")).toBe("932806332");
    expect(expressNumber("+244 932806332")).toBe("932806332");
    expect(expressNumber("832806332")).toBeNull();
    expect(cleanRefundDestination("+244 932 806 332")).toBe("Multicaixa Express 932806332");
    expect(cleanRefundDestination("0066 0000 07341533101 37")).toBe("AO06 0066 0000 0734 1533 1013 7");
    expect(cleanRefundDestination("12345")).toBeNull();
  });
  it("valida a conta para receber", () => {
    expect(validatePayoutAccount({ method: "iban", holder: "Jo", destination: "0066 0000 07341533101 37" })).toMatch(/titular/);
    expect(validatePayoutAccount({ method: "iban", holder: "João Lopes", destination: "1234" })).toMatch(/IBAN/);
    expect(validatePayoutAccount({ method: "express", holder: "João Lopes", destination: "12" })).toMatch(/Express/);
    expect(validatePayoutAccount({ method: "express", holder: "João Lopes", destination: "923000000" })).toBeNull();
  });
});

describe("dias de levantamento e prazos", () => {
  it("escreve os dias em português", () => {
    expect(payoutDaysText([2, 5])).toBe("terças e sextas-feiras");
    expect(payoutDaysText([5])).toBe("sextas-feiras");
    expect(payoutDaysText([1, 3, 6])).toBe("segundas, quartas e sábados");
    expect(payoutDaysText([])).toBe("nos dias úteis");
  });
  it("próximo dia de pagamentos: hoje antes do meio-dia, senão o seguinte", () => {
    expect(formatDay(nextPayoutDate([2, 5], NOW)!)).toBe("13/10/2026");
    expect(formatDay(nextPayoutDate([2, 5], Date.parse("2026-10-13T13:00:00Z"))!)).toBe("16/10/2026");
    expect(nextPayoutDate([], NOW)).toBeNull();
  });
  it("tempo que falta", () => {
    expect(timeLeftText(new Date(NOW + 5 * 3600000).toISOString(), NOW)).toBe("faltam 5 horas");
    expect(timeLeftText(new Date(NOW + 50 * 3600000).toISOString(), NOW)).toBe("faltam 3 dias");
    expect(timeLeftText(new Date(NOW - 1000).toISOString(), NOW)).toBe("já passou");
  });
});

describe("passos do pagamento protegido", () => {
  const base: ProtectedOrderFields = { id: "o1", status: "pending", total: 20000, protected: true, escrow_status: "awaiting_payment",
    pay_by: new Date(NOW + 47 * 3600000).toISOString(), payment: null };
  it("comprador: pagar, comprovativo enviado, guardado, entregue, concluído", () => {
    expect(escrowBuyerStep(base, false, NOW)).toMatch(/Pague 20.000 Kz ao Huambo Online \(faltam 2 dias\)/);
    expect(canPayOrder(base)).toBe(true);
    const sent = { ...base, payment: { id: "p", status: "pending", provider: "manual", method: "bank_transfer", entity: null, reference: "X", amount: 20000, expires_at: null, admin_note: null, created_at: "" } } as ProtectedOrderFields;
    expect(canPayOrder(sent)).toBe(false);
    expect(escrowBuyerStep(sent, false, NOW)).toMatch(/comprovativo/);
    const held = { ...base, status: "confirmed", escrow_status: "held" } as ProtectedOrderFields;
    expect(canConfirmReceived(held)).toBe(true);
    expect(canConfirmReceived(held, true)).toBe(false);
    expect(escrowBuyerStep(held, true, NOW)).toMatch(/fica guardado/);
    const delivered = { ...held, status: "completed", delivered_at: "x", release_at: new Date(NOW + 72 * 3600000).toISOString() };
    expect(escrowBuyerStep(delivered, false, NOW)).toMatch(/faltam 3 dias/);
    expect(escrowBuyerStep({ ...held, escrow_status: "released" }, false, NOW)).toMatch(/entregue ao vendedor/);
    expect(canConfirmReceived({ ...held, protected: false })).toBe(false);
  });
  it("vendedor: não enviar antes do pagamento; saldo depois de libertar", () => {
    expect(escrowSellerStep(base, NOW)).toMatch(/Não envie ainda/);
    expect(escrowSellerStep({ ...base, escrow_status: "held", status: "confirmed" }, NOW)).toMatch(/Prepare e entregue/);
    expect(escrowSellerStep({ ...base, escrow_status: "released", total: 20000, refunded_amount: 0, platform_fee: 400 }, NOW)).toMatch(/19.600 Kz.*comissão: 400 Kz/);
    expect(escrowSellerStep({ ...base, escrow_status: "held", status: "cancelled" }, NOW)).toMatch(/devolve o dinheiro/);
    expect(escrowSellerStep({ id: "x", status: "pending", total: 1 }, NOW)).toBe("");
  });
});

describe("saldo e levantamentos", () => {
  it("valor a levantar", () => {
    expect(validatePayoutAmount(500, 10000, 1000)).toMatch(/mínimo/);
    expect(validatePayoutAmount(20000, 10000, 1000)).toMatch(/Só tem/);
    expect(validatePayoutAmount(5000, 10000, 1000)).toBeNull();
    expect(walletBalance({ pending: "200.50", available: 10, in_payout: null as any })).toEqual({ pending: 200.5, available: 10, inPayout: 0 });
  });
  it("ficheiro do banco: IBAN sem espaços, vírgula decimal, aspas quando preciso", () => {
    const csv = payoutsCsv([
      { ref_no: 1001, holder_name: "Ana; Lda", method: "iban", destination: "AO06 0066 0000 0734 1533 1013 7", amount: "19600.5", phone: "923000000" },
      { ref_no: 1002, holder_name: "Rui", method: "express", destination: "932806332", amount: 3000, phone: null }]);
    const lines = csv.replace("﻿", "").split("\r\n");
    expect(lines[0]).toBe("Referência;Beneficiário;Tipo;IBAN / Número;Montante (Kz);Descritivo;Telefone");
    expect(lines[1]).toBe('L-1001;"Ana; Lda";Conta bancária (IBAN);AO06006600000734153310137;19600,50;Huambo Online L-1001;923000000');
    expect(lines[2]).toBe("L-1002;Rui;Multicaixa Express;932806332;3000,00;Huambo Online L-1002;");
    expect(payoutsTotal([{ amount: "10" }, { amount: 5.5 }])).toBe(15.5);
  });
});

describe("chamadas ao servidor", () => {
  it("encomenda protegida usa place_orders_v2; normal continua igual", async () => {
    const { client, rpc } = rpcClient();
    client.from = () => ({ delete: () => ({ not: async () => ({}) }) });
    await placeOrders(client, { fulfillment: "pickup", paymentMethod: "cash_on_delivery", phone: "923000000", protected: true });
    expect(rpc).toHaveBeenLastCalledWith("place_orders_v2", expect.objectContaining({ p_protected: true, p_contact_phone: "923000000" }));
    await placeOrders(client, { fulfillment: "pickup", paymentMethod: "cash_on_delivery", phone: "923000000" });
    expect(rpc).toHaveBeenLastCalledWith("place_orders", expect.not.objectContaining({ p_protected: true }));
    await listOrders(client, "seller");
    expect(rpc).toHaveBeenLastCalledWith("my_orders_v3", { p_role: "seller" });
  });
  it("pagamento, receção, conta, levantamento, reembolso", async () => {
    const { client, rpc } = rpcClient();
    expect((await submitOrderPayment(client, "o1", { method: "bank_transfer" })).error?.message).toMatch(/comprovativo/);
    await submitOrderPayment(client, "o1", { method: "multicaixa_express", reference: " 123 " });
    expect(rpc).toHaveBeenLastCalledWith("submit_order_payment", { p_order_id: "o1", p_method: "multicaixa_express", p_reference: "123", p_proof_path: null });
    await confirmOrderReceived(client, "o1");
    expect(rpc).toHaveBeenLastCalledWith("confirm_order_received", { p_order_id: "o1" });
    expect((await savePayoutAccount(client, { method: "iban", holder: "Ana Silva", destination: "1" })).error).toBeTruthy();
    await savePayoutAccount(client, { method: "iban", holder: " Ana Silva ", destination: "0066 0000 07341533101 37" });
    expect(rpc).toHaveBeenLastCalledWith("save_payout_account", { p_method: "iban", p_holder: "Ana Silva", p_destination: "0066 0000 07341533101 37" });
    await requestPayout(client);
    expect(rpc).toHaveBeenLastCalledWith("request_payout", { p_amount: null });
    expect((await setDisputeRefundAccount(client, "d1", "abc")).error).toBeTruthy();
    await setDisputeRefundAccount(client, "d1", "932806332");
    expect(rpc).toHaveBeenLastCalledWith("set_dispute_refund_account", { p_dispute_id: "d1", p_account: "932806332" });
    await markPayoutsPaid(client, ["a", "b"], " LOTE ");
    expect(rpc).toHaveBeenLastCalledWith("admin_mark_payouts_paid", { p_ids: ["a", "b"], p_bank_reference: "LOTE" });
    await listMyDisputes(client);
    expect(rpc).toHaveBeenLastCalledWith("my_disputes_v2");
    await listDisputesForAdmin(client, "escrow_refunds");
    expect(rpc).toHaveBeenLastCalledWith("admin_list_disputes_v2", { p_status: "escrow_refunds" });
  });
  it("referência ProxyPay: mostra o código de erro do servidor", async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { message: "Edge Function returned a non-2xx status code", context: { json: async () => ({ error: "PROVIDER_NOT_CONFIGURED" }) } } }));
    const r = await requestPaymentReference({ functions: { invoke } } as any, "o1");
    expect(invoke).toHaveBeenCalledWith("payment-reference", { body: { order_id: "o1" } });
    expect(friendlyError(r.error)).toMatch(/ainda não está ligado/);
    const ok = await requestPaymentReference({ functions: { invoke: async () => ({ data: { entity: "12345", reference: "123456789", amount: 100, expires_at: null }, error: null }) } } as any, "o1");
    expect(ok.data?.reference).toBe("123456789");
  });
});

describe("disputas com dinheiro guardado", () => {
  const d = { status: "awaiting_refund" as const, updated_at: new Date(NOW).toISOString(), request: "refund" as const, outcome: null, protected: true, escrow_status: "held", refund_to: null };
  it("o vendedor não marca «já devolvi» quando quem devolve é a plataforma", () => {
    expect(platformRefunds(d)).toBe(true);
    expect(disputeActions(d, "seller", NOW)).not.toContain("mark_refunded");
    expect(disputeActions({ ...d, protected: false }, "seller", NOW)).toContain("mark_refunded");
    expect(disputeNextStep(d, "buyer")).toMatch(/Indique abaixo para onde/);
    expect(disputeNextStep({ ...d, refund_to: "Multicaixa Express 932806332" }, "buyer")).toMatch(/932806332/);
    expect(disputeNextStep(d, "seller")).toMatch(/Não precisa de enviar/);
    expect(disputeNextStep({ ...d, escrow_status: "released" }, "seller")).toMatch(/Devolva o dinheiro/);
  });
});

describe("avisos, mensagens e textos", () => {
  it("ligações das notificações", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(getNotificationLink({ type: "system", title: "Dinheiro disponível 💰", data: { for: "wallet", order_id: id } })?.href).toBe("/conta/saldo");
    expect(getNotificationLink({ type: "order", title: "Pagamento recebido 🛡️", data: { for: "sale", order_id: id } })?.href).toBe("/encomendas?vendas=1");
    expect(getNotificationLink({ type: "order", title: "Pagamento confirmado ✔", data: { for: "purchase", order_id: id } })?.href).toBe("/encomendas");
    expect(getNotificationLink({ type: "system", title: "Pedido de levantamento", data: { for: "admin", payout_id: id } })?.href).toBe("/admin");
  });
  it("mensagens de erro", () => {
    expect(friendlyError(new Error("AWAITING_PAYMENT"))).toMatch(/ainda não pagou/);
    expect(friendlyError(new Error("PROTECTED_PAID_BY_PLATFORM"))).toMatch(/Huambo Online/);
    expect(friendlyError(new Error("PAYOUT_TOO_SMALL"))).toMatch(/mínimo/);
    expect(friendlyError(new Error("INVALID_IBAN"))).toMatch(/IBAN/);
    expect(friendlyError(new Error("REFUND_ACCOUNT_REQUIRED"))).toMatch(/para onde/);
    expect(friendlyError(new Error("PAYMENT_PENDING"))).toMatch(/à espera/);
  });
  it("termos, devoluções, ajuda e receitas falam do pagamento protegido", () => {
    expect(termsPage().sections.map(s => s.title)).toContain("6. Pagamento protegido");
    expect(termsPage().sections.at(-1)?.title).toBe("10. Contacto");
    expect(returnsPage().sections.flatMap(s => s.paragraphs).join(" ")).toMatch(/pagamento protegido/);
    expect(HELP_FAQ.some(f => /Pagamento protegido/.test(f.q))).toBe(true);
    expect(REVENUE_KIND_LABELS.protected_fee).toMatch(/pagamento protegido/);
  });
});
