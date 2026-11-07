"use client";
import { useEffect } from "react";
import { reportSiteError } from "../components/ErrorReporter";
import { useT } from "../lib/i18n";

/** Se uma página falhar: «Tentar outra vez» e aviso à equipa. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useT();
  useEffect(() => { reportSiteError(error, true); }, [error]);
  return <main className="stack" style={{ alignItems: "center", textAlign: "center", padding: "64px 16px" }}>
    <div style={{ fontSize: 48 }} aria-hidden>😕</div>
    <h1>{t("err.title")}</h1>
    <p className="muted">{t("err.text")}</p>
    <button type="button" onClick={reset}>{t("err.retry")}</button>
  </main>;
}
