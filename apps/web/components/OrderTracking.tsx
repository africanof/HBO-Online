"use client";
import { useEffect, useRef, useState } from "react";
import { getOrderTracking, trackingSteps, trackingStopped, trackingActive, courierLive, shareCourierLocation, mapsUrl, friendlyErrorIn, type OrderTracking } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn, timeAgoIn } from "../lib/i18n";

/** «📦 Acompanhar encomenda»: passos com a hora de cada um, histórico e onde está o estafeta. */
export function OrderTrackingPanel({ orderId, role = "buyer", defaultOpen = false }: { orderId: string; role?: "buyer" | "seller"; defaultOpen?: boolean }) {
  const { lang, t } = useT();
  const [open, setOpen] = useState(defaultOpen); const [data, setData] = useState<OrderTracking | null>(null); const [err, setErr] = useState("");
  async function load() { const r = await getOrderTracking(supabase(), orderId); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setErr(""); setData(r.data); } }
  useEffect(() => { if (open) void load(); }, [open, orderId]);
  // Enquanto a encomenda anda, atualiza a cada 30 segundos.
  useEffect(() => {
    if (!open || !data || !trackingActive(data)) return;
    const id = setInterval(() => void load(), 30_000); return () => clearInterval(id);
  }, [open, data]);
  if (!open) return <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{t("trk.open")}</button>;
  const stopped = data ? trackingStopped(data) : null; const live = data ? courierLive(data) : null;
  const stepLabel = (k: string) => k === "received" && role === "seller" ? t("trk.ev.received") : t("trk.step." + k);
  return <section className="stack" style={{ gap: 8, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }} aria-label={t("trk.open")}>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <strong>{t("trk.open")}</strong>
      <button type="button" className="secondary" style={{ minHeight: 36, padding: "4px 12px" }} onClick={() => setOpen(false)}>{t("trk.hide")}</button>
    </div>
    {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
    {!data && !err && <p style={{ margin: 0 }}>{t("common.loading")}</p>}
    {stopped && <p className="error" style={{ margin: 0 }}>{t("trk." + stopped)}</p>}
    {data && <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 0 }}>
      {trackingSteps(data).map((s, i, all) => <li key={s.key} style={{ display: "grid", gridTemplateColumns: "28px 1fr", gap: 8, alignItems: "start" }}>
        <span aria-hidden style={{ display: "grid", justifyItems: "center" }}>
          <span style={{ width: 22, height: 22, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 800,
            background: s.done ? "var(--green, #2E7D32)" : s.current ? "var(--accent, #3665F3)" : "var(--line, #ddd)", color: s.done || s.current ? "#fff" : "inherit" }}>{s.done ? "✓" : i + 1}</span>
          {i < all.length - 1 && <span style={{ width: 2, height: 22, background: s.done ? "var(--green, #2E7D32)" : "var(--line, #ddd)" }} />}
        </span>
        <span style={{ paddingTop: 1, opacity: s.done || s.current ? 1 : 0.6 }}>
          <strong style={{ fontWeight: s.current ? 800 : 600 }}>{stepLabel(s.key)}</strong>{s.current && !stopped ? <span className="badge" style={{ marginLeft: 6 }}>{t("trk.now")}</span> : null}
          {s.at && s.done && <small style={{ display: "block" }}>{formatDateIn(s.at, lang)}</small>}
        </span>
      </li>)}
    </ol>}
    {data?.delivery?.courier_name && <span>{t("trk.courier", { name: data.delivery.courier_name })}</span>}
    {data?.delivery && ["assigned", "accepted", "picked_up", "in_transit"].includes(data.delivery.status) && (live
      ? <a className="btn" href={mapsUrl({ lat: live.lat, lng: live.lng })} target="_blank" rel="noopener" style={{ justifySelf: "start" }}>{t("trk.live", { ago: timeAgoIn(live.at, lang) })}</a>
      : <small className="muted">{t("trk.no_live")}</small>)}
    {data && data.events.length > 0 && <details>
      <summary>{t("trk.history")} ({data.events.length})</summary>
      <ul style={{ margin: "6px 0 0" }}>{[...data.events].reverse().map((e, i) => <li key={i}>{formatDateIn(e.at, lang)} — {t("trk.ev." + e.kind)}{e.note ? ` (${e.note})` : ""}</li>)}</ul>
    </details>}
    {data && trackingActive(data) && <small className="muted">{t("trk.auto")}</small>}
  </section>;
}

/** Estafeta: partilha a localização com o cliente enquanto a entrega está ativa (a cada minuto). */
export function CourierLocationShare({ deliveryId }: { deliveryId: string }) {
  const { lang, t } = useT();
  const [on, setOn] = useState(false); const [err, setErr] = useState(""); const [last, setLast] = useState<string | null>(null);
  const watch = useRef<number | null>(null); const lastSent = useRef(0);
  useEffect(() => () => { if (watch.current != null) navigator.geolocation?.clearWatch(watch.current); }, []);
  function start() {
    setErr("");
    if (!navigator.geolocation) { setErr(t("trk.share_error")); return; }
    watch.current = navigator.geolocation.watchPosition(async pos => {
      if (Date.now() - lastSent.current < 55_000) return;
      lastSent.current = Date.now();
      const r = await shareCourierLocation(supabase(), deliveryId, pos.coords.latitude, pos.coords.longitude);
      if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setLast(new Date().toISOString());
    }, () => setErr(t("trk.share_error")), { enableHighAccuracy: true, maximumAge: 30_000 });
    setOn(true);
  }
  function stop() { if (watch.current != null) navigator.geolocation.clearWatch(watch.current); watch.current = null; setOn(false); }
  return <div className="stack" style={{ gap: 4 }}>
    {on ? <button type="button" className="secondary" onClick={stop}>{t("trk.share_off")}</button> : <button type="button" onClick={start}>{t("trk.share_on")}</button>}
    {on && <small>{t("trk.sharing")}{last ? ` · ${timeAgoIn(last, lang)}` : ""}</small>}
    {err && <small className="error">{err}</small>}
  </div>;
}
