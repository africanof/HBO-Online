import type { InfoPage as Page } from "@huambo-online/core";

/** Página de informação (Termos, Privacidade, Apagar conta) — texto vindo do código partilhado. */
export function InfoPageView({ page }: { page: Page }) {
  const [y, m, d] = page.updated.split("-");
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/">← Início</a>
    <h1>{page.title}</h1>
    <p style={{ fontSize: 19 }}>{page.intro}</p>
    <small className="muted">Última atualização: {d}/{m}/{y}</small>
    {page.sections.map(s => <section key={s.title} className="stack" style={{ gap: 6 }}>
      <h2 style={{ margin: "8px 0 0" }}>{s.title}</h2>
      {s.paragraphs.map((p, i) => <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>{p}</p>)}
    </section>)}
    <nav className="row" aria-label="Mais informação" style={{ marginTop: 12 }}>
      <a href="/ajuda">Ajuda</a> · <a href="/termos">Termos</a> · <a href="/privacidade">Privacidade</a> · <a href="/devolucoes">Devoluções</a> · <a href="/apagar-conta">Apagar conta</a>
    </nav>
  </main>;
}
