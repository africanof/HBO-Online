"use client";
import { useEffect, useState } from "react";
import { getMyWallet, savePayoutAccount, requestPayout, cancelPayout, validatePayoutAccount, validatePayoutAmount, walletBalance, payoutDaysText, nextPayoutDate,
  formatDay, formatPrice, friendlyError, WALLET_KIND_LABELS, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS, type Wallet, type PayoutMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";

export default function Saldo() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [w, setW] = useState<Wallet | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false); const [method, setMethod] = useState<PayoutMethod>("iban"); const [holder, setHolder] = useState(""); const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  async function load() { const r = await getMyWallet(supabase()); if (r.error) setError(friendlyError(r.error)); else setW(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setEditing(false); setAmount(""); await load(); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><h1>O meu saldo</h1><p><a href="/conta/login?voltar=/conta/saldo">Inicie sessão</a>.</p></main>;
  const b = walletBalance(w), min = Number(w?.payout_min_kz ?? 0), next = nextPayoutDate(w?.payout_weekdays);
  const open = (w?.payouts ?? []).find(p => p.status === "requested" || p.status === "processing");
  function saveAccount(e: React.FormEvent) {
    e.preventDefault();
    const bad = validatePayoutAccount({ method, holder, destination: dest }); if (bad) { setError(bad); return; }
    void run(savePayoutAccount(supabase(), { method, holder, destination: dest }), "Conta guardada.");
  }
  function ask(e: React.FormEvent) {
    e.preventDefault();
    const value = amount.trim() ? Number(amount.replace(/\s/g, "").replace(",", ".")) : b.available;
    const bad = validatePayoutAmount(value, b.available, min); if (bad) { setError(bad); return; }
    if (!confirm(`Pedir o levantamento de ${formatPrice(value)} para ${w?.account?.destination}?`)) return;
    void run(requestPayout(supabase(), value), `Pedido enviado. Os levantamentos são pagos às ${payoutDaysText(w?.payout_weekdays)}.`);
  }
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← A sua conta</a>
    <h1>💰 O meu saldo</h1>
    <p style={{ margin: 0 }}>Aqui fica o dinheiro das vendas da Loja pagas com <strong>Pagamento protegido</strong>. O dinheiro passa a «disponível» quando o cliente confirma que recebeu (ou {w?.auto_release_days ?? 3} dias depois da entrega, sem reclamação).</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="grid">
      <div className="card"><span>Disponível para levantar</span><strong style={{ fontSize: 32 }}>{formatPrice(b.available)}</strong></div>
      <div className="card"><span>Guardado (à espera da entrega)</span><strong style={{ fontSize: 26 }}>{formatPrice(b.pending)}</strong></div>
      <div className="card"><span>Em levantamento</span><strong style={{ fontSize: 26 }}>{formatPrice(b.inPayout)}</strong><small>Já recebeu: {formatPrice(w?.paid_out ?? 0)}</small></div>
    </div>
    {Number(w?.fee_pct ?? 0) > 0 && <small>Comissão do Huambo Online nas vendas protegidas: {String(w?.fee_pct)}% (já descontada ao libertar).</small>}

    <section className="card stack">
      <h2 style={{ margin: 0 }}>Para onde enviamos o dinheiro</h2>
      {w?.account && !editing ? <>
        <span>{PAYOUT_METHOD_LABELS[w.account.method]}: <strong style={{ overflowWrap: "anywhere" }}>{w.account.destination}</strong></span>
        <span>Titular: {w.account.holder_name}</span>
        <button className="secondary" style={{ justifySelf: "start" }} onClick={() => { setEditing(true); setMethod(w.account!.method); setHolder(w.account!.holder_name); setDest(""); }}>Mudar conta</button>
      </> : <form className="stack" onSubmit={saveAccount}>
        <div className="row" role="radiogroup" aria-label="Tipo de conta">{(Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PAYOUT_METHOD_LABELS[m]}</button>)}</div>
        <label>Nome do titular<input value={holder} onChange={e => setHolder(e.target.value)} maxLength={120} autoComplete="name" /></label>
        <label>{method === "iban" ? "IBAN (AO06 + 21 algarismos)" : "Número Multicaixa Express"}<input value={dest} onChange={e => setDest(e.target.value)} inputMode={method === "iban" ? "text" : "tel"} placeholder={method === "iban" ? "AO06 0000 0000 0000 0000 0000 0" : "9xx xxx xxx"} /></label>
        <small>🔒 Só a administração vê estes dados, para lhe pagar.</small>
        <div className="row"><button disabled={busy}>Guardar conta</button>{editing && <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancelar</button>}</div>
      </form>}
    </section>

    <section className="card stack">
      <h2 style={{ margin: 0 }}>Pedir levantamento</h2>
      <p style={{ margin: 0 }}>Os levantamentos são pagos às <strong>{payoutDaysText(w?.payout_weekdays)}</strong>{next ? ` (próximo: ${formatDay(next)})` : ""}. Mínimo: {formatPrice(min)}.</p>
      {open ? <>
        <p className="ok" style={{ margin: 0 }}>⏳ L-{open.ref_no}: {formatPrice(open.amount)} — {PAYOUT_STATUS_LABELS[open.status]}</p>
        {open.status === "requested" && <button className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => { if (confirm("Cancelar este pedido? O dinheiro volta ao saldo disponível.")) void run(cancelPayout(supabase(), open.id), "Pedido cancelado."); }}>Cancelar pedido</button>}
      </> : <form className="stack" onSubmit={ask}>
        <label>Valor (deixe vazio para levantar tudo)<input inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(b.available)} /></label>
        <button disabled={busy || !w?.account || b.available < Math.max(min, 1)} style={{ justifySelf: "start" }}>💸 Pedir levantamento</button>
        {!w?.account && <small>Primeiro indique a conta para onde quer receber.</small>}
      </form>}
    </section>

    <section className="stack">
      <h2 style={{ margin: 0 }}>Levantamentos</h2>
      {(w?.payouts ?? []).length === 0 && <p>Ainda não pediu levantamentos.</p>}
      {(w?.payouts ?? []).map(p => <article key={p.id} className="card">
        <strong>L-{p.ref_no} · {formatPrice(p.amount)} · <span className="badge">{PAYOUT_STATUS_LABELS[p.status]}</span></strong>
        <span style={{ overflowWrap: "anywhere" }}>{p.destination}</span>
        <small>{new Date(p.created_at).toLocaleString("pt-AO")}{p.paid_at ? " · Pago " + new Date(p.paid_at).toLocaleString("pt-AO") : ""}{p.bank_reference ? " · Ref.: " + p.bank_reference : ""}</small>
        {p.admin_note && <small>Nota: {p.admin_note}</small>}
      </article>)}
      <h2 style={{ margin: 0 }}>Movimentos</h2>
      {(w?.entries ?? []).length === 0 && <p>Sem movimentos. Quando vender com Pagamento protegido, aparecem aqui.</p>}
      {(w?.entries ?? []).map(e => <div key={e.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
        <span>{WALLET_KIND_LABELS[e.kind]}{e.note ? <small className="muted"> · {e.note}</small> : null}<br /><small className="muted">{new Date(e.created_at).toLocaleString("pt-AO")} · {e.bucket === "pending" ? "guardado" : "disponível"}</small></span>
        <strong style={{ color: Number(e.amount) < 0 ? "var(--danger)" : undefined }}>{Number(e.amount) > 0 ? "+" : ""}{formatPrice(e.amount)}</strong>
      </div>)}
    </section>
  </main>;
}
