"use client";
import { useEffect, useState } from "react";
import { escrowBuyerStep, escrowSellerStep, canPayOrder, canConfirmReceived, submitOrderPayment, requestPaymentReference, confirmOrderReceived,
  uploadPaymentProof, validateDocument, paymentProofUrl, formatPrice, formatRef, friendlyErrorIn, LANG_TAGS, timeLeftText, ESCROW_STATUS_LABELS, ORDER_PAY_METHOD_LABELS,
  getProtectedSettings, updateProtectedSettings, getEscrowSummary, listOrderPaymentsForAdmin, decideOrderPayment, listPayoutsForAdmin, startPayoutBatch,
  markPayoutsPaid, rejectPayout, releaseEscrowAsAdmin, payoutsCsv, payoutsTotal, payoutDaysText, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS,
  type ProtectedOrderFields, type OrderPayMethod, type PlatformSettings, type ProtectedSettings, type EscrowSummary, type AdminOrderPayment,
  type AdminPayout, type PayoutStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { PaymentDetails } from "./Plans";
import { useT } from "../lib/i18n";

/** Pagar uma encomenda protegida: referência ProxyPay (automático) ou transferência/Express com comprovativo. */
function PayOrder({ order, uid, settings, provider, onDone }: { order: ProtectedOrderFields; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay"; onDone: (msg: string) => void }) {
  const { lang, t, tc } = useT();
  const [method, setMethod] = useState<OrderPayMethod>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [ref, setRef] = useState<{ entity: string; reference: string; amount: number | string; expires_at: string | null } | null>(
    order.payment?.provider === "proxypay" && order.payment.status === "pending" && order.payment.reference ? { entity: order.payment.entity ?? "", reference: order.payment.reference, amount: order.payment.amount, expires_at: order.payment.expires_at } : null);
  const code = order.ref_no ? formatRef("order", order.ref_no) : "";
  async function getReference() {
    setBusy(true); setError("");
    const r = await requestPaymentReference(supabase(), order.id);
    setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setRef(r.data);
  }
  async function send() {
    if (!reference.trim() && !file) { setError(t("sh.pp.need_ref")); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sh.proof_fail")); proof = up.data; }
      const r = await submitOrderPayment(supabase(), order.id, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      onDone(t("sh.pp.proof_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  if (provider === "proxypay") return <div className="stack" style={{ gap: 8 }}>
    {ref ? <dl className="facts card" style={{ margin: 0 }}>
      <dt>{t("sh.pp.entity")}</dt><dd><strong style={{ fontSize: 22 }}>{ref.entity}</strong></dd>
      <dt>{t("sh.pp.reference")}</dt><dd><strong style={{ fontSize: 22 }}>{ref.reference.replace(/(\d{3})(?=\d)/g, "$1 ")}</strong></dd>
      <dt>{t("sh.pp.amount")}</dt><dd><strong style={{ fontSize: 22 }}>{formatPrice(ref.amount)}</strong></dd>
      {ref.expires_at && <><dt>{t("sh.pp.valid")}</dt><dd>{tc(timeLeftText(ref.expires_at))}</dd></>}
    </dl> : <button disabled={busy} onClick={getReference} style={{ justifySelf: "start" }}>{busy ? t("sh.pp.generating") : "🔢 " + t("sh.pp.generate")}</button>}
    <small>{t("sh.pp.ref_hint")}</small>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
  return <div className="stack" style={{ gap: 10 }}>
    <strong>1. {t("sh.pp.pay_to_ho", { amount: formatPrice(order.total) })}</strong>
    <PaymentDetails s={settings} />
    {code && <small>{t("sh.pp.descr")} <strong>{code}</strong>.</small>}
    <strong>2. {t("sh.how_paid")}</strong>
    <div className="row" role="radiogroup" aria-label={t("sh.how_paid_short")}>{(Object.keys(ORDER_PAY_METHOD_LABELS) as OrderPayMethod[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(ORDER_PAY_METHOD_LABELS[m])}</button>)}</div>
    <label>{t("sh.reference")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder={t("sh.reference_ph")} /></label>
    <label>{t("sh.proof_label")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <small>🔒 {t("sh.proof_private")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy} onClick={send} style={{ justifySelf: "start" }}>{busy ? t("sh.sending") : t("sh.pp.send_proof")}</button>
  </div>;
}

/** Caixa do pagamento protegido dentro de cada encomenda (comprador ou vendedor). */
export function OrderEscrowPanel({ order, role, uid, settings, provider, hasActiveDispute, onChanged }: {
  order: ProtectedOrderFields; role: "buyer" | "seller"; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay";
  hasActiveDispute: boolean; onChanged: (msg: string, error?: boolean) => void }) {
  const { lang, t, tc } = useT();
  const [paying, setPaying] = useState(false); const [busy, setBusy] = useState(false);
  if (!order.protected || !order.escrow_status) return null;
  const step = role === "buyer" ? escrowBuyerStep(order, hasActiveDispute) : escrowSellerStep(order);
  async function confirmReceived() {
    if (!confirm(t("sh.pp.confirm_q"))) return;
    setBusy(true);
    const r = await confirmOrderReceived(supabase(), order.id);
    setBusy(false);
    if (r.error) onChanged(friendlyErrorIn(r.error, lang), true); else onChanged(t("sh.pp.thanks"));
  }
  return <div className="card stack" style={{ gap: 8, borderWidth: 2 }}>
    <strong>{order.status === "cancelled" && order.escrow_status === "awaiting_payment" ? "🛡️ " + t("sh.pp.cancelled") : tc(ESCROW_STATUS_LABELS[order.escrow_status])}</strong>
    <span>{tc(step)}</span>
    {role === "buyer" && order.payment?.status === "rejected" && order.payment.admin_note && order.escrow_status === "awaiting_payment" && <span className="error">{t("sh.pp.last_rejected")}: {order.payment.admin_note}</span>}
    {role === "buyer" && canPayOrder(order) && (paying || provider === "proxypay"
      ? <PayOrder order={order} uid={uid} settings={settings} provider={provider} onDone={m => { setPaying(false); onChanged(m); }} />
      : <button style={{ justifySelf: "start" }} onClick={() => setPaying(true)}>💳 {t("sh.pay_now")}</button>)}
    {role === "buyer" && canConfirmReceived(order, hasActiveDispute) && <button disabled={busy} style={{ justifySelf: "start" }} onClick={confirmReceived}>✅ {t("sh.pp.confirm_received")}</button>}
    {role === "seller" && order.escrow_status === "released" && <a href="/conta/saldo">💰 {t("sh.pp.see_balance")} →</a>}
  </div>;
}

/** Administração do pagamento protegido: definições, pagamentos por confirmar e levantamentos. */
export function AdminProtected() {
  const { lang, t, tc } = useT();
  const [s, setS] = useState<ProtectedSettings | null>(null); const [sum, setSum] = useState<EscrowSummary | null>(null);
  const [payments, setPayments] = useState<AdminOrderPayment[]>([]); const [payStatus, setPayStatus] = useState<"pending" | "confirmed" | "rejected" | "">("pending");
  const [payouts, setPayouts] = useState<AdminPayout[]>([]); const [poStatus, setPoStatus] = useState<PayoutStatus | "">("requested");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b, c, d] = await Promise.all([getProtectedSettings(supabase()), getEscrowSummary(supabase()), listOrderPaymentsForAdmin(supabase(), payStatus), listPayoutsForAdmin(supabase(), poStatus)]);
    setS(a.data); setSum(b.data); setPayments(c.data); setPayouts(d.data);
    const err = a.error ?? b.error ?? c.error ?? d.error; if (err) setError(friendlyErrorIn(err, lang));
  }
  useEffect(() => { void load(); }, [payStatus, poStatus]);
  const ok = async (p: PromiseLike<{ error: any }>, msg: string) => { setError(""); setNotice(""); const r = await p; if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); await load(); } };
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const fee = num(s.protected_fee_pct), days = Number(s.auto_release_days), hours = Number(s.payment_window_hours), min = num(s.payout_min_kz);
    if (!(fee >= 0 && fee <= 20) || !Number.isInteger(days) || days < 1 || days > 30 || !Number.isInteger(hours) || hours < 1 || hours > 168 || !(min >= 0)) { setError(t("sh.pa.check")); return; }
    if (s.payment_provider === "proxypay" && !/^\d{3,6}$/.test(String(s.proxypay_entity ?? ""))) { setError(t("sh.pa.need_entity")); return; }
    if (!s.payout_weekdays?.length) { setError(t("sh.pa.need_day")); return; }
    setBusy(true);
    await ok(updateProtectedSettings(supabase(), { protected_enabled: !!s.protected_enabled, payment_provider: s.payment_provider, proxypay_entity: s.proxypay_entity?.trim() || null,
      protected_fee_pct: fee, auto_release_days: days, payment_window_hours: hours, payout_min_kz: min, payout_weekdays: s.payout_weekdays }), t("sh.pa.saved"));
    setBusy(false);
  }
  async function decide(p: AdminOrderPayment, confirmIt: boolean) {
    const note = confirmIt ? "" : prompt(t("sh.pa.why_reject")) ?? "";
    if (!confirmIt && !note.trim()) return;
    if (confirmIt && !confirm(t("sh.pa.confirm_q", { amount: formatPrice(p.amount), name: p.buyer_name, ref: p.order_ref }))) return;
    await ok(decideOrderPayment(supabase(), p.id, confirmIt, note), confirmIt ? t("sh.pa.confirmed") : t("sh.pay_rejected"));
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyErrorIn(r.error, lang)); }
  function download(rows: AdminPayout[]) {
    const url = URL.createObjectURL(new Blob([payoutsCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `levantamentos-huambo-online-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function startBatch() {
    if (!confirm(t("sh.pa.batch_q"))) return;
    setError(""); setNotice("");
    const r = await startPayoutBatch(supabase());
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    const list = await listPayoutsForAdmin(supabase(), "processing");
    download(list.data.filter(p => p.batch_id === r.data));
    setNotice(t("sh.pa.batch_done"));
    setPoStatus("processing");
  }
  async function markPaid(rows: AdminPayout[]) {
    const ref = prompt(t("sh.pa.paid_q", { n: rows.length, total: formatPrice(payoutsTotal(rows)) }));
    if (ref === null) return;
    await ok(markPayoutsPaid(supabase(), rows.map(r => r.id), ref), t("sh.pa.paid_done"));
  }
  async function reject(p: AdminPayout) {
    const note = prompt(t("sh.pa.reject_q")) ?? "";
    if (!note.trim()) return;
    await ok(rejectPayout(supabase(), p.id, note), t("sh.pa.rejected"));
  }
  async function release() {
    const code = prompt(t("sh.pa.release_q")) ?? "";
    if (!code.trim()) return;
    const note = prompt(t("sh.pa.why")) ?? "";
    if (!note.trim()) return;
    const id = code.trim();
    const found = /^E-\d+$/i.test(id) ? await supabase().from("orders").select("id").eq("ref_no", Number(id.slice(2))).maybeSingle() : { data: { id }, error: null };
    if (!found.data?.id) { setError(t("sh.pa.order_not_found")); return; }
    await ok(releaseEscrowAsAdmin(supabase(), found.data.id, note), t("sh.pa.released"));
  }
  const toggleDay = (d: number) => s && setS({ ...s, payout_weekdays: (s.payout_weekdays ?? []).includes(d) ? (s.payout_weekdays ?? []).filter(x => x !== d) : [...(s.payout_weekdays ?? []), d].sort() });
  const processing = payouts.filter(p => p.status === "processing");
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🛡️ {t("sh.protected")}</h2>
    <p style={{ margin: 0 }}>{t("sh.pa.intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {sum && <div className="grid">
      <div className="card"><span>{t("sh.pa.held")}</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.held)}</strong></div>
      <div className="card"><span>{t("sh.pa.sellers_balance")}</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.available)}</strong></div>
      <div className="card"><span>{t("sh.pa.payouts_open")}</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.payouts_open)}</strong><small>{t("sh.pa.payouts_detail", { n: sum.payouts_requested, m: sum.payouts_processing })}</small></div>
      <div className="card"><span>{t("sh.pa.proofs_pending")}</span><strong style={{ fontSize: 26 }}>{sum.payments_pending}</strong><small>{t("sh.pa.awaiting", { n: sum.awaiting_payment })}</small></div>
      <div className="card"><span>{t("sh.pa.refunds")}</span><strong style={{ fontSize: 26 }}>{sum.refunds_to_send}</strong><small>{t("sh.pa.refunds_where")}</small></div>
      <div className="card"><span>{t("sh.pa.fees30")}</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.fees_30d)}</strong></div>
    </div>}

    <h3 style={{ margin: 0 }}>{t("sh.pa.order_payments")}</h3>
    <label style={{ maxWidth: 260 }}>{t("sh.show")}<select value={payStatus} onChange={e => setPayStatus(e.target.value as any)}>
      <option value="pending">{t("sh.to_confirm")}</option><option value="confirmed">{t("sh.confirmed_pl")}</option><option value="rejected">{t("sh.rejected_pl")}</option><option value="">{t("sh.all_m")}</option></select></label>
    {payments.length === 0 && <p>{t("sh.no_payments")}</p>}
    {payments.map(p => <article key={p.id} className="card">
      <strong>{formatPrice(p.amount)} · {p.order_ref} · <span className="badge">{p.status === "pending" ? t("sh.to_confirm") : p.status === "confirmed" ? t("sh.confirmed") : p.status === "rejected" ? t("sh.rejected") : t("sh.expired")}</span></strong>
      <span>{t("sh.buyer")}: {p.buyer_name}{p.buyer_phone ? " · " + p.buyer_phone : ""} · {t("sh.seller")}: {p.seller_name}</span>
      <span>{p.provider === "proxypay" ? `ProxyPay · ${t("sh.pp.entity")} ${p.entity} · ${t("sh.ref")} ${p.reference}` : `${tc(ORDER_PAY_METHOD_LABELS[p.method as OrderPayMethod] ?? p.method)}${p.reference ? " · " + t("sh.ref") + " " + p.reference : ""}`} · {new Date(p.created_at).toLocaleString(LANG_TAGS[lang])}</span>
      {p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount) && <span className="error">{t("sh.pa.paid_amount")}: {formatPrice(p.paid_amount)}</span>}
      {p.admin_note && <small>{t("sh.note")}: {p.admin_note}</small>}
      <div className="row">
        {p.proof_path && <button className="secondary" onClick={() => proof(p.proof_path!)}>📄 {t("sh.see_proof")}</button>}
        {p.status === "pending" && p.provider === "manual" && <><button onClick={() => decide(p, true)}>✔ {t("sh.pa.received")}</button><button className="danger" onClick={() => decide(p, false)}>✖ {t("sh.not_received")}</button></>}
      </div>
    </article>)}

    <h3 style={{ margin: 0 }}>{t("sh.pa.seller_payouts")}</h3>
    <p style={{ margin: 0 }}>{t("sh.pa.pay_days")}: <strong>{tc(payoutDaysText(s?.payout_weekdays))}</strong>. {t("sh.pa.batch_how")}</p>
    <div className="row">
      <button onClick={startBatch} disabled={!sum?.payouts_requested}>📦 {t("sh.pa.create_batch")}</button>
      <button className="secondary" onClick={release}>{t("sh.pa.release")}</button>
    </div>
    <label style={{ maxWidth: 260 }}>{t("sh.show")}<select value={poStatus} onChange={e => setPoStatus(e.target.value as any)}>
      {(Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map(k => <option key={k} value={k}>{tc(PAYOUT_STATUS_LABELS[k])}</option>)}<option value="">{t("sh.all_m")}</option></select></label>
    {poStatus === "processing" && processing.length > 0 && <div className="row">
      <button onClick={() => markPaid(processing)}>✔ {t("sh.pa.mark_batch", { n: processing.length, total: formatPrice(payoutsTotal(processing)) })}</button>
      <button className="secondary" onClick={() => download(processing)}>⬇️ {t("sh.pa.download_again")}</button>
    </div>}
    {payouts.length === 0 && <p>{t("sh.pa.no_payouts")}</p>}
    {payouts.map(p => <article key={p.id} className="card">
      <strong>L-{p.ref_no} · {formatPrice(p.amount)} · <span className="badge">{tc(PAYOUT_STATUS_LABELS[p.status])}</span></strong>
      <span>{p.holder_name} ({p.user_name}{p.phone ? " · " + p.phone : ""})</span>
      <span style={{ overflowWrap: "anywhere" }}>{tc(PAYOUT_METHOD_LABELS[p.method])}: <strong>{p.destination}</strong></span>
      <small>{t("sh.pa.requested")} {new Date(p.created_at).toLocaleString(LANG_TAGS[lang])}{p.paid_at ? " · " + t("sh.paid_on") + " " + new Date(p.paid_at).toLocaleString(LANG_TAGS[lang]) : ""}{p.bank_reference ? " · " + t("sh.ref") + " " + p.bank_reference : ""}</small>
      {p.admin_note && <small>{t("sh.note")}: {p.admin_note}</small>}
      {(p.status === "requested" || p.status === "processing") && <div className="row"><button className="danger" onClick={() => reject(p)}>✖ {t("sh.pa.dont_pay")}</button></div>}
    </article>)}

    {s && <form className="card stack" onSubmit={saveSettings}>
      <h3 style={{ margin: 0 }}>{t("sh.pa.settings")}</h3>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={!!s.protected_enabled} onChange={e => setS({ ...s, protected_enabled: e.target.checked })} style={{ width: 24, height: 24 }} /> {t("sh.pa.enable")}</label>
      <small>{t("sh.pa.enable_hint")}</small>
      <label>{t("sh.pa.provider")}<select value={s.payment_provider ?? "manual"} onChange={e => setS({ ...s, payment_provider: e.target.value as any })}>
        <option value="manual">{t("sh.pa.manual")}</option>
        <option value="proxypay">{t("sh.pa.proxypay")}</option></select></label>
      {s.payment_provider === "proxypay" && <label>{t("sh.pa.entity")}<input inputMode="numeric" value={s.proxypay_entity ?? ""} onChange={e => setS({ ...s, proxypay_entity: e.target.value })} placeholder={t("sh.pa.entity_ph")} /></label>}
      {s.payment_provider === "proxypay" && <small>{t("sh.pa.secret_hint")}</small>}
      <label>{t("sh.pa.fee")}<input inputMode="decimal" value={String(s.protected_fee_pct ?? "")} onChange={e => setS({ ...s, protected_fee_pct: e.target.value })} /></label>
      <label>{t("sh.pa.release_days")}<input inputMode="numeric" value={String(s.auto_release_days ?? "")} onChange={e => setS({ ...s, auto_release_days: e.target.value as any })} /></label>
      <label>{t("sh.pa.hours")}<input inputMode="numeric" value={String(s.payment_window_hours ?? "")} onChange={e => setS({ ...s, payment_window_hours: e.target.value as any })} /></label>
      <label>{t("sh.pa.min")}<input inputMode="numeric" value={String(s.payout_min_kz ?? "")} onChange={e => setS({ ...s, payout_min_kz: e.target.value })} /></label>
      <fieldset className="row" style={{ gap: 6 }}><legend>{t("sh.pa.weekdays")}</legend>
        {[[1, t("sh.day.mon")], [2, t("sh.day.tue")], [3, t("sh.day.wed")], [4, t("sh.day.thu")], [5, t("sh.day.fri")], [6, t("sh.day.sat")]].map(([d, l]) => <button key={d} type="button" role="checkbox" aria-checked={(s.payout_weekdays ?? []).includes(d as number)} className={(s.payout_weekdays ?? []).includes(d as number) ? "" : "secondary"} onClick={() => toggleDay(d as number)}>{l}</button>)}
      </fieldset>
      <button disabled={busy} style={{ justifySelf: "start" }}>{t("common.save")}</button>
    </form>}
  </section>;
}
