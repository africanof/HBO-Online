"use client";
import { useEffect, useState } from "react";
import { adminAppHealth, friendlyErrorIn, type AppHealth } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, eventDateIn } from "../lib/i18n";

/** Equipa: erros da APP e do Site (agrupados) e ecrãs mais usados da APP. */
export function AdminAppHealth() {
  const { t, lang } = useT();
  const [days, setDays] = useState(7); const [h, setH] = useState<AppHealth | null>(null); const [error, setError] = useState("");
  useEffect(() => { setH(null); setError(""); void adminAppHealth(supabase(), days).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); else setH(r.data); }); }, [days]);
  const maxViews = Math.max(1, ...(h?.days ?? []).map(d => d.views));
  return <section className="stack">
    <nav className="chips">{[1, 7, 30].map(n => <button key={n} type="button" className={"chip" + (days === n ? " on" : "")} aria-pressed={days === n} onClick={() => setDays(n)}>{t("health.days", { n })}</button>)}</nav>
    {error && <p className="error" role="alert">{error}</p>}
    {!h && !error && <p className="muted">{t("common.loading")}</p>}
    {h && <>
      <h2>{t("health.per_day")}</h2>
      <div className="card health-days">{h.days.map(d => <div key={d.day} className="health-day">
        <span className="muted">{d.day.slice(5).split("-").reverse().join("/")}</span>
        <span className="health-bar"><span style={{ width: `${Math.round(d.views / maxViews * 100)}%` }} /></span>
        <span className="muted">{d.views} · {d.errors > 0 ? "⚠️ " + d.errors : "✓"}</span>
      </div>)}</div>
      <h2>{t("health.errors")}</h2>
      {!h.errors.length && <p>{t("health.no_errors")}</p>}
      {h.errors.map(e => <div key={e.fingerprint} className={"card" + (e.fatal ? " health-fatal" : "")}>
        <strong>{e.message}</strong>
        <span className="muted">{t("health.times", { n: e.total, u: e.users })}{e.fatal ? " · " + t("health.fatal") : ""} · {e.screen ?? "?"} · {e.app_version === "site" ? "🌐 Site" : "📱 v" + (e.app_version ?? "?")} · {eventDateIn(e.last_at, lang)}</span>
        {e.stack && <details><summary>Stack</summary><pre className="health-stack">{e.stack}</pre></details>}
      </div>)}
      <h2>{t("health.screens")}</h2>
      <div className="card">{h.screens.map(s => <div key={s.screen} className="health-screen"><span>{s.screen}</span><strong>{s.views}</strong></div>)}</div>
    </>}
  </section>;
}
