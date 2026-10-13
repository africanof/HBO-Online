"use client";
import { useEffect, useState } from "react";
import { listCommissionsForAdmin, updateCommissionAsAdmin, COMMISSION_STATUS_LABELS, type AdminCommission, type CommissionStatus,
  listRevenue, revenueSummary, revenueCsv, monthRange, REVENUE_KIND_LABELS, type RevenueRow, type RevenueKind,
  getPlatformSettings, updatePlatformSettings, paymentAccounts, hasPaymentDetails, validatePaymentAccounts, MAX_PAYMENT_ACCOUNTS, type PaymentAccount, listMyPlans, planSummary, needsPayment, PLAN_STATE_LABELS, listPlanPaymentsForAdmin, decidePlanPayment, paymentProofUrl, formatPrice, friendlyError,
  PLAN_KIND_LABELS, PLAN_METHOD_LABELS, type PlatformSettings, type AdminPlanPayment } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { AdminBoosts } from "./Boosts";

/** Dados para pagamento (IBAN, Multicaixa Express) definidos pela administração. */
export function PaymentDetails({ s }: { s: PlatformSettings | null }) {
  if (!hasPaymentDetails(s)) return <p className="muted" style={{ margin: 0 }}>Os dados para pagamento ainda não foram publicados pela administração. Contacte-nos pelas mensagens.</p>;
  const accounts = paymentAccounts(s);
  return <div className="stack" style={{ gap: 8 }}>
    {accounts.length > 1 && <span>Pode pagar para qualquer uma destas contas:</span>}
    {accounts.map((a, i) => <dl key={i} className="facts card" style={{ margin: 0 }}>
      <dt>Banco</dt><dd><strong>{a.bank}</strong></dd>
      <dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{a.iban}</strong> <CopyButton text={a.iban} /></dd>
      <dt>Titular</dt><dd>{a.holder}</dd>
    </dl>)}
    {s!.express_number && <dl className="facts card" style={{ margin: 0 }}><dt>Multicaixa Express</dt><dd><strong>{s!.express_number}</strong> <CopyButton text={s!.express_number} /></dd></dl>}
    {s!.payment_note && <span>{s!.payment_note}</span>}
  </div>;
}
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="secondary" style={{ padding: "4px 12px", minHeight: 36 }} aria-label={"Copiar " + text}
    onClick={() => void navigator.clipboard?.writeText(text.replace(/\s/g, "")).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); })}>{done ? "Copiado ✔" : "Copiar"}</button>;
}

/** Administração: preços, dias grátis, dados para pagamento e pagamentos por confirmar. */
export function AdminPlans() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [accounts, setAccounts] = useState<PaymentAccount[]>([]); const [items, setItems] = useState<AdminPlanPayment[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected" | "">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b] = await Promise.all([getPlatformSettings(supabase()), listPlanPaymentsForAdmin(supabase(), status)]);
    setS(a.data); setAccounts(paymentAccounts(a.data)); if (b.error) setError(friendlyError(b.error)); setItems(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const provider = num(s.provider_monthly_kz), business = num(s.business_monthly_kz), store = num(s.store_monthly_kz), days = Number(s.trial_days), pct = num(s.listing_commission_pct), due = Number(s.commission_due_days), boostPrice = num(s.boost_price_kz ?? 500), boostDays = Number(s.boost_days ?? 7);
    if (!(provider >= 0) || !(business >= 0) || !(store >= 0) || !Number.isInteger(days) || days < 0 || days > 365 || !(pct >= 0 && pct <= 50) || !Number.isInteger(due) || due < 1 || due > 90 || !(boostPrice >= 0) || !Number.isInteger(boostDays) || boostDays < 1 || boostDays > 60) { setError("Verifique os preços, a percentagem e os dias."); return; }
    const bad = validatePaymentAccounts(accounts); if (bad) { setError(bad); return; }
    setBusy(true); setError(""); setNotice("");
    const clean = accounts.map(a => ({ bank: a.bank.trim(), iban: a.iban.trim(), holder: a.holder.trim() }));
    const r = await updatePlatformSettings(supabase(), { provider_monthly_kz: provider, business_monthly_kz: business, store_monthly_kz: store, trial_days: days, listing_commission_pct: pct, commission_due_days: due, boost_price_kz: boostPrice, boost_days: boostDays,
      payment_accounts: clean, bank_name: clean[0]?.bank ?? null, iban: clean[0]?.iban ?? null, account_holder: clean[0]?.holder ?? null,
      express_number: s.express_number?.trim() || null, payment_note: s.payment_note?.trim() || null });
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
    <AdminCommissions />
    <AdminBoosts />
    {s && <form className="card stack" onSubmit={saveSettings}>
      <h2 style={{ margin: 0 }}>Preços e dados para pagamento</h2>
      <label>Mensalidade dos profissionais (Kz)<input inputMode="numeric" value={String(s.provider_monthly_kz)} onChange={set("provider_monthly_kz")} /></label>
      <label>Mensalidade das empresas (Kz)<input inputMode="numeric" value={String(s.business_monthly_kz)} onChange={set("business_monthly_kz")} /></label>
      <label>Mensalidade das Lojas (Kz)<input inputMode="numeric" value={String(s.store_monthly_kz ?? "")} onChange={set("store_monthly_kz")} /></label>
      <label>Comissão dos anúncios vendidos (%)<input inputMode="decimal" value={String(s.listing_commission_pct ?? "")} onChange={set("listing_commission_pct")} /></label>
      <label>Dias para pagar a comissão<input inputMode="numeric" value={String(s.commission_due_days ?? "")} onChange={set("commission_due_days")} /></label>
      <label>Preço do destaque de anúncio (Kz)<input inputMode="numeric" value={String(s.boost_price_kz ?? "")} onChange={set("boost_price_kz")} /></label>
      <label>Dias de cada destaque<input inputMode="numeric" value={String(s.boost_days ?? "")} onChange={set("boost_days")} /></label>
      <label>Dias grátis para perfis novos<input inputMode="numeric" value={String(s.trial_days)} onChange={set("trial_days")} /></label>
      <strong>Contas para receber ({accounts.length}/{MAX_PAYMENT_ACCOUNTS})</strong>
      {accounts.map((a, i) => <fieldset key={i} className="card stack" style={{ margin: 0 }}>
        <legend>Conta {i + 1}</legend>
        <label>Banco<input value={a.bank} onChange={e => setAccounts(accounts.map((x, j) => j === i ? { ...x, bank: e.target.value } : x))} placeholder="Ex.: Banco Yetu" /></label>
        <label>IBAN<input value={a.iban} onChange={e => setAccounts(accounts.map((x, j) => j === i ? { ...x, iban: e.target.value } : x))} placeholder="AO06 …" /></label>
        <label>Titular<input value={a.holder} onChange={e => setAccounts(accounts.map((x, j) => j === i ? { ...x, holder: e.target.value } : x))} /></label>
        <button type="button" className="danger" style={{ justifySelf: "start" }} onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}>Tirar esta conta</button>
      </fieldset>)}
      {accounts.length < MAX_PAYMENT_ACCOUNTS && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setAccounts([...accounts, { bank: "", iban: "", holder: "" }])}>➕ Juntar conta bancária</button>}
      <label>Número Multicaixa Express<input value={s.express_number ?? ""} onChange={set("express_number")} placeholder="9xx xxx xxx" /></label>
      <label>Nota para quem paga (opcional)<input value={s.payment_note ?? ""} onChange={set("payment_note")} maxLength={500} placeholder="Ex.: escreva o seu nome no descritivo" /></label>
      <button disabled={busy} style={{ justifySelf: "start" }}>Guardar</button>
    </form>}
  </section>;
}

/** Faixa curta com o estado do plano (nas páginas de gestão do perfil). */
export function PlanBanner({ kind, subjectId }: { kind: "provider" | "business" | "store"; subjectId: string }) {
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof listMyPlans>>["data"][number] | null>(null);
  useEffect(() => { void listMyPlans(supabase()).then(r => setPlan(r.data.find(p => p.kind === kind && p.subject_id === subjectId) ?? null)); }, [kind, subjectId]);
  if (!plan) return null;
  const bad = plan.state === "expired";
  return <p className={bad ? "error" : needsPayment(plan) ? "" : "muted"} style={{ margin: 0 }} role={bad ? "alert" : undefined}>
    💳 <strong>{PLAN_STATE_LABELS[plan.state]}</strong> — {planSummary(plan)} <a href="/conta/plano">{needsPayment(plan) ? "Pagar agora →" : "Ver o meu plano →"}</a>
  </p>;
}

/** Administração: comissões dos anúncios vendidos. */
function AdminCommissions() {
  const [items, setItems] = useState<AdminCommission[]>([]); const [status, setStatus] = useState<CommissionStatus | "overdue" | "">("submitted");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listCommissionsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function act(c: AdminCommission, action: "confirm" | "reject" | "waive" | "adjust") {
    let note = "", amount: number | undefined;
    if (action === "adjust") { const v = prompt("Valor real da venda (Kz):", String(Number(c.sale_amount))); if (v === null) return; amount = Number(v.replace(/\s/g, "").replace(",", ".")); if (!(amount >= 0)) { setError("Valor inválido."); return; } note = prompt("Nota para o vendedor (opcional):") ?? ""; }
    else if (action !== "confirm") { note = prompt(action === "waive" ? "Porque anula esta comissão?" : "Porque não confirma o pagamento?") ?? ""; if (!note.trim()) return; }
    else if (!confirm(`Confirmar o pagamento de ${formatPrice(c.amount)} de ${c.owner_name}?`)) return;
    const r = await updateCommissionAsAdmin(supabase(), c.id, action, note, amount);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Comissão atualizada."); await load(); }
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyError(r.error)); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>Comissões dos anúncios</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <label style={{ maxWidth: 260 }}>Mostrar<select value={status} onChange={e => setStatus(e.target.value as any)}>
      <option value="submitted">Pagas — por confirmar</option><option value="overdue">Em atraso</option><option value="due">Por pagar</option><option value="paid">Pagas</option><option value="waived">Anuladas</option><option value="">Todas</option></select></label>
    {items.length === 0 && <p>Sem comissões.</p>}
    {items.map(c => <article key={c.id} className="card">
      <strong>{formatPrice(c.amount)} · <span className="badge">{COMMISSION_STATUS_LABELS[c.status]}</span></strong>
      <span><a href={"/classificados/" + c.listing_id} target="_blank">{c.listing_title}</a> · {c.owner_name}{c.phone ? " · " + c.phone : ""}</span>
      <span>Venda {formatPrice(c.sale_amount)}{c.listed_price != null ? " (anunciado por " + formatPrice(c.listed_price) + ")" : ""} · {String(c.rate_pct)}% · prazo {new Date(c.due_at).toLocaleDateString("pt-AO")}</span>
      {c.reference && <span>{c.method ? PLAN_METHOD_LABELS[c.method] + " · " : ""}Ref.: {c.reference}</span>}
      {c.admin_note && <small>Nota: {c.admin_note}</small>}
      <div className="row">
        {c.proof_path && <button className="secondary" onClick={() => proof(c.proof_path!)}>📄 Comprovativo</button>}
        {(c.status === "submitted" || c.status === "due") && <button onClick={() => act(c, "confirm")}>✔ Confirmar pagamento</button>}
        {c.status === "submitted" && <button className="secondary" onClick={() => act(c, "reject")}>✖ Não recebido</button>}
        {(c.status === "submitted" || c.status === "due") && <><button className="secondary" onClick={() => act(c, "adjust")}>Corrigir valor da venda</button><button className="secondary" onClick={() => act(c, "waive")}>Anular</button></>}
      </div>
    </article>)}
  </section>;
}

/** Administração: receitas confirmadas (mensalidades e comissões) de um mês, com ficheiro para o Excel. */
export function AdminRevenue() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<RevenueRow[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (!/^\d{4}-\d{2}$/.test(month)) return; setLoading(true); const { from, to } = monthRange(month);
    void listRevenue(supabase(), from, to).then(r => { setLoading(false); if (r.error) setError(friendlyError(r.error)); else { setError(""); setRows(r.data); } }); }, [month]);
  const sum = revenueSummary(rows);
  function download() {
    const url = URL.createObjectURL(new Blob([revenueCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `receitas-huambo-online-${month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>💰 Receitas</h2>
    <p style={{ margin: 0 }}>Mensalidades e comissões já confirmadas pela administração.</p>
    <label style={{ maxWidth: 260 }}>Mês<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="grid">
      <div className="card"><span>Total do mês</span><strong style={{ fontSize: 30 }}>{formatPrice(sum.total)}</strong><small>{sum.count} pagamento(s)</small></div>
      {(Object.keys(REVENUE_KIND_LABELS) as RevenueKind[]).map(k => <div key={k} className="card"><span>{REVENUE_KIND_LABELS[k]}</span><strong style={{ fontSize: 24 }}>{formatPrice(sum.byKind[k] ?? 0)}</strong></div>)}
    </div>
    <button type="button" className="secondary" style={{ justifySelf: "start" }} disabled={!rows.length} onClick={download}>⬇️ Descarregar para Excel (CSV)</button>
    {loading && <p>A carregar…</p>}
    {!loading && rows.length === 0 && <p>Sem receitas confirmadas neste mês.</p>}
    {rows.map((r, i) => <article key={i} className="card">
      <strong>{formatPrice(r.amount)} · {REVENUE_KIND_LABELS[r.kind]}</strong>
      <span style={{ overflowWrap: "anywhere" }}>{r.description} · {r.payer_name}</span>
      <small>{new Date(r.paid_at).toLocaleString("pt-AO")}{r.method ? " · " + PLAN_METHOD_LABELS[r.method] : ""}{r.reference ? " · Ref.: " + r.reference : ""}</small>
    </article>)}
  </section>;
}
