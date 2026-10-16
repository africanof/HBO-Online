"use client";
import { useT } from "../lib/i18n";

export default function NotFound() {
  const { t } = useT();
  return <main className="stack" style={{ textAlign: "center", justifyItems: "center", paddingTop: 48 }}>
    <span style={{ fontSize: 72 }} aria-hidden>🧭</span>
    <h1>{t("nf.title")}</h1>
    <p style={{ maxWidth: 520 }}>{t("nf.text")}</p>
    <div className="row" style={{ justifyContent: "center" }}>
      <a className="btn" href="/">{t("nf.home")}</a>
      <a className="btn secondary" href="/explorar">{t("nf.listings")}</a>
      <a className="btn secondary" href="/pracas">{t("nav.markets")}</a>
    </div>
  </main>;
}
