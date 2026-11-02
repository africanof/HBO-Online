"use client";
import { HELP_FAQ, SAFETY_TIPS, SCAM_WARNING_TEXT, type InfoPage as Page } from "@huambo-online/core";
import { HelpAssistant } from "./AiTools";
import { useT, type TFunction } from "../lib/i18n";
import { SV_INFO_PAGES, SV_HELP_FAQ, SV_SAFETY_TIPS, SV_SCAM_TEXT, type InfoPageText } from "../lib/i18n/services";
import { CONTACT_EMAIL } from "../lib/contact";
import { SafeSpotsList } from "./Safety";

/** Linha de contacto na língua escolhida (igual à do core, que só existe em português). */
function contactLineIn(t: TFunction): string {
  const e = CONTACT_EMAIL.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? t("sv.contact_email", { email: e }) : t("sv.contact_none");
}

/** Página traduzida, ou null se não houver tradução que bata certo com a do core (fica em português). */
function translatedPage(page: Page, lang: string, t: TFunction): InfoPageText | null {
  if (lang !== "en" && lang !== "zh" && lang !== "fr") return null;
  const tr = SV_INFO_PAGES[lang][page.slug];
  if (!tr || tr.sections.length !== page.sections.length) return null;
  const contact = contactLineIn(t);
  return { ...tr, sections: tr.sections.map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p === "{contact}" ? contact : p) })) };
}

/** Página de informação (Termos, Privacidade, Apagar conta, Devoluções) — texto vindo do código partilhado. */
export function InfoPageView({ page }: { page: Page }) {
  const { lang, t } = useT();
  const [y, m, d] = page.updated.split("-");
  const shown = translatedPage(page, lang, t) ?? page;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/">← {t("nav.home")}</a>
    <h1>{shown.title}</h1>
    <p style={{ fontSize: 19 }}>{shown.intro}</p>
    <small className="muted">{t("sv.info_updated", { date: lang === "zh" ? `${y}/${m}/${d}` : lang === "en" ? `${m}/${d}/${y}` : `${d}/${m}/${y}` })}</small>
    {shown.sections.map((s, k) => <section key={k} className="stack" style={{ gap: 6 }}>
      <h2 style={{ margin: "8px 0 0" }}>{s.title}</h2>
      {s.paragraphs.map((p, i) => <p key={i} style={{ margin: 0, lineHeight: 1.6 }}>{p}</p>)}
    </section>)}
    <nav className="row" aria-label={t("sv.info_more")} style={{ marginTop: 12 }}>
      <a href="/ajuda">{t("nav.help")}</a> · <a href="/termos">{t("sv.info_terms")}</a> · <a href="/privacidade">{t("sv.info_privacy")}</a> · <a href="/devolucoes">{t("sv.info_returns")}</a> · <a href="/apagar-conta">{t("sv.info_delete")}</a>
    </nav>
  </main>;
}

/** Página «Ajuda»: perguntas frequentes. */
export function HelpPageView() {
  const { lang, t } = useT();
  const faq = HELP_FAQ.map(f => (lang === "en" || lang === "zh" || lang === "fr" ? SV_HELP_FAQ[lang][f.q] : undefined) ?? f);
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/">← {t("nav.home")}</a>
    <h1>❓ {t("nav.help")}</h1>
    <p style={{ fontSize: 19 }}>{t("sv.help_intro")}</p>
    <a className="btn secondary" href="/seguranca" style={{ justifySelf: "start" }}>🛡️ {t("sv.help_safety_btn")}</a>
    <HelpAssistant />
    {faq.map(f => <details key={f.q} className="card faq"><summary><strong>{f.q}</strong></summary><p style={{ margin: 0, lineHeight: 1.6 }}>{f.a}</p></details>)}
    <section className="card"><h2 style={{ margin: 0 }}>{t("sv.help_more")}</h2><p style={{ margin: 0 }}>{contactLineIn(t)}</p></section>
    <nav className="row" aria-label={t("sv.info_more")}><a href="/termos">{t("nav.terms")}</a> · <a href="/privacidade">{t("nav.privacy")}</a> · <a href="/devolucoes">{t("sv.help_returns")}</a> · <a href="/apagar-conta">{t("sv.help_delete")}</a></nav>
  </main>;
}

/** Página «Segurança»: regras de ouro, pontos de encontro e sinais de burla. */
export function SafetyPageView() {
  const { lang, t, tc } = useT();
  const tips = SAFETY_TIPS.map(x => (lang === "en" || lang === "zh" || lang === "fr" ? SV_SAFETY_TIPS[lang][x] : undefined) ?? tc(x));
  const scams = Object.entries(SCAM_WARNING_TEXT).map(([k, x]) => (lang === "en" || lang === "zh" || lang === "fr" ? SV_SCAM_TEXT[lang][k] : undefined) ?? tc(x));
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/ajuda">← {t("nav.help")}</a>
    <h1>🛡️ {t("sv.sf_title")}</h1>
    <p style={{ fontSize: 19, margin: 0 }}>{t("sv.sf_intro")}</p>
    <section className="card"><h2 style={{ margin: 0 }}>✅ {t("sv.sf_rules")}</h2><ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{tips.map(x => <li key={x}>{x}</li>)}</ul></section>
    <section className="card"><h2 style={{ margin: 0 }}>📍 {t("sv.sf_spots")}</h2><p style={{ margin: 0 }}>{t("sv.sf_spots_intro")}</p><SafeSpotsList /></section>
    <section className="card"><h2 style={{ margin: 0 }}>⚠️ {t("sv.sf_scam")}</h2><p style={{ margin: 0 }}>{t("sv.sf_scam_intro")}</p><ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>{scams.map(x => <li key={x}>{x}</li>)}</ul></section>
    <section className="card"><h2 style={{ margin: 0 }}>🚫 {t("sv.sf_block")}</h2><p style={{ margin: 0 }}>{t("sv.sf_block_text")}</p></section>
  </main>;
}
