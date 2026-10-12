"use client";
import { useEffect, useState } from "react";
import { listMyPlans, getPlatformSettings, submitPlanPayment, uploadPaymentProof, validatePlanPayment, planSummary, planTotal, needsPayment, formatPrice, friendlyError,
  PLAN_KIND_LABELS, PLAN_STATE_LABELS, PLAN_METHOD_LABELS, PLAN_MONTH_OPTIONS, validateDocument, type MyPlan, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { PaymentDetails } from "../../../components/Plans";


function PayForm({ plan, uid, settings, onDone }: { plan: MyPlan; uid: string; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const [months, setMonths] = useState(1); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    const invalid = validatePlanPayment({ months, method, reference, proofPath: file ? "x" : null }); if (invalid) { setError(invalid); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitPlanPayment(supabase(), plan.id, { months, method, reference, proofPath: proof });
      if (r.error) throw r.error;
      onDone("Pagamento enviado. A administração vai confirmar e recebe uma notificação.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 10 }}>
    <strong>1. Quantos meses quer pagar?</strong>
    <div className="row" role="radiogroup" aria-label="Meses">{PLAN_MONTH_OPTIONS.map(m => <button key={m} type="button" role="radio" aria-checked={months === m} className={months === m ? "" : "secondary"} onClick={() => setMonths(m)}>{m} {m === 1 ? "mês" : "meses"}</button>)}</div>
    <p style={{ margin: 0, fontSize: 20 }}>Total: <strong>{formatPrice(planTotal(plan.monthly_price, months))}</strong></p>
    <strong>2. Pague para estes dados</strong>
    <PaymentDetails s={settings} />
    <strong>3. Diga-nos como pagou</strong>
    <div className="row" role="radiogroup" aria-label="Como pagou">{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PLAN_METHOD_LABELS[m]}</button>)}</div>
    <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="Ex.: 1234 5678" /></label>
    <label>Comprovativo (fotografia ou PDF, opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <small>🔒 O comprovativo fica privado: só a administração o vê.</small>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy} onClick={send} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : `Enviar pagamento de ${formatPrice(planTotal(plan.monthly_price, months))}`}</button>
  </div>;
}

export default function Plano() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [plans, setPlans] = useState<MyPlan[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [p, s] = await Promise.all([listMyPlans(supabase()), getPlatformSettings(supabase())]);
    if (p.error) setError(friendlyError(p.error)); setPlans(p.data); setSettings(s.data);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><h1>O meu plano</h1><p><a href="/conta/login?voltar=/conta/plano">Inicie sessão</a>.</p></main>;
  const price = (k: "provider_monthly_kz" | "business_monthly_kz") => formatPrice(settings?.[k] ?? (k === "provider_monthly_kz" ? 2000 : 5000));
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← A sua conta</a>
    <h1>💳 O meu plano</h1>
    <p style={{ margin: 0 }}>Profissionais e empresas têm <strong>{settings?.trial_days ?? 30} dias grátis</strong>. Depois: profissionais <strong>{price("provider_monthly_kz")}</strong> por mês, empresas <strong>{price("business_monthly_kz")}</strong> por mês. Sem pagamento, o perfil deixa de aparecer aos clientes (não é apagado) e volta a aparecer quando o pagamento é confirmado.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {plans.length === 0 && <p>Ainda não tem perfil profissional nem empresa. <a href="/conta/profissional">Criar perfil profissional</a> · <a href="/conta/empresas">Registar empresa</a></p>}
    {plans.map(p => <article key={p.id} className="card stack">
      <strong style={{ fontSize: 20 }}>{PLAN_KIND_LABELS[p.kind]}: {p.name}</strong>
      <span><span className="badge">{PLAN_STATE_LABELS[p.state]}</span></span>
      <span className={p.state === "expired" ? "error" : ""} style={{ margin: 0 }}>{planSummary(p)}</span>
      {p.pending_payment_id && <p className="ok" style={{ margin: 0 }}>⏳ Pagamento de {formatPrice(p.pending_amount)} à espera de confirmação da administração.</p>}
      {p.last_rejected_note && !p.pending_payment_id && <p className="error" style={{ margin: 0 }}>Último pagamento não confirmado: {p.last_rejected_note}</p>}
      {!p.pending_payment_id && (open === p.id
        ? <PayForm plan={p} uid={uid} settings={settings} onDone={msg => { setNotice(msg); setOpen(null); void load(); }} />
        : <button className={needsPayment(p) ? "" : "secondary"} style={{ justifySelf: "start" }} onClick={() => { setOpen(p.id); setNotice(""); }}>{needsPayment(p) ? "💳 Pagar agora" : "💳 Pagar adiantado"}</button>)}
    </article>)}
  </main>;
}
