"use client";
import { useEffect, useMemo, useState } from "react";
import { listMapPoints, mapHtml, MAP_CENTER, MAP_KINDS, type MapKind, type MapPoint } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { browserPosition } from "../../components/Place";
import { useT } from "../../lib/i18n";

/** Mapa do Huambo (OpenStreetMap): anúncios, empresas, profissionais, combustível e eventos. */
export default function Mapa() {
  const { t, tc } = useT();
  const [kind, setKind] = useState<MapKind | "">(""); const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); const [error, setError] = useState("");
  useEffect(() => { setPoints(null); void listMapPoints(supabase(), kind).then(r => setPoints(r.data)); }, [kind]);
  async function where() { setError(""); const r = await browserPosition(); if (r.point) setMe(r.point); else setError(tc(r.error)); }
  const html = useMemo(() => mapHtml(points ?? [], me ? { ...me, zoom: 15 } : MAP_CENTER, me), [points, me]);
  return <main className="stack map-page">
    <h1>🗺️ {t("map.title")}</h1>
    <nav className="chips" aria-label={t("map.title")}>
      {([["", t("map.all")], ...MAP_KINDS.map(k => [k.value, k.icon + " " + t("map." + k.value)])] as [string, string][]).map(([v, l]) =>
        <button key={v} type="button" className={"chip" + (kind === v ? " on" : "")} aria-pressed={kind === v} onClick={() => setKind(v as MapKind | "")}>{l}</button>)}
    </nav>
    <div className="map-bar">
      <span className="muted">{points ? t("map.count", { n: points.length }) : t("common.loading")}</span>
      <button type="button" className="secondary" onClick={() => void where()}>{t("map.me")}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {points?.length === 0 && <p className="muted">{t("map.empty")}</p>}
    <iframe className="map-frame" title={t("map.title")} srcDoc={html} sandbox="allow-scripts allow-popups allow-top-navigation-by-user-activation" />
    <p className="muted small">{t("map.approx")}</p>
  </main>;
}
