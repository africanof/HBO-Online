"use client";
import { FormEvent, useEffect, useState } from "react";
import { listTotpFactors, startTotpEnrollment, verifyTotp, disableTotp, mfaRequired, mfaErrorIn, formatTotpSecret,
  MFA_STEPS, type MfaFactor, type MfaEnrollment } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useT, formatDateIn } from "../../../lib/i18n";
import { MfaGate, MfaPrompt, TotpCodeInput } from "../../../components/Mfa";

function Security() {
  const { lang, t, tc } = useT();
  const [factor, setFactor] = useState<MfaFactor | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState(""); const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [askCode, setAskCode] = useState(false);

  async function load() {
    const r = await listTotpFactors(supabase());
    if (r.error) setError(mfaErrorIn(r.error, lang));
    setFactor(r.data.find(f => f.status === "verified") ?? null);
  }
  useEffect(() => { void load(); }, []);

  async function start() {
    setBusy(true); setError(""); setNotice(""); setCopied(false);
    const r = await startTotpEnrollment(supabase());
    setBusy(false);
    if (r.error || !r.data) { setError(mfaErrorIn(r.error, lang)); return; }
    setEnroll(r.data); setCode("");
  }
  async function confirm(e: FormEvent) {
    e.preventDefault(); if (!enroll || busy) return;
    setBusy(true); setError("");
    const r = await verifyTotp(supabase(), enroll.factorId, code);
    setBusy(false);
    if (r.error) { setError(mfaErrorIn(r.error, lang)); setCode(""); return; }
    setEnroll(null); setCode("");
    setNotice("✔ " + t("sv.mfa_on_done"));
    await load();
  }
  async function cancelEnroll() {
    if (enroll) await disableTotp(supabase(), enroll.factorId); // apaga a tentativa por confirmar
    setEnroll(null); setCode(""); setError("");
  }
  async function copy() {
    if (!enroll) return;
    try { await navigator.clipboard.writeText(enroll.secret); setCopied(true); } catch { setError(t("sv.mfa_copy_fail")); }
  }
  async function turnOff() {
    if (!factor) return;
    if (!window.confirm(t("sv.mfa_off_q"))) return;
    setError(""); setNotice("");
    // Para desligar, a sessão tem de estar confirmada com o código (nível 2).
    if (await mfaRequired(supabase())) { setAskCode(true); return; }
    await doTurnOff();
  }
  async function doTurnOff() {
    if (!factor) return;
    setAskCode(false); setBusy(true);
    const r = await disableTotp(supabase(), factor.id);
    setBusy(false);
    if (r.error) { setError(mfaErrorIn(r.error, lang)); return; }
    setNotice(t("sv.mfa_off_done")); await load();
  }

  return <main className="stack" style={{ maxWidth: 640 }}>
    <a href="/conta">← {t("sv.your_account")}</a>
    <h1>🔐 {t("sv.mfa_title")}</h1>
    <p style={{ margin: 0 }}>{t("sv.mfa_intro")}</p>
    {notice && <p className="ok" role="status">{notice}</p>}
    {factor === undefined ? <p>{t("common.loading")}</p> : factor ? <section className="card">
      <p className="ok" style={{ margin: 0 }}>✔ {t("sv.mfa_on")}</p>
      <p style={{ margin: 0 }}>{factor.created_at ? t("sv.mfa_on_since", { date: formatDateIn(factor.created_at, lang) }) : t("sv.mfa_on_text")} {t("sv.mfa_on_hint")}</p>
      {askCode ? <MfaPrompt title={t("sv.mfa_confirm_off")} onDone={() => void doTurnOff()} onCancel={() => setAskCode(false)} />
        : <div className="row"><button type="button" className="danger" disabled={busy} onClick={turnOff}>{busy ? t("sv.wait") : t("sv.mfa_turn_off")}</button></div>}
      {error && <p className="error" role="alert">{error}</p>}
    </section> : enroll ? <section className="card">
      <h2 style={{ margin: 0 }}>{t("sv.mfa_link_app")}</h2>
      <ol style={{ margin: 0, paddingLeft: 22 }}>{MFA_STEPS.map(s => <li key={s}>{tc(s)}</li>)}</ol>
      <img className="totp-qr" src={enroll.qrCode} alt={t("sv.mfa_qr_alt")} />
      <p style={{ margin: 0 }}>{t("sv.mfa_no_qr")}</p>
      <div className="row">
        <code className="totp-secret" aria-label={t("sv.mfa_key_aria")}>{formatTotpSecret(enroll.secret)}</code>
        <button type="button" className="secondary" onClick={copy}>{copied ? "✔ " + t("sv.mfa_copied") : "📋 " + t("sv.mfa_copy")}</button>
      </div>
      <form className="stack" onSubmit={confirm}>
        <TotpCodeInput value={code} onChange={setCode} label={t("sv.mfa_code_label")} />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button type="submit" disabled={busy || code.length !== 6}>{busy ? t("sv.rf_confirming") : t("sv.mfa_confirm_on")}</button>
          <button type="button" className="secondary" onClick={cancelEnroll}>{t("common.cancel")}</button>
        </div>
      </form>
    </section> : <section className="card">
      <p style={{ margin: 0 }}><strong>{t("sv.mfa_off")}</strong> {t("sv.mfa_how")}</p>
      <ol style={{ margin: 0, paddingLeft: 22 }}>{MFA_STEPS.map(s => <li key={s}>{tc(s)}</li>)}</ol>
      <p style={{ margin: 0 }}>⚠️ {t("sv.mfa_lose_warn")}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={start}>{busy ? t("sv.wait") : t("sv.mfa_turn_on")}</button></div>
    </section>}
  </main>;
}

export default function SegurancaPage() {
  const { t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  useEffect(() => { void currentUserId().then(setUid, () => setUid(null)); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/conta">← {t("sv.your_account")}</a><h1>🔐 {t("sv.mfa_title")}</h1><p><a href="/conta/login?voltar=/conta/seguranca">{t("sv.login_link")}</a> {t("sv.mfa_login_b")}</p></main>;
  return <MfaGate intro={t("sv.mfa_gate_intro")}><Security /></MfaGate>;
}
