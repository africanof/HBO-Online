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
