import { useEffect, useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { listCouriersForAdmin, setCourierStatus, listOpenDeliveriesForAdmin, assignDelivery, formatPrice, friendlyError,
  COURIER_STATUS_LABELS, DELIVERY_STATUS_LABELS, VEHICLE_LABELS, type CourierStatus, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

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
  return <View style={{ gap: 12 }}>
    <Message error={error} ok={notice} />
    <Text style={ui.h2}>Estafetas ({couriers.length})</Text>
    {couriers.length === 0 && <Text style={ui.text}>Ainda ninguém se registou como estafeta.</Text>}
    {couriers.map(c => <View key={c.user_id} style={ui.card}>
      <Text style={ui.label}>{c.display_name} · {COURIER_STATUS_LABELS[c.status as CourierStatus]}</Text>
      <Text style={ui.muted}>{VEHICLE_LABELS[c.vehicle as Vehicle] ?? c.vehicle} · {c.municipality ?? "Qualquer município"} · {c.delivered} entrega(s){c.available ? "" : " · indisponível"}</Text>
      <Button title={"📞 " + c.phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + String(c.phone).replace(/\s/g, ""))} />
      {c.status !== "approved" && <Button title="Aprovar" onPress={() => void act(() => setCourierStatus(supabase(), c.user_id, "approved"), "Estafeta aprovado.")} />}
      {c.status !== "suspended" && <Button title="Suspender" variant="danger" onPress={() => Alert.alert("Suspender este estafeta?", "", [{ text: "Não", style: "cancel" }, { text: "Suspender", style: "destructive", onPress: () => void act(() => setCourierStatus(supabase(), c.user_id, "suspended"), "Estafeta suspenso.") }])} />}
    </View>)}
    <Text style={ui.h2}>Entregas em curso ({deliveries.length})</Text>
    {deliveries.length === 0 && <Text style={ui.text}>Sem entregas em curso.</Text>}
    {deliveries.map(d => <View key={d.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(d.total)} · {DELIVERY_STATUS_LABELS[d.status as DeliveryStatus]}</Text>
      <Text style={ui.muted}>Vendedor: {d.seller_name}{d.delivery_text ? " · Entregar em: " + d.delivery_text : ""}</Text>
      {!!d.courier_name && <Text style={ui.text}>Estafeta: {d.courier_name}</Text>}
      {["pending", "assigned"].includes(d.status) && approved.length > 0 && <>
        <Chips options={approved.map(c => ({ value: c.user_id as string, label: c.display_name as string }))} value={pick[d.id] ?? ""} onChange={v => setPick({ ...pick, [d.id]: v })} />
        <Button title="Atribuir" disabled={!pick[d.id]} onPress={() => void act(() => assignDelivery(supabase(), d.id, pick[d.id]), "Entrega atribuída.")} />
      </>}
    </View>)}
  </View>;
}
