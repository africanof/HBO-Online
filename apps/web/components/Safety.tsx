"use client";
import { useEffect, useState } from "react";
import { getSafeSpots, saveSafeSpots, toggleBlock, listMyBlocks, conversationWarnings, friendlyErrorIn, SAFETY_TIPS, SCAM_WARNING_TEXT, DEFAULT_SAFE_SPOTS, type SafeSpot } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ReportButton } from "./Trust";
import { useT } from "../lib/i18n";

/** Pontos de encontro seguros (lista da administração). */
export function SafeSpotsList() {
  const { tc } = useT();
  const [spots, setSpots] = useState<SafeSpot[]>(DEFAULT_SAFE_SPOTS);
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  return <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{spots.map(s => <li key={s.name}><strong>{tc(s.name)}</strong>{s.note ? " — " + tc(s.note) : ""}</li>)}</ul>;
}

/** Caixa curta de dicas (página do anúncio). */
export function SafetyTipsBox() {
  const { t, tc } = useT();
  return <details className="card faq">
    <summary><strong>🛡️ {t("ls.safe_buy_sell")}</strong></summary>
    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{SAFETY_TIPS.slice(0, 4).map(x => <li key={x}>{tc(x)}</li>)}</ul>
    <p style={{ margin: "8px 0 0" }}><a href="/seguranca">{t("ls.safe_more")}</a></p>
  </details>;
}

/** Na conversa: avisos de burla, dicas, pontos de encontro, Bloquear e Denunciar. */
export function ConversationSafety({ messages, uid, otherUserId, otherName }: { messages: { sender_id: string; body: string | null }[]; uid: string; otherUserId?: string | null; otherName?: string | null }) {
  const { lang, t, tc } = useT();
  const [blocked, setBlocked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const warnings = conversationWarnings(messages, uid);
  useEffect(() => {
    setNotice(""); setError("");
    if (!otherUserId) return;
    void listMyBlocks(supabase()).then(r => setBlocked(r.data.some(b => b.user_id === otherUserId)));
  }, [otherUserId]);
  async function block() {
    if (!otherUserId) return;
    if (!blocked && !window.confirm(t("ls.block_confirm", { name: otherName || t("ls.this_person") }))) return;
    setBusy(true); setError("");
    const r = await toggleBlock(supabase(), otherUserId);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setBlocked(!!r.data); setNotice(r.data ? t("ls.blocked_done") : t("ls.unblocked_done"));
  }
  return <div className="stack" style={{ gap: 10 }}>
    {warnings.length > 0 && <div className="scam-warn" role="alert">
      <strong>⚠️ {t("ls.scam_title")}</strong>
      {warnings.map(w => <span key={w}>{tc(SCAM_WARNING_TEXT[w])}</span>)}
    </div>}
    {blocked && <p className="error" role="status" style={{ margin: 0 }}>🚫 {t("ls.you_blocked")}</p>}
    <details className="card faq">
      <summary><strong>🛡️ {t("ls.safety_tips_spots")}</strong></summary>
      <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{SAFETY_TIPS.map(x => <li key={x}>{tc(x)}</li>)}</ul>
      <strong style={{ display: "block", marginTop: 10 }}>📍 {t("ls.safe_spots")}</strong>
      <SafeSpotsList />
    </details>
    {otherUserId && <div className="row">
      <button type="button" className={blocked ? "secondary" : "danger"} disabled={busy} onClick={block}>{blocked ? "✅ " + t("ls.unblock") : "🚫 " + t("ls.block")}</button>
      <ReportButton type="user" id={otherUserId} label={"🚩 " + t("ls.report")} />
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
  </div>;
}

/** Administração: editar os pontos de encontro seguros. */
export function AdminSafeSpots() {
  const { lang, t } = useT();
  const [spots, setSpots] = useState<SafeSpot[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  const set = (i: number, k: keyof SafeSpot, v: string) => setSpots(list => list.map((s, j) => j === i ? { ...s, [k]: v } : s));
  async function save() {
    setBusy(true); setError(""); setNotice("");
    const r = await saveSafeSpots(supabase(), spots);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setNotice(t("ls.spots_saved"));
  }
  return <section className="card stack" style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>📍 {t("ls.safe_spots")}</h2>
    <p style={{ margin: 0 }}>{t("ls.spots_intro")}</p>
    {spots.map((s, i) => <fieldset key={i} className="card stack" style={{ gap: 6 }}>
      <legend>{t("ls.spot_n", { n: i + 1 })}</legend>
      <label>{t("ls.place")}<input value={s.name} maxLength={120} onChange={e => set(i, "name", e.target.value)} /></label>
      <label>{t("ls.note_opt")}<input value={s.note ?? ""} maxLength={200} onChange={e => set(i, "note", e.target.value)} /></label>
      <button type="button" className="secondary" onClick={() => setSpots(list => list.filter((_, j) => j !== i))}>{t("ls.spot_remove")}</button>
    </fieldset>)}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="row">
      {spots.length < 20 && <button type="button" className="secondary" onClick={() => setSpots(list => [...list, { name: "", note: "" }])}>➕ {t("ls.spot_add")}</button>}
      <button type="button" disabled={busy} onClick={save}>{busy ? t("recover.saving") : t("ls.spots_save")}</button>
    </div>
  </section>;
}
