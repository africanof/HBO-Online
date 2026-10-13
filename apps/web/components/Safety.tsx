"use client";
import { useEffect, useState } from "react";
import { getSafeSpots, saveSafeSpots, toggleBlock, listMyBlocks, conversationWarnings, friendlyError, SAFETY_TIPS, SCAM_WARNING_TEXT, DEFAULT_SAFE_SPOTS, type SafeSpot } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ReportButton } from "./Trust";

/** Pontos de encontro seguros (lista da administração). */
export function SafeSpotsList() {
  const [spots, setSpots] = useState<SafeSpot[]>(DEFAULT_SAFE_SPOTS);
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  return <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{spots.map(s => <li key={s.name}><strong>{s.name}</strong>{s.note ? " — " + s.note : ""}</li>)}</ul>;
}

/** Caixa curta de dicas (página do anúncio). */
export function SafetyTipsBox() {
  return <details className="card faq">
    <summary><strong>🛡️ Compre e venda em segurança</strong></summary>
    <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{SAFETY_TIPS.slice(0, 4).map(t => <li key={t}>{t}</li>)}</ul>
    <p style={{ margin: "8px 0 0" }}><a href="/seguranca">Ver pontos de encontro seguros e mais dicas</a></p>
  </details>;
}

/** Na conversa: avisos de burla, dicas, pontos de encontro, Bloquear e Denunciar. */
export function ConversationSafety({ messages, uid, otherUserId, otherName }: { messages: { sender_id: string; body: string | null }[]; uid: string; otherUserId?: string | null; otherName?: string | null }) {
  const [blocked, setBlocked] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const warnings = conversationWarnings(messages, uid);
  useEffect(() => {
    setNotice(""); setError("");
    if (!otherUserId) return;
    void listMyBlocks(supabase()).then(r => setBlocked(r.data.some(b => b.user_id === otherUserId)));
  }, [otherUserId]);
  async function block() {
    if (!otherUserId) return;
    if (!blocked && !window.confirm(`Bloquear ${otherName || "esta pessoa"}? Deixam de poder trocar mensagens.`)) return;
    setBusy(true); setError("");
    const r = await toggleBlock(supabase(), otherUserId);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setBlocked(!!r.data); setNotice(r.data ? "Pessoa bloqueada. Já não podem trocar mensagens." : "Pessoa desbloqueada.");
  }
  return <div className="stack" style={{ gap: 10 }}>
    {warnings.length > 0 && <div className="scam-warn" role="alert">
      <strong>⚠️ Cuidado: esta conversa tem sinais de burla</strong>
      {warnings.map(w => <span key={w}>{SCAM_WARNING_TEXT[w]}</span>)}
    </div>}
    {blocked && <p className="error" role="status" style={{ margin: 0 }}>🚫 Bloqueou esta pessoa. Desbloqueie para voltar a trocar mensagens.</p>}
    <details className="card faq">
      <summary><strong>🛡️ Dicas de segurança e pontos de encontro</strong></summary>
      <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{SAFETY_TIPS.map(t => <li key={t}>{t}</li>)}</ul>
      <strong style={{ display: "block", marginTop: 10 }}>📍 Pontos de encontro seguros</strong>
      <SafeSpotsList />
    </details>
    {otherUserId && <div className="row">
      <button type="button" className={blocked ? "secondary" : "danger"} disabled={busy} onClick={block}>{blocked ? "✅ Desbloquear" : "🚫 Bloquear"}</button>
      <ReportButton type="user" id={otherUserId} label="🚩 Denunciar" />
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
  </div>;
}

/** Administração: editar os pontos de encontro seguros. */
export function AdminSafeSpots() {
  const [spots, setSpots] = useState<SafeSpot[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { void getSafeSpots(supabase()).then(setSpots); }, []);
  const set = (i: number, k: keyof SafeSpot, v: string) => setSpots(list => list.map((s, j) => j === i ? { ...s, [k]: v } : s));
  async function save() {
    setBusy(true); setError(""); setNotice("");
    const r = await saveSafeSpots(supabase(), spots);
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setNotice("Pontos de encontro guardados.");
  }
  return <section className="card stack" style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>📍 Pontos de encontro seguros</h2>
    <p style={{ margin: 0 }}>Aparecem nas mensagens e na página «Segurança». Escreva lugares públicos, movimentados e com câmaras.</p>
    {spots.map((s, i) => <fieldset key={i} className="card stack" style={{ gap: 6 }}>
      <legend>Ponto {i + 1}</legend>
      <label>Lugar<input value={s.name} maxLength={120} onChange={e => set(i, "name", e.target.value)} /></label>
      <label>Nota (opcional)<input value={s.note ?? ""} maxLength={200} onChange={e => set(i, "note", e.target.value)} /></label>
      <button type="button" className="secondary" onClick={() => setSpots(list => list.filter((_, j) => j !== i))}>Tirar este ponto</button>
    </fieldset>)}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="row">
      {spots.length < 20 && <button type="button" className="secondary" onClick={() => setSpots(list => [...list, { name: "", note: "" }])}>➕ Juntar ponto</button>}
      <button type="button" disabled={busy} onClick={save}>{busy ? "A guardar…" : "Guardar pontos"}</button>
    </div>
  </section>;
}
