"use client";
import { OrderPoint } from "../../components/Place";
import { CourierLocationShare } from "../../components/OrderTracking";
import { useEffect, useState } from "react";
import { getMyCourier, registerCourier, setCourierAvailable, listAvailableDeliveries, claimDelivery, updateDeliveryStatus, listMyDeliveries,
  nextCourierSteps, isActiveDelivery, formatPrice, friendlyErrorIn, LANG_TAGS, DELIVERY_STATUS_LABELS, COURIER_STATUS_LABELS, VEHICLE_LABELS, STEP_LABELS,
  type Courier, type CourierStep, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";
import { useT } from "../../lib/i18n";

export default function Entregas() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [available, setAvailable] = useState<any[]>([]); const [mine, setMine] = useState<any[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", vehicle: "moto" as Vehicle, municipalityId: "" }); const [editing, setEditing] = useState(false);
  const { municipalities } = useTerritory();

  async function load(id = uid) {
    if (!id) return;
    const c = supabase();
    const r = await getMyCourier(c, id);
    setCourier(r.data ?? null);
    if (r.data) setForm({ name: r.data.display_name, phone: r.data.phone, vehicle: r.data.vehicle, municipalityId: r.data.municipality_id ?? "" });
    if (r.data?.status === "approved") {
      const [a, m] = await Promise.all([listAvailableDeliveries(c), listMyDeliveries(c, "courier")]);
      setAvailable((a.data as any[]) ?? []); setMine((m.data as any[]) ?? []);
    }
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setEditing(false); await load(); }
  }

  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>{t("sh.deliveries")}</h1><p><a href="/conta/login?voltar=/entregas">{t("sh.sign_in")}</a> {t("sh.del.to_be_courier")}</p></main>;

  const registration = <form className="card stack" onSubmit={e => { e.preventDefault(); void act(() => registerCourier(supabase(), form), courier ? t("sh.del.data_updated") : t("sh.del.registered")); }}>
    <h2 style={{ margin: 0 }}>{courier ? t("sh.del.my_data") : t("sh.del.want")}</h2>
    <label>{t("sh.name")}<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>{t("auth.phone")}<input inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+244 9xx xxx xxx" /></label>
    <label>{t("sh.del.vehicle")}<select value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value as Vehicle })}>{Object.entries(VEHICLE_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select></label>
    <label>{t("sh.del.municipality")}<select value={form.municipalityId} onChange={e => setForm({ ...form, municipalityId: e.target.value })}><option value="">{t("sh.del.any")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <div className="row"><button disabled={busy}>{courier ? t("common.save") : t("sh.del.register")}</button>{courier && <button type="button" className="secondary" onClick={() => setEditing(false)}>{t("common.cancel")}</button>}</div>
  </form>;

  return <main className="stack">
    <a href="/conta">← {t("nav.account_short")}</a>
    <h1>🛵 {t("sh.deliveries")}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!courier ? <>
      <p>{t("sh.del.intro")}</p>
      {registration}
    </> : <>
      <div className="card">
        <strong>{courier.display_name} · {tc(VEHICLE_LABELS[courier.vehicle])}</strong>
        <span>{t("sh.status")}: <span className="badge">{tc(COURIER_STATUS_LABELS[courier.status])}</span></span>
        <div className="row">
          {courier.status === "approved" && <button className={courier.available ? "" : "secondary"} disabled={busy} onClick={() => act(() => setCourierAvailable(supabase(), !courier.available), courier.available ? t("sh.del.now_unavailable") : t("sh.del.now_available"))}>{courier.available ? "🟢 " + t("sh.del.available") : "⚪ " + t("sh.del.unavailable")}</button>}
          <button className="secondary" onClick={() => setEditing(!editing)}>{t("sh.del.edit_data")}</button>
        </div>
      </div>
      {editing && registration}
      {courier.status === "pending" && <p>{t("sh.del.pending")}</p>}
      {courier.status === "suspended" && <p className="error">{t("sh.del.suspended")}</p>}
      {courier.status === "approved" && <>
        <h2>{t("sh.del.mine")}</h2>
        {mine.filter(d => isActiveDelivery(d.status)).length === 0 && <p>{t("sh.del.none_active")}</p>}
        {mine.filter(d => isActiveDelivery(d.status)).map(d => <article key={d.id} className="card">
          <strong>{formatPrice(d.total, d.currency)} · <span className="badge">{tc(DELIVERY_STATUS_LABELS[d.status as DeliveryStatus])}</span></strong>
          <span>{t("sh.del.pickup")}: {d.seller_name}</span>
          <span>{t("sh.del.deliver_to")}: {d.buyer_name}{d.delivery_text ? " — " + d.delivery_text : ""}</span>
          <OrderPoint orderId={d.order_id} canEdit={false} />
          {d.contact_phone && <span>{t("sh.del.customer_phone")}: <a href={"tel:" + d.contact_phone.replace(/\s/g, "")}>{d.contact_phone}</a></span>}
          {d.notes && <span>{t("sh.note")}: {d.notes}</span>}
          {["assigned", "accepted", "picked_up", "in_transit"].includes(d.status) && <CourierLocationShare deliveryId={d.id} />}
          <div className="row">{nextCourierSteps(d.status).map((s: CourierStep) => <button key={s} disabled={busy} className={s === "released" ? "secondary" : ""} onClick={() => { if (s !== "released" || confirm(t("sh.del.release_q"))) void act(() => updateDeliveryStatus(supabase(), d.id, s), t("sh.del.updated")); }}>{tc(STEP_LABELS[s])}</button>)}</div>
        </article>)}
        <h2>{t("sh.del.available_list")}</h2>
        {available.length === 0 && <p>{t("sh.del.none_waiting")}</p>}
        {available.map(d => <article key={d.id} className="card">
          <strong>{formatPrice(d.total, d.currency)}</strong>
          <span>{t("sh.del.pickup")}: {d.seller_name}{d.seller_municipality ? " (" + d.seller_municipality + ")" : ""}</span>
          {d.delivery_text && <span>{t("sh.del.deliver_at")}: {d.delivery_text}</span>}
          <span>{(d.items ?? []).map((i: any) => i.quantity + " × " + i.name).join(", ")}</span>
          {d.notes && <span>{t("sh.note")}: {d.notes}</span>}
          <button disabled={busy} onClick={() => act(() => claimDelivery(supabase(), d.id), t("sh.del.accepted"))}>{t("sh.del.accept")}</button>
        </article>)}
        {mine.some(d => d.status === "delivered") && <><h2>{t("sh.del.done")}</h2>
          {mine.filter(d => d.status === "delivered").map(d => <div key={d.id} className="card"><span>{formatPrice(d.total, d.currency)} · {d.buyer_name} · {new Date(d.delivered_at).toLocaleString(LANG_TAGS[lang])}</span></div>)}</>}
      </>}
    </>}
  </main>;
}
