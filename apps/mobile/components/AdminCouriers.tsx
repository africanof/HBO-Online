import { useEffect, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { listCouriersForAdmin, setCourierStatus, listOpenDeliveriesForAdmin, assignDelivery, formatPrice, friendlyErrorIn,
  COURIER_STATUS_LABELS, DELIVERY_STATUS_LABELS, VEHICLE_LABELS, type CourierStatus, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

/** Administração: aprovar estafetas e atribuir entregas. */
export function AdminCouriers() {
  const { lang, t, tc } = useT();
  const [couriers, setCouriers] = useState<any[]>([]); const [deliveries, setDeliveries] = useState<any[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [pick, setPick] = useState<Record<string, string>>({});
  async function load() {
    const c = supabase();
    const [a, b] = await Promise.all([listCouriersForAdmin(c), listOpenDeliveriesForAdmin(c)]);
    if (a.error || b.error) setError(friendlyErrorIn(a.error ?? b.error, lang));
    setCouriers((a.data as any[]) ?? []); setDeliveries((b.data as any[]) ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); await load(); }
  }
  const approved = couriers.filter(c => c.status === "approved");
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={notice} />
    <Text style={ui.h2}>{t("ad.couriers_count", { n: couriers.length })}</Text>
    {couriers.length === 0 && <Text style={ui.text}>{t("ad.no_couriers")}</Text>}
    {couriers.map(c => <View key={c.user_id} style={ui.card}>
      <Text style={ui.label}>{c.display_name} · {tc(COURIER_STATUS_LABELS[c.status as CourierStatus])}</Text>
      <Text style={ui.muted}>{tc(VEHICLE_LABELS[c.vehicle as Vehicle] ?? c.vehicle)} · {c.municipality ?? t("ad.any_municipality")} · {t("ad.deliveries_done", { n: c.delivered })}{c.available ? "" : " · " + t("ad.unavailable")}</Text>
      <Button title={"📞 " + c.phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + String(c.phone).replace(/\s/g, ""))} />
      {c.status !== "approved" && <Button title={t("ad.approve")} onPress={() => void act(() => setCourierStatus(supabase(), c.user_id, "approved"), t("ad.ok.courier_approved"))} />}
      {c.status !== "suspended" && <Button title={t("ad.suspend")} variant="danger" onPress={() => Alert.alert(t("ad.suspend_courier_q"), "", [{ text: t("ad.no"), style: "cancel" }, { text: t("ad.suspend"), style: "destructive", onPress: () => void act(() => setCourierStatus(supabase(), c.user_id, "suspended"), t("ad.ok.courier_suspended")) }])} />}
    </View>)}
    <Text style={ui.h2}>{t("ad.deliveries_open", { n: deliveries.length })}</Text>
    {deliveries.length === 0 && <Text style={ui.text}>{t("ad.no_deliveries")}</Text>}
    {deliveries.map(d => <View key={d.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(d.total)} · {tc(DELIVERY_STATUS_LABELS[d.status as DeliveryStatus])}</Text>
      <Text style={ui.muted}>{t("ad.seller", { name: d.seller_name })}{d.delivery_text ? " · " + t("ad.deliver_to", { place: d.delivery_text }) : ""}</Text>
      {!!d.courier_name && <Text style={ui.text}>{t("ad.courier", { name: d.courier_name })}</Text>}
      {["pending", "assigned"].includes(d.status) && approved.length > 0 && <>
        <Chips options={approved.map(c => ({ value: c.user_id as string, label: c.display_name as string }))} value={pick[d.id] ?? ""} onChange={v => setPick({ ...pick, [d.id]: v })} />
        <Button title={t("ad.assign")} disabled={!pick[d.id]} onPress={() => void act(() => assignDelivery(supabase(), d.id, pick[d.id]), t("ad.ok.delivery_assigned"))} />
      </>}
    </View>)}
  </View>;
}
