"use client";
import { useEffect, useState } from "react";
import { listCommissionsForAdmin, updateCommissionAsAdmin, COMMISSION_STATUS_LABELS, type AdminCommission, type CommissionStatus,
  listRevenue, revenueSummary, revenueCsv, monthRange, REVENUE_KIND_LABELS, type RevenueRow, type RevenueKind,
  getPlatformSettings, updatePlatformSettings, paymentAccounts, hasPaymentDetails, validatePaymentAccounts, MAX_PAYMENT_ACCOUNTS, type PaymentAccount, listMyPlans, planSummary, needsPayment, PLAN_STATE_LABELS, listPlanPaymentsForAdmin, decidePlanPayment, paymentProofUrl, formatPrice, friendlyErrorIn, LANG_TAGS,
  PLAN_KIND_LABELS, PLAN_METHOD_LABELS, type PlatformSettings, type AdminPlanPayment } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { AdminBoosts } from "./Boosts";
import { useT } from "../lib/i18n";

/** Dados para pagamento (IBAN, Multicaixa Express) definidos pela administração. */
export function PaymentDetails({ s }: { s: PlatformSettings | null }) {
  const { t } = useT();
  if (!hasPaymentDetails(s)) return <p className="muted" style={{ margin: 0 }}>{t("sh.pd.none")}</p>;
  const accounts = paymentAccounts(s);
  return <div className="stack" style={{ gap: 8 }}>
    {accounts.length > 1 && <span>{t("sh.pd.any")}</span>}
    {accounts.map((a, i) => <dl key={i} className="facts card" style={{ margin: 0 }}>
      <dt>{t("sh.bank")}</dt><dd><strong>{a.bank}</strong></dd>
      <dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{a.iban}</strong> <CopyButton text={a.iban} /></dd>
      <dt>{t("sh.holder")}</dt><dd>{a.holder}</dd>
    </dl>)}
    {s!.express_number && <dl className="facts card" style={{ margin: 0 }}><dt>Multicaixa Express</dt><dd><strong>{s!.express_number}</strong> <CopyButton text={s!.express_number} /></dd></dl>}
    {s!.payment_note && <span>{s!.payment_note}</span>}
  </div>;
}
function CopyButton({ text }: { text: string }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return <button type="button" className="secondary" style={{ padding: "4px 12px", minHeight: 36 }} aria-label={t("sh.copy_x", { text })}
    onClick={() => void navigator.clipboard?.writeText(text.replace(/\s/g, "")).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); })}>{done ? t("sh.copied") + " ✔" : t("sh.copy")}</button>;
}

/** Administração: preços, dias grátis, dados para pagamento e pagamentos por confirmar. */
export function AdminPlans() {
  const { lang, t, tc } = useT();
  const [s, setS] = useState<PlatformSettings | null>(null); const [accounts, setAccounts] = useState<PaymentAccount[]>([]); const [items, setItems] = useState<AdminPlanPayment[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected" | "">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b] = await Promise.all([getPlatformSettings(supabase()), listPlanPaymentsForAdmin(supabase(), status)]);
    setS(a.data); setAccounts(paymentAccounts(a.data)); if (b.error) setError(friendlyErrorIn(b.error, lang)); setItems(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const provider = num(s.provider_monthly_kz), business = num(s.business_monthly_kz), store = num(s.store_monthly_kz), days = Number(s.trial_days), pct = num(s.listing_commission_pct), due = Number(s.commission_due_days), boostPrice = num(s.boost_price_kz ?? 500), boostDays = Number(s.boost_days ?? 7), refDays = Number(s.referral_reward_days ?? 30);
    if (!(provider >= 0) || !(business >= 0) || !(store >= 0) || !Number.isInteger(days) || days < 0 || days > 365 || !(pct >= 0 && pct <= 50) || !Number.isInteger(due) || due < 1 || due > 90 || !(boostPrice >= 0) || !Number.isInteger(boostDays) || boostDays < 1 || boostDays > 60 || !Number.isInteger(refDays) || refDays < 0 || refDays > 365) { setError(t("sh.apl.check")); return; }
    const bad = validatePaymentAccounts(accounts); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError(""); setNotice("");
    const clean = accounts.map(a => ({ bank: a.bank.trim(), iban: a.iban.trim(), holder: a.holder.trim() }));
    const r = await updatePlatformSettings(supabase(), { provider_monthly_kz: provider, business_monthly_kz: business, store_monthly_kz: store, trial_days: days, listing_commission_pct: pct, commission_due_days: due, boost_price_kz: boostPrice, boost_days: boostDays, referral_reward_days: refDays,
      payment_accounts: clean, bank_name: clean[0]?.bank ?? null, iban: clean[0]?.iban ?? null, account_holder: clean[0]?.holder ?? null,
      express_number: s.express_number?.trim() || null, payment_note: s.payment_note?.trim() || null });
    setBusy(false); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setNotice(t("sh.apl.saved"));
  }
  async function decide(p: AdminPlanPayment, ok: boolean) {
    const note = ok ? "" : prompt(t("sh.apl.why_reject")) ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(t("sh.apl.confirm_q", { amount: formatPrice(p.amount), name: p.owner_name, months: t(p.months === 1 ? "sh.month_one" : "sh.month_many", { n: p.months }) }))) return;
    const r = await decidePlanPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("sh.apl.confirmed") : t("sh.pay_rejected")); await load(); }
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyErrorIn(r.error, lang, t("sh.apl.proof_open_fail"))); }
  const set = (k: keyof PlatformSettings) => (e: React.ChangeEvent<HTMLInputElement>) => s && setS({ ...s, [k]: e.target.value } as PlatformSettings);
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <h2 style={{ margin: 0 }}>{t("sh.apl.title")}</h2>
    <label style={{ maxWidth: 260 }}>{t("sh.show")}<select value={status} onChange={e => setStatus(e.target.value as any)}>
      <option value="pending">{t("sh.to_confirm")}</option><option value="confirmed">{t("sh.confirmed_pl")}</option><option value="rejected">{t("sh.rejected_pl")}</option><option value="">{t("sh.all_m")}</option></select></label>
    {items.length === 0 && <p>{t("sh.no_payments")}</p>}
    {items.map(p => <article key={p.id} className="card">
      <strong>{formatPrice(p.amount)} · {t(p.months === 1 ? "sh.month_one" : "sh.month_many", { n: p.months })} · <span className="badge">{p.status === "pending" ? t("sh.to_confirm") : p.status === "confirmed" ? t("sh.confirmed") : t("sh.rejected")}</span></strong>
      <span>{tc(PLAN_KIND_LABELS[p.kind])}: <a href={(p.kind === "provider" ? "/profissionais/" : "/empresas/") + p.subject_id} target="_blank">{p.subject_name}</a> · {p.owner_name}{p.phone ? " · " + p.phone : ""}</span>
      <span>{tc(PLAN_METHOD_LABELS[p.method])}{p.reference ? " · " + t("sh.ref") + " " + p.reference : ""} · {new Date(p.created_at).toLocaleString(LANG_TAGS[lang])}</span>
      <small>{t("sh.apl.active_until", { date: new Date(p.active_until).toLocaleDateString(LANG_TAGS[lang]) })}</small>
      {p.admin_note && <span>{t("sh.note")}: {p.admin_note}</span>}
      <div className="row">
        {p.proof_path && <button className="secondary" onClick={() => proof(p.proof_path!)}>📄 {t("sh.see_proof")}</button>}
        {p.status === "pending" && <><button onClick={() => decide(p, true)}>✔ {t("sh.confirm_payment")}</button><button className="danger" onClick={() => decide(p, false)}>✖ {t("sh.reject")}</button></>}
      </div>
    </article>)}
    <AdminCommissions />
    <AdminBoosts />
    {s && <form className="card stack" onSubmit={saveSettings}>
      <h2 style={{ margin: 0 }}>{t("sh.apl.prices")}</h2>
      <label>{t("sh.apl.provider")}<input inputMode="numeric" value={String(s.provider_monthly_kz)} onChange={set("provider_monthly_kz")} /></label>
      <label>{t("sh.apl.business")}<input inputMode="numeric" value={String(s.business_monthly_kz)} onChange={set("business_monthly_kz")} /></label>
      <label>{t("sh.apl.store")}<input inputMode="numeric" value={String(s.store_monthly_kz ?? "")} onChange={set("store_monthly_kz")} /></label>
      <label>{t("sh.apl.pct")}<input inputMode="decimal" value={String(s.listing_commission_pct ?? "")} onChange={set("listing_commission_pct")} /></label>
      <label>{t("sh.apl.due")}<input inputMode="numeric" value={String(s.commission_due_days ?? "")} onChange={set("commission_due_days")} /></label>
      <label>{t("sh.apl.boost_price")}<input inputMode="numeric" value={String(s.boost_price_kz ?? "")} onChange={set("boost_price_kz")} /></label>
      <label>{t("sh.apl.boost_days")}<input inputMode="numeric" value={String(s.boost_days ?? "")} onChange={set("boost_days")} /></label>
      <label>{t("sh.apl.ref_days")}<input inputMode="numeric" value={String(s.referral_reward_days ?? "")} onChange={set("referral_reward_days")} /></label>
      <label>{t("sh.apl.trial")}<input inputMode="numeric" value={String(s.trial_days)} onChange={set("trial_days")} /></label>
      <strong>{t("sh.apl.accounts", { n: accounts.length, max: MAX_PAYMENT_ACCOUNTS })}</strong>
      {accounts.map((a, i) => <fieldset key={i} className="card stack" style={{ margin: 0 }}>
        <legend>{t("sh.apl.account_n", { n: i + 1 })}</legend>
        <label>{t("sh.bank")}<input value={a.bank} onChange={e => setAccounts(accounts.map((x, j) => j === i ? { ...x, bank: e.target.value } : x))} placeholder={t("sh.apl.bank_ph")} /></label>
        <label>IBAN<input value={a.iban} onChange={e => setAccounts(accounts.map((x, j) => j === i ? { ...x, iban: e.target.value } : x))} placeholder="AO06 …" /></label>
        <label>{t("sh.holder")}<input value={a.holder} onChange={e => setAccounts(accounts.map((x, j) => j === i ? { ...x, holder: e.target.value } : x))} /></label>
        <button type="button" className="danger" style={{ justifySelf: "start" }} onClick={() => setAccounts(accounts.filter((_, j) => j !== i))}>{t("sh.apl.remove_account")}</button>
      </fieldset>)}
      {accounts.length < MAX_PAYMENT_ACCOUNTS && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setAccounts([...accounts, { bank: "", iban: "", holder: "" }])}>➕ {t("sh.apl.add_account")}</button>}
      <label>{t("sh.express_number")}<input value={s.express_number ?? ""} onChange={set("express_number")} placeholder="9xx xxx xxx" /></label>
      <label>{t("sh.apl.note")}<input value={s.payment_note ?? ""} onChange={set("payment_note")} maxLength={500} placeholder={t("sh.apl.note_ph")} /></label>
      <button disabled={busy} style={{ justifySelf: "start" }}>{t("common.save")}</button>
    </form>}
  </section>;
}

/** Faixa curta com o estado do plano (nas páginas de gestão do perfil). */
export function PlanBanner({ kind, subjectId }: { kind: "provider" | "business" | "store"; subjectId: string }) {
  const { t, tc } = useT();
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof listMyPlans>>["data"][number] | null>(null);
  useEffect(() => { void listMyPlans(supabase()).then(r => setPlan(r.data.find(p => p.kind === kind && p.subject_id === subjectId) ?? null)); }, [kind, subjectId]);
  if (!plan) return null;
  const bad = plan.state === "expired";
  return <p className={bad ? "error" : needsPayment(plan) ? "" : "muted"} style={{ margin: 0 }} role={bad ? "alert" : undefined}>
    💳 <strong>{tc(PLAN_STATE_LABELS[plan.state])}</strong> — {tc(planSummary(plan))} <a href="/conta/plano">{needsPayment(plan) ? t("sh.pay_now") + " →" : t("sh.apl.see_plan") + " →"}</a>
  </p>;
}

/** Administração: comissões dos anúncios vendidos. */
function AdminCommissions() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<AdminCommission[]>([]); const [status, setStatus] = useState<CommissionStatus | "overdue" | "">("submitted");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listCommissionsForAdmin(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function act(c: AdminCommission, action: "confirm" | "reject" | "waive" | "adjust") {
    let note = "", amount: number | undefined;
    if (action === "adjust") { const v = prompt(t("sh.ac.real_q"), String(Number(c.sale_amount))); if (v === null) return; amount = Number(v.replace(/\s/g, "").replace(",", ".")); if (!(amount >= 0)) { setError(t("sh.invalid_amount")); return; } note = prompt(t("sh.ac.note_q")) ?? ""; }
    else if (action !== "confirm") { note = prompt(action === "waive" ? t("sh.ac.waive_q") : t("sh.ac.reject_q")) ?? ""; if (!note.trim()) return; }
    else if (!confirm(t("sh.ac.confirm_q", { amount: formatPrice(c.amount), name: c.owner_name }))) return;
    const r = await updateCommissionAsAdmin(supabase(), c.id, action, note, amount);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.ac.updated")); await load(); }
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyErrorIn(r.error, lang)); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>{t("sh.ac.title")}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <label style={{ maxWidth: 260 }}>{t("sh.show")}<select value={status} onChange={e => setStatus(e.target.value as any)}>
      <option value="submitted">{t("sh.ac.submitted")}</option><option value="overdue">{t("sh.com.late")}</option><option value="due">{t("sh.ac.due")}</option><option value="paid">{t("sh.ac.paid")}</option><option value="waived">{t("sh.ac.waived")}</option><option value="">{t("sh.all_f")}</option></select></label>
    {items.length === 0 && <p>{t("sh.ac.none")}</p>}
    {items.map(c => <article key={c.id} className="card">
      <strong>{formatPrice(c.amount)} · <span className="badge">{tc(COMMISSION_STATUS_LABELS[c.status])}</span></strong>
      <span><a href={"/classificados/" + c.listing_id} target="_blank">{c.listing_title}</a> · {c.owner_name}{c.phone ? " · " + c.phone : ""}</span>
      <span>{t("sh.com.sale")} {formatPrice(c.sale_amount)}{c.listed_price != null ? " (" + t("sh.ac.listed", { price: formatPrice(c.listed_price) }) + ")" : ""} · {String(c.rate_pct)}% · {t("sh.com.due")} {new Date(c.due_at).toLocaleDateString(LANG_TAGS[lang])}</span>
      {c.reference && <span>{c.method ? tc(PLAN_METHOD_LABELS[c.method]) + " · " : ""}{t("sh.ref")} {c.reference}</span>}
      {c.admin_note && <small>{t("sh.note")}: {c.admin_note}</small>}
      <div className="row">
        {c.proof_path && <button className="secondary" onClick={() => proof(c.proof_path!)}>📄 {t("sh.proof")}</button>}
        {(c.status === "submitted" || c.status === "due") && <button onClick={() => act(c, "confirm")}>✔ {t("sh.confirm_payment")}</button>}
        {c.status === "submitted" && <button className="secondary" onClick={() => act(c, "reject")}>✖ {t("sh.not_received")}</button>}
        {(c.status === "submitted" || c.status === "due") && <><button className="secondary" onClick={() => act(c, "adjust")}>{t("sh.ac.adjust")}</button><button className="secondary" onClick={() => act(c, "waive")}>{t("sh.ac.waive")}</button></>}
      </div>
    </article>)}
  </section>;
}

/** Administração: receitas confirmadas (mensalidades e comissões) de um mês, com ficheiro para o Excel. */
export function AdminRevenue() {
  const { lang, t, tc } = useT();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<RevenueRow[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => { if (!/^\d{4}-\d{2}$/.test(month)) return; setLoading(true); const { from, to } = monthRange(month);
    void listRevenue(supabase(), from, to).then(r => { setLoading(false); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setRows(r.data); } }); }, [month]);
  const sum = revenueSummary(rows);
  function download() {
    const url = URL.createObjectURL(new Blob([revenueCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `receitas-huambo-online-${month}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>💰 {t("sh.rv.title")}</h2>
    <p style={{ margin: 0 }}>{t("sh.rv.intro")}</p>
    <label style={{ maxWidth: 260 }}>{t("sh.rv.month")}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="grid">
      <div className="card"><span>{t("sh.rv.total")}</span><strong style={{ fontSize: 30 }}>{formatPrice(sum.total)}</strong><small>{t("sh.rv.count", { n: sum.count })}</small></div>
      {(Object.keys(REVENUE_KIND_LABELS) as RevenueKind[]).map(k => <div key={k} className="card"><span>{tc(REVENUE_KIND_LABELS[k])}</span><strong style={{ fontSize: 24 }}>{formatPrice(sum.byKind[k] ?? 0)}</strong></div>)}
    </div>
    <button type="button" className="secondary" style={{ justifySelf: "start" }} disabled={!rows.length} onClick={download}>⬇️ {t("sh.rv.download")}</button>
    {loading && <p>{t("common.loading")}</p>}
    {!loading && rows.length === 0 && <p>{t("sh.rv.none")}</p>}
    {rows.map((r, i) => <article key={i} className="card">
      <strong>{formatPrice(r.amount)} · {tc(REVENUE_KIND_LABELS[r.kind])}</strong>
      <span style={{ overflowWrap: "anywhere" }}>{r.description} · {r.payer_name}</span>
      <small>{new Date(r.paid_at).toLocaleString(LANG_TAGS[lang])}{r.method ? " · " + tc(PLAN_METHOD_LABELS[r.method]) : ""}{r.reference ? " · " + t("sh.ref") + " " + r.reference : ""}</small>
    </article>)}
  </section>;
}
