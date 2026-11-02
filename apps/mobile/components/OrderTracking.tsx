import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import * as Location from "expo-location";
import { getOrderTracking, trackingSteps, trackingStopped, trackingActive, courierLive, shareCourierLocation, mapsUrl, friendlyErrorIn, type OrderTracking } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, timeAgoIn, useT } from "../lib/i18n";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

/** «📦 Acompanhar encomenda»: passos com a hora de cada um, histórico e onde está o estafeta. */
export function OrderTrackingPanel({ orderId, role = "buyer" }: { orderId: string; role?: "buyer" | "seller" }) {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false); const [data, setData] = useState<OrderTracking | null>(null); const [err, setErr] = useState(""); const [hist, setHist] = useState(false);
  async function load() { const r = await getOrderTracking(supabase(), orderId); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setErr(""); setData(r.data); } }
  useEffect(() => { if (open) void load(); }, [open, orderId]);
  useEffect(() => {
    if (!open || !data || !trackingActive(data)) return;
    const id = setInterval(() => void load(), 30_000); return () => clearInterval(id);
  }, [open, data]);
  if (!open) return <Button title={t("trk.open")} variant="secondary" onPress={() => setOpen(true)} />;
  const stopped = data ? trackingStopped(data) : null; const live = data ? courierLive(data) : null;
  const stepLabel = (k: string) => k === "received" && role === "seller" ? t("trk.ev.received") : t("trk.step." + k);
  return <View style={{ gap: 8, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12 }}>
    <Text style={ui.label}>{t("trk.open")}</Text>
    <Message error={err} />
    {!data && !err && <Text style={ui.muted}>{t("common.loading")}</Text>}
    {!!stopped && <Text style={ui.error}>{t("trk." + stopped)}</Text>}
    {data && trackingSteps(data).map((s, i, all) => <View key={s.key} style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: "center", width: 24 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: s.done ? "#2E7D32" : s.current ? C.blue : C.line }}>
          <Text style={{ color: s.done || s.current ? "#fff" : C.ink, fontSize: 12, fontWeight: "800" }}>{s.done ? "✓" : String(i + 1)}</Text>
        </View>
        {i < all.length - 1 && <View style={{ width: 2, height: 20, backgroundColor: s.done ? "#2E7D32" : C.line }} />}
      </View>
      <View style={{ flex: 1, opacity: s.done || s.current ? 1 : 0.6 }}>
        <Text style={[ui.text, { fontWeight: s.current ? "800" : "600" }]}>{stepLabel(s.key)}{s.current && !stopped ? " · " + t("trk.now") : ""}</Text>
        {!!s.at && s.done && <Text style={ui.muted}>{formatDateTimeIn(s.at, lang)}</Text>}
      </View>
    </View>)}
    {!!data?.delivery?.courier_name && <Text style={ui.text}>{t("trk.courier", { name: data.delivery.courier_name })}</Text>}
    {data?.delivery && ["assigned", "accepted", "picked_up", "in_transit"].includes(data.delivery.status) && (live
      ? <Button title={t("trk.live", { ago: timeAgoIn(live.at, t, lang) })} onPress={() => void Linking.openURL(mapsUrl({ lat: live.lat, lng: live.lng }))} />
      : <Text style={ui.muted}>{t("trk.no_live")}</Text>)}
    {data && data.events.length > 0 && <Pressable accessibilityRole="button" onPress={() => setHist(!hist)}><Text style={ui.link}>{t("trk.history")} ({data.events.length}) {hist ? "▲" : "▼"}</Text></Pressable>}
    {hist && data && [...data.events].reverse().map((e, i) => <Text key={i} style={ui.muted}>{formatDateTimeIn(e.at, lang)} — {t("trk.ev." + e.kind)}{e.note ? ` (${e.note})` : ""}</Text>)}
    {data && trackingActive(data) && <Text style={ui.muted}>{t("trk.auto")}</Text>}
    <Button title={t("trk.hide")} variant="secondary" onPress={() => setOpen(false)} />
  </View>;
}

/** Estafeta: partilha a localização com o cliente enquanto a entrega está ativa (a cada minuto, com a APP aberta). */
export function CourierLocationShare({ deliveryId }: { deliveryId: string }) {
  const { lang, t } = useT();
  const [on, setOn] = useState(false); const [err, setErr] = useState(""); const [last, setLast] = useState<string | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null); const lastSent = useRef(0);
  useEffect(() => () => { sub.current?.remove(); }, []);
  async function start() {
    setErr("");
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { setErr(t("trk.share_error")); return; }
    sub.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 60_000, distanceInterval: 50 }, async pos => {
      if (Date.now() - lastSent.current < 55_000) return;
      lastSent.current = Date.now();
      const r = await shareCourierLocation(supabase(), deliveryId, pos.coords.latitude, pos.coords.longitude);
      if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setLast(new Date().toISOString());
    });
    setOn(true);
  }
  function stop() { sub.current?.remove(); sub.current = null; setOn(false); }
  return <View style={{ gap: 4 }}>
    {on ? <Button title={t("trk.share_off")} variant="secondary" onPress={stop} /> : <Button title={t("trk.share_on")} onPress={() => void start()} />}
    {on && <Text style={ui.muted}>{t("trk.sharing")}{last ? ` · ${timeAgoIn(last, t, lang)}` : ""}</Text>}
    <Message error={err} />
  </View>;
}
