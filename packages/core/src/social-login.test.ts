import { describe, expect, it } from "vitest";
import { enabledSocialProviders, parseAuthReturn } from "./social-login";

describe("entrar com Google, Facebook ou Apple", () => {
  it("só mostra os que estão ligados", async () => {
    const f = (async () => ({ ok: true, json: async () => ({ external: { email: true, google: true, facebook: false, apple: true, github: true } }) })) as any;
    expect(await enabledSocialProviders("https://x.supabase.co", "k", f)).toEqual(["google", "apple"]);
    expect(await enabledSocialProviders("https://x.supabase.co", "k", (async () => { throw new Error("rede"); }) as any)).toEqual([]);
  });
  it("lê o regresso do navegador (APP e Site)", () => {
    expect(parseAuthReturn("huamboonline://login-callback?code=abc")).toMatchObject({ code: "abc" });
    expect(parseAuthReturn("huamboonline://login-callback#access_token=a&refresh_token=r&expires_in=3600")).toMatchObject({ accessToken: "a", refreshToken: "r" });
    expect(parseAuthReturn("https://huamboonline.com/conta/entrar?error=access_denied&error_description=Cancelado")).toMatchObject({ error: "Cancelado" });
  });
});
