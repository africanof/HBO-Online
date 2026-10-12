import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { proxypayBase, proxypayHeaders, referenceEnd, referenceBody, referenceId, parsePaymentEvent, verifySignature, hmacSha256Hex } from "../../../supabase/functions/_shared/proxypay";

const NOW = Date.parse("2026-10-13T10:00:00Z");

describe("ProxyPay (funções do servidor)", () => {
  it("ambiente de testes por omissão; pagamentos reais só com PROXYPAY_ENV=production", () => {
    expect(proxypayBase(undefined)).toBe("https://api.sandbox.proxypay.co.ao");
    expect(proxypayBase("production")).toBe("https://api.proxypay.co.ao");
    expect(proxypayHeaders("abc")).toMatchObject({ Authorization: "Token abc", Accept: "application/vnd.proxypay.v2+json" });
  });
  it("prazo e corpo da referência", () => {
    expect(referenceEnd(new Date(NOW + 48 * 3600000).toISOString(), NOW).toISOString()).toBe("2026-10-15T10:00:00.000Z");
    expect(referenceEnd(null, NOW).toISOString()).toBe("2026-10-20T10:00:00.000Z");
    expect(referenceEnd(new Date(NOW - 1000).toISOString(), NOW).toISOString()).toBe("2026-10-13T11:00:00.000Z");
    expect(referenceBody("20000", new Date(NOW), "E-1001")).toEqual({ amount: "20000.00", end_datetime: "2026-10-13T10:00:00.000Z",
      custom_fields: { order_number: "E-1001", app_description: "Huambo Online" } });
    expect(referenceId("123456789")).toBe("123456789");
    expect(referenceId('"123456789"')).toBe("123456789");
    expect(referenceId("abc")).toBeNull();
  });
  it("lê o aviso de pagamento", () => {
    expect(parsePaymentEvent({ id: 449500352608, reference_id: 123456789, amount: "20000.00" })).toEqual({ id: "449500352608", reference: "123456789", amount: 20000 });
    expect(parsePaymentEvent({ id: 1, reference_id: "x", amount: 1 })).toBeNull();
    expect(parsePaymentEvent({ id: 1, reference_id: 123456789, amount: 0 })).toBeNull();
    expect(parsePaymentEvent(null)).toBeNull();
  });
  it("só aceita avisos assinados com a chave certa", async () => {
    const body = JSON.stringify({ id: 1, reference_id: 123456789, amount: 100 });
    const sig = createHmac("sha256", "chave-secreta").update(body).digest("hex");
    expect(await hmacSha256Hex("chave-secreta", body)).toBe(sig);
    expect(await verifySignature(body, sig, "chave-secreta")).toBe(true);
    expect(await verifySignature(body, sig.toUpperCase(), "chave-secreta")).toBe(true);
    expect(await verifySignature(body, sig, "outra-chave")).toBe(false);
    expect(await verifySignature(body + " ", sig, "chave-secreta")).toBe(false);
    expect(await verifySignature(body, null, "chave-secreta")).toBe(false);
  });
});
