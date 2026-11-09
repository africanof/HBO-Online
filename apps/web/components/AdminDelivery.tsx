"use client";
import { useEffect, useState } from "react";
import { listDeliveryFees, saveDeliveryFee, listPickupPointsAdmin, savePickupPoint, friendlyErrorIn, parsePrice, formatPrice, type DeliveryFeeRow, type PickupPointAdmin } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { PointPicker } from "./Place";
import { useT } from "../lib/i18n";

type Muni = { id: string; name: string };
const EMPTY: Omit<PickupPointAdmin, "id"> & { id?: string | null } = { id: null, name: "", address: "", directions: null, municipality_id: "", geo_lat: null, geo_lng: null, hours: null, phone: null, active: true };

/** Equipa: preços de entrega por município e pontos de recolha. */
export function AdminDelivery() {
  const { t, lang } = useT();
  const [munis, setMunis] = useState<Muni[]>([]); const [fees, setFees] = useState<Record<string, DeliveryFeeRow>>({});
  const [points, setPoints] = useState<PickupPointAdmin[]>([]); const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [error, setError] = useState(""); const [ok, setOk] = useState("");
  async function load() {
    const c = supabase();
    const m = await c.from("municipalities").select("id,name,provinces!inner(name)").eq("provinces.name", "Huambo").order("name");
    setMunis(((m.data ?? []) as any[]).map(x => ({ id: x.id, name: x.name })));
    const f = await listDeliveryFees(c); setFees(Object.fromEntries(f.data.map(x => [x.municipality_id, x])));
    const p = await listPickupPointsAdmin(c); setPoints(p.data);
  }
  useEffect(() => { void load(); }, []);
  const row = (id: string): DeliveryFeeRow => fees[id] ?? { municipality_id: id, home_fee: null, point_fee: null, eta_text: "1 a 2 dias úteis", active: true };
  const setRow = (id: string, patch: Partial<DeliveryFeeRow>) => setFees(f => ({ ...f, [id]: { ...row(id), ...patch } }));
  async function saveFee(id: string) {
    setError(""); setOk("");
    const r = await saveDeliveryFee(supabase(), row(id));
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setOk(t("dl.saved"));
  }
  async function savePoint() {
    if (!form) return; setError(""); setOk("");
    const r = await savePickupPoint(supabase(), form);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setOk(t("dl.saved")); setForm(null); await load(); }
  }
  const num = (v: string) => v.trim() === "" ? null : parsePrice(v) ?? null;
  return <section className="stack">
    {error && <p className="error" role="alert">{error}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
    <h2>{t("dl.fees_title")}</h2>
    <p className="muted">{t("dl.fees_help")}</p>
    <div className="adm-fees">
      <div className="adm-fee head"><span /><span>{t("dl.home_fee")}</span><span>{t("dl.point_fee")}</span><span>{t("dl.eta")}</span><span>{t("dl.active")}</span><span /></div>
      {munis.map(m => { const r = row(m.id); return <div key={m.id} className="adm-fee">
        <strong>{m.name}</strong>
        <input inputMode="numeric" aria-label={m.name + " — " + t("dl.home_fee")} value={r.home_fee ?? ""} onChange={e => setRow(m.id, { home_fee: num(e.target.value) })} />
        <input inputMode="numeric" aria-label={m.name + " — " + t("dl.point_fee")} value={r.point_fee ?? ""} onChange={e => setRow(m.id, { point_fee: num(e.target.value) })} />
        <input aria-label={m.name + " — " + t("dl.eta")} value={r.eta_text} onChange={e => setRow(m.id, { eta_text: e.target.value })} />
        <input type="checkbox" aria-label={m.name + " — " + t("dl.active")} checked={r.active} onChange={e => setRow(m.id, { active: e.target.checked })} />
        <button type="button" className="secondary" onClick={() => void saveFee(m.id)}>{t("dl.save")}</button>
      </div>; })}
    </div>

    <h2>{t("dl.points_title")}</h2>
    <p className="muted">{t("dl.points_help")}</p>
    {!form && <button type="button" style={{ justifySelf: "start" }} onClick={() => setForm({ ...EMPTY, municipality_id: munis.find(m => m.name === "Huambo")?.id ?? "" })}>{t("dl.new_point")}</button>}
    {form && <form className="card stack" onSubmit={e => { e.preventDefault(); void savePoint(); }}>
      <label>{t("dl.name")}<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label>{t("dl.address")}<input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
      <label>{t("dl.directions")}<input value={form.directions ?? ""} onChange={e => setForm({ ...form, directions: e.target.value || null })} /></label>
      <label>{t("co.area")}<select value={form.municipality_id} onChange={e => setForm({ ...form, municipality_id: e.target.value })}>{munis.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>{t("dl.hours")}<input value={form.hours ?? ""} onChange={e => setForm({ ...form, hours: e.target.value || null })} /></label>
      <label>{t("dl.phone")}<input type="tel" value={form.phone ?? ""} onChange={e => setForm({ ...form, phone: e.target.value || null })} /></label>
      <PointPicker point={form.geo_lat != null && form.geo_lng != null ? { lat: Number(form.geo_lat), lng: Number(form.geo_lng) } : null} onChange={p => setForm({ ...form, geo_lat: p?.lat ?? null, geo_lng: p?.lng ?? null })} />
      <label className="check"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> {t("dl.active")}</label>
      <div className="row"><button type="submit">{t("dl.save")}</button><button type="button" className="secondary" onClick={() => setForm(null)}>{t("common.cancel")}</button></div>
    </form>}
    {points.length === 0 && <p>{t("dl.none")}</p>}
    {points.map(p => <div key={p.id} className="card" style={{ gap: 4 }}>
      <strong>📦 {p.name}{p.active ? "" : " · " + t("dl.off")}</strong>
      <span className="muted">📍 {p.address} · {munis.find(m => m.id === p.municipality_id)?.name ?? ""}{p.hours ? " · 🕘 " + p.hours : ""}</span>
      <span className="muted">{t("dl.point_fee")}: {row(p.municipality_id).point_fee != null ? formatPrice(row(p.municipality_id).point_fee) : "—"}</span>
      <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setForm({ ...p })}>{t("dl.edit")}</button>
    </div>)}
  </section>;
}
