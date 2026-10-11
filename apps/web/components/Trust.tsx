"use client";
import { useEffect, useState } from "react";
import { submitReport, validateReport, getTrustSignals, trustBadges, replyToReview, friendlyError, REPORT_REASONS, type ReportTargetType, type TrustSignals } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";

/** Botão «Denunciar» para perfis, empresas, profissionais e produtos. */
export function ReportButton({ type, id, label = "Denunciar" }: { type: ReportTargetType; id: string; label?: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [details, setDetails] = useState("");
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function send() {
    if (!(await currentUserId())) { setError("Inicie sessão para denunciar."); return; }
    const v = validateReport(reason); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await submitReport(supabase(), type, id, reason, details); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setDone(true); setOpen(false); }
  }
  if (done) return <p className="ok" role="status">Denúncia enviada. Obrigado — a administração vai analisar.</p>;
  if (!open) return <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>🚩 {label}</button>;
  return <section className="card" aria-label="Denunciar">
    <strong>Porque quer denunciar?</strong>
    <div className="row">{REPORT_REASONS.map(r => <button key={r} type="button" className={reason === r ? "" : "secondary"} onClick={() => setReason(r)}>{r}</button>)}</div>
    <textarea rows={2} value={details} onChange={e => setDetails(e.target.value)} placeholder="Explique o que aconteceu (opcional)" />
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" className="danger" disabled={busy} onClick={send}>Enviar denúncia</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
  </section>;
}

/** Selos «✔ Identidade verificada», «✔ Empresa verificada»… */
export function TrustBadges({ userId }: { userId?: string | null }) {
  const [t, setT] = useState<TrustSignals | null>(null);
  useEffect(() => { if (userId) void getTrustSignals(supabase(), userId).then(r => setT(r.data)); }, [userId]);
  const list = trustBadges(t);
  return list.length ? <div className="row">{list.map(b => <span key={b} className="verified">{b}</span>)}</div> : null;
}

/** Resposta do dono a uma avaliação (mostra a resposta; quem foi avaliado pode escrever/editar). */
export function ReviewReply({ kind, reviewId, reply, canReply, onDone }: { kind: "service" | "deal"; reviewId: string; reply?: string | null; canReply: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(reply ?? ""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    const r = await replyToReview(supabase(), kind, reviewId, text); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setOpen(false); onDone(); }
  }
  return <>
    {reply && !open && <div className="reply"><strong>Resposta:</strong> {reply}</div>}
    {canReply && !open && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{reply ? "Editar resposta" : "↩ Responder"}</button>}
    {open && <>
      <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Escreva a sua resposta (fica pública)" />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={save}>Publicar resposta</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
    </>}
  </>;
}
