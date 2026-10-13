"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listMyDisputes, listOrders, openDispute, validateDispute, canOpenDispute, requestsFor, refundableAmount, formatPrice, friendlyError,
  BUYER_REASONS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS, DISPUTE_WINDOW_DAYS, isActiveDispute,
  type DisputeReason, type DisputeRequest, type MyDispute } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { DisputeCard, EvidencePicker, uploadEvidence } from "../../components/Disputes";
import { ListingClaims } from "../../components/Conformity";

function NewDispute({ order, uid, onDone }: { order: any; uid: string; onDone: () => void }) {
  const [reason, setReason] = useState<DisputeReason>("damaged");
  const [request, setRequest] = useState<DisputeRequest>("return_refund");
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState(""); const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const max = refundableAmount(order);
  const options = requestsFor(reason);
  useEffect(() => { if (!options.includes(request)) setRequest(options[0]); }, [reason]);
  async function send() {
    const value = amount.trim() ? Number(amount.replace(/\s/g, "").replace(",", ".")) : null;
    const input = { request, reason, description, amount: value, photos: files.map(f => f.name) };
    const invalid = validateDispute(input, max); if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const photos = await uploadEvidence(order.id, uid, files);
      const r = await openDispute(supabase(), order.id, { ...input, photos });
      if (r.error) throw r.error;
      onDone();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <section className="card">
    <h2 style={{ margin: 0 }}>Pedir devolução ou reembolso</h2>
    <span>Encomenda de {formatPrice(order.total)} a {order.other_name}: {(order.items ?? []).map((i: any) => `${i.quantity} × ${i.name}`).join(", ")}</span>
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend><strong>O que aconteceu?</strong></legend>
      <div className="row">{BUYER_REASONS.map(r => <button key={r} type="button" aria-pressed={reason === r} className={reason === r ? "" : "secondary"} onClick={() => setReason(r)}>{DISPUTE_REASON_LABELS[r]}</button>)}</div>
    </fieldset>
    <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend><strong>O que pede?</strong></legend>
      <div className="row">{options.map(r => <button key={r} type="button" aria-pressed={request === r} className={request === r ? "" : "secondary"} onClick={() => setRequest(r)}>{DISPUTE_REQUEST_LABELS[r]}</button>)}</div>
    </fieldset>
    <label>Explique o problema<textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: o ecrã chegou partido no canto; a caixa estava amolgada." /></label>
    {request !== "replacement" && <label>Valor a devolver (Kz) — deixe vazio para pedir tudo ({formatPrice(max)})
      <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder={String(max)} /></label>}
    <EvidencePicker files={files} onChange={setFiles} label="Fotografias do problema (ajudam muito, até 4)" />
    <small>🔒 As fotografias ficam privadas: só o vendedor e a administração as veem.</small>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar pedido ao vendedor"}</button><a className="btn secondary" href="/disputas">Cancelar</a></div>
  </section>;
}

function Disputas() {
  const params = useSearchParams(); const router = useRouter();
  const orderId = params.get("encomenda");
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyDispute[]>([]); const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [filter, setFilter] = useState<"active" | "all">("active");
  async function load() {
    const r = await listMyDisputes(supabase());
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data);
    if (orderId) {
      const o = await listOrders(supabase(), "buyer");
      const found = ((o.data as any[]) ?? []).find(x => x.id === orderId) ?? null;
      if (!found) setOrder(null);
      else {
        const can = canOpenDispute(found, r.data.filter(d => d.order_id === orderId));
        if (can.ok) setOrder(found); else { setOrder(null); setError(can.why); }
      }
    }
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, [orderId]);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/encomendas">← Encomendas</a><h1>Devoluções e reembolsos</h1><p><a href={"/conta/login?voltar=" + encodeURIComponent("/disputas" + (orderId ? "?encomenda=" + orderId : ""))}>Inicie sessão</a>.</p></main>;
  const shown = filter === "active" ? items.filter(d => isActiveDispute(d.status)) : items;
  return <main className="stack">
    <a href="/encomendas">← Encomendas</a>
    <h1>↩️ Devoluções e reembolsos</h1>
    <p style={{ margin: 0 }}>Pode pedir até {DISPUTE_WINDOW_DAYS} dias depois da entrega. <a href="/devolucoes">Como funciona</a></p>
    {notice && <p className="ok" role="status">{notice}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {order && <NewDispute order={order} uid={uid} onDone={() => { setOrder(null); setNotice("Pedido enviado ao vendedor. Vai receber uma notificação a cada passo."); router.replace("/disputas"); }} />}
    <div className="row" role="tablist">
      <button role="tab" aria-selected={filter === "active"} className={filter === "active" ? "" : "secondary"} onClick={() => setFilter("active")}>Abertos ({items.filter(d => isActiveDispute(d.status)).length})</button>
      <button role="tab" aria-selected={filter === "all"} className={filter === "all" ? "" : "secondary"} onClick={() => setFilter("all")}>Todos ({items.length})</button>
    </div>
    {shown.length === 0 && <p>{filter === "active" ? "Não tem pedidos abertos." : "Ainda não há pedidos."} Para pedir, abra <a href="/encomendas">Encomendas</a> e escolha a encomenda.</p>}
    {shown.map(d => <DisputeCard key={d.id} d={d} uid={uid} onChanged={msg => { setNotice(msg); setError(""); void load(); }} />)}
    <ListingClaims />
  </main>;
}
export default function Page() { return <Suspense fallback={<main><p>A carregar…</p></main>}><Disputas /></Suspense>; }
