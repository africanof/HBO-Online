"use client";
import { useEffect, useMemo, useState } from "react";
import { getDeliveryOptions, deliveryFee, checkoutSummary, validateListingCheckoutV2, buyListingProtectedV2, sortPointsNear, formatKm, loadSavedCheckout, saveCheckout,
  getItemInspectionFees, itemInspectionCategory, requestItemInspection, formatPrice, friendlyErrorIn, orderHref, mapHtml, MAP_CENTER,
  type DeliveryOptions, type CheckoutFulfillment } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { browserStore } from "./Engage";
import { browserPosition } from "./Place";
import { useT } from "../lib/i18n";

/** Compra como na Vinted: entrega (em mão, ponto de recolha ou casa), morada guardada, inspeção opcional e total. */
export function CheckoutForm({ item, uid, label, onCancel }: { item: any; uid: string; label: string; onCancel: () => void }) {
  const { t, tc, lang } = useT();
  const cur = item.currency ?? "AOA"; const price = Number(item.price) || 0;
  const [opts, setOpts] = useState<DeliveryOptions>({ home: [], points: [] });
  const [ful, setFul] = useState<CheckoutFulfillment>("pickup");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  const [area, setArea] = useState<string>(""); const [point, setPoint] = useState<string>("");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); const [view, setView] = useState<"list" | "map">("list");
  const [inspect, setInspect] = useState(false); const [inspFee, setInspFee] = useState(0);
  const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    void getDeliveryOptions(supabase()).then(setOpts);
    void getItemInspectionFees(supabase()).then(f => setInspFee(f[itemInspectionCategory(item.listing_type)] ?? 0)).catch(() => {});
    void loadSavedCheckout(browserStore).then(s => {
      if (s.phone || s.deliveryText) setSaved(true);
      setPhone(s.phone ?? ""); setAddress(s.deliveryText ?? ""); setArea(s.municipalityId ?? ""); setPoint(s.pickupPointId ?? "");
      if (s.fulfillment) setFul(s.fulfillment);
    });
  }, []);
  // Se a opção guardada já não existe (ex.: ponto desativado), volta a «em mão».
  useEffect(() => {
    if (ful === "point" && !opts.points.length) setFul("pickup");
    if (ful === "delivery" && !opts.home.length) setFul("pickup");
    if (!area && opts.home.length) setArea(opts.home[0].municipality_id);
  }, [opts]);
  const points = useMemo(() => sortPointsNear(opts.points, me), [opts.points, me]);
  const fee = deliveryFee(opts, { fulfillment: ful, municipalityId: area, pickupPointId: point });
  const sum = checkoutSummary(price, Number.isFinite(fee) ? fee : 0, inspect ? inspFee : 0);
  const minPoint = opts.points.length ? Math.min(...opts.points.map(p => p.fee)) : 0;
  const minHome = opts.home.length ? Math.min(...opts.home.map(h => h.fee)) : 0;
  const homeArea = opts.home.find(h => h.municipality_id === area);

  async function near() { const r = await browserPosition(); if (r.point) setMe(r.point); else setError(tc(r.error)); }
  async function submit() {
    setError("");
    const input = { fulfillment: ful, phone, deliveryText: address, note, municipalityId: area || null, pickupPointId: point || null };
    const bad = validateListingCheckoutV2(input); if (bad) { setError(t(bad)); return; }
    setBusy(true);
    const r = await buyListingProtectedV2(supabase(), item.id, input);
    if (r.error) { setBusy(false); setError(friendlyErrorIn(r.error, lang)); return; }
    await saveCheckout(browserStore, { fulfillment: ful, phone, deliveryText: address, municipalityId: area, pickupPointId: point });
    if (inspect) await requestItemInspection(supabase(), { listingId: item.id, orderId: String(r.data) });
    window.location.href = orderHref(String(r.data), true);
  }

  const card = (v: CheckoutFulfillment, title: string, desc: string) => <label className={"co-opt" + (ful === v ? " on" : "")}>
    <input type="radio" name="co-ful" checked={ful === v} onChange={() => setFul(v)} /><span><strong>{title}</strong><small>{desc}</small></span></label>;

  return <form className="card stack co" style={{ gap: 12 }} onSubmit={e => { e.preventDefault(); void submit(); }}>
    <strong>{label} · {formatPrice(price, cur)}</strong>
    {saved && <small className="muted">✏️ {t("co.saved")}</small>}
    <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
      <legend style={{ fontWeight: 700, marginBottom: 6 }}>{t("co.how")}</legend>
      {card("pickup", t("co.pickup"), t("co.pickup_d"))}
      {opts.points.length > 0 && card("point", t("co.point"), t("co.point_d", { fee: formatPrice(minPoint, cur) }))}
      {opts.home.length > 0 && card("delivery", t("co.home"), t("co.home_d", { fee: formatPrice(minHome, cur) }))}
    </fieldset>

    {ful === "point" && <div className="stack co-points" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>{t("co.choose_point")}</strong>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className={view === "list" ? "" : "secondary"} onClick={() => setView("list")}>{t("co.list")}</button>
          <button type="button" className={view === "map" ? "" : "secondary"} onClick={() => setView("map")}>{t("co.map")}</button>
        </div>
      </div>
      <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void near()}>{t("co.near_me")}</button>
      {view === "map" && <iframe className="co-map" title={t("co.map")} sandbox="allow-scripts" srcDoc={mapHtml(points.filter(p => p.lat != null).map(p => ({ kind: "pickup", id: p.id, title: p.name, subtitle: p.address, lat: p.lat!, lng: p.lng! })), me ? { ...me, zoom: 14 } : MAP_CENTER, me)} />}
      <div className="stack" style={{ gap: 6 }} role="radiogroup">
        {points.map(p => <label key={p.id} className={"co-point" + (point === p.id ? " on" : "")}>
          <input type="radio" name="co-point" checked={point === p.id} onChange={() => setPoint(p.id)} />
          <span><strong>📦 {p.name}</strong><small>📍 {p.address}{p.km != null ? " · " + formatKm(p.km) : ""}</small>
            {p.hours && <small>🕘 {t("co.hours", { hours: p.hours })}</small>}<small>⏱ {t("co.eta", { eta: p.eta })} · {formatPrice(p.fee, cur)}</small></span>
        </label>)}
      </div>
    </div>}

    {ful === "delivery" && <>
      <label>{t("co.area")}<select value={area} onChange={e => setArea(e.target.value)}>{opts.home.map(h => <option key={h.municipality_id} value={h.municipality_id}>{h.municipality} · {formatPrice(h.fee, cur)}</option>)}</select></label>
      {homeArea && <small className="muted">⏱ {t("co.eta_home", { eta: homeArea.eta })}</small>}
      <label>{t("co.address")}<input value={address} onChange={e => setAddress(e.target.value)} autoComplete="street-address" /></label>
    </>}

    <label>{t("pp.phone")}<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="923 000 000" /></label>
    <label>{t("pp.note")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>

    {inspFee > 0 && <label className={"co-opt" + (inspect ? " on" : "")}>
      <input type="checkbox" checked={inspect} onChange={e => setInspect(e.target.checked)} />
      <span><strong>{t("co.inspection", { fee: formatPrice(inspFee, cur) })}</strong><small>{t("co.inspection_d")}</small></span></label>}

    <div className="co-sum">
      <div><span>{t("co.sum_item")}</span><span>{formatPrice(sum.item, cur)}</span></div>
      <div><span>{t("co.sum_delivery")}</span><span>{sum.delivery ? formatPrice(sum.delivery, cur) : t("co.sum_free")}</span></div>
      {inspect && <div><span>{t("co.sum_inspection")}</span><span>{formatPrice(sum.inspection, cur)}</span></div>}
      <div className="co-total"><span>{t("co.sum_total")}</span><span>{formatPrice(sum.total, cur)}</span></div>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row">
      <button type="submit" disabled={busy}>{busy ? t("common.loading") : t("pp.continue")}</button>
      <button type="button" className="secondary" onClick={onCancel}>{t("common.cancel")}</button>
    </div>
    <small className="muted">🛡️ {t("pp.never_outside")}</small>
  </form>;
}
