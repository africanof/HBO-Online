"use client";
import { useEffect, useState } from "react";
import { listMyPlans, getPlatformSettings, submitPlanPayment, uploadPaymentProof, validatePlanPayment, planSummary, planTotal, needsPayment, formatPrice, friendlyErrorIn,
  PLAN_KIND_LABELS, PLAN_STATE_LABELS, PLAN_METHOD_LABELS, PLAN_MONTH_OPTIONS, validateDocument, type MyPlan, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { PaymentDetails } from "../../../components/Plans";
import { useT } from "../../../lib/i18n";


function PayForm({ plan, uid, settings, onDone }: { plan: MyPlan; uid: string; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const { lang, t, tc } = useT();
  const [months, setMonths] = useState(1); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    const invalid = validatePlanPayment({ months, method, reference, proofPath: file ? "x" : null }); if (invalid) { setError(tc(invalid)); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sh.proof_fail")); proof = up.data; }
      const r = await submitPlanPayment(supabase(), plan.id, { months, method, reference, proofPath: proof });
      if (r.error) throw r.error;
      onDone(t("sh.pay_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 10 }}>
    <strong>1. {t("sh.plan.how_many")}</strong>
    <div className="row" role="radiogroup" aria-label={t("sh.plan.months")}>{PLAN_MONTH_OPTIONS.map(m => <button key={m} type="button" role="radio" aria-checked={months === m} className={months === m ? "" : "secondary"} onClick={() => setMonths(m)}>{t(m === 1 ? "sh.month_one" : "sh.month_many", { n: m })}</button>)}</div>
    <p style={{ margin: 0, fontSize: 20 }}>{t("sh.total")}: <strong>{formatPrice(planTotal(plan.monthly_price, months))}</strong></p>
    <strong>2. {t("sh.pay_to")}</strong>
    <PaymentDetails s={settings} />
    <strong>3. {t("sh.how_paid")}</strong>
    <div className="row" role="radiogroup" aria-label={t("sh.how_paid_short")}>{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
    <label>{t("sh.reference")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder={t("sh.reference_ph")} /></label>
    <label>{t("sh.proof_label")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <small>🔒 {t("sh.proof_private")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy} onClick={send} style={{ justifySelf: "start" }}>{busy ? t("sh.sending") : t("sh.send_payment", { amount: formatPrice(planTotal(plan.monthly_price, months)) })}</button>
  </div>;
}

export default function Plano() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [plans, setPlans] = useState<MyPlan[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [p, s] = await Promise.all([listMyPlans(supabase()), getPlatformSettings(supabase())]);
    if (p.error) setError(friendlyErrorIn(p.error, lang)); setPlans(p.data); setSettings(s.data);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><h1>{t("sh.plan.title")}</h1><p><a href="/conta/login?voltar=/conta/plano">{t("sh.sign_in")}</a>.</p></main>;
  const price = (k: "provider_monthly_kz" | "business_monthly_kz") => formatPrice(settings?.[k] ?? (k === "provider_monthly_kz" ? 2000 : 5000));
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("sh.your_account")}</a>
    <h1>💳 {t("sh.plan.title")}</h1>
    <p style={{ margin: 0 }}>{t("sh.plan.intro", { days: settings?.trial_days ?? 30, provider: price("provider_monthly_kz"), business: price("business_monthly_kz") })}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {plans.length === 0 && <p>{t("sh.plan.none")} <a href="/conta/profissional">{t("sh.plan.create_pro")}</a> · <a href="/conta/empresas">{t("sh.plan.register_biz")}</a></p>}
    {plans.map(p => <article key={p.id} className="card stack">
      <strong style={{ fontSize: 20 }}>{tc(PLAN_KIND_LABELS[p.kind])}: {p.name}</strong>
      <span><span className="badge">{tc(PLAN_STATE_LABELS[p.state])}</span></span>
      <span className={p.state === "expired" ? "error" : ""} style={{ margin: 0 }}>{tc(planSummary(p))}</span>
      {p.pending_payment_id && <p className="ok" style={{ margin: 0 }}>⏳ {t("sh.plan.pending", { amount: formatPrice(p.pending_amount) })}</p>}
      {p.last_rejected_note && !p.pending_payment_id && <p className="error" style={{ margin: 0 }}>{t("sh.plan.last_rejected")}: {p.last_rejected_note}</p>}
      {!p.pending_payment_id && (open === p.id
        ? <PayForm plan={p} uid={uid} settings={settings} onDone={msg => { setNotice(msg); setOpen(null); void load(); }} />
        : <button className={needsPayment(p) ? "" : "secondary"} style={{ justifySelf: "start" }} onClick={() => { setOpen(p.id); setNotice(""); }}>{needsPayment(p) ? "💳 " + t("sh.pay_now") : "💳 " + t("sh.plan.pay_ahead")}</button>)}
    </article>)}
  </main>;
}
