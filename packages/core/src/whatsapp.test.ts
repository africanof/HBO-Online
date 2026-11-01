import { describe, expect, it, vi } from "vitest";
import { teamWhatsappMessage, teamWhatsappRequestMessage, teamWhatsappLink, getTeamWhatsapp, setTeamWhatsapp, shareMessage, whatsappShareUrl, sellerWhatsappMessage, normalizeWhatsapp, formatWhatsapp, setMyWhatsapp, getSellerWhatsapp, friendlyError } from "./index";

describe("WhatsApp", () => {
  it("texto de partilha com preço, número do anúncio e local", () => {
    const m = shareMessage("https://huambo.online", "listing", "abc", "Toyota Hilux 2015", { price: 9500000, refCode: "A-1023", place: "Huambo" });
    expect(m.url).toBe("https://huambo.online/classificados/abc");
    expect(m.text).toBe("Toyota Hilux 2015 — Huambo Online\n💰 9 500 000 Kz · A-1023 · 📍 Huambo\n👉 https://huambo.online/classificados/abc");
    expect(shareMessage("", "product", "9", "Arroz", { price: 0 }).text).toBe("Arroz — Huambo Online");
    expect(whatsappShareUrl("Olá & adeus")).toBe("https://wa.me/?text=Ol%C3%A1%20%26%20adeus");
  });
  it("mensagem para o vendedor", () => {
    expect(sellerWhatsappMessage("listing", "Mota", "A-1001", "https://x/classificados/1")).toBe("Olá! Vi o seu anúncio «Mota» (A-1001) no Huambo Online e tenho interesse.\nhttps://x/classificados/1");
    expect(sellerWhatsappMessage("product", "Fuba")).toBe("Olá! Vi o seu produto «Fuba» no Huambo Online e tenho interesse.");
  });
  it("número: igual ao servidor", () => {
    expect(normalizeWhatsapp("932 806 332")).toBe("244932806332");
    expect(normalizeWhatsapp("+244 932-806-332")).toBe("244932806332");
    expect(normalizeWhatsapp("00244932806332")).toBe("244932806332");
    expect(normalizeWhatsapp("+351 912 345 678")).toBe("351912345678");
    expect(normalizeWhatsapp("244 22 123")).toBeNull();
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(formatWhatsapp("244932806332")).toBe("+244 932 806 332");
    expect(formatWhatsapp("351912345678")).toBe("+351912345678");
  });
  it("guardar e ler o número", async () => {
    const rpc = vi.fn(async () => ({ data: "244923000000", error: null }));
    const c = { rpc } as any;
    expect(friendlyError((await setMyWhatsapp(c, "123", true)).error)).toMatch(/WhatsApp válido/);
    await setMyWhatsapp(c, " 923 000 000 ", true);
    expect(rpc).toHaveBeenLastCalledWith("set_my_whatsapp", { p_number: "923 000 000", p_public: true });
    await setMyWhatsapp(c, "", false);
    expect(rpc).toHaveBeenLastCalledWith("set_my_whatsapp", { p_number: null, p_public: false });
    expect(await getSellerWhatsapp(c, "u1")).toBe("244923000000");
    expect(await getSellerWhatsapp({ rpc: async () => ({ data: null, error: null }) } as any, "u1")).toBeNull();
  });
  it("WhatsApp da equipa: mensagem com ligação direta", async () => {
    expect(teamWhatsappMessage("listing", "Mesa Infantil", "A-1001", "https://x/classificados/1")).toBe("Olá, equipa Huambo Online! Vi o anúncio «Mesa Infantil» (A-1001) e gostaria de saber se ainda está disponível.\n👉 https://x/classificados/1");
    expect(teamWhatsappRequestMessage("Reserva · Hotel X", 12, "https://x/reservas/9")).toBe("Olá, equipa Huambo Online! Fiz um pedido: Reserva · Hotel X (n.º 12). Podem ajudar-me a acompanhá-lo?\n👉 https://x/reservas/9");
    expect(teamWhatsappLink("923 000 000", "Olá & x")).toBe("https://wa.me/244923000000?text=Ol%C3%A1%20%26%20x");
    expect(teamWhatsappLink(null, "x")).toBeNull();
    const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { team_whatsapp: "244923000000" } }) };
    expect(await getTeamWhatsapp({ from: () => q } as any)).toBe("244923000000");
    const rpc = vi.fn(async () => ({ data: "244923000000", error: null }));
    expect(friendlyError((await setTeamWhatsapp({ rpc } as any, "12")).error)).toMatch(/WhatsApp válido/);
    await setTeamWhatsapp({ rpc } as any, "923 000 000");
    expect(rpc).toHaveBeenLastCalledWith("admin_set_team_whatsapp", { p_number: "923 000 000" });
  });
});
