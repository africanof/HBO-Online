import { describe, expect, it, vi } from "vitest";
import { normalizeReferralCode, isReferralCodeShape, referralLink, referralRewardText, referralInviteMessage, daysText, storeReferralCode, pendingReferralCode,
  getMyReferrals, claimReferral, claimPendingReferral, REFERRAL_KEY } from "./referrals";
import { friendlyError } from "./classified-listings";
import { getNotificationLink } from "./notifications";

const mem = (init: Record<string, string> = {}) => { const m = new Map(Object.entries(init)); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe("convide um amigo", () => {
  it("códigos e ligações", () => {
    expect(normalizeReferralCode(" k7m-2qx ")).toBe("K7M2QX");
    expect(isReferralCodeShape("k7m2qx")).toBe(true);
    expect(isReferralCodeShape("K7M2Q")).toBe(false);
    expect(isReferralCodeShape("K7M2Q0")).toBe(false); // sem 0, O, 1 ou I (confundem-se)
    expect(referralLink("https://huambo.ao/", "k7m2qx")).toBe("https://huambo.ao/?convite=K7M2QX");
  });
  it("textos", () => {
    expect(referralRewardText(30)).toBe("Ganhe 1 mês grátis na sua mensalidade por cada amigo que entrar com o seu convite e pagar a primeira mensalidade (profissional, empresa ou loja).");
    expect(referralRewardText(15)).toContain("15 dias grátis");
    expect(referralInviteMessage("https://huambo.ao", "K7M2QX")).toContain("👉 https://huambo.ao/?convite=K7M2QX");
    expect(daysText(30)).toBe("1 mês"); expect(daysText(90)).toBe("3 meses"); expect(daysText(10)).toBe("10 dias");
  });
  it("guarda o código da ligação até haver sessão", async () => {
    const s = mem();
    await storeReferralCode(s, "abc"); expect(await pendingReferralCode(s)).toBe("");
    await storeReferralCode(s, "k7m2qx"); expect(await pendingReferralCode(s)).toBe("K7M2QX");
  });
  it("usa o código guardado uma vez", async () => {
    const s = mem({ [REFERRAL_KEY]: "K7M2QX" });
    const rpc = vi.fn().mockResolvedValue({ data: "Aires", error: null });
    expect((await claimPendingReferral({ rpc } as any, s))?.data).toBe("Aires");
    expect(rpc).toHaveBeenCalledWith("claim_referral", { p_code: "K7M2QX" });
    expect(s.m.get(REFERRAL_KEY)).toBe("");
    expect(await claimPendingReferral({ rpc } as any, s)).toBeNull();
  });
  it("dois pedidos ao mesmo tempo usam o código uma só vez", async () => {
    const s = mem({ [REFERRAL_KEY]: "K7M2QX" });
    const rpc = vi.fn().mockResolvedValue({ data: "Aires", error: null });
    await Promise.all([claimPendingReferral({ rpc } as any, s), claimPendingReferral({ rpc } as any, s)]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("erro do convite apaga; falta de rede guarda para tentar depois", async () => {
    const s1 = mem({ [REFERRAL_KEY]: "K7M2QX" });
    await claimPendingReferral({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "REFERRAL_TOO_LATE" } }) } as any, s1);
    expect(s1.m.get(REFERRAL_KEY)).toBe("");
    const s2 = mem({ [REFERRAL_KEY]: "K7M2QX" });
    await claimPendingReferral({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Failed to fetch" } }) } as any, s2);
    expect(s2.m.get(REFERRAL_KEY)).toBe("K7M2QX");
  });
  it("valida antes de chamar o servidor", async () => {
    const rpc = vi.fn();
    expect((await claimReferral({ rpc } as any, "12")).error?.message).toContain("6 letras e números");
    expect(rpc).not.toHaveBeenCalled();
    const r = await getMyReferrals({ rpc: vi.fn().mockResolvedValue({ data: { code: "K7M2QX", invited: 2 }, error: null }) } as any);
    expect(r.data?.code).toBe("K7M2QX");
  });
  it("erros e avisos", () => {
    expect(friendlyError({ message: "REFERRAL_SELF" })).toBe("Não pode usar o seu próprio convite.");
    expect(friendlyError({ message: "REFERRAL_TOO_LATE" })).toContain("14 dias");
    expect(friendlyError({ message: "REFERRAL_NOT_FOUND" })).toContain("não encontrado");
    expect(getNotificationLink({ data: { for: "referral" }, type: "system", title: "x" } as any)?.href).toBe("/convidar");
  });
});
