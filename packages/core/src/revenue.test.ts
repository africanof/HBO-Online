import { describe, expect, it, vi } from "vitest";
import { paymentAccounts, hasPaymentDetails, validatePaymentAccounts, savePaymentAccounts, monthRange, revenueSummary, revenueCsv, listRevenue, type RevenueRow } from "./plans";

describe("contas para receber", () => {
  const base = { bank_name: null, iban: null, account_holder: null, express_number: null, payment_note: null, provider_monthly_kz: 2000, business_monthly_kz: 5000, trial_days: 30 };
  it("usa a lista e, sem lista, a conta antiga", () => {
    expect(paymentAccounts({ ...base, payment_accounts: [{ bank: "Banco Yetu", iban: "0066 0000 07341533101 37", holder: "A" }, { bank: "Standard Bank", iban: "0060", holder: "A" }] })).toHaveLength(2);
    expect(paymentAccounts({ ...base, iban: "0066 1", bank_name: "Yetu", account_holder: "A", payment_accounts: [] })).toEqual([{ bank: "Yetu", iban: "0066 1", holder: "A" }]);
    expect(paymentAccounts(null)).toEqual([]);
    expect(hasPaymentDetails({ ...base, express_number: "932 806 332" })).toBe(true);
    expect(hasPaymentDetails(base)).toBe(false);
  });
  it("valida e grava", async () => {
    expect(validatePaymentAccounts([{ bank: "", iban: "0066 0000 07341533101 37", holder: "A" }])).toMatch(/banco/);
    expect(validatePaymentAccounts([{ bank: "Yetu", iban: "0066", holder: "A" }])).toMatch(/incompleto/);
    expect(validatePaymentAccounts([{ bank: "Yetu", iban: "0066 0000 07341533101 37", holder: "" }])).toMatch(/titular/);
    expect(validatePaymentAccounts([{ bank: "Yetu", iban: "0066 0000 07341533101 37", holder: "Aires" }])).toBeNull();
    const eq = vi.fn().mockResolvedValue({ error: null }); const update = vi.fn(() => ({ eq }));
    await savePaymentAccounts({ from: () => ({ update }) } as any, [{ bank: " Yetu ", iban: "0066 0000 07341533101 37", holder: "Aires" }], " 932 806 332 ", "");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ bank_name: "Yetu", iban: "0066 0000 07341533101 37", express_number: "932 806 332", payment_note: null,
      payment_accounts: [{ bank: "Yetu", iban: "0066 0000 07341533101 37", holder: "Aires" }] }));
  });
});

describe("relatório de receitas", () => {
  const rows: RevenueRow[] = [
    { paid_at: "2026-10-05T10:00:00Z", kind: "plan_store", description: "A minha Loja · 3 meses", payer_name: "João", amount: "15000", method: "bank_transfer", reference: "T1" },
    { paid_at: "2026-10-06T10:00:00Z", kind: "commission", description: "Mota; nova · venda 100000 Kz", payer_name: "Maria", amount: 5000, method: "multicaixa_express", reference: null }];
  it("meses, totais e CSV", async () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
    expect(revenueSummary(rows)).toEqual({ total: 20000, count: 2, byKind: { plan_store: 15000, commission: 5000 } });
    const csv = revenueCsv(rows);
    expect(csv.startsWith("\uFEFFData;Tipo;")).toBe(true);
    expect(csv).toContain("05/10/2026;Mensalidade — Loja;A minha Loja · 3 meses;João;15000;Transferência bancária;T1");
    expect(csv).toContain('"Mota; nova · venda 100000 Kz"');
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    expect((await listRevenue({ rpc } as any, "2026-10-01", "2026-10-31")).data).toEqual([]);
    expect(rpc).toHaveBeenCalledWith("admin_revenue", { p_from: "2026-10-01", p_to: "2026-10-31" });
  });
});
