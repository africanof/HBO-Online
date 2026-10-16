"use client";
import { useEffect, useState } from "react";
import { getMyWallet, savePayoutAccount, requestPayout, cancelPayout, validatePayoutAccount, validatePayoutAmount, walletBalance, payoutDaysText, nextPayoutDate,
  formatPrice, friendlyErrorIn, LANG_TAGS, WALLET_KIND_LABELS, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS, type Wallet, type PayoutMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useT, formatDateIn } from "../../../lib/i18n";

export default function Saldo() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [w, setW] = useState<Wallet | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [method, setMethod] = useState<PayoutMethod>("iban"); const [holder, setHolder] = useState(""); const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  async function load() { const r = await getMyWallet(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setW(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setEditing(false); setAmount(""); await load(); }
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><h1>{t("sh.wal.title")}</h1><p><a href="/conta/login?voltar=/conta/saldo">{t("sh.sign_in")}</a>.</p></main>;
  const b = walletBalance(w), min = Number(w?.payout_min_kz ?? 0), next = nextPayoutDate(w?.payout_weekdays);
  const open = (w?.payouts ?? []).find(p => p.status === "requested" || p.status === "processing");
  function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    const bad = validatePayoutAccount({ method, holder, destination: dest }); if (bad) { setError(tc(bad)); return; }
    void run(savePayoutAccount(supabase(), { method, holder, destination: dest }), t("sh.wal.account_saved"));
  }
  function ask(e: React.FormEvent) {
    e.preventDefault();
    const value = amount.trim() ? Number(amount.replace(/\s/g, "").replace(",", ".")) : b.available;
    const bad = validatePayoutAmount(value, b.available, min); if (bad) { setError(tc(bad)); return; }
    if (!confirm(t("sh.wal.ask_q", { amount: formatPrice(value), dest: w?.account?.destination ?? "" }))) return;
    void run(requestPayout(supabase(), value), t("sh.wal.asked", { days: tc(payoutDaysText(w?.payout_weekdays)) }));
  }
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("sh.your_account")}</a>
    <h1>💰 {t("sh.wal.title")}</h1>
    <p style={{ margin: 0 }}>{t("sh.wal.intro", { n: w?.auto_release_days ?? 3 })}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="grid">
      <div className="card"><span>{t("sh.wal.available")}</span><strong style={{ fontSize: 32 }}>{formatPrice(b.available)}</strong></div>
      <div className="card"><span>{t("sh.wal.pending")}</span><strong style={{ fontSize: 26 }}>{formatPrice(b.pending)}</strong></div>
      <div className="card"><span>{t("sh.wal.in_payout")}</span><strong style={{ fontSize: 26 }}>{formatPrice(b.inPayout)}</strong><small>{t("sh.wal.paid_out")}: {formatPrice(w?.paid_out ?? 0)}</small></div>
    </div>
    {Number(w?.fee_pct ?? 0) > 0 && <small>{t("sh.wal.fee", { pct: String(w?.fee_pct) })}</small>}

    <section className="card stack">
      <h2 style={{ margin: 0 }}>{t("sh.wal.where")}</h2>
      {w?.account && !editing ? <>
        <span>{tc(PAYOUT_METHOD_LABELS[w.account.method])}: <strong style={{ overflowWrap: "anywhere" }}>{w.account.destination}</strong></span>
        <span>{t("sh.holder")}: {w.account.holder_name}</span>
        <button className="secondary" style={{ justifySelf: "start" }} onClick={() => { setEditing(true); setMethod(w.account!.method); setHolder(w.account!.holder_name); setDest(""); }}>{t("sh.wal.change")}</button>
      </> : <form className="stack" onSubmit={saveAccount}>
        <div className="row" role="radiogroup" aria-label={t("sh.wal.account_type")}>{(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PAYOUT_METHOD_LABELS[m])}</button>)}</div>
        <label>{t("sh.wal.holder_name")}<input value={holder} onChange={e => setHolder(e.target.value)} maxLength={120} autoComplete="name" /></label>
        <label>{method === "iban" ? t("sh.wal.iban") : t("sh.express_number")}<input value={dest} onChange={e => setDest(e.target.value)} inputMode={method === "iban" ? "text" : "tel"} placeholder={method === "iban" ? "AO06 0000 0000 0000 0000 0000 0" : "9xx xxx xxx"} /></label>
        <small>🔒 {t("sh.wal.private")}</small>
        <div className="row"><button disabled={busy}>{t("sh.wal.save_account")}</button>{editing && <button type="button" className="secondary" onClick={() => setEditing(false)}>{t("common.cancel")}</button>}</div>
      </form>}
    </section>

    <section className="card stack">
      <h2 style={{ margin: 0 }}>{t("sh.wal.ask")}</h2>
      <p style={{ margin: 0 }}>{t("sh.wal.days", { days: tc(payoutDaysText(w?.payout_weekdays)) })}{next ? " " + t("sh.wal.next", { date: formatDateIn(next, lang) }) : ""}. {t("sh.wal.min")}: {formatPrice(min)}.</p>
      {open ? <>
        <p className="ok" style={{ margin: 0 }}>⏳ L-{open.ref_no}: {formatPrice(open.amount)} — {tc(PAYOUT_STATUS_LABELS[open.status])}</p>
        {open.status === "requested" && <button className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => { if (confirm(t("sh.wal.cancel_q"))) void run(cancelPayout(supabase(), open.id), t("sh.wal.cancelled")); }}>{t("sh.wal.cancel")}</button>}
      </> : <form className="stack" onSubmit={ask}>
        <label>{t("sh.wal.amount")}<input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(b.available)} /></label>
        <button disabled={busy || !w?.account || b.available < Math.max(min, 1)} style={{ justifySelf: "start" }}>💸 {t("sh.wal.ask")}</button>
        {!w?.account && <small>{t("sh.wal.first_account")}</small>}
      </form>}
    </section>

    <section className="stack">
      <h2 style={{ margin: 0 }}>{t("sh.wal.payouts")}</h2>
      {(w?.payouts ?? []).length === 0 && <p>{t("sh.wal.no_payouts")}</p>}
      {(w?.payouts ?? []).map(p => <article key={p.id} className="card">
        <strong>L-{p.ref_no} · {formatPrice(p.amount)} · <span className="badge">{tc(PAYOUT_STATUS_LABELS[p.status])}</span></strong>
        <span style={{ overflowWrap: "anywhere" }}>{p.destination}</span>
        <small>{new Date(p.created_at).toLocaleString(LANG_TAGS[lang])}{p.paid_at ? " · " + t("sh.paid_on") + " " + new Date(p.paid_at).toLocaleString(LANG_TAGS[lang]) : ""}{p.bank_reference ? " · " + t("sh.ref") + " " + p.bank_reference : ""}</small>
        {p.admin_note && <small>{t("sh.note")}: {p.admin_note}</small>}
      </article>)}
      <h2 style={{ margin: 0 }}>{t("sh.wal.entries")}</h2>
      {(w?.entries ?? []).length === 0 && <p>{t("sh.wal.no_entries")}</p>}
      {(w?.entries ?? []).map(e => <div key={e.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
        <span>{tc(WALLET_KIND_LABELS[e.kind])}{e.note ? <small className="muted"> · {e.note}</small> : null}<br /><small className="muted">{new Date(e.created_at).toLocaleString(LANG_TAGS[lang])} · {e.bucket === "pending" ? t("sh.wal.b_pending") : t("sh.wal.b_available")}</small></span>
        <strong style={{ color: Number(e.amount) < 0 ? "var(--danger)" : undefined }}>{Number(e.amount) > 0 ? "+" : ""}{formatPrice(e.amount)}</strong>
      </div>)}
    </section>
  </main>;
}
