"use client";
import { useEffect, useState } from "react";
import { listCouriersForAdmin, setCourierStatus, listOpenDeliveriesForAdmin, assignDelivery, formatPrice, friendlyErrorIn, LANG_TAGS,
  COURIER_STATUS_LABELS, DELIVERY_STATUS_LABELS, VEHICLE_LABELS, type CourierStatus, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Administração: aprovar estafetas e atribuir entregas. */
export function AdminCouriers() {
  const { lang, t, tc } = useT();
  const [couriers, setCouriers] = useState<any[]>([]); const [deliveries, setDeliveries] = useState<any[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [pick, setPick] = useState<Record<string, string>>({});
  async function load() {
    const c = supabase();
    const [a, b] = await Promise.all([listCouriersForAdmin(c), listOpenDeliveriesForAdmin(c)]);
    if (a.error || b.error) setError(friendlyErrorIn(a.error ?? b.error, lang));
    setCouriers((a.data as any[]) ?? []); setDeliveries((b.data as any[]) ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); await load(); }
  }
  const approved = couriers.filter(c => c.status === "approved");
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <h2>{t("ad.couriers_title", { n: couriers.length })}</h2>
    {couriers.length === 0 && <p>{t("ad.couriers_empty")}</p>}
    {couriers.map(c => <div key={c.user_id} className="card">
      <strong>{c.display_name} · <span className="badge">{tc(COURIER_STATUS_LABELS[c.status as CourierStatus])}</span></strong>
      <span>{tc(VEHICLE_LABELS[c.vehicle as Vehicle] ?? c.vehicle)} · {c.municipality ?? t("ad.any_municipality")} · <a href={"tel:" + String(c.phone).replace(/\s/g, "")}>{c.phone}</a> · {t(Number(c.delivered) === 1 ? "ad.delivered_one" : "ad.delivered_many", { n: c.delivered ?? 0 })}{c.available ? "" : " · " + t("ad.unavailable")}</span>
      <div className="row">
        {c.status !== "approved" && <button onClick={() => act(() => setCourierStatus(supabase(), c.user_id, "approved"), t("ad.ok_courier_approved"))}>{t("ad.approve")}</button>}
        {c.status !== "suspended" && <button className="danger" onClick={() => { if (confirm(t("ad.confirm_suspend_courier"))) void act(() => setCourierStatus(supabase(), c.user_id, "suspended"), t("ad.ok_courier_suspended")); }}>{t("ad.suspend")}</button>}
      </div>
    </div>)}
    <h2>{t("ad.deliveries_title", { n: deliveries.length })}</h2>
    {deliveries.length === 0 && <p>{t("ad.deliveries_empty")}</p>}
    {deliveries.map(d => <div key={d.id} className="card">
      <strong>{formatPrice(d.total)} · <span className="badge">{tc(DELIVERY_STATUS_LABELS[d.status as DeliveryStatus])}</span></strong>
      <span>{t("ad.seller")}: {d.seller_name}{d.delivery_text ? " · " + t("ad.deliver_to") + ": " + d.delivery_text : ""} · {new Date(d.requested_at).toLocaleString(LANG_TAGS[lang])}</span>
      {d.courier_name && <span>{t("ad.courier")}: {d.courier_name}</span>}
      {["pending", "assigned"].includes(d.status) && approved.length > 0 && <div className="row">
        <select value={pick[d.id] ?? ""} onChange={e => setPick({ ...pick, [d.id]: e.target.value })} aria-label={t("ad.courier")}><option value="">{t("ad.pick_courier")}</option>{approved.map(c => <option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select>
        <button disabled={!pick[d.id]} onClick={() => act(() => assignDelivery(supabase(), d.id, pick[d.id]), t("ad.ok_delivery_assigned"))}>{t("ad.assign")}</button>
      </div>}
    </div>)}
  </section>;
}
