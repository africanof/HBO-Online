"use client";
import { useState } from "react";
import { clearMyInterests, friendlyErrorIn } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** «A sua conta»: explica as recomendações e deixa apagar o histórico. */
export function RecommendationPrivacy() {
  const { lang, t } = useT();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function clear() {
    if (!confirm(t("rec.clear_q"))) return;
    setBusy(true); setMsg(""); setErr("");
    const u = await supabase().auth.getUser(); if (!u.data.user) { setBusy(false); return; }
    const r = await clearMyInterests(supabase(), u.data.user.id); setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setMsg(t("rec.cleared"));
  }
  return <section className="card stack" style={{ gap: 6 }}>
    <h2 style={{ margin: 0 }}>✨ {t("rec.title")}</h2>
    <p style={{ margin: 0 }}>{t("rec.text")}</p>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    <button type="button" className="secondary" style={{ justifySelf: "start" }} disabled={busy} onClick={() => void clear()}>{t("rec.clear")}</button>
  </section>;
}
