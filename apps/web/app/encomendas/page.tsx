"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listOrders, changeOrderStatus, formatPrice, friendlyError, ORDER_STATUS_LABELS, PAYMENT_LABELS, FULFILLMENT_LABELS, NEXT_SELLER_STATUS,
  listMyDeliveries, requestOrderDelivery, cancelDeliveryRequest, latestDeliveryByOrder, isActiveDelivery, DELIVERY_STATUS_LABELS,
  listMyDisputes, latestDisputeByOrder, formatRef, canOpenDispute, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, type MyDispute,
  type OrderStatus, type PaymentMethod, type Fulfillment, type DeliveryStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";

function Encomendas() {
  const params = useSearchParams();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"buyer" | "seller">(params.get("vendas") ? "seller" : "buyer");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(params.get("novas") ? "Encomenda enviada ao vendedor. Vai receber notificações sobre o estado." : "");
  const [deliveries, setDeliveries] = useState<Record<string, any>>({});
  const [disputes, setDisputes] = useState<MyDispute[]>([]);
  async function load(r = role) {
    const [res, d, ds] = await Promise.all([listOrders(supabase(), r), listMyDeliveries(supabase(), "party"), listMyDisputes(supabase())]);
    if (res.error) setError(friendlyError(res.error)); else setItems((res.data as any[]) ?? []);
    setDeliveries(latestDeliveryByOrder((d.data as any[]) ?? []));
    setDisputes(ds.data);
  }
  const lastDispute = latestDisputeByOrder(disputes);
  // aberto pelo número (E-1001): mostra a encomenda certa, nas compras ou nas vendas
  useEffect(() => {
    const id = window.location.hash.replace(/^#encomenda-/, "");
    if (!id || !items.length) return;
    const el = document.getElementById("encomenda-" + id);
    if (el) el.scrollIntoView({ block: "start" }); else if (role === "buyer") setRole("seller");
  }, [items]);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); await load(); }
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  useEffect(() => { if (uid) void load(role); }, [role]);
  async function act(id: string, status: OrderStatus, paid?: boolean) {
    setError(""); setNotice("");
    const r = await changeOrderStatus(supabase(), id, status, paid);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Encomenda atualizada."); await load(); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/loja">← Loja</a><h1>Encomendas</h1><p><a href="/conta/login?voltar=/encomendas">Inicie sessão</a>.</p></main>;
  return <main className="stack">
    <a href="/loja">← Loja</a>
    <h1>Encomendas</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={role === "buyer"} className={role === "buyer" ? "" : "secondary"} onClick={() => setRole("buyer")}>As minhas compras</button>
      <button role="tab" aria-selected={role === "seller"} className={role === "seller" ? "" : "secondary"} onClick={() => setRole("seller")}>As minhas vendas</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Sem encomendas.</p>}
    {items.map(o => {
      const next = NEXT_SELLER_STATUS[o.status as OrderStatus];
      return <article key={o.id} id={"encomenda-" + o.id} className="card">
        <strong>{o.ref_no ? formatRef("order", o.ref_no) + " · " : ""}{formatPrice(o.total, o.currency)} · <span className="badge">{ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}</span>{o.payment_status === "paid" ? " · ✅ Paga" : o.payment_status === "refunded" ? " · ↩️ Reembolsada" : ""}</strong>
        <span>{role === "seller" ? "Cliente" : "Vendedor"}: {o.other_name} · {new Date(o.created_at).toLocaleString("pt-AO")}</span>
        <span>{FULFILLMENT_LABELS[o.fulfillment_type as Fulfillment]} · {PAYMENT_LABELS[o.payment_method as PaymentMethod] ?? o.payment_method}</span>
        <ul style={{ margin: 0 }}>{(o.items ?? []).map((it: any, i: number) => <li key={i}>{it.quantity} × {it.name} — {formatPrice(it.line_total)}</li>)}</ul>
        {o.delivery_text && <span>Entrega: {o.delivery_text}</span>}
        {role === "seller" && o.contact_phone && <span>Telefone: <a href={"tel:" + o.contact_phone.replace(/\s/g, "")}>{o.contact_phone}</a></span>}
        {o.buyer_note && <span>Nota: {o.buyer_note}</span>}
        {deliveries[o.id] && <span>🛵 Entrega: <strong>{DELIVERY_STATUS_LABELS[deliveries[o.id].status as DeliveryStatus]}</strong>{deliveries[o.id].courier_name ? " · Estafeta: " + deliveries[o.id].courier_name : ""}{deliveries[o.id].courier_phone && isActiveDelivery(deliveries[o.id].status) ? <> · <a href={"tel:" + deliveries[o.id].courier_phone.replace(/\s/g, "")}>{deliveries[o.id].courier_phone}</a></> : null}</span>}
        {lastDispute[o.id] && <a href={"/disputas#pedido-" + lastDispute[o.id].id}>↩️ Devolução / reembolso: <strong>{lastDispute[o.id].status === "resolved" && lastDispute[o.id].outcome ? DISPUTE_OUTCOME_LABELS[lastDispute[o.id].outcome!] : DISPUTE_STATUS_LABELS[lastDispute[o.id].status]}</strong> →</a>}
        {role === "buyer" && canOpenDispute(o, disputes.filter(d => d.order_id === o.id)).ok && <a className="btn secondary" href={"/disputas?encomenda=" + o.id}>↩️ Pedir devolução ou reembolso</a>}
        {o.status === "completed" && <a className="btn secondary" href="/avaliacoes">⭐ Avaliar {role === "seller" ? "o cliente" : "o vendedor"}</a>}
        <div className="row">
          {role === "seller" && o.fulfillment_type === "delivery" && !["completed", "cancelled"].includes(o.status) && !(deliveries[o.id] && isActiveDelivery(deliveries[o.id].status)) && <button className="secondary" onClick={() => { const notes = prompt("Nota para o estafeta (opcional): onde recolher, cuidados…") ?? undefined; void run(() => requestOrderDelivery(supabase(), o.id, notes), "Pedido enviado aos estafetas."); }}>🛵 Pedir estafeta</button>}
          {role === "seller" && deliveries[o.id] && ["pending", "assigned", "accepted"].includes(deliveries[o.id].status) && <button className="secondary" onClick={() => { if (confirm("Cancelar o pedido de estafeta?")) void run(() => cancelDeliveryRequest(supabase(), deliveries[o.id].id), "Pedido de estafeta cancelado."); }}>Cancelar estafeta</button>}
          {role === "seller" && next && <button onClick={() => act(o.id, next)}>Marcar como «{ORDER_STATUS_LABELS[next]}»</button>}
          {role === "seller" && o.payment_status !== "paid" && !["cancelled"].includes(o.status) && <button className="secondary" onClick={() => act(o.id, o.status as OrderStatus, true)}>Marcar como paga</button>}
          {(role === "seller" ? !["completed", "cancelled"].includes(o.status) : o.status === "pending") && <button className="danger" onClick={() => { if (confirm(o.payment_status === "paid" ? "Esta encomenda já está paga. Se a cancelar, abre-se um pedido de reembolso e o vendedor tem de devolver o dinheiro. Cancelar?" : "Cancelar esta encomenda?")) void act(o.id, "cancelled"); }}>Cancelar</button>}
        </div>
      </article>;
    })}
  </main>;
}
export default function Page() { return <Suspense fallback={<main><p>A carregar…</p></main>}><Encomendas /></Suspense>; }
