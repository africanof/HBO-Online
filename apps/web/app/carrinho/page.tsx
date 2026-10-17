"use client";
import { useEffect, useMemo, useState } from "react";
import { PointPicker } from "../../components/Place";
import { type GeoPoint, getMyCart, setCartQuantity, groupCartBySeller, formatPrice, friendlyErrorIn, PAYMENT_LABELS,
  getProtectedSettings, PROTECTED_STEPS, type Fulfillment, type PaymentMethod,
  cartDeliveryQuote, cartTotals, defaultFulfillment, deliveryQuoteText, freeDeliveryHint, placeOrdersV3, DELIVERY_REASON_TEXT, type CartSellerQuote } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";
import { MunicipalitySelect } from "../../components/SellerDelivery";
import { useT } from "../../lib/i18n";

export default function Carrinho() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<GeoPoint | null>(null); const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  const [protectedOn, setProtectedOn] = useState(false); const [useProtected, setUseProtected] = useState(true);
  // 🚚 Entrega por vendedor: município do comprador → preço de cada vendedor (calculado pela base de dados)
  const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [municipalityId, setMunicipalityId] = useState("");
  const [quotes, setQuotes] = useState<CartSellerQuote[] | null>(null);
  const [choices, setChoices] = useState<Record<string, Fulfillment | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => { void getProtectedSettings(supabase()).then(r => setProtectedOn(!!r.data?.protected_enabled)); }, []);
  const isProtected = protectedOn && useProtected;
  async function load() { const r = await getMyCart(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  // Atualiza os preços da entrega quando muda o município ou o carrinho.
  const cartKey = items.map(i => i.product_id + ":" + i.quantity).join(",");
  useEffect(() => {
    if (!uid || !items.length) { setQuotes(items.length ? null : []); return; }
    let alive = true; setQuotes(null);
    void cartDeliveryQuote(supabase(), municipalityId || null).then(r => {
      if (!alive) return;
      if (r.error) { setError(friendlyErrorIn(r.error, lang)); setQuotes([]); return; }
      setQuotes(r.data);
      // Escolha inicial (ou quando a escolha deixou de ser possível); o que o cliente escolheu fica.
      setChoices(prev => {
        const next: Record<string, Fulfillment | undefined> = {};
        for (const row of r.data) {
          const q = row.quote, c = prev[row.seller_id];
          const stillOk = c === "pickup" ? q.pickup : c === "delivery" ? (q.delivery || q.reason === "needs_area") : false;
          next[row.seller_id] = touched[row.seller_id] && stillOk ? c : defaultFulfillment(q) ?? undefined;
        }
        return next;
      });
    });
    return () => { alive = false; };
  }, [uid, cartKey, municipalityId]);
  async function qty(productId: string, q: number) { const r = await setCartQuantity(supabase(), productId, q); if (r.error) setError(friendlyErrorIn(r.error, lang)); else await load(); }

  const groups = groupCartBySeller(items);
  const sellerIds = groups.map(g => g.sellerId);
  const byId = useMemo(() => Object.fromEntries((quotes ?? []).map(q => [q.seller_id, q])), [quotes]);
  const rows = (quotes ?? []).filter(q => sellerIds.includes(q.seller_id));
  const totals = cartTotals(rows, choices);
  const missingQuote = quotes !== null && sellerIds.some(id => !byId[id]);
  const calculating = items.length > 0 && quotes === null;
  const anyDelivery = sellerIds.some(id => choices[id] === "delivery");
  const blocked = calculating || missingQuote || totals.problems.length > 0;
  // Texto da linha «Entrega»: preço, grátis, «a combinar» (vendedores sem regras) ou «—» enquanto falta escolher o município.
  const deliveryRows = rows.filter(r => choices[r.seller_id] === "delivery");
  const toAgree = deliveryRows.some(r => r.quote.delivery && !r.quote.configured);
  const deliveryText = calculating ? "…" : !anyDelivery ? t("sh.dl.no_delivery_fee") : deliveryRows.some(r => !r.quote.delivery) ? "—"
    : totals.delivery > 0 ? formatPrice(totals.delivery) + (toAgree ? " + " + t("sh.dl.to_agree") : "") : toAgree ? t("sh.dl.to_agree") : t("sh.dl.free");

  function choose(sellerId: string, f: Fulfillment) { setChoices(c => ({ ...c, [sellerId]: f })); setTouched(x => ({ ...x, [sellerId]: true })); }
  async function checkout(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setError("");
    if (blocked) { setError(t("sh.dl.cart_problems")); return; }
    setBusy(true);
    const r = await placeOrdersV3(supabase(), { choices: choices as Record<string, Fulfillment>, paymentMethod: payment, phone, municipalityId: anyDelivery ? municipalityId || null : null,
      deliveryText: anyDelivery ? address : "", note, protected: isProtected, point: anyDelivery ? point : null }, sellerIds);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); await load(); return; }
    window.location.href = "/encomendas?novas=" + ((r.data as any[]) ?? []).length + (isProtected ? "&pagar=1" : "");
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/loja">← {t("nav.shop")}</a><h1>{t("sh.cart")}</h1><p><a href="/conta/login?voltar=/carrinho">{t("sh.sign_in")}</a> {t("sh.cart.to_see")}</p></main>;
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/loja">← {t("nav.shop")}</a>
    <h1>{t("sh.cart")}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {items.length === 0 && <p>{t("sh.cart.empty")} <a href="/loja">{t("sh.cart.see_products")}</a></p>}
    {items.length > 0 && <section className="card" aria-labelledby="dl-where">
      <h2 id="dl-where" style={{ margin: 0, fontSize: 20 }}>📍 {t("sh.dl.cart_muni")}</h2>
      <p className="muted" style={{ margin: 0 }}>{t("sh.dl.cart_muni_help")}</p>
      <MunicipalitySelect idPrefix="dl-cart" provinces={provinces} municipalities={municipalities} provinceId={provinceId} setProvinceId={setProvinceId}
        value={municipalityId} onChange={id => setMunicipalityId(id)} />
    </section>}
    {groups.map(g => {
      const row = byId[g.sellerId]; const q = row?.quote; const choice = choices[g.sellerId];
      const canDelivery = !!q && (q.delivery || q.reason === "needs_area");
      const problem = !!q && totals.problems.includes(g.sellerId);
      const hint = q ? freeDeliveryHint(q) : null;
      return <section key={g.sellerId} className="card" aria-label={t("sh.seller") + ": " + g.sellerName}>
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
        <span>{t("sh.cart.subtotal")}: <strong>{formatPrice(row?.subtotal ?? g.total)}</strong></span>
        {!q ? <p className="muted" style={{ margin: 0 }}>{t("sh.dl.calc")}</p> : <>
          <fieldset className="dl-choices">
            <legend>{t("sh.dl.how")}</legend>
            {q.pickup && <label className="dl-choice"><input type="radio" name={"dl-" + g.sellerId} value="pickup" checked={choice === "pickup"} onChange={() => choose(g.sellerId, "pickup")} /> 🏪 {t("sh.dl.pickup")}</label>}
            {q.reason !== "no_delivery" && <label className="dl-choice"><input type="radio" name={"dl-" + g.sellerId} value="delivery" checked={choice === "delivery"} disabled={!canDelivery} onChange={() => choose(g.sellerId, "delivery")} /> 🚚 {t("sh.dl.delivery")}</label>}
          </fieldset>
          {choice === "pickup" && <span>🏪 {q.pickup_place ? t("sh.dl.pickup_at", { place: q.pickup_place }) : t("sh.dl.pickup_agree")}</span>}
          {choice === "delivery" && q.delivery && <span><strong>🚚 {tc(deliveryQuoteText(q))}</strong></span>}
          {(!q.delivery && q.reason) && <span className={choice === "delivery" ? "error" : "muted"}>ℹ️ {tc(DELIVERY_REASON_TEXT[q.reason])}</span>}
          {hint && q.delivery && <span>🎁 {tc(hint)}</span>}
          {choice === "delivery" && q.delivery_days && <span>⏱️ {t("sh.dl.days_line", { d: q.delivery_days })}</span>}
          {q.note && <span>ℹ️ {q.note}</span>}
          {problem && !choice && <span className="error">{t("sh.dl.choose_one")}</span>}
        </>}
      </section>;
    })}
    {items.length > 0 && <form className="stack card" onSubmit={checkout}>
      <h2 style={{ margin: 0 }}>{t("sh.cart.checkout", { total: formatPrice(totals.total) })}</h2>
      {groups.length > 1 && <p>{t("sh.cart.many_orders", { n: groups.length })}</p>}
      <dl className="dl-totals" aria-live="polite">
        <dt>{t("sh.dl.sum_items")}</dt><dd>{formatPrice(totals.subtotal)}</dd>
        <dt>{t("sh.dl.sum_delivery")}</dt><dd>{deliveryText}</dd>
        <dt className="dl-total">{t("sh.dl.sum_total")}</dt><dd className="dl-total">{formatPrice(totals.total)}</dd>
      </dl>
      {anyDelivery && <label>{t("sh.cart.address")}<input value={address} onChange={e => setAddress(e.target.value)} placeholder={t("sh.cart.address_ph")} /></label>}
      {anyDelivery && <PointPicker point={point} onChange={setPoint} label={t("sh.cart.point_label")} hint={t("sh.cart.point_hint")} />}
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
      {blocked && !calculating && <p className="error" role="status">⚠️ {t("sh.dl.cart_problems")}</p>}
      <button disabled={busy || blocked}>{busy ? t("sh.sending") : t("sh.cart.confirm")}</button>
    </form>}
  </main>;
}
