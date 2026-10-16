import { useEffect, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { getOrderDeliveryPoint, setOrderDeliveryPoint, parseGeoInput, geoInputProblem, formatPoint, mapsUrl, geoErrorMessage, isInAngola, pointFrom, friendlyErrorIn,
  DIRECTIONS_MAX, DIRECTIONS_PLACEHOLDER, type GeoPoint } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button } from "./Ui";
import { useT } from "../lib/i18n";

/** Pede o GPS ao telemóvel (só quando a pessoa carrega no botão). */
export async function devicePosition(): Promise<{ point: GeoPoint | null; error: string }> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { point: null, error: geoErrorMessage("denied") };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    return isInAngola(p) ? { point: p, error: "" } : { point: null, error: geoErrorMessage("outside") };
  } catch { return { point: null, error: geoErrorMessage("unavailable") }; }
}

/** Ponto no mapa: «Usar a minha localização», colar coordenadas/ligação do Google Maps, ou tirar. */
export function PointPicker({ point, onChange, label, hint }: { point: GeoPoint | null; onChange: (p: GeoPoint | null) => void; label?: string; hint?: string }) {
  const { t, tc } = useT();
  const [paste, setPaste] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function here() {
    setBusy(true); setError("");
    const r = await devicePosition(); setBusy(false);
    if (r.point) onChange(r.point); else setError(tc(r.error));
  }
  function pasted(v: string) {
    setPaste(v); setError("");
    if (!v.trim()) return;
    const p = parseGeoInput(v);
    if (p) { onChange(p); setPaste(""); } else setError(tc(geoInputProblem(v) ?? ""));
  }
  return <View style={[ui.card, { gap: 8 }]}>
    <Text style={ui.label}>📍 {label ?? t("sh.map_point_opt")}</Text>
    {!!hint && <Text style={ui.muted}>{hint}</Text>}
    {point ? <>
      <Text style={ui.ok}>{t("sh.point_marked", { point: formatPoint(point) })}</Text>
      <Button title={t("sh.view_on_map")} variant="secondary" onPress={() => void Linking.openURL(mapsUrl(point))} />
      <Button title={t("sh.remove_point")} variant="secondary" onPress={() => onChange(null)} />
    </> : <>
      <Button title={busy ? t("sh.searching") : t("sh.use_my_location")} variant="secondary" disabled={busy} onPress={() => void here()} />
      <Text style={ui.label}>{t("sh.paste_coords")}</Text>
      <TextInput accessibilityLabel={t("sh.coords_a11y")} value={paste} onChangeText={pasted} placeholder="-12.7765, 15.7398" autoCapitalize="none" style={ui.input} />
    </>}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}

/** «Como chegar» + ponto no mapa (formulários de anúncio, empresa e perfil profissional). */
export function PlaceFields({ directions, point, onDirections, onPoint, approximate, hint }: { directions: string; point: GeoPoint | null; onDirections: (v: string) => void; onPoint: (p: GeoPoint | null) => void; approximate?: boolean; hint?: string }) {
  const { t, tc } = useT();
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>{t("sh.directions_label")}</Text>
    <TextInput accessibilityLabel={t("sh.directions")} value={directions} onChangeText={onDirections} maxLength={DIRECTIONS_MAX} multiline placeholder={tc(DIRECTIONS_PLACEHOLDER)} style={[ui.input, ui.area]} />
    <PointPicker point={point} onChange={onPoint}
      hint={hint ?? (approximate ? t("sh.approx_hint") : undefined)} />
  </View>;
}

/** Mostra «Como chegar» e o botão para abrir o ponto no mapa. */
export function PlaceView({ directions, lat, lng, approximate }: { directions?: string | null; lat?: unknown; lng?: unknown; approximate?: boolean }) {
  const { t } = useT();
  const p = pointFrom(lat, lng);
  if (!directions && !p) return null;
  return <View style={ui.card}>
    <Text style={ui.h2}>{"🧭 " + t("sh.directions")}</Text>
    {!!directions && <Text style={ui.text}>{directions}</Text>}
    {!!p && <Button title={t("sh.open_on_map")} variant="secondary" onPress={() => void Linking.openURL(mapsUrl(p))} />}
    {!!p && approximate && <Text style={ui.muted}>{t("sh.approx_place")}</Text>}
  </View>;
}

/** Ponto de entrega de uma encomenda: o vendedor e o estafeta abrem no mapa; o comprador pode marcar ou mudar. */
export function OrderPoint({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const { t, lang } = useT();
  const [p, setP] = useState<GeoPoint | null | undefined>(undefined); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void getOrderDeliveryPoint(supabase(), orderId).then(setP); }, [orderId]);
  async function save(next: GeoPoint | null) {
    setError("");
    const r = await setOrderDeliveryPoint(supabase(), orderId, next);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setP(next); setOpen(false); }
  }
  if (p === undefined) return null;
  return <View style={{ gap: 6 }}>
    {!!p && <Button title={t("sh.open_delivery_point")} variant="secondary" onPress={() => void Linking.openURL(mapsUrl(p))} />}
    {!!p && canEdit && <Button title={t("sh.remove_point")} variant="secondary" onPress={() => void save(null)} />}
    {!p && canEdit && !open && <Button title={t("sh.mark_delivery_point")} variant="secondary" onPress={() => setOpen(true)} />}
    {!p && canEdit && open && <PointPicker point={null} onChange={pt => { if (pt) void save(pt); }} label={t("sh.delivery_point")} hint={t("sh.delivery_point_private")} />}
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
  </View>;
}
