import { describe, expect, it } from "vitest";
import { COMMON_DICT, LANGS, detectLang, translate, makeT, mergeDictionaries, missingTranslations, categoryLabelIn, isLang } from "./i18n";
import { HOME_CATEGORIES } from "./design";

describe("várias línguas", () => {
  it("todas as chaves comuns estão em português, inglês e mandarim", () => {
    for (const l of LANGS) expect(missingTranslations(COMMON_DICT, l)).toEqual([]);
  });
  it("todas as categorias da página inicial têm tradução", () => {
    for (const c of HOME_CATEGORIES) { expect(COMMON_DICT["cat." + c.label]).toBeTruthy(); expect(categoryLabelIn(c.label, "zh")).not.toBe(""); }
    expect(categoryLabelIn("Hotéis", "en")).toBe("Hotels"); expect(categoryLabelIn("Desconhecida", "en")).toBe("Desconhecida");
  });
  it("deteta a língua do navegador/telemóvel", () => {
    expect(detectLang("en-GB,en;q=0.9")).toBe("en"); expect(detectLang("zh-CN,zh;q=0.8")).toBe("zh"); expect(detectLang(["fr-FR", "pt-PT"])).toBe("pt");
    expect(detectLang("fr")).toBe("pt"); expect(detectLang(undefined)).toBe("pt");
    expect(isLang("zh")).toBe(true); expect(isLang("fr")).toBe(false);
  });
  it("traduz, troca valores e cai para português", () => {
    expect(translate(COMMON_DICT, "zh", "auth.hello_name", { name: "Ana" })).toBe("您好，Ana");
    const d = mergeDictionaries(COMMON_DICT, { "x.only_pt": { pt: "Só português" } });
    expect(makeT(d, "en")("x.only_pt")).toBe("Só português");
    expect(makeT(d, "en")("nav.sell")).toBe("Sell");
    expect(makeT(d, "en")("nao.existe")).toBe("nao.existe");
  });
});
