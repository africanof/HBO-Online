import { describe, expect, it, vi } from "vitest";
import { normalizeBiNumber, validateIdentityRequest, identityShotPath, requestIdentityVerification, listVerificationsForAdminV2, biNumberText, IDENTITY_SHOTS, IDENTITY_ADMIN_CHECKLIST } from "./trust";
import { normalizeTotpCode, validateTotpCode, formatTotpSecret, mfaErrorMessage, startTotpEnrollment, verifyTotp, mfaRequired, verifyLoginTotp, disableTotp } from "./mfa";
import { friendlyError } from "./classified-listings";

const U = "11111111-1111-4111-8111-111111111111";
describe("identidade: BI + selfie", () => {
  it("número do BI", () => {
    expect(normalizeBiNumber("004 512 345 la 042")).toBe("004512345LA042");
    expect(normalizeBiNumber("004512345-LA-042")).toBe("004512345LA042");
    expect(normalizeBiNumber("12345")).toBeNull(); expect(normalizeBiNumber("0045123450LA42")).toBeNull();
    expect(biNumberText("004512345LA042")).toBe("004512345 LA 042");
  });
  it("três fotografias obrigatórias, selfie com a câmara da frente", () => {
    const b = new Blob(["x"]);
    expect(validateIdentityRequest({ back: b, selfie: b, idNumber: "004512345LA042" })).toContain("frente");
    expect(validateIdentityRequest({ front: b, selfie: b, idNumber: "004512345LA042" })).toContain("verso");
    expect(validateIdentityRequest({ front: b, back: b, idNumber: "004512345LA042" })).toContain("selfie");
    expect(validateIdentityRequest({ front: b, back: b, selfie: b, idNumber: "1" })).toContain("número do BI");
    expect(validateIdentityRequest({ front: b, back: b, selfie: b, idNumber: "004512345LA042" })).toBeNull();
    expect(IDENTITY_SHOTS.map(s => s.camera)).toEqual(["back", "back", "front"]);
    expect(identityShotPath(U, "selfie", 5)).toBe(U + "/5-bi-selfie.jpg");
    expect(IDENTITY_ADMIN_CHECKLIST.join(" ")).toContain("selfie");
  });
  it("envia as três fotografias para a pasta privada e cria o pedido", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const c = { storage: { from: vi.fn(() => ({ upload })) }, rpc: vi.fn().mockResolvedValue({ data: { id: "v1" }, error: null }) } as any;
    const b = new Blob(["x"]);
    expect((await requestIdentityVerification(c, U, { front: b, back: b, selfie: b }, "x")).error?.message).toContain("número do BI");
    expect(upload).not.toHaveBeenCalled();
    await requestIdentityVerification(c, U, { front: b, back: b, selfie: b }, "004 512 345 LA 042", " olá ");
    expect(c.storage.from).toHaveBeenCalledWith("verification-docs");
    expect(upload).toHaveBeenCalledTimes(3);
    const args = c.rpc.mock.calls[0];
    expect(args[0]).toBe("request_identity_verification");
    expect(args[1]).toMatchObject({ p_id_number: "004512345LA042", p_note: "olá" });
    expect(args[1].p_selfie_path).toMatch(new RegExp("^" + U + "/\\d+-bi-selfie\\.jpg$"));
    const fail = { storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: new Error("x") }) }) }, rpc: vi.fn() } as any;
    expect((await requestIdentityVerification(fail, U, { front: b, back: b, selfie: b }, "004512345LA042")).error).toBeTruthy();
    expect(fail.rpc).not.toHaveBeenCalled();
  });
  it("lista da administração e erros", async () => {
    const r = await listVerificationsForAdminV2({ rpc: vi.fn().mockResolvedValue({ data: [{ id: "v", previous_rejections: "2" }], error: null }) } as any);
    expect(r.data[0].previous_rejections).toBe(2);
    expect(friendlyError({ message: "BI_ALREADY_USED" })).toContain("outra conta");
    expect(friendlyError({ message: "IDENTITY_NEEDS_SELFIE" })).toContain("selfie");
    expect(friendlyError({ message: "INVALID_BI_NUMBER" })).toContain("Número do BI");
  });
});

describe("dois passos (APP autenticadora)", () => {
  it("código e textos", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456"); expect(validateTotpCode("12345")).toContain("6 algarismos"); expect(validateTotpCode("123-456")).toBeNull();
    expect(formatTotpSecret("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
    expect(mfaErrorMessage(new Error("Invalid TOTP code entered"))).toContain("Código errado");
    expect(mfaErrorMessage({ message: "too many requests" })).toContain("Demasiadas");
  });
  it("ligar, confirmar, entrar e desligar", async () => {
    const mfa = {
      listFactors: vi.fn().mockResolvedValue({ data: { all: [{ id: "old", factor_type: "totp", status: "unverified" }], totp: [{ id: "f1", factor_type: "totp", status: "verified" }] }, error: null }),
      unenroll: vi.fn().mockResolvedValue({ error: null }),
      enroll: vi.fn().mockResolvedValue({ data: { id: "f2", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "SECRET", uri: "otpauth://totp/x" } }, error: null }),
      challengeAndVerify: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null })
    };
    const c = { auth: { mfa } } as any;
    const e = await startTotpEnrollment(c);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "old" });
    expect(e.data).toEqual({ factorId: "f2", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "SECRET", uri: "otpauth://totp/x" });
    expect((await verifyTotp(c, "f2", "12")).error?.message).toContain("6 algarismos");
    await verifyTotp(c, "f2", "123 456"); expect(mfa.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: "f2", code: "123456" });
    expect(await mfaRequired(c)).toBe(true);
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null }); expect(await mfaRequired(c)).toBe(false);
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValueOnce({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }); expect(await mfaRequired(c)).toBe(false);
    await verifyLoginTotp(c, "654321"); expect(mfa.challengeAndVerify).toHaveBeenLastCalledWith({ factorId: "f1", code: "654321" });
    await disableTotp(c, "f1"); expect(mfa.unenroll).toHaveBeenLastCalledWith({ factorId: "f1" });
    mfa.listFactors.mockResolvedValueOnce({ data: { all: [], totp: [] }, error: null });
    expect((await verifyLoginTotp(c, "654321")).error?.message).toContain("não tem APP");
  });
});
