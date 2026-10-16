"use client";
import { OrderPoint } from "../../components/Place";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listOrders, changeOrderStatus, formatPrice, friendlyErrorIn, LANG_TAGS, ORDER_STATUS_LABELS, PAYMENT_LABELS, FULFILLMENT_LABELS, NEXT_SELLER_STATUS,
  listMyDeliveries, requestOrderDelivery, cancelDeliveryRequest, latestDeliveryByOrder, isActiveDelivery, DELIVERY_STATUS_LABELS,
  listMyDisputes, latestDisputeByOrder, formatRef, canOpenDispute, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, type MyDispute,
  getPlatformSettings, getProtectedSettings, isActiveDispute, type PlatformSettings,
  type OrderStatus, type PaymentMethod, type Fulfillment, type DeliveryStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { OrderEscrowPanel } from "../../components/ProtectedPayment";
import { useT } from "../../lib/i18n";

function Encomendas() {
  const params = useSearchParams();
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"buyer" | "seller">(params.get("vendas") ? "seller" : "buyer");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(params.get("pagar") ? "@sh.ord.notice_pay" : params.get("novas") ? "@sh.ord.notice_new" : "");
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [provider, setProvider] = useState<"manual" | "proxypay">("manual");
  const [deliveries, setDeliveries] = useState<Record<string, any>>({});
  const [disputes, setDisputes] = useState<MyDispute[]>([]);
  async function load(r = role) {
    const [res, d, ds] = await Promise.all([listOrders(supabase(), r), listMyDeliveries(supabase(), "party"), listMyDisputes(supabase())]);
    if (res.error) setError(friendlyErrorIn(res.error, lang)); else setItems((res.data as any[]) ?? []);
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
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); await load(); }
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => setSettings(r.data)); void getProtectedSettings(supabase()).then(r => setProvider(r.data?.payment_provider ?? "manual")); }, []);
  useEffect(() => { if (uid) void load(role); }, [role]);
  async function act(id: string, status: OrderStatus, paid?: boolean) {
    setError(""); setNotice("");
    const r = await changeOrderStatus(supabase(), id, status, paid);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.ord.updated")); await load(); }
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/loja">← {t("nav.shop")}</a><h1>{t("sh.orders")}</h1><p><a href="/conta/login?voltar=/encomendas">{t("sh.sign_in")}</a>.</p></main>;
  return <main className="stack">
    <a href="/loja">← {t("nav.shop")}</a>
    <h1>{t("sh.orders")}</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={role === "buyer"} className={role === "buyer" ? "" : "secondary"} onClick={() => setRole("buyer")}>{t("sh.ord.my_purchases")}</button>
      <button role="tab" aria-selected={role === "seller"} className={role === "seller" ? "" : "secondary"} onClick={() => setRole("seller")}>{t("sh.my_sales")}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice.startsWith("@") ? t(notice.slice(1)) : notice}</p>}
    {items.length === 0 && <p>{t("sh.ord.none")}</p>}
    {items.map(o => {
      const next = NEXT_SELLER_STATUS[o.status as OrderStatus];
      return <article key={o.id} id={"encomenda-" + o.id} className="card">
        <strong>{o.ref_no ? formatRef("order", o.ref_no) + " · " : ""}{formatPrice(o.total, o.currency)} · <span className="badge">{o.protected && o.status === "completed" && o.escrow_status === "held" ? t("sh.ord.delivered") : tc(ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status)}</span>{o.payment_status === "paid" ? " · ✅ " + t("sh.ord.paid") : o.payment_status === "refunded" ? " · ↩️ " + t("sh.ord.refunded") : ""}</strong>
        <span>{role === "seller" ? t("sh.customer") : t("sh.seller")}: {o.other_name} · {new Date(o.created_at).toLocaleString(LANG_TAGS[lang])}</span>
        <span>{tc(FULFILLMENT_LABELS[o.fulfillment_type as Fulfillment])} · {o.protected ? "🛡️ " + t("sh.protected") : tc(PAYMENT_LABELS[o.payment_method as PaymentMethod] ?? o.payment_method)}</span>
        <OrderEscrowPanel order={o} role={role} uid={uid} settings={settings} provider={provider} hasActiveDispute={!!lastDispute[o.id] && isActiveDispute(lastDispute[o.id].status)}
          onChanged={(m, bad) => { if (bad) { setError(m); setNotice(""); } else { setError(""); setNotice(m); void load(); } }} />
        <ul style={{ margin: 0 }}>{(o.items ?? []).map((it: any, i: number) => <li key={i}>{it.quantity} × {it.name} — {formatPrice(it.line_total)}</li>)}</ul>
        {o.delivery_text && <span>{t("sh.delivery")}: {o.delivery_text}</span>}
        {o.fulfillment_type === "delivery" && <OrderPoint orderId={o.id} canEdit={role === "buyer" && o.status !== "completed" && o.status !== "cancelled"} />}
        {role === "seller" && o.contact_phone && <span>{t("auth.phone")}: <a href={"tel:" + o.contact_phone.replace(/\s/g, "")}>{o.contact_phone}</a></span>}
        {o.buyer_note && <span>{t("sh.note")}: {o.buyer_note}</span>}
        {deliveries[o.id] && <span>🛵 {t("sh.delivery")}: <strong>{tc(DELIVERY_STATUS_LABELS[deliveries[o.id].status as DeliveryStatus])}</strong>{deliveries[o.id].courier_name ? " · " + t("sh.courier") + ": " + deliveries[o.id].courier_name : ""}{deliveries[o.id].courier_phone && isActiveDelivery(deliveries[o.id].status) ? <> · <a href={"tel:" + deliveries[o.id].courier_phone.replace(/\s/g, "")}>{deliveries[o.id].courier_phone}</a></> : null}</span>}
        {lastDispute[o.id] && <a href={"/disputas#pedido-" + lastDispute[o.id].id}>↩️ {t("sh.ord.return_refund")}: <strong>{tc(lastDispute[o.id].status === "resolved" && lastDispute[o.id].outcome ? DISPUTE_OUTCOME_LABELS[lastDispute[o.id].outcome!] : DISPUTE_STATUS_LABELS[lastDispute[o.id].status])}</strong> →</a>}
        {role === "buyer" && canOpenDispute(o, disputes.filter(d => d.order_id === o.id)).ok && <a className="btn secondary" href={"/disputas?encomenda=" + o.id}>↩️ {t("sh.ask_return")}</a>}
        {o.status === "completed" && <a className="btn secondary" href="/avaliacoes">⭐ {t(role === "seller" ? "sh.ord.rate_customer" : "sh.ord.rate_seller")}</a>}
        <div className="row">
          {role === "seller" && o.fulfillment_type === "delivery" && o.escrow_status !== "awaiting_payment" && !["completed", "cancelled"].includes(o.status) && !(deliveries[o.id] && isActiveDelivery(deliveries[o.id].status)) && <button className="secondary" onClick={() => { const notes = prompt(t("sh.ord.courier_note")) ?? undefined; void run(() => requestOrderDelivery(supabase(), o.id, notes), t("sh.ord.courier_sent")); }}>🛵 {t("sh.ord.ask_courier")}</button>}
          {role === "seller" && deliveries[o.id] && ["pending", "assigned", "accepted"].includes(deliveries[o.id].status) && <button className="secondary" onClick={() => { if (confirm(t("sh.ord.cancel_courier_q"))) void run(() => cancelDeliveryRequest(supabase(), deliveries[o.id].id), t("sh.ord.courier_cancelled")); }}>{t("sh.ord.cancel_courier")}</button>}
          {role === "seller" && next && !(o.escrow_status === "awaiting_payment" && next !== "confirmed") && <button onClick={() => act(o.id, next)}>{t("sh.ord.mark_as", { status: o.protected && next === "completed" ? t("sh.ord.delivered") : tc(ORDER_STATUS_LABELS[next]) })}</button>}
          {role === "seller" && !o.protected && o.payment_status !== "paid" && !["cancelled"].includes(o.status) && <button className="secondary" onClick={() => act(o.id, o.status as OrderStatus, true)}>{t("sh.ord.mark_paid")}</button>}
          {(role === "seller" ? !["completed", "cancelled"].includes(o.status) : o.status === "pending") && <button className="danger" onClick={() => { if (confirm(t(o.payment_status === "paid" ? (o.escrow_status === "held" ? "sh.ord.cancel_held_q" : "sh.ord.cancel_paid_q") : "sh.ord.cancel_q"))) void act(o.id, "cancelled"); }}>{t("common.cancel")}</button>}
        </div>
      </article>;
    })}
  </main>;
}
function Loading() { const { t } = useT(); return <main><p>{t("common.loading")}</p></main>; }
export default function Page() { return <Suspense fallback={<Loading />}><Encomendas /></Suspense>; }
