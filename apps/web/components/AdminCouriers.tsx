"use client";
import { useEffect, useState } from "react";
import { listCouriersForAdmin, setCourierStatus, listOpenDeliveriesForAdmin, assignDelivery, formatPrice, friendlyError,
  COURIER_STATUS_LABELS, DELIVERY_STATUS_LABELS, VEHICLE_LABELS, type CourierStatus, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Administração: aprovar estafetas e atribuir entregas. */
export function AdminCouriers() {
  const [couriers, setCouriers] = useState<any[]>([]); const [deliveries, setDeliveries] = useState<any[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [pick, setPick] = useState<Record<string, string>>({});
  async function load() {
    const c = supabase();
    const [a, b] = await Promise.all([listCouriersForAdmin(c), listOpenDeliveriesForAdmin(c)]);
    if (a.error || b.error) setError(friendlyError(a.error ?? b.error));
    setCouriers((a.data as any[]) ?? []); setDeliveries((b.data as any[]) ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); await load(); }
  }
  const approved = couriers.filter(c => c.status === "approved");
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <h2>Estafetas ({couriers.length})</h2>
    {couriers.length === 0 && <p>Ainda ninguém se registou como estafeta.</p>}
    {couriers.map(c => <div key={c.user_id} className="card">
      <strong>{c.display_name} · <span className="badge">{COURIER_STATUS_LABELS[c.status as CourierStatus]}</span></strong>
      <span>{VEHICLE_LABELS[c.vehicle as Vehicle] ?? c.vehicle} · {c.municipality ?? "Qualquer município"} · <a href={"tel:" + String(c.phone).replace(/\s/g, "")}>{c.phone}</a> · {c.delivered} entrega(s) feita(s){c.available ? "" : " · indisponível"}</span>
      <div className="row">
        {c.status !== "approved" && <button onClick={() => act(() => setCourierStatus(supabase(), c.user_id, "approved"), "Estafeta aprovado.")}>Aprovar</button>}
        {c.status !== "suspended" && <button className="danger" onClick={() => { if (confirm("Suspender este estafeta?")) void act(() => setCourierStatus(supabase(), c.user_id, "suspended"), "Estafeta suspenso."); }}>Suspender</button>}
      </div>
    </div>)}
    <h2>Entregas em curso ({deliveries.length})</h2>
    {deliveries.length === 0 && <p>Sem entregas em curso.</p>}
    {deliveries.map(d => <div key={d.id} className="card">
      <strong>{formatPrice(d.total)} · <span className="badge">{DELIVERY_STATUS_LABELS[d.status as DeliveryStatus]}</span></strong>
      <span>Vendedor: {d.seller_name}{d.delivery_text ? " · Entregar em: " + d.delivery_text : ""} · {new Date(d.requested_at).toLocaleString("pt-AO")}</span>
      {d.courier_name && <span>Estafeta: {d.courier_name}</span>}
      {["pending", "assigned"].includes(d.status) && approved.length > 0 && <div className="row">
        <select value={pick[d.id] ?? ""} onChange={e => setPick({ ...pick, [d.id]: e.target.value })} aria-label="Estafeta"><option value="">Escolher estafeta…</option>{approved.map(c => <option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select>
        <button disabled={!pick[d.id]} onClick={() => act(() => assignDelivery(supabase(), d.id, pick[d.id]), "Entrega atribuída.")}>Atribuir</button>
      </div>}
    </div>)}
  </section>;
}
