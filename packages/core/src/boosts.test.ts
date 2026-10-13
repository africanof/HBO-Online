import { describe, expect, it, vi } from "vitest";
import { isFeatured, boostOfferText, boostStateFor, formatDate, boostRef, requestBoost, decideBoost, listBoostsForAdmin, getNotificationLink, friendlyError,
  REVENUE_KIND_LABELS, FEATURED_TAG } from "./index";

const NOW = Date.parse("2026-10-13T10:00:00Z");
const iso = (h: number) => new Date(NOW + h * 3600000).toISOString();

describe("destaques pagos", () => {
  it("está em destaque?", () => {
    expect(isFeatured({ featured: true, featured_until: iso(5) }, NOW)).toBe(true);
    expect(isFeatured({ featured: true, featured_until: iso(-1) }, NOW)).toBe(false);
    expect(isFeatured({ featured: true, featured_until: null }, NOW)).toBe(true);
    expect(isFeatured({ featured: false }, NOW)).toBe(false);
    expect(FEATURED_TAG).toBe("⭐ Destaque");
  });
  it("texto da oferta", () => {
    expect(boostOfferText({ boost_price_kz: 500, boost_days: 7 })).toBe("⭐ Destacar por 500 Kz (7 dias)");
    expect(boostOfferText({ boost_price_kz: "1500", boost_days: 1 })).toBe("⭐ Destacar por 1 500 Kz (1 dia)");
    expect(boostOfferText(null)).toBe("⭐ Destacar por 500 Kz (7 dias)");
  });
  it("estado do destaque de cada anúncio", () => {
    const b = (status: any, created: number, ends?: number, note: string | null = null) => ({ listing_id: "l1", status, created_at: iso(created), ends_at: ends == null ? null : iso(ends), admin_note: note });
    expect(boostStateFor("l1", [], NOW)).toEqual({ kind: "none" });
    expect(boostStateFor("l1", [b("pending", -1)], NOW)).toEqual({ kind: "pending" });
    expect(boostStateFor("l1", [b("active", -50, 100), b("active", -2, 200)], NOW)).toEqual({ kind: "active", until: iso(200) });
    expect(boostStateFor("l1", [b("active", -500, -10)], NOW)).toEqual({ kind: "none" });
    expect(boostStateFor("l1", [b("rejected", -1, undefined, "Não recebido")], NOW)).toEqual({ kind: "rejected", note: "Não recebido" });
    expect(boostStateFor("outro", [b("pending", -1)], NOW)).toEqual({ kind: "none" });
    expect(formatDate("2026-10-20T23:30:00Z")).toBe("21/10/2026");
    expect(boostRef(1001)).toBe("D-1001");
  });
  it("chamadas ao servidor", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    const c = { rpc } as any;
    expect((await requestBoost(c, "l1", { method: "multicaixa_express" })).error?.message).toMatch(/referência/);
    await requestBoost(c, "l1", { method: "multicaixa_express", reference: " OP-1 " });
    expect(rpc).toHaveBeenLastCalledWith("request_listing_boost", { p_listing_id: "l1", p_method: "multicaixa_express", p_reference: "OP-1", p_proof_path: null });
    await decideBoost(c, "b1", false, " Não recebido ");
    expect(rpc).toHaveBeenLastCalledWith("admin_decide_boost", { p_boost_id: "b1", p_confirm: false, p_note: "Não recebido" });
    await listBoostsForAdmin(c, "");
    expect(rpc).toHaveBeenLastCalledWith("admin_list_boosts", { p_status: null });
  });
  it("avisos, erros e receitas", () => {
    expect(getNotificationLink({ type: "system", title: "Anúncio em destaque ⭐", data: { for: "boost" } })?.href).toBe("/meus-anuncios");
    expect(getNotificationLink({ type: "system", title: "Destaque para confirmar", data: { for: "admin", boost_id: "11111111-1111-4111-8111-111111111111" } })?.href).toBe("/admin");
    expect(friendlyError(new Error("LISTING_NOT_PUBLISHED"))).toMatch(/publicados/);
    expect(REVENUE_KIND_LABELS.boost).toBe("Destaque de anúncio");
  });
});
