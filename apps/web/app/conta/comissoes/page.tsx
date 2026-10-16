"use client";
import { useEffect, useState } from "react";
import { listMyCommissions, submitCommissionPayment, commissionTotals, getPlatformSettings, uploadPaymentProof, validateDocument, formatPrice, friendlyErrorIn, LANG_TAGS,
  COMMISSION_STATUS_LABELS, COMMISSION_SOURCE_LABELS, PLAN_METHOD_LABELS, type MyCommission, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { PaymentDetails } from "../../../components/Plans";
import { useT } from "../../../lib/i18n";

export default function Comissoes() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyCommission[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [c, s] = await Promise.all([listMyCommissions(supabase()), getPlatformSettings(supabase())]);
    if (c.error) setError(friendlyErrorIn(c.error, lang)); setItems(c.data); setSettings(s.data);
    setSel(c.data.filter(x => x.status === "due").map(x => x.id));
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function pay() {
    if (!uid) return;
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError(""); setNotice("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sh.proof_fail")); proof = up.data; }
      const r = await submitCommissionPayment(supabase(), sel, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      setNotice(t("sh.pay_sent")); setReference(""); setFile(null); await load();
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><h1>{t("sh.com.short")}</h1><p><a href="/conta/login?voltar=/conta/comissoes">{t("sh.sign_in")}</a>.</p></main>;
  const tot = commissionTotals(items);
  const selTotal = items.filter(i => sel.includes(i.id)).reduce((s, i) => s + Number(i.amount), 0);
  const pct = settings?.listing_commission_pct ?? 5;
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("sh.your_account")}</a>
    <h1>💸 {t("sh.com.title")}</h1>
    <p style={{ margin: 0 }}>{t("sh.com.intro", { pct: String(pct), days: settings?.commission_due_days ?? 7 })}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {tot.overdueCount > 0 && <p className="error" style={{ margin: 0 }}>⚠️ {t("sh.com.overdue", { n: tot.overdueCount })}</p>}
    {items.length === 0 && <p>{t("sh.com.none")}</p>}
    {items.map(c => <article key={c.id} className="card" style={{ display: "grid", gridTemplateColumns: c.status === "due" ? "32px minmax(0,1fr)" : "minmax(0,1fr)", gap: 10 }}>
      {c.status === "due" && <input type="checkbox" aria-label={t("sh.com.pay_item", { title: c.listing_title })} checked={sel.includes(c.id)} onChange={e => setSel(e.target.checked ? [...sel, c.id] : sel.filter(x => x !== c.id))} style={{ width: 26, height: 26 }} />}
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <a href={"/classificados/" + c.listing_id} style={{ overflowWrap: "anywhere" }}><strong>{c.listing_title}</strong></a>
        <span>{t("sh.com.sale")}: {formatPrice(c.sale_amount)} · {String(c.rate_pct)}% = <strong>{formatPrice(c.amount)}</strong></span>
        <small className="muted">{tc(COMMISSION_SOURCE_LABELS[c.source])} · {t("sh.com.due")} {new Date(c.due_at).toLocaleDateString(LANG_TAGS[lang])}</small>
        <span className={c.overdue ? "error" : c.status === "paid" ? "ok" : ""} style={{ margin: 0 }}><strong>{c.overdue ? t("sh.com.late") : tc(COMMISSION_STATUS_LABELS[c.status])}</strong></span>
        {c.admin_note && <small>{t("sh.admin_note")}: {c.admin_note}</small>}
      </div>
    </article>)}
    {tot.dueCount > 0 && <section className="card stack">
      <h2 style={{ margin: 0 }}>{t("sh.com.pay_n", { n: sel.length, amount: formatPrice(selTotal) })}</h2>
      <strong>1. {t("sh.pay_to")}</strong>
      <PaymentDetails s={settings} />
      <strong>2. {t("sh.how_paid")}</strong>
      <div className="row" role="radiogroup" aria-label={t("sh.how_paid_short")}>{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
      <label>{t("sh.reference")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
      <label>{t("sh.proof_label_short")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button disabled={busy || !sel.length} onClick={pay} style={{ justifySelf: "start" }}>{busy ? t("sh.sending") : t("sh.send_payment", { amount: formatPrice(selTotal) })}</button>
    </section>}
  </main>;
}
