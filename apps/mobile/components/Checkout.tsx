import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { getDeliveryOptions, deliveryFee, checkoutSummary, validateListingCheckoutV2, buyListingProtectedV2, sortPointsNear, formatKm, loadSavedCheckout, saveCheckout,
  getItemInspectionFees, itemInspectionCategory, requestItemInspection, formatPrice, friendlyErrorIn, mapHtml, MAP_CENTER,
  type DeliveryOptions, type CheckoutFulfillment } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { deviceStore } from "./Engage";
import { devicePosition } from "./Place";
import { ui, C } from "../lib/ui";
import { Button, Message, SmallButton } from "./Ui";
import { success } from "../lib/haptics";
import { useT } from "../lib/i18n";

/** Compra como na Vinted: entrega (em mão, ponto de recolha ou casa), morada guardada, inspeção opcional e total. */
export function CheckoutForm({ item, label, onCancel }: { item: any; label: string; onCancel: () => void }) {
  const { t, tc, lang } = useT(); const router = useRouter();
  const cur = item.currency ?? "AOA"; const price = Number(item.price) || 0;
  const [opts, setOpts] = useState<DeliveryOptions>({ home: [], points: [] });
  const [ful, setFul] = useState<CheckoutFulfillment>("pickup");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  const [area, setArea] = useState(""); const [point, setPoint] = useState("");
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); const [view, setView] = useState<"list" | "map">("list");
  const [inspect, setInspect] = useState(false); const [inspFee, setInspFee] = useState(0);
  const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    void getDeliveryOptions(supabase()).then(setOpts);
    void getItemInspectionFees(supabase()).then(f => setInspFee(f[itemInspectionCategory(item.listing_type)] ?? 0)).catch(() => {});
    void loadSavedCheckout(deviceStore).then(s => {
      if (s.phone || s.deliveryText) setSaved(true);
      setPhone(s.phone ?? ""); setAddress(s.deliveryText ?? ""); setArea(s.municipalityId ?? ""); setPoint(s.pickupPointId ?? "");
      if (s.fulfillment) setFul(s.fulfillment);
    });
  }, []);
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

  async function near() { const r = await devicePosition(); if (r.point) setMe(r.point); else setError(tc(r.error)); }
  async function submit() {
    setError("");
    const input = { fulfillment: ful, phone, deliveryText: address, note, municipalityId: area || null, pickupPointId: point || null };
    const bad = validateListingCheckoutV2(input); if (bad) { setError(t(bad)); return; }
    setBusy(true);
    const r = await buyListingProtectedV2(supabase(), item.id, input);
    if (r.error) { setBusy(false); setError(friendlyErrorIn(r.error, lang)); return; }
    await saveCheckout(deviceStore, { fulfillment: ful, phone, deliveryText: address, municipalityId: area, pickupPointId: point });
    if (inspect) await requestItemInspection(supabase(), { listingId: item.id, orderId: String(r.data) });
    success(); setBusy(false);
    router.push("/encomendas?pagar=1" as any);
  }

  const radio = (on: boolean, onPress: () => void, title: string, desc: string, extra?: string[]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress}
    style={{ flexDirection: "row", gap: 12, borderWidth: on ? 2 : 1, borderColor: on ? C.blue : C.line, backgroundColor: on ? C.blueSoft : C.card, borderRadius: 14, padding: 12 }}>
    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? C.blue : C.muted, alignItems: "center", justifyContent: "center", marginTop: 2 }}>{on && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.blue }} />}</View>
    <View style={{ flex: 1, gap: 2 }}><Text style={ui.label}>{title}</Text><Text style={ui.muted}>{desc}</Text>{extra?.map((e, k) => <Text key={k} style={ui.muted}>{e}</Text>)}</View>
  </Pressable>;
  const row = (a: string, b: string, strong = false) => <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={strong ? ui.h2 : ui.text}>{a}</Text><Text style={strong ? ui.h2 : ui.text}>{b}</Text></View>;

  return <View style={[ui.card, { gap: 12 }]}>
    <Text style={ui.label}>{label} · {formatPrice(price, cur)}</Text>
    {saved && <Text style={ui.muted}>✏️ {t("co.saved")}</Text>}
    <Text style={ui.label}>{t("co.how")}</Text>
    {radio(ful === "pickup", () => setFul("pickup"), t("co.pickup"), t("co.pickup_d"))}
    {opts.points.length > 0 && radio(ful === "point", () => setFul("point"), t("co.point"), t("co.point_d", { fee: formatPrice(minPoint, cur) }))}
    {opts.home.length > 0 && radio(ful === "delivery", () => setFul("delivery"), t("co.home"), t("co.home_d", { fee: formatPrice(minHome, cur) }))}

    {ful === "point" && <View style={{ gap: 8 }}>
      <Text style={ui.label}>{t("co.choose_point")}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <SmallButton primary={view === "list"} title={t("co.list")} onPress={() => setView("list")} />
        <SmallButton primary={view === "map"} title={t("co.map")} onPress={() => setView("map")} />
        <SmallButton title={t("co.near_me")} onPress={() => void near()} />
      </View>
      {view === "map" && <View style={{ height: 280, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
        <WebView originWhitelist={["*"]} javaScriptEnabled source={{ html: mapHtml(points.filter(p => p.lat != null).map(p => ({ kind: "pickup", id: p.id, title: p.name, subtitle: p.address, lat: p.lat!, lng: p.lng! })), me ? { ...me, zoom: 14 } : MAP_CENTER, me) }} />
      </View>}
      {points.map(p => <View key={p.id}>{radio(point === p.id, () => setPoint(p.id), "📦 " + p.name, "📍 " + p.address + (p.km != null ? " · " + formatKm(p.km) : ""),
        [...(p.hours ? ["🕘 " + t("co.hours", { hours: p.hours })] : []), "⏱ " + t("co.eta", { eta: p.eta }) + " · " + formatPrice(p.fee, cur)])}</View>)}
    </View>}

    {ful === "delivery" && <View style={{ gap: 8 }}>
      <Text style={ui.label}>{t("co.area")}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{opts.home.map(h => <SmallButton key={h.municipality_id} primary={area === h.municipality_id} title={h.municipality + " · " + formatPrice(h.fee, cur)} onPress={() => setArea(h.municipality_id)} />)}</View>
      {!!homeArea && <Text style={ui.muted}>⏱ {t("co.eta_home", { eta: homeArea.eta })}</Text>}
      <Text style={ui.label}>{t("co.address")}</Text>
      <TextInput value={address} onChangeText={setAddress} style={ui.input} autoComplete="street-address" />
    </View>}

    <Text style={ui.label}>{t("pp.phone")}</Text>
    <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="923 000 000" style={ui.input} />
    <Text style={ui.label}>{t("pp.note")}</Text>
    <TextInput value={note} onChangeText={setNote} maxLength={500} style={ui.input} />

    {inspFee > 0 && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: inspect }} onPress={() => setInspect(v => !v)}
      style={{ flexDirection: "row", gap: 12, borderWidth: inspect ? 2 : 1, borderColor: inspect ? C.blue : C.line, backgroundColor: inspect ? C.blueSoft : C.card, borderRadius: 14, padding: 12 }}>
      <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: inspect ? C.blue : C.muted, backgroundColor: inspect ? C.blue : "transparent", alignItems: "center", justifyContent: "center", marginTop: 2 }}>{inspect && <Text style={{ color: C.onAccent, fontWeight: "900" }}>✓</Text>}</View>
      <View style={{ flex: 1, gap: 2 }}><Text style={ui.label}>{t("co.inspection", { fee: formatPrice(inspFee, cur) })}</Text><Text style={ui.muted}>{t("co.inspection_d")}</Text></View>
    </Pressable>}

    <View style={{ gap: 6, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10 }}>
      {row(t("co.sum_item"), formatPrice(sum.item, cur))}
      {row(t("co.sum_delivery"), sum.delivery ? formatPrice(sum.delivery, cur) : t("co.sum_free"))}
      {inspect && row(t("co.sum_inspection"), formatPrice(sum.inspection, cur))}
      {row(t("co.sum_total"), formatPrice(sum.total, cur), true)}
    </View>
    <Message error={error} />
    <Button title={busy ? t("common.loading") : t("pp.continue")} disabled={busy} onPress={() => void submit()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={onCancel} />
    <Text style={ui.muted}>🛡️ {t("pp.never_outside")}</Text>
  </View>;
}
