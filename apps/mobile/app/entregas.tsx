import { OrderPoint } from "../components/Place";
import { CourierLocationShare } from "../components/OrderTracking";
import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";
import { getMyCourier, registerCourier, setCourierAvailable, listAvailableDeliveries, claimDelivery, updateDeliveryStatus, listMyDeliveries,
  nextCourierSteps, isActiveDelivery, formatPrice, friendlyErrorIn, DELIVERY_STATUS_LABELS, COURIER_STATUS_LABELS, VEHICLE_LABELS, STEP_LABELS,
  type Courier, type CourierStep, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { useTerritory } from "../components/Directory";
import { useT, formatDateTimeIn } from "../lib/i18n";

export default function Entregas() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [available, setAvailable] = useState<any[]>([]); const [mine, setMine] = useState<any[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", vehicle: "moto" as Vehicle, municipalityId: "" }); const [editing, setEditing] = useState(false);
  const { municipalities } = useTerritory();

  async function load(id = uid) {
    if (!id) return;
    const c = supabase();
    const r = await getMyCourier(c, id);
    setCourier(r.data ?? null);
    if (r.data) setForm({ name: r.data.display_name, phone: r.data.phone, vehicle: r.data.vehicle, municipalityId: r.data.municipality_id ?? "" });
    if (r.data?.status === "approved") {
      const [a, m] = await Promise.all([listAvailableDeliveries(c), listMyDeliveries(c, "courier")]);
      setAvailable((a.data as any[]) ?? []); setMine((m.data as any[]) ?? []);
    }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []));
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setEditing(false); await load(); }
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.deliveries")}</Text><Text style={ui.text}>{t("sh.login_courier")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;

  const registration = <View style={ui.card}>
    <Text style={ui.h2}>{courier ? t("sh.my_courier_data") : t("sh.become_courier")}</Text>
    <Text style={ui.label}>{t("sh.name")}</Text>
    <TextInput style={ui.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
    <Text style={ui.label}>{t("auth.phone")}</Text>
    <TextInput style={ui.input} value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} keyboardType="phone-pad" placeholder="+244 9xx xxx xxx" />
    <Text style={ui.label}>{t("sh.vehicle")}</Text>
    <Chips options={Object.entries(VEHICLE_LABELS).map(([value, label]) => ({ value: value as Vehicle, label: tc(label) }))} value={form.vehicle} onChange={v => setForm({ ...form, vehicle: v })} />
    <Text style={ui.label}>{t("sh.work_municipality")}</Text>
    <Chips options={[{ value: "", label: t("sh.any") }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })} />
    <Button title={courier ? t("common.save") : t("sh.register")} disabled={busy} onPress={() => void act(() => registerCourier(supabase(), form), courier ? t("sh.data_updated") : t("sh.registration_sent"))} />
    {!!courier && <Button title={t("common.cancel")} variant="secondary" onPress={() => setEditing(false)} />}
  </View>;
  const active = mine.filter(d => isActiveDelivery(d.status));

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{"← " + t("nav.account_short")}</Link>
    <Text style={ui.h1}>{"🛵 " + t("sh.deliveries")}</Text>
    <Message error={error} ok={notice} />
    {!courier ? <>
      <Text style={ui.text}>{t("sh.courier_intro")}</Text>
      {registration}
    </> : <>
      <View style={ui.card}>
        <Text style={ui.label}>{courier.display_name} · {tc(VEHICLE_LABELS[courier.vehicle])}</Text>
        <Text style={ui.text}>{t("sh.status", { status: tc(COURIER_STATUS_LABELS[courier.status]) })}</Text>
        {courier.status === "approved" && <Button title={courier.available ? t("sh.available") : t("sh.unavailable")} variant={courier.available ? "primary" : "secondary"} disabled={busy} onPress={() => void act(() => setCourierAvailable(supabase(), !courier.available), courier.available ? t("sh.now_unavailable") : t("sh.now_available"))} />}
        <Button title={t("sh.edit_data")} variant="secondary" onPress={() => setEditing(!editing)} />
      </View>
      {editing && registration}
      {courier.status === "pending" && <Text style={ui.text}>{t("sh.courier_pending")}</Text>}
      {courier.status === "suspended" && <Text style={ui.error}>{t("sh.courier_suspended")}</Text>}
      {courier.status === "approved" && <>
        <Text style={ui.h2}>{t("sh.my_deliveries")}</Text>
        {active.length === 0 && <Text style={ui.text}>{t("sh.no_active_deliveries")}</Text>}
        {active.map(d => <View key={d.id} style={ui.card}>
          <Text style={ui.label}>{formatPrice(d.total, d.currency)} · {tc(DELIVERY_STATUS_LABELS[d.status as DeliveryStatus] ?? "")}</Text>
          <Text style={ui.text}>{t("sh.pickup_at", { name: d.seller_name })}</Text>
          <Text style={ui.text}>{t("sh.deliver_to", { name: d.buyer_name })}{d.delivery_text ? " — " + d.delivery_text : ""}</Text>
          {!!d.notes && <Text style={ui.text}>{t("sh.note", { text: d.notes })}</Text>}
          <OrderPoint orderId={d.order_id} canEdit={false} />
          {!!d.contact_phone && <Button title={t("sh.call_customer", { phone: d.contact_phone })} variant="secondary" onPress={() => void Linking.openURL("tel:" + d.contact_phone.replace(/\s/g, ""))} />}
          {["assigned", "accepted", "picked_up", "in_transit"].includes(d.status) && <CourierLocationShare deliveryId={d.id} />}
          {nextCourierSteps(d.status).map((s: CourierStep) => <Button key={s} title={tc(STEP_LABELS[s])} variant={s === "released" ? "secondary" : "primary"} disabled={busy}
            onPress={() => s === "released" ? Alert.alert(t("sh.give_up_q"), "", [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.give_up"), onPress: () => void act(() => updateDeliveryStatus(supabase(), d.id, s), t("sh.delivery_returned")) }]) : void act(() => updateDeliveryStatus(supabase(), d.id, s), t("sh.delivery_updated"))} />)}
        </View>)}
        <Text style={ui.h2}>{t("sh.available_deliveries")}</Text>
        {available.length === 0 && <Text style={ui.text}>{t("sh.no_waiting_deliveries")}</Text>}
        {available.map(d => <View key={d.id} style={ui.card}>
          <Text style={ui.label}>{formatPrice(d.total, d.currency)}</Text>
          <Text style={ui.text}>{t("sh.pickup_at", { name: d.seller_name })}{d.seller_municipality ? " (" + d.seller_municipality + ")" : ""}</Text>
          {!!d.delivery_text && <Text style={ui.text}>{t("sh.deliver_at", { text: d.delivery_text })}</Text>}
          <Text style={ui.muted}>{(d.items ?? []).map((i: any) => i.quantity + " × " + i.name).join(", ")}</Text>
          {!!d.notes && <Text style={ui.text}>{t("sh.note", { text: d.notes })}</Text>}
          <Button title={t("sh.accept_delivery")} disabled={busy} onPress={() => void act(() => claimDelivery(supabase(), d.id), t("sh.delivery_accepted"))} />
        </View>)}
        {mine.some(d => d.status === "delivered") && <><Text style={ui.h2}>{t("sh.done_deliveries")}</Text>
          {mine.filter(d => d.status === "delivered").map(d => <View key={d.id} style={ui.card}><Text style={ui.text}>{formatPrice(d.total, d.currency)} · {d.buyer_name} · {formatDateTimeIn(d.delivered_at, lang)}</Text></View>)}</>}
      </>}
    </>}
  </ScrollView>;
}
