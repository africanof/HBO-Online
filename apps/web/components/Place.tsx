"use client";
import { useEffect, useState } from "react";
import { getOrderDeliveryPoint, setOrderDeliveryPoint, friendlyError, parseGeoInput, geoInputProblem, formatPoint, mapsUrl, osmEmbedUrl, geoErrorMessage, isInAngola, pointFrom, DIRECTIONS_MAX, DIRECTIONS_PLACEHOLDER, type GeoPoint } from "@huambo-online/core";
import { useDataSaver } from "../lib/dataSaver";
import { supabase } from "../lib/supabase";

/** Pede o GPS ao navegador. */
export function browserPosition(): Promise<{ point: GeoPoint | null; error: string }> {
  return new Promise(resolve => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve({ point: null, error: geoErrorMessage("unavailable") }); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        resolve(isInAngola(p) ? { point: p, error: "" } : { point: null, error: geoErrorMessage("outside") });
      },
      err => resolve({ point: null, error: geoErrorMessage(err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable") }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  });
}

/** Ponto no mapa: «Usar a minha localização», colar coordenadas/ligação do Google Maps, ou tirar. */
export function PointPicker({ point, onChange, label = "Ponto no mapa (opcional)", hint }: { point: GeoPoint | null; onChange: (p: GeoPoint | null) => void; label?: string; hint?: string }) {
  const [paste, setPaste] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function here() {
    setBusy(true); setError("");
    const r = await browserPosition(); setBusy(false);
    if (r.point) onChange(r.point); else setError(r.error);
  }
  function pasted(v: string) {
    setPaste(v); setError("");
    if (!v.trim()) return;
    const p = parseGeoInput(v);
    if (p) { onChange(p); setPaste(""); } else setError(geoInputProblem(v) ?? "");
  }
  return <fieldset className="card stack" style={{ gap: 8 }}>
    <legend style={{ fontWeight: 700 }}>📍 {label}</legend>
    {hint && <small>{hint}</small>}
    {point ? <div className="row" style={{ alignItems: "center" }}>
      <span className="ok">✔ Ponto marcado: {formatPoint(point)}</span>
      <a href={mapsUrl(point)} target="_blank" rel="noopener">Ver no mapa</a>
      <button type="button" className="secondary" onClick={() => onChange(null)}>Tirar o ponto</button>
    </div> : <>
      <button type="button" className="secondary" onClick={here} disabled={busy} style={{ justifySelf: "start" }}>{busy ? "A procurar…" : "📍 Usar a minha localização"}</button>
      <label>…ou cole as coordenadas ou a ligação do Google Maps<input value={paste} onChange={e => pasted(e.target.value)} placeholder="-12.7765, 15.7398" inputMode="text" /></label>
    </>}
    {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
  </fieldset>;
}

/** «Como chegar» + ponto no mapa (formulários de anúncio, empresa e perfil profissional). */
export function PlaceFields({ directions, point, onDirections, onPoint, approximate, hint }: { directions: string; point: GeoPoint | null; onDirections: (v: string) => void; onPoint: (p: GeoPoint | null) => void; approximate?: boolean; hint?: string }) {
  return <>
    <label>Como chegar (ponto de referência, opcional)<textarea value={directions} onChange={e => onDirections(e.target.value)} maxLength={DIRECTIONS_MAX} rows={2} placeholder={DIRECTIONS_PLACEHOLDER} /></label>
    <PointPicker point={point} onChange={onPoint}
      hint={hint ?? (approximate ? "Por segurança, o ponto aparece aproximado (cerca de 100 m). Não marque a sua casa: marque onde mostra o artigo." : undefined)} />
  </>;
}

/** Mostra «Como chegar» e o ponto no mapa. O mapa só carrega quando a pessoa pede (poupa dados). */
export function PlaceView({ directions, lat, lng, approximate }: { directions?: string | null; lat?: unknown; lng?: unknown; approximate?: boolean }) {
  const p = pointFrom(lat, lng); const [show, setShow] = useState(false); const lite = useDataSaver();
  if (!directions && !p) return null;
  return <section className="card" style={{ gap: 8 }}>
    <h2 style={{ margin: 0, fontSize: 20 }}>🧭 Como chegar</h2>
    {directions && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{directions}</p>}
    {p && <div className="row">
      <a className="btn secondary" href={mapsUrl(p)} target="_blank" rel="noopener">📍 Abrir no mapa</a>
      {!show && <button type="button" className="secondary" onClick={() => setShow(true)}>🗺️ Mostrar mapa aqui{lite ? " (gasta dados)" : ""}</button>}
    </div>}
    {p && approximate && <small>Local aproximado (cerca de 100 m).</small>}
    {p && show && <iframe title="Mapa do local" src={osmEmbedUrl(p)} style={{ width: "100%", height: 260, border: 0, borderRadius: 12 }} loading="lazy" />}
  </section>;
}

/** Ponto de entrega de uma encomenda: o vendedor e o estafeta abrem no mapa; o comprador pode marcar ou mudar. */
export function OrderPoint({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [p, setP] = useState<GeoPoint | null | undefined>(undefined); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void getOrderDeliveryPoint(supabase(), orderId).then(setP); }, [orderId]);
  async function save(next: GeoPoint | null) {
    setError("");
    const r = await setOrderDeliveryPoint(supabase(), orderId, next);
    if (r.error) setError(friendlyError(r.error)); else { setP(next); setOpen(false); }
  }
  if (p === undefined) return null;
  return <div className="stack" style={{ gap: 6 }}>
    {p && <div className="row"><a className="btn secondary" href={mapsUrl(p)} target="_blank" rel="noopener">📍 Abrir o ponto da entrega no mapa</a>
      {canEdit && <button type="button" className="secondary" onClick={() => void save(null)}>Tirar o ponto</button>}</div>}
    {!p && canEdit && !open && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>📍 Marcar o ponto da entrega no mapa</button>}
    {!p && canEdit && open && <PointPicker point={null} onChange={pt => { if (pt) void save(pt); }} label="Ponto da entrega no mapa" hint="Só o vendedor e o estafeta o veem." />}
    {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
  </div>;
}
