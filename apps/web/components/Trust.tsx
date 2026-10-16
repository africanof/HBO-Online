"use client";
import { useEffect, useState } from "react";
import { submitReport, validateReport, getTrustSignals, trustBadges, replyToReview, friendlyErrorIn, REPORT_REASONS, type ReportTargetType, type TrustSignals } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Botão «Denunciar» para perfis, empresas, profissionais e produtos. */
export function ReportButton({ type, id, label }: { type: ReportTargetType; id: string; label?: string }) {
  const { lang, t, tc } = useT();
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [details, setDetails] = useState("");
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function send() {
    if (!(await currentUserId())) { setError(t("sv.tr_login")); return; }
    const v = validateReport(reason); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await submitReport(supabase(), type, id, reason, details); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setDone(true); setOpen(false); }
  }
  if (done) return <p className="ok" role="status">{t("sv.tr_sent")}</p>;
  if (!open) return <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>🚩 {label ?? t("sv.tr_report")}</button>;
  return <section className="card" aria-label={t("sv.tr_report")}>
    <strong>{t("sv.tr_why")}</strong>
    <div className="row">{REPORT_REASONS.map(r => <button key={r} type="button" className={reason === r ? "" : "secondary"} onClick={() => setReason(r)}>{tc(r)}</button>)}</div>
    <textarea rows={2} value={details} onChange={e => setDetails(e.target.value)} placeholder={t("sv.tr_details_ph")} />
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" className="danger" disabled={busy} onClick={send}>{t("sv.tr_send")}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button></div>
  </section>;
}

/** Selos «✔ Identidade verificada», «✔ Empresa verificada»… */
export function TrustBadges({ userId }: { userId?: string | null }) {
  const { tc } = useT();
  const [t, setT] = useState<TrustSignals | null>(null);
  useEffect(() => { if (userId) void getTrustSignals(supabase(), userId).then(r => setT(r.data)); }, [userId]);
  const list = trustBadges(t);
  return list.length ? <div className="row">{list.map(b => <span key={b} className="verified">{tc(b)}</span>)}</div> : null;
}

/** Resposta do dono a uma avaliação (mostra a resposta; quem foi avaliado pode escrever/editar). */
export function ReviewReply({ kind, reviewId, reply, canReply, onDone }: { kind: "service" | "deal"; reviewId: string; reply?: string | null; canReply: boolean; onDone: () => void }) {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false); const [text, setText] = useState(reply ?? ""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setError("");
    const r = await replyToReview(supabase(), kind, reviewId, text); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOpen(false); onDone(); }
  }
  return <>
    {reply && !open && <div className="reply"><strong>{t("sv.tr_reply")}:</strong> {reply}</div>}
    {canReply && !open && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{reply ? t("sv.tr_edit_reply") : "↩ " + t("sv.tr_answer")}</button>}
    {open && <>
      <textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder={t("sv.tr_reply_ph")} />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={save}>{t("sv.tr_post_reply")}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button></div>
    </>}
  </>;
}
