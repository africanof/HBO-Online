"use client";
import { useEffect, useState } from "react";
import { getMyCart, setCartQuantity, placeOrders, groupCartBySeller, formatPrice, friendlyError, PAYMENT_LABELS, FULFILLMENT_LABELS,
  type Fulfillment, type PaymentMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";

export default function Carrinho() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery"); const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  async function load() { const r = await getMyCart(supabase()); if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function qty(productId: string, q: number) { const r = await setCartQuantity(supabase(), productId, q); if (r.error) setError(friendlyError(r.error)); else await load(); }
  async function checkout(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError(""); setBusy(true);
    const r = await placeOrders(supabase(), { fulfillment, paymentMethod: payment, phone, deliveryText: address, note }); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); await load(); return; }
    window.location.href = "/encomendas?novas=" + ((r.data as any[]) ?? []).length;
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/loja">← Loja</a><h1>Carrinho</h1><p><a href="/conta/login?voltar=/carrinho">Inicie sessão</a> para ver o carrinho.</p></main>;
  const groups = groupCartBySeller(items);
  const total = groups.reduce((s, g) => s + g.total, 0);
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/loja">← Loja</a>
    <h1>Carrinho</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {items.length === 0 && <p>O carrinho está vazio. <a href="/loja">Ver produtos</a></p>}
    {groups.map(g => <section key={g.sellerId} className="card">
      <strong>Vendedor: {g.sellerName}</strong>
      {g.items.map((it: any) => <div key={it.product_id} className="row" style={{ justifyContent: "space-between" }}>
        <span>{it.name} — {formatPrice(it.price, it.currency)}{!it.active || it.stock < it.quantity ? <span className="error"> (stock insuficiente)</span> : null}</span>
        <span className="row">
          <button className="secondary" onClick={() => qty(it.product_id, it.quantity - 1)} aria-label="Menos">−</button>
          <strong>{it.quantity}</strong>
          <button className="secondary" onClick={() => qty(it.product_id, it.quantity + 1)} disabled={it.quantity >= it.stock} aria-label="Mais">+</button>
          <button className="danger" onClick={() => qty(it.product_id, 0)}>Remover</button>
        </span>
      </div>)}
      <span>Subtotal: <strong>{formatPrice(g.total)}</strong></span>
    </section>)}
    {items.length > 0 && <form className="stack card" onSubmit={checkout}>
      <h2 style={{ margin: 0 }}>Finalizar compra — {formatPrice(total)}</h2>
      {groups.length > 1 && <p>Vai criar {groups.length} encomendas, uma por vendedor.</p>}
      <label>Receber<select value={fulfillment} onChange={e => setFulfillment(e.target.value as Fulfillment)}>{Object.entries(FULFILLMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {fulfillment === "delivery" && <label>Morada / ponto de referência<input value={address} onChange={e => setAddress(e.target.value)} placeholder="Bairro, rua, referência" /></label>}
      <label>Pagamento<select value={payment} onChange={e => setPayment(e.target.value as PaymentMethod)}>{Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Telefone para contacto<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="923 000 000" /></label>
      <label>Nota para o vendedor (opcional)<input value={note} onChange={e => setNote(e.target.value)} /></label>
      <p>O pagamento é combinado diretamente com o vendedor. O Huambo Online ainda não processa pagamentos online.</p>
      <button disabled={busy}>{busy ? "A enviar…" : "Confirmar encomenda"}</button>
    </form>}
  </main>;
}
