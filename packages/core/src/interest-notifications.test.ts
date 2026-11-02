import { describe, expect, it, vi } from "vitest";
import { INTEREST_FREQUENCIES, setInterestNotifications } from "./notification-preferences";
import { tc } from "./i18n-core";

describe("«✨ Novidades para si»", () => {
  it("o aviso e as opções estão traduzidos", () => {
    expect(tc("✨ Novidades para si", "fr")).toBe("✨ Nouveautés pour vous");
    expect(tc("Um anúncio novo de que pode gostar: Toyota Hilux", "en")).toBe("A new listing you may like: Toyota Hilux");
    expect(tc("3 anúncios novos de que pode gostar, como Toyota Hilux.", "fr")).toBe("3 nouvelles annonces qui pourraient vous plaire, comme Toyota Hilux.");
    expect(tc("3 anúncios novos de que pode gostar, como Toyota Hilux.", "zh")).toBe("有3条您可能喜欢的新信息，例如Toyota Hilux。");
    for (const f of INTEREST_FREQUENCIES) for (const l of ["en", "zh", "fr"] as const) expect(tc(f.label, l), f.label).not.toBe(f.label);
  });
  it("guarda a frequência escolhida", async () => {
    const rpc = vi.fn(async () => ({ data: { interests_frequency: "weekly" }, error: null }));
    const r = await setInterestNotifications({ rpc } as any, "weekly");
    expect(rpc).toHaveBeenCalledWith("set_interest_notifications", { p_frequency: "weekly" });
    expect(r.data?.interests_frequency).toBe("weekly");
  });
});

describe("emails", () => {
  it("cancela só com um código válido", async () => {
    const { unsubscribeEmail, setEmailDigest } = await import("./notification-preferences");
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await unsubscribeEmail({ rpc } as any, "nao-e-codigo")).toEqual({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    expect(await unsubscribeEmail({ rpc } as any, "5029be45-f7a3-4d86-8f14-73c96ee83b82")).toEqual({ ok: true });
    await setEmailDigest({ rpc } as any, false);
    expect(rpc).toHaveBeenLastCalledWith("set_email_digest", { p_enabled: false });
  });
});
