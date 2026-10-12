import { describe, expect, it } from "vitest";
import { termsPage, privacyPage, deleteAccountPage, returnsPage, HELP_FAQ, INFO_LINKS, contactLine } from "./legal";

describe("páginas de informação", () => {
  it("mostra o e-mail só quando é válido", () => {
    expect(contactLine("ajuda@huambo.ao")).toBe("Pode contactar-nos pelo e-mail ajuda@huambo.ao.");
    expect(contactLine("")).toMatch(/através da sua conta/);
    expect(contactLine("não-é-email")).toMatch(/através da sua conta/);
    expect(termsPage("ajuda@huambo.ao").sections.at(-1)?.paragraphs[0]).toMatch(/ajuda@huambo\.ao/);
  });
  it("tem as páginas que a Google Play pede", () => {
    const pages = [termsPage(), privacyPage(), deleteAccountPage()];
    expect(pages.map(p => p.slug)).toEqual(["termos", "privacidade", "apagar-conta"]);
    for (const p of pages) { expect(p.sections.length).toBeGreaterThan(1); expect(p.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
    expect(deleteAccountPage().sections[0].paragraphs.join(" ")).toMatch(/ELIMINAR/);
    expect(INFO_LINKS.map(l => l.href)).toEqual(["/ajuda", "/termos", "/privacidade", "/devolucoes", "/apagar-conta"]);
  });
  it("a privacidade descreve o que a APP faz de verdade", () => {
    const txt = privacyPage().sections.flatMap(s => s.paragraphs).join(" ");
    expect(txt).toMatch(/União Europeia/);       // Supabase eu-west-1
    expect(txt).toMatch(/7 dias/); expect(txt).toMatch(/30 dias/); // limpeza automática dos vídeos
    expect(txt).toMatch(/Anthropic/);            // pesquisa por fotografia
    expect(txt).toMatch(/Lei n\.º 22\/11|Protecção de Dados/);
  });
  it("a ajuda cobre as funções principais", () => {
    const qs = HELP_FAQ.map(f => f.q).join(" ");
    for (const w of ["publico", "propostas", "trocas", "serviço", "avalio", "Verificado", "burlas", "internet", "apago", "devolução", "retiro uma proposta", "cancelo um lance", "número do anúncio"]) expect(qs.toLowerCase()).toContain(w.toLowerCase());
  });
  it("a política de devoluções bate certo com as regras do servidor", () => {
    const p = returnsPage("ajuda@huambo.ao");
    const txt = p.sections.flatMap(x => x.paragraphs).join(" ");
    expect(p.slug).toBe("devolucoes");
    expect(txt).toMatch(/14 dias/); expect(txt).toMatch(/3 dias/); expect(txt).toMatch(/4 fotografias/);
    expect(txt).toMatch(/não guarda o dinheiro/); expect(txt).toMatch(/ajuda@huambo\.ao/);
    expect(termsPage().sections.flatMap(x => x.paragraphs).join(" ")).toMatch(/Devoluções e reembolsos/);
  });
});
