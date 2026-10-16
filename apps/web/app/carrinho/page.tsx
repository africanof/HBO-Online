"use client";
import { useEffect, useState } from "react";
import { PointPicker } from "../../components/Place";
import { type GeoPoint, getMyCart, setCartQuantity, placeOrders, groupCartBySeller, formatPrice, friendlyErrorIn, PAYMENT_LABELS, FULFILLMENT_LABELS,
  getProtectedSettings, PROTECTED_STEPS, type Fulfillment, type PaymentMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useT } from "../../lib/i18n";

export default function Carrinho() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<GeoPoint | null>(null); const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery"); const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  const [protectedOn, setProtectedOn] = useState(false); const [useProtected, setUseProtected] = useState(true);
  useEffect(() => { void getProtectedSettings(supabase()).then(r => setProtectedOn(!!r.data?.protected_enabled)); }, []);
  const isProtected = protectedOn && useProtected;
  async function load() { const r = await getMyCart(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function qty(productId: string, q: number) { const r = await setCartQuantity(supabase(), productId, q); if (r.error) setError(friendlyErrorIn(r.error, lang)); else await load(); }
  async function checkout(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError(""); setBusy(true);
    const r = await placeOrders(supabase(), { fulfillment, paymentMethod: payment, phone, deliveryText: address, note, protected: isProtected, point }); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); await load(); return; }
    window.location.href = "/encomendas?novas=" + ((r.data as any[]) ?? []).length + (isProtected ? "&pagar=1" : "");
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/loja">← {t("nav.shop")}</a><h1>{t("sh.cart")}</h1><p><a href="/conta/login?voltar=/carrinho">{t("sh.sign_in")}</a> {t("sh.cart.to_see")}</p></main>;
  const groups = groupCartBySeller(items);
  const total = groups.reduce((s, g) => s + g.total, 0);
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/loja">← {t("nav.shop")}</a>
    <h1>{t("sh.cart")}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {items.length === 0 && <p>{t("sh.cart.empty")} <a href="/loja">{t("sh.cart.see_products")}</a></p>}
    {groups.map(g => <section key={g.sellerId} className="card">
      <strong>{t("sh.seller")}: {g.sellerName}</strong>
      {g.items.map((it: any) => <div key={it.product_id} className="row" style={{ justifyContent: "space-between" }}>
        <span>{it.name} — {formatPrice(it.price, it.currency)}{!it.active || it.stock < it.quantity ? <span className="error"> ({t("sh.cart.low_stock")})</span> : null}</span>
        <span className="row">
          <button className="secondary" onClick={() => qty(it.product_id, it.quantity - 1)} aria-label={t("sh.cart.less")}>−</button>
          <strong>{it.quantity}</strong>
          <button className="secondary" onClick={() => qty(it.product_id, it.quantity + 1)} disabled={it.quantity >= it.stock} aria-label={t("sh.cart.more")}>+</button>
          <button className="danger" onClick={() => qty(it.product_id, 0)}>{t("sh.remove")}</button>
        </span>
      </div>)}
      <span>{t("sh.cart.subtotal")}: <strong>{formatPrice(g.total)}</strong></span>
    </section>)}
    {items.length > 0 && <form className="stack card" onSubmit={checkout}>
      <h2 style={{ margin: 0 }}>{t("sh.cart.checkout", { total: formatPrice(total) })}</h2>
      {groups.length > 1 && <p>{t("sh.cart.many_orders", { n: groups.length })}</p>}
      <label>{t("sh.cart.receive")}<select value={fulfillment} onChange={e => setFulfillment(e.target.value as Fulfillment)}>{Object.entries(FULFILLMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select></label>
      {fulfillment === "delivery" && <label>{t("sh.cart.address")}<input value={address} onChange={e => setAddress(e.target.value)} placeholder={t("sh.cart.address_ph")} /></label>}
      {fulfillment === "delivery" && <PointPicker point={point} onChange={setPoint} label={t("sh.cart.point_label")} hint={t("sh.cart.point_hint")} />}
      {protectedOn && <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
        <legend><strong>{t("sh.cart.how_pay")}</strong></legend>
        <button type="button" role="radio" aria-checked={useProtected} className={useProtected ? "" : "secondary"} style={{ textAlign: "left" }} onClick={() => setUseProtected(true)}>🛡️ {t("sh.cart.protected_rec")}</button>
        {useProtected && <ol className="card" style={{ margin: 0, paddingLeft: 32 }}>{PROTECTED_STEPS.map((s, i) => <li key={i}>{tc(s)}</li>)}</ol>}
        <button type="button" role="radio" aria-checked={!useProtected} className={!useProtected ? "" : "secondary"} style={{ textAlign: "left" }} onClick={() => setUseProtected(false)}>🤝 {t("sh.cart.pay_seller")}</button>
      </fieldset>}
      {!isProtected && <label>{t("sh.payment")}<select value={payment} onChange={e => setPayment(e.target.value as PaymentMethod)}>{Object.entries(PAYMENT_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select></label>}
      <label>{t("sh.cart.phone")}<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="923 000 000" /></label>
      <label>{t("sh.cart.note")}<input value={note} onChange={e => setNote(e.target.value)} /></label>
      {isProtected ? <p>{t("sh.cart.protected_info")}</p>
        : <p>{t(protectedOn ? "sh.cart.direct_protected" : "sh.cart.direct_only")}</p>}
      <button disabled={busy}>{busy ? t("sh.sending") : t("sh.cart.confirm")}</button>
    </form>}
  </main>;
}
