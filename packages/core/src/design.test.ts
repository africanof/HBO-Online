import { describe, expect, it } from "vitest";
import { searchHref, readExploreParams, timeAgo, firstPhoto, HOME_CATEGORIES, SEARCH_SCOPES, LOGO_PARTS, BRAND } from "./design";

describe("design", () => {
  it("monta o endereço da pesquisa do topo", () => {
    expect(searchHref("classificados", "  casa T3 ")).toBe("/explorar?q=casa+T3");
    expect(searchHref("loja", "")).toBe("/loja");
    expect(searchHref("profissionais", "eletricista")).toBe("/profissionais?q=eletricista");
    expect(searchHref("classificados", "", { tipo: "vehicle", finalidade: undefined })).toBe("/explorar?tipo=vehicle");
    expect(SEARCH_SCOPES.map(s => s.value)).toEqual(["classificados", "loja", "pracas", "profissionais", "empresas"]);
    expect(searchHref("pracas", "kapango")).toBe("/pracas?q=kapango");
  });
  it("lê os filtros da página Explorar e ignora valores estranhos", () => {
    const p = new URLSearchParams("q=%20hilux%20&tipo=vehicle&finalidade=auction");
    expect(readExploreParams(k => p.get(k))).toEqual({ query: "hilux", listingType: "vehicle", purpose: "auction" });
    const bad = new URLSearchParams("tipo=nave&finalidade=x");
    expect(readExploreParams(k => bad.get(k))).toEqual({ query: "", listingType: "", purpose: "" });
  });
  it("as categorias da página inicial apontam para páginas existentes", () => {
    for (const c of HOME_CATEGORIES) expect(c.href).toMatch(/^\/(explorar|loja|pracas|procura-se|trocas|profissionais|empresas)(\?|$)/);
    expect(LOGO_PARTS.map(p => p[0]).join("")).toBe("HuamboOnline");
    expect(BRAND.blue).toBe("#3665F3");
  });
  it("mostra há quanto tempo foi publicado", () => {
    const now = new Date("2026-10-11T12:00:00Z").getTime();
    expect(timeAgo("2026-10-11T11:59:40Z", now)).toBe("agora mesmo");
    expect(timeAgo("2026-10-11T11:55:00Z", now)).toBe("há 5 min");
    expect(timeAgo("2026-10-11T09:00:00Z", now)).toBe("há 3 h");
    expect(timeAgo("2026-10-10T10:00:00Z", now)).toBe("há 1 dia");
    expect(timeAgo("2026-10-08T10:00:00Z", now)).toBe("há 3 dias");
    expect(timeAgo(null, now)).toBe("");
  });
  it("escolhe a primeira fotografia", () => {
    expect(firstPhoto(["a.jpg", "b.jpg"])).toBe("a.jpg");
    expect(firstPhoto([])).toBeNull();
    expect(firstPhoto(null)).toBeNull();
  });
});
