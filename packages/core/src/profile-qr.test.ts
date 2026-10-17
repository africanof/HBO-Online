import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { profileUrl, profileQrPngUrl, validProfileQrRequest, profileQrFilename, profileShareText, profileQrSvg, qrPng, PROFILE_QR_KINDS, PROFILE_QR_LABELS } from "./profile-qr";
import { qrMatrix } from "./events";
import { tc } from "./i18n-core";

const ID = "11111111-1111-4111-8111-111111111111";
describe("QR dos perfis", () => {
  it("endereços e validação", () => {
    expect(profileUrl("https://h.ao/", "empresas", ID)).toBe("https://h.ao/empresas/" + ID);
    expect(profileQrPngUrl("https://h.ao", "vendedor", ID)).toBe("https://h.ao/api/qr?kind=vendedor&id=" + ID);
    expect(validProfileQrRequest("pracas", ID)).toBe(true);
    expect(validProfileQrRequest("admin", ID)).toBe(false);
    expect(validProfileQrRequest("empresas", "1 or 1=1")).toBe(false);
    expect(profileQrFilename("Padaria Ekuikui & Filhos", "png")).toBe("qr-padaria-ekuikui-filhos.png");
    expect(profileQrFilename("", "svg")).toBe("qr-huambo-online.svg");
  });
  it("cartaz SVG com o nome (sem HTML perigoso)", () => {
    const svg = profileQrSvg("https://h.ao/empresas/" + ID, "Loja <b>Teste</b>");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Loja &lt;b&gt;Teste&lt;/b&gt;");
    expect(svg).not.toContain("<b>");
    const long = profileQrSvg("https://h.ao/empresas/" + ID, "Padaria e Pastelaria Ekuikui Muito Comprida Para Testar o Cartaz");
    const font = Number(/font-size="(\d+)" font-weight="700"/.exec(long)![1]); const width = Number(/width="(\d+)"/.exec(long)![1]);
    expect(font).toBeLessThan(26); expect(50 * font * 0.62).toBeLessThanOrEqual(width);
  });
  it("PNG válido, com os quadradinhos do QR", () => {
    const url = profileUrl("https://huambo-na-m-o.onrender.com", "empresas", ID);
    const png = qrPng(url, 4);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const dv = new DataView(png.buffer); const w = dv.getUint32(16); const n = qrMatrix(url).length;
    expect(w).toBe((n + 8) * 4);
    // descomprime o IDAT e confere o primeiro quadradinho escuro (canto do QR) e a margem branca
    const idatLen = dv.getUint32(33); const raw = inflateSync(Buffer.from(png.slice(41, 41 + idatLen)));
    const rowBytes = Math.ceil(w / 8); const px = (x: number, y: number) => (raw[y * (rowBytes + 1) + 1 + (x >> 3)] >> (7 - (x & 7))) & 1;
    expect(px(0, 0)).toBe(1); // margem branca
    expect(px(16, 16)).toBe(0); // canto superior esquerdo do QR é preto
  });
  it("traduções", () => {
    for (const k of PROFILE_QR_KINDS) expect(tc(PROFILE_QR_LABELS[k], "zh")).not.toBe(PROFILE_QR_LABELS[k]);
    expect(tc(profileShareText("Padaria", "https://h.ao/x"), "en")).toBe("Padaria on Huambo Online — see the profile, products and location:\n👉 https://h.ao/x");
  });
});
