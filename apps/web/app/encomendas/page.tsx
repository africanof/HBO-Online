"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listOrders, changeOrderStatus, formatPrice, friendlyError, ORDER_STATUS_LABELS, PAYMENT_LABELS, FULFILLMENT_LABELS, NEXT_SELLER_STATUS,
  type OrderStatus, type PaymentMethod, type Fulfillment } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";

function Encomendas() {
  const params = useSearchParams();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"buyer" | "seller">(params.get("vendas") ? "seller" : "buyer");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(params.get("novas") ? "Encomenda enviada ao vendedor. Vai receber notificações sobre o estado." : "");
  async function load(r = role) { const res = await listOrders(supabase(), r); if (res.error) setError(friendlyError(res.error)); else setItems((res.data as any[]) ?? []); }
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
      return <article key={o.id} className="card">
        <strong>{formatPrice(o.total, o.currency)} · <span className="badge">{ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}</span>{o.payment_status === "paid" ? " · ✅ Paga" : ""}</strong>
        <span>{role === "seller" ? "Cliente" : "Vendedor"}: {o.other_name} · {new Date(o.created_at).toLocaleString("pt-AO")}</span>
        <span>{FULFILLMENT_LABELS[o.fulfillment_type as Fulfillment]} · {PAYMENT_LABELS[o.payment_method as PaymentMethod] ?? o.payment_method}</span>
        <ul style={{ margin: 0 }}>{(o.items ?? []).map((it: any, i: number) => <li key={i}>{it.quantity} × {it.name} — {formatPrice(it.line_total)}</li>)}</ul>
        {o.delivery_text && <span>Entrega: {o.delivery_text}</span>}
        {role === "seller" && o.contact_phone && <span>Telefone: <a href={"tel:" + o.contact_phone.replace(/\s/g, "")}>{o.contact_phone}</a></span>}
        {o.buyer_note && <span>Nota: {o.buyer_note}</span>}
        <div className="row">
          {role === "seller" && next && <button onClick={() => act(o.id, next)}>Marcar como «{ORDER_STATUS_LABELS[next]}»</button>}
          {role === "seller" && o.payment_status !== "paid" && !["cancelled"].includes(o.status) && <button className="secondary" onClick={() => act(o.id, o.status as OrderStatus, true)}>Marcar como paga</button>}
          {(role === "seller" ? !["completed", "cancelled"].includes(o.status) : o.status === "pending") && <button className="danger" onClick={() => { if (confirm("Cancelar esta encomenda?")) void act(o.id, "cancelled"); }}>Cancelar</button>}
        </div>
      </article>;
    })}
  </main>;
}
export default function Page() { return <Suspense fallback={<main><p>A carregar…</p></main>}><Encomendas /></Suspense>; }
