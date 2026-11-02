import { describe, expect, it, vi } from "vitest";
import { removePhotoBackground, removePhotoBackgroundBase64, photoBackgroundMessage, photoBackgroundUrl, PHOTO_BACKGROUND_STYLES } from "./photo-background";
import { tc } from "./i18n-core";

const res = (status: number, body: any, headers: Record<string, string> = {}) => ({
  ok: status < 300, status, headers: { get: (n: string) => headers[n] ?? null },
  json: async () => body, blob: async () => new Blob(["jpg"], { type: "image/jpeg" })
});

describe("fundo branco", () => {
  it("monta o endereço da função", () => {
    expect(photoBackgroundUrl("https://site.ao/", "marca")).toBe("https://site.ao/api/fundo?estilo=marca");
    expect(photoBackgroundUrl("https://site.ao")).toBe("https://site.ao/api/fundo?estilo=branco");
  });

  it("Site: envia a foto com a sessão e devolve a nova e quantas restam", async () => {
    const f = vi.fn(async () => res(200, null, { "X-Remaining": "39" }));
    const r = await removePhotoBackground(f, { siteUrl: "https://site.ao", token: "tok", image: new Blob(["x"], { type: "image/png" }), style: "branco" });
    expect(r.error).toBeNull(); expect(r.data?.remaining).toBe(39);
    expect(f).toHaveBeenCalledWith("https://site.ao/api/fundo?estilo=branco", expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer tok", "Content-Type": "image/png" } }));
  });

  it("APP: envia em base64 e lê os erros da função", async () => {
    const ok = vi.fn(async () => res(200, { image: "QUJD", remaining: 3 }));
    expect((await removePhotoBackgroundBase64(ok, { siteUrl: "https://s", token: "t", base64: "eA==", style: "marca" })).data).toEqual({ base64: "QUJD", remaining: 3 });
    expect(JSON.parse((ok.mock.calls[0] as any)[1].body)).toEqual({ image: "eA==", estilo: "marca" });
    const lim = vi.fn(async () => res(429, { error: "AI_LIMIT" }));
    expect((await removePhotoBackgroundBase64(lim, { siteUrl: "https://s", token: "t", base64: "eA==" })).error).toBe("AI_LIMIT");
    const none = vi.fn(async () => res(422, { error: "NO_OBJECT" }));
    expect((await removePhotoBackgroundBase64(none, { siteUrl: "https://s", token: "t", base64: "eA==" })).error).toBe("NO_OBJECT");
    const down = vi.fn(async () => { throw new Error("fetch failed"); });
    expect((await removePhotoBackgroundBase64(down, { siteUrl: "https://s", token: "t", base64: "eA==" })).error).toBe("NETWORK");
    expect((await removePhotoBackgroundBase64(ok, { siteUrl: "https://s", token: null, base64: "eA==" })).error).toBe("AUTH_REQUIRED");
  });

  it("as mensagens e os estilos estão traduzidos", () => {
    for (const code of ["AUTH_REQUIRED", "ACCOUNT_SUSPENDED", "AI_LIMIT", "INVALID_IMAGE", "TOO_LARGE", "NO_OBJECT", "NOT_CONFIGURED", "SERVER_ERROR", "NETWORK", "?"]) {
      const pt = photoBackgroundMessage(code);
      for (const l of ["en", "zh", "fr"] as const) expect(tc(pt, l), `${l}: ${pt}`).not.toBe(pt);
    }
    for (const s of PHOTO_BACKGROUND_STYLES) expect(tc(s.label, "fr")).not.toBe(s.label);
  });
});
