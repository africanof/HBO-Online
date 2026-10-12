"use client";
import { useEffect, useState } from "react";
import { escrowBuyerStep, escrowSellerStep, canPayOrder, canConfirmReceived, submitOrderPayment, requestPaymentReference, confirmOrderReceived,
  uploadPaymentProof, validateDocument, paymentProofUrl, formatPrice, formatRef, friendlyError, timeLeftText, ESCROW_STATUS_LABELS, ORDER_PAY_METHOD_LABELS,
  getProtectedSettings, updateProtectedSettings, getEscrowSummary, listOrderPaymentsForAdmin, decideOrderPayment, listPayoutsForAdmin, startPayoutBatch,
  markPayoutsPaid, rejectPayout, releaseEscrowAsAdmin, payoutsCsv, payoutsTotal, payoutDaysText, PAYOUT_STATUS_LABELS, PAYOUT_METHOD_LABELS,
  type ProtectedOrderFields, type OrderPayMethod, type PlatformSettings, type ProtectedSettings, type EscrowSummary, type AdminOrderPayment,
  type AdminPayout, type PayoutStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { PaymentDetails } from "./Plans";

/** Pagar uma encomenda protegida: referência ProxyPay (automático) ou transferência/Express com comprovativo. */
function PayOrder({ order, uid, settings, provider, onDone }: { order: ProtectedOrderFields; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay"; onDone: (msg: string) => void }) {
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
    if (r.error) setError(friendlyError(r.error)); else setRef(r.data);
  }
  async function send() {
    if (!reference.trim() && !file) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitOrderPayment(supabase(), order.id, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      onDone("Comprovativo enviado. Vamos confirmar e avisá-lo; o vendedor só envia depois disso.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  if (provider === "proxypay") return <div className="stack" style={{ gap: 8 }}>
    {ref ? <dl className="facts card" style={{ margin: 0 }}>
      <dt>Entidade</dt><dd><strong style={{ fontSize: 22 }}>{ref.entity}</strong></dd>
      <dt>Referência</dt><dd><strong style={{ fontSize: 22 }}>{ref.reference.replace(/(\d{3})(?=\d)/g, "$1 ")}</strong></dd>
      <dt>Montante</dt><dd><strong style={{ fontSize: 22 }}>{formatPrice(ref.amount)}</strong></dd>
      {ref.expires_at && <><dt>Válida</dt><dd>{timeLeftText(ref.expires_at)}</dd></>}
    </dl> : <button disabled={busy} onClick={getReference} style={{ justifySelf: "start" }}>{busy ? "A gerar…" : "🔢 Gerar referência de pagamento"}</button>}
    <small>Pague em «Pagamentos → Pagamento por referência» no Multicaixa Express, num ATM ou no banco. A confirmação chega sozinha.</small>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
  return <div className="stack" style={{ gap: 10 }}>
    <strong>1. Pague {formatPrice(order.total)} para o Huambo Online</strong>
    <PaymentDetails s={settings} />
    {code && <small>No descritivo escreva <strong>{code}</strong>.</small>}
    <strong>2. Diga-nos como pagou</strong>
    <div className="row" role="radiogroup" aria-label="Como pagou">{(Object.keys(ORDER_PAY_METHOD_LABELS) as OrderPayMethod[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{ORDER_PAY_METHOD_LABELS[m]}</button>)}</div>
    <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="Ex.: 1234 5678" /></label>
    <label>Comprovativo (fotografia ou PDF, opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    <small>🔒 O comprovativo fica privado: só a administração o vê.</small>
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy} onClick={send} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : "Enviar comprovativo"}</button>
  </div>;
}

/** Caixa do pagamento protegido dentro de cada encomenda (comprador ou vendedor). */
export function OrderEscrowPanel({ order, role, uid, settings, provider, hasActiveDispute, onChanged }: {
  order: ProtectedOrderFields; role: "buyer" | "seller"; uid: string; settings: PlatformSettings | null; provider: "manual" | "proxypay";
  hasActiveDispute: boolean; onChanged: (msg: string, error?: boolean) => void }) {
  const [paying, setPaying] = useState(false); const [busy, setBusy] = useState(false);
  if (!order.protected || !order.escrow_status) return null;
  const step = role === "buyer" ? escrowBuyerStep(order, hasActiveDispute) : escrowSellerStep(order);
  async function confirmReceived() {
    if (!confirm("Confirma que recebeu a encomenda e está tudo bem? O pagamento passa para o vendedor e já não pode pedir ao Huambo Online para o guardar.")) return;
    setBusy(true);
    const r = await confirmOrderReceived(supabase(), order.id);
    setBusy(false);
    if (r.error) onChanged(friendlyError(r.error), true); else onChanged("Obrigado! O pagamento foi entregue ao vendedor. Não se esqueça de o avaliar.");
  }
  return <div className="card stack" style={{ gap: 8, borderWidth: 2 }}>
    <strong>{order.status === "cancelled" && order.escrow_status === "awaiting_payment" ? "🛡️ Pagamento protegido — cancelada" : ESCROW_STATUS_LABELS[order.escrow_status]}</strong>
    <span>{step}</span>
    {role === "buyer" && order.payment?.status === "rejected" && order.payment.admin_note && order.escrow_status === "awaiting_payment" && <span className="error">Último comprovativo não confirmado: {order.payment.admin_note}</span>}
    {role === "buyer" && canPayOrder(order) && (paying || provider === "proxypay"
      ? <PayOrder order={order} uid={uid} settings={settings} provider={provider} onDone={m => { setPaying(false); onChanged(m); }} />
      : <button style={{ justifySelf: "start" }} onClick={() => setPaying(true)}>💳 Pagar agora</button>)}
    {role === "buyer" && canConfirmReceived(order, hasActiveDispute) && <button disabled={busy} style={{ justifySelf: "start" }} onClick={confirmReceived}>✅ Confirmar receção</button>}
    {role === "seller" && order.escrow_status === "released" && <a href="/conta/saldo">💰 Ver o meu saldo →</a>}
  </div>;
}

/** Administração do pagamento protegido: definições, pagamentos por confirmar e levantamentos. */
export function AdminProtected() {
  const [s, setS] = useState<ProtectedSettings | null>(null); const [sum, setSum] = useState<EscrowSummary | null>(null);
  const [payments, setPayments] = useState<AdminOrderPayment[]>([]); const [payStatus, setPayStatus] = useState<"pending" | "confirmed" | "rejected" | "">("pending");
  const [payouts, setPayouts] = useState<AdminPayout[]>([]); const [poStatus, setPoStatus] = useState<PayoutStatus | "">("requested");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b, c, d] = await Promise.all([getProtectedSettings(supabase()), getEscrowSummary(supabase()), listOrderPaymentsForAdmin(supabase(), payStatus), listPayoutsForAdmin(supabase(), poStatus)]);
    setS(a.data); setSum(b.data); setPayments(c.data); setPayouts(d.data);
    const err = a.error ?? b.error ?? c.error ?? d.error; if (err) setError(friendlyError(err));
  }
  useEffect(() => { void load(); }, [payStatus, poStatus]);
  const ok = async (p: PromiseLike<{ error: any }>, msg: string) => { setError(""); setNotice(""); const r = await p; if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); await load(); } };
  async function saveSettings(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const num = (v: unknown) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
    const fee = num(s.protected_fee_pct), days = Number(s.auto_release_days), hours = Number(s.payment_window_hours), min = num(s.payout_min_kz);
    if (!(fee >= 0 && fee <= 20) || !Number.isInteger(days) || days < 1 || days > 30 || !Number.isInteger(hours) || hours < 1 || hours > 168 || !(min >= 0)) { setError("Verifique a comissão (0 a 20%), os dias (1 a 30), as horas (1 a 168) e o mínimo."); return; }
    if (s.payment_provider === "proxypay" && !/^\d{3,6}$/.test(String(s.proxypay_entity ?? ""))) { setError("Escreva o número da Entidade dado pela ProxyPay."); return; }
    if (!s.payout_weekdays?.length) { setError("Escolha pelo menos um dia de pagamentos."); return; }
    setBusy(true);
    await ok(updateProtectedSettings(supabase(), { protected_enabled: !!s.protected_enabled, payment_provider: s.payment_provider, proxypay_entity: s.proxypay_entity?.trim() || null,
      protected_fee_pct: fee, auto_release_days: days, payment_window_hours: hours, payout_min_kz: min, payout_weekdays: s.payout_weekdays }), "Definições guardadas.");
    setBusy(false);
  }
  async function decide(p: AdminOrderPayment, confirmIt: boolean) {
    const note = confirmIt ? "" : prompt("Porque não confirma? (o comprador vai ler)") ?? "";
    if (!confirmIt && !note.trim()) return;
    if (confirmIt && !confirm(`Confirma que recebeu ${formatPrice(p.amount)} de ${p.buyer_name} (${p.order_ref})? O vendedor é avisado para enviar.`)) return;
    await ok(decideOrderPayment(supabase(), p.id, confirmIt, note), confirmIt ? "Pagamento confirmado: o dinheiro fica guardado e o vendedor foi avisado." : "Pagamento recusado.");
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyError(r.error)); }
  function download(rows: AdminPayout[]) {
    const url = URL.createObjectURL(new Blob([payoutsCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `levantamentos-huambo-online-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function startBatch() {
    if (!confirm("Juntar todos os pedidos novos num lote e descarregar o ficheiro para o banco?")) return;
    setError(""); setNotice("");
    const r = await startPayoutBatch(supabase());
    if (r.error) { setError(friendlyError(r.error)); return; }
    const list = await listPayoutsForAdmin(supabase(), "processing");
    download(list.data.filter(p => p.batch_id === r.data));
    setNotice("Lote criado e ficheiro descarregado. Depois de pagar no banco, carregue em «Marcar lote como pago».");
    setPoStatus("processing");
  }
  async function markPaid(rows: AdminPayout[]) {
    const ref = prompt(`Confirma que pagou ${rows.length} levantamento(s), total ${formatPrice(payoutsTotal(rows))}? Referência do lote no banco (opcional):`);
    if (ref === null) return;
    await ok(markPayoutsPaid(supabase(), rows.map(r => r.id), ref), "Levantamentos marcados como pagos. Os vendedores foram avisados.");
  }
  async function reject(p: AdminPayout) {
    const note = prompt("Porque não faz este levantamento? (o vendedor vai ler; o dinheiro volta ao saldo dele)") ?? "";
    if (!note.trim()) return;
    await ok(rejectPayout(supabase(), p.id, note), "Levantamento recusado; o dinheiro voltou ao saldo do vendedor.");
  }
  async function release() {
    const code = prompt("Libertar à força o dinheiro de uma encomenda (só sem reclamação aberta). Número da encomenda (ex.: E-1001) ou o código interno:") ?? "";
    if (!code.trim()) return;
    const note = prompt("Porquê? (fica registado)") ?? "";
    if (!note.trim()) return;
    const id = code.trim();
    const found = /^E-\d+$/i.test(id) ? await supabase().from("orders").select("id").eq("ref_no", Number(id.slice(2))).maybeSingle() : { data: { id }, error: null };
    if (!found.data?.id) { setError("Encomenda não encontrada."); return; }
    await ok(releaseEscrowAsAdmin(supabase(), found.data.id, note), "Dinheiro libertado para o saldo do vendedor.");
  }
  const toggleDay = (d: number) => s && setS({ ...s, payout_weekdays: (s.payout_weekdays ?? []).includes(d) ? (s.payout_weekdays ?? []).filter(x => x !== d) : [...(s.payout_weekdays ?? []), d].sort() });
  const processing = payouts.filter(p => p.status === "processing");
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🛡️ Pagamento protegido</h2>
    <p style={{ margin: 0 }}>O comprador paga ao Huambo Online; o dinheiro fica guardado até ele confirmar que recebeu. Depois passa para o saldo do vendedor, que pede o levantamento.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {sum && <div className="grid">
      <div className="card"><span>Dinheiro guardado (à espera de entrega)</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.held)}</strong></div>
      <div className="card"><span>Saldo dos vendedores (por levantar)</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.available)}</strong></div>
      <div className="card"><span>Levantamentos em curso</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.payouts_open)}</strong><small>{sum.payouts_requested} pedido(s) novo(s) · {sum.payouts_processing} no banco</small></div>
      <div className="card"><span>Comprovativos por confirmar</span><strong style={{ fontSize: 26 }}>{sum.payments_pending}</strong><small>{sum.awaiting_payment} encomenda(s) à espera de pagamento</small></div>
      <div className="card"><span>Reembolsos a enviar</span><strong style={{ fontSize: 26 }}>{sum.refunds_to_send}</strong><small>Veja em «Disputas» → «Reembolsos a enviar»</small></div>
      <div className="card"><span>Comissões (30 dias)</span><strong style={{ fontSize: 26 }}>{formatPrice(sum.fees_30d)}</strong></div>
    </div>}

    <h3 style={{ margin: 0 }}>Pagamentos das encomendas</h3>
    <label style={{ maxWidth: 260 }}>Mostrar<select value={payStatus} onChange={e => setPayStatus(e.target.value as any)}>
      <option value="pending">Por confirmar</option><option value="confirmed">Confirmados</option><option value="rejected">Recusados</option><option value="">Todos</option></select></label>
    {payments.length === 0 && <p>Sem pagamentos.</p>}
    {payments.map(p => <article key={p.id} className="card">
      <strong>{formatPrice(p.amount)} · {p.order_ref} · <span className="badge">{p.status === "pending" ? "Por confirmar" : p.status === "confirmed" ? "Confirmado" : p.status === "rejected" ? "Recusado" : "Vencido"}</span></strong>
      <span>Comprador: {p.buyer_name}{p.buyer_phone ? " · " + p.buyer_phone : ""} · Vendedor: {p.seller_name}</span>
      <span>{p.provider === "proxypay" ? `ProxyPay · Entidade ${p.entity} · Ref. ${p.reference}` : `${ORDER_PAY_METHOD_LABELS[p.method as OrderPayMethod] ?? p.method}${p.reference ? " · Ref.: " + p.reference : ""}`} · {new Date(p.created_at).toLocaleString("pt-AO")}</span>
      {p.paid_amount != null && Number(p.paid_amount) !== Number(p.amount) && <span className="error">Valor pago: {formatPrice(p.paid_amount)}</span>}
      {p.admin_note && <small>Nota: {p.admin_note}</small>}
      <div className="row">
        {p.proof_path && <button className="secondary" onClick={() => proof(p.proof_path!)}>📄 Ver comprovativo</button>}
        {p.status === "pending" && p.provider === "manual" && <><button onClick={() => decide(p, true)}>✔ Dinheiro recebido</button><button className="danger" onClick={() => decide(p, false)}>✖ Não recebido</button></>}
      </div>
    </article>)}

    <h3 style={{ margin: 0 }}>Levantamentos dos vendedores</h3>
    <p style={{ margin: 0 }}>Dias de pagamentos: <strong>{payoutDaysText(s?.payout_weekdays)}</strong>. Junte os pedidos num lote, descarregue o ficheiro, pague no banco (pagamentos em lote) e marque o lote como pago.</p>
    <div className="row">
      <button onClick={startBatch} disabled={!sum?.payouts_requested}>📦 Criar lote e descarregar ficheiro para o banco</button>
      <button className="secondary" onClick={release}>Libertar dinheiro de uma encomenda…</button>
    </div>
    <label style={{ maxWidth: 260 }}>Mostrar<select value={poStatus} onChange={e => setPoStatus(e.target.value as any)}>
      {(Object.keys(PAYOUT_STATUS_LABELS) as PayoutStatus[]).map(k => <option key={k} value={k}>{PAYOUT_STATUS_LABELS[k]}</option>)}<option value="">Todos</option></select></label>
    {poStatus === "processing" && processing.length > 0 && <div className="row">
      <button onClick={() => markPaid(processing)}>✔ Marcar lote como pago ({processing.length} · {formatPrice(payoutsTotal(processing))})</button>
      <button className="secondary" onClick={() => download(processing)}>⬇️ Descarregar outra vez</button>
    </div>}
    {payouts.length === 0 && <p>Sem levantamentos.</p>}
    {payouts.map(p => <article key={p.id} className="card">
      <strong>L-{p.ref_no} · {formatPrice(p.amount)} · <span className="badge">{PAYOUT_STATUS_LABELS[p.status]}</span></strong>
      <span>{p.holder_name} ({p.user_name}{p.phone ? " · " + p.phone : ""})</span>
      <span style={{ overflowWrap: "anywhere" }}>{PAYOUT_METHOD_LABELS[p.method]}: <strong>{p.destination}</strong></span>
      <small>Pedido {new Date(p.created_at).toLocaleString("pt-AO")}{p.paid_at ? " · Pago " + new Date(p.paid_at).toLocaleString("pt-AO") : ""}{p.bank_reference ? " · Ref.: " + p.bank_reference : ""}</small>
      {p.admin_note && <small>Nota: {p.admin_note}</small>}
      {(p.status === "requested" || p.status === "processing") && <div className="row"><button className="danger" onClick={() => reject(p)}>✖ Não fazer (devolver ao saldo)</button></div>}
    </article>)}

    {s && <form className="card stack" onSubmit={saveSettings}>
      <h3 style={{ margin: 0 }}>Definições</h3>
      <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={!!s.protected_enabled} onChange={e => setS({ ...s, protected_enabled: e.target.checked })} style={{ width: 24, height: 24 }} /> Mostrar «Pagamento protegido» aos compradores</label>
      <small>Ative só depois de rever os Termos com um jurista e de ter a conta da empresa pronta.</small>
      <label>Como os compradores pagam<select value={s.payment_provider ?? "manual"} onChange={e => setS({ ...s, payment_provider: e.target.value as any })}>
        <option value="manual">Transferência / Multicaixa Express com comprovativo (a administração confirma)</option>
        <option value="proxypay">Referência ProxyPay (confirmação automática)</option></select></label>
      {s.payment_provider === "proxypay" && <label>Entidade ProxyPay<input inputMode="numeric" value={s.proxypay_entity ?? ""} onChange={e => setS({ ...s, proxypay_entity: e.target.value })} placeholder="Ex.: 12345" /></label>}
      {s.payment_provider === "proxypay" && <small>Precisa também do segredo PROXYPAY_API_KEY nas Edge Functions do Supabase (e PROXYPAY_ENV=production para pagamentos reais).</small>}
      <label>Comissão sobre as vendas protegidas (%)<input inputMode="decimal" value={String(s.protected_fee_pct ?? "")} onChange={e => setS({ ...s, protected_fee_pct: e.target.value })} /></label>
      <label>Dias depois da entrega para libertar sozinho<input inputMode="numeric" value={String(s.auto_release_days ?? "")} onChange={e => setS({ ...s, auto_release_days: e.target.value as any })} /></label>
      <label>Horas para o comprador pagar<input inputMode="numeric" value={String(s.payment_window_hours ?? "")} onChange={e => setS({ ...s, payment_window_hours: e.target.value as any })} /></label>
      <label>Mínimo para levantar (Kz)<input inputMode="numeric" value={String(s.payout_min_kz ?? "")} onChange={e => setS({ ...s, payout_min_kz: e.target.value })} /></label>
      <fieldset className="row" style={{ gap: 6 }}><legend>Dias de pagamento dos levantamentos</legend>
        {[[1, "Seg"], [2, "Ter"], [3, "Qua"], [4, "Qui"], [5, "Sex"], [6, "Sáb"]].map(([d, l]) => <button key={d} type="button" role="checkbox" aria-checked={(s.payout_weekdays ?? []).includes(d as number)} className={(s.payout_weekdays ?? []).includes(d as number) ? "" : "secondary"} onClick={() => toggleDay(d as number)}>{l}</button>)}
      </fieldset>
      <button disabled={busy} style={{ justifySelf: "start" }}>Guardar</button>
    </form>}
  </section>;
}
