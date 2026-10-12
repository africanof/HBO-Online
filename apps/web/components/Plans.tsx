"use client";
import { useEffect, useState } from "react";
import { getPlatformSettings, updatePlatformSettings, listMyPlans, planSummary, needsPayment, PLAN_STATE_LABELS, listPlanPaymentsForAdmin, decidePlanPayment, paymentProofUrl, formatPrice, friendlyError,
  PLAN_KIND_LABELS, PLAN_METHOD_LABELS, type PlatformSettings, type AdminPlanPayment } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Dados para pagamento (IBAN, Multicaixa Express) definidos pela administração. */
export function PaymentDetails({ s }: { s: PlatformSettings | null }) {
  if (!s || !(s.iban || s.express_number)) return <p className="muted" style={{ margin: 0 }}>Os dados para pagamento ainda não foram publicados pela administração. Contacte-nos pelas mensagens.</p>;
  return <dl className="facts" style={{ margin: 0 }}>
    {s.bank_name && <><dt>Banco</dt><dd>{s.bank_name}</dd></>}
    {s.iban && <><dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{s.iban}</strong></dd></>}
    {s.account_holder && <><dt>Titular</dt><dd>{s.account_holder}</dd></>}
    {s.express_number && <><dt>Multicaixa Express</dt><dd><strong>{s.express_number}</strong></dd></>}
    {s.payment_note && <><dt>Nota</dt><dd>{s.payment_note}</dd></>}
  </dl>;
}

/** Administração: preços, dias grátis, dados para pagamento e pagamentos por confirmar. */
export function AdminPlans() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [items, setItems] = useState<AdminPlanPayment[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected" | "">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b] = await Promise.all([getPlatformSettings(supabase()), listPlanPaymentsForAdmin(supabase(), status)]);
    setS(a.data); if (b.error) setError(friendlyError(b.error)); setItems(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const provider = Number(String(s.provider_monthly_kz).replace(/\s/g, "")), business = Number(String(s.business_monthly_kz).replace(/\s/g, "")), days = Number(s.trial_days);
    if (!(provider >= 0) || !(business >= 0) || !Number.isInteger(days) || days < 0 || days > 365) { setError("Verifique os preços e os dias grátis."); return; }
    setBusy(true); setError(""); setNotice("");
    const r = await updatePlatformSettings(supabase(), { provider_monthly_kz: provider, business_monthly_kz: business, trial_days: days,
      bank_name: s.bank_name?.trim() || null, iban: s.iban?.trim() || null, account_holder: s.account_holder?.trim() || null, express_number: s.express_number?.trim() || null, payment_note: s.payment_note?.trim() || null });
    setBusy(false); if (r.error) setError(friendlyError(r.error)); else setNotice("Dados guardados.");
  }
  async function decide(p: AdminPlanPayment, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (a pessoa vai ler)") ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirmar ${formatPrice(p.amount)} de ${p.owner_name} (${p.months} mês/meses)?`)) return;
    const r = await decidePlanPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Pagamento confirmado. O perfil fica visível." : "Pagamento recusado."); await load(); }
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyError(r.error, "Não foi possível abrir o comprovativo.")); }
  const set = (k: keyof PlatformSettings) => (e: React.ChangeEvent<HTMLInputElement>) => s && setS({ ...s, [k]: e.target.value } as PlatformSettings);
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <h2 style={{ margin: 0 }}>Pagamentos de mensalidade</h2>
    <label style={{ maxWidth: 260 }}>Mostrar<select value={status} onChange={e => setStatus(e.target.value as any)}>
      <option value="pending">Por confirmar</option><option value="confirmed">Confirmados</option><option value="rejected">Recusados</option><option value="">Todos</option></select></label>
    {items.length === 0 && <p>Sem pagamentos.</p>}
    {items.map(p => <article key={p.id} className="card">
      <strong>{formatPrice(p.amount)} · {p.months} {p.months === 1 ? "mês" : "meses"} · <span className="badge">{p.status === "pending" ? "Por confirmar" : p.status === "confirmed" ? "Confirmado" : "Recusado"}</span></strong>
      <span>{PLAN_KIND_LABELS[p.kind]}: <a href={(p.kind === "provider" ? "/profissionais/" : "/empresas/") + p.subject_id} target="_blank">{p.subject_name}</a> · {p.owner_name}{p.phone ? " · " + p.phone : ""}</span>
      <span>{PLAN_METHOD_LABELS[p.method]}{p.reference ? " · Ref.: " + p.reference : ""} · {new Date(p.created_at).toLocaleString("pt-AO")}</span>
      <small>Plano ativo até {new Date(p.active_until).toLocaleDateString("pt-AO")}</small>
      {p.admin_note && <span>Nota: {p.admin_note}</span>}
      <div className="row">
        {p.proof_path && <button className="secondary" onClick={() => proof(p.proof_path!)}>📄 Ver comprovativo</button>}
        {p.status === "pending" && <><button onClick={() => decide(p, true)}>✔ Confirmar pagamento</button><button className="danger" onClick={() => decide(p, false)}>✖ Recusar</button></>}
      </div>
    </article>)}
    {s && <form className="card stack" onSubmit={saveSettings}>
      <h2 style={{ margin: 0 }}>Preços e dados para pagamento</h2>
      <label>Mensalidade dos profissionais (Kz)<input inputMode="numeric" value={String(s.provider_monthly_kz)} onChange={set("provider_monthly_kz")} /></label>
      <label>Mensalidade das empresas (Kz)<input inputMode="numeric" value={String(s.business_monthly_kz)} onChange={set("business_monthly_kz")} /></label>
      <label>Dias grátis para perfis novos<input inputMode="numeric" value={String(s.trial_days)} onChange={set("trial_days")} /></label>
      <label>Banco<input value={s.bank_name ?? ""} onChange={set("bank_name")} placeholder="Ex.: BAI" /></label>
      <label>IBAN<input value={s.iban ?? ""} onChange={set("iban")} placeholder="AO06 …" /></label>
      <label>Titular da conta<input value={s.account_holder ?? ""} onChange={set("account_holder")} /></label>
      <label>Número Multicaixa Express<input value={s.express_number ?? ""} onChange={set("express_number")} placeholder="9xx xxx xxx" /></label>
      <label>Nota para quem paga (opcional)<input value={s.payment_note ?? ""} onChange={set("payment_note")} maxLength={500} placeholder="Ex.: escreva o seu nome no descritivo" /></label>
      <button disabled={busy} style={{ justifySelf: "start" }}>Guardar</button>
    </form>}
  </section>;
}

/** Faixa curta com o estado do plano (nas páginas de gestão do perfil). */
export function PlanBanner({ kind, subjectId }: { kind: "provider" | "business"; subjectId: string }) {
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof listMyPlans>>["data"][number] | null>(null);
  useEffect(() => { void listMyPlans(supabase()).then(r => setPlan(r.data.find(p => p.kind === kind && p.subject_id === subjectId) ?? null)); }, [kind, subjectId]);
  if (!plan) return null;
  const bad = plan.state === "expired";
  return <p className={bad ? "error" : needsPayment(plan) ? "" : "muted"} style={{ margin: 0 }} role={bad ? "alert" : undefined}>
    💳 <strong>{PLAN_STATE_LABELS[plan.state]}</strong> — {planSummary(plan)} <a href="/conta/plano">{needsPayment(plan) ? "Pagar agora →" : "Ver o meu plano →"}</a>
  </p>;
}
