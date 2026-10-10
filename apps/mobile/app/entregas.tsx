import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";
import { getMyCourier, registerCourier, setCourierAvailable, listAvailableDeliveries, claimDelivery, updateDeliveryStatus, listMyDeliveries,
  nextCourierSteps, isActiveDelivery, formatPrice, friendlyError, DELIVERY_STATUS_LABELS, COURIER_STATUS_LABELS, VEHICLE_LABELS, STEP_LABELS,
  type Courier, type CourierStep, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { useTerritory } from "../components/Directory";

export default function Entregas() {
  const router = useRouter();
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
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setEditing(false); await load(); }
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Entregas</Text><Text style={ui.text}>Inicie sessão para ser estafeta.</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;

  const registration = <View style={ui.card}>
    <Text style={ui.h2}>{courier ? "Os meus dados de estafeta" : "Quero ser estafeta"}</Text>
    <Text style={ui.label}>Nome</Text>
    <TextInput style={ui.input} value={form.name} onChangeText={v => setForm({ ...form, name: v })} />
    <Text style={ui.label}>Telefone</Text>
    <TextInput style={ui.input} value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} keyboardType="phone-pad" placeholder="+244 9xx xxx xxx" />
    <Text style={ui.label}>Meio de transporte</Text>
    <Chips options={Object.entries(VEHICLE_LABELS).map(([value, label]) => ({ value: value as Vehicle, label }))} value={form.vehicle} onChange={v => setForm({ ...form, vehicle: v })} />
    <Text style={ui.label}>Município onde trabalha</Text>
    <Chips options={[{ value: "", label: "Qualquer" }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={form.municipalityId} onChange={v => setForm({ ...form, municipalityId: v })} />
    <Button title={courier ? "Guardar" : "Registar"} disabled={busy} onPress={() => void act(() => registerCourier(supabase(), form), courier ? "Dados atualizados." : "Registo enviado. A administração vai aprovar a sua conta.")} />
    {!!courier && <Button title="Cancelar" variant="secondary" onPress={() => setEditing(false)} />}
  </View>;
  const active = mine.filter(d => isActiveDelivery(d.status));

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← Conta</Link>
    <Text style={ui.h1}>🛵 Entregas</Text>
    <Message error={error} ok={notice} />
    {!courier ? <>
      <Text style={ui.text}>Faça entregas das encomendas da loja do Huambo Online. Registe-se e espere pela aprovação da administração.</Text>
      {registration}
    </> : <>
      <View style={ui.card}>
        <Text style={ui.label}>{courier.display_name} · {VEHICLE_LABELS[courier.vehicle]}</Text>
        <Text style={ui.text}>Estado: {COURIER_STATUS_LABELS[courier.status]}</Text>
        {courier.status === "approved" && <Button title={courier.available ? "🟢 Disponível" : "⚪ Indisponível"} variant={courier.available ? "primary" : "secondary"} disabled={busy} onPress={() => void act(() => setCourierAvailable(supabase(), !courier.available), courier.available ? "Ficou indisponível." : "Ficou disponível.")} />}
        <Button title="Editar dados" variant="secondary" onPress={() => setEditing(!editing)} />
      </View>
      {editing && registration}
      {courier.status === "pending" && <Text style={ui.text}>A sua conta está à espera de aprovação. Vai receber uma notificação.</Text>}
      {courier.status === "suspended" && <Text style={ui.error}>A sua conta de estafeta está suspensa. Contacte a administração.</Text>}
      {courier.status === "approved" && <>
        <Text style={ui.h2}>As minhas entregas</Text>
        {active.length === 0 && <Text style={ui.text}>Nenhuma entrega em curso.</Text>}
        {active.map(d => <View key={d.id} style={ui.card}>
          <Text style={ui.label}>{formatPrice(d.total, d.currency)} · {DELIVERY_STATUS_LABELS[d.status as DeliveryStatus]}</Text>
          <Text style={ui.text}>Recolher em: {d.seller_name}</Text>
          <Text style={ui.text}>Entregar a: {d.buyer_name}{d.delivery_text ? " — " + d.delivery_text : ""}</Text>
          {!!d.notes && <Text style={ui.text}>Nota: {d.notes}</Text>}
          {!!d.contact_phone && <Button title={"📞 Cliente " + d.contact_phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + d.contact_phone.replace(/\s/g, ""))} />}
          {nextCourierSteps(d.status).map((s: CourierStep) => <Button key={s} title={STEP_LABELS[s]} variant={s === "released" ? "secondary" : "primary"} disabled={busy}
            onPress={() => s === "released" ? Alert.alert("Desistir desta entrega?", "", [{ text: "Não", style: "cancel" }, { text: "Desistir", onPress: () => void act(() => updateDeliveryStatus(supabase(), d.id, s), "Entrega devolvida.") }]) : void act(() => updateDeliveryStatus(supabase(), d.id, s), "Entrega atualizada.")} />)}
        </View>)}
        <Text style={ui.h2}>Entregas disponíveis</Text>
        {available.length === 0 && <Text style={ui.text}>Sem entregas à espera neste momento.</Text>}
        {available.map(d => <View key={d.id} style={ui.card}>
          <Text style={ui.label}>{formatPrice(d.total, d.currency)}</Text>
          <Text style={ui.text}>Recolher em: {d.seller_name}{d.seller_municipality ? " (" + d.seller_municipality + ")" : ""}</Text>
          {!!d.delivery_text && <Text style={ui.text}>Entregar em: {d.delivery_text}</Text>}
          <Text style={ui.muted}>{(d.items ?? []).map((i: any) => i.quantity + " × " + i.name).join(", ")}</Text>
          {!!d.notes && <Text style={ui.text}>Nota: {d.notes}</Text>}
          <Button title="Aceitar entrega" disabled={busy} onPress={() => void act(() => claimDelivery(supabase(), d.id), "Entrega aceite. O vendedor e o cliente foram avisados.")} />
        </View>)}
        {mine.some(d => d.status === "delivered") && <><Text style={ui.h2}>Entregas feitas</Text>
          {mine.filter(d => d.status === "delivered").map(d => <View key={d.id} style={ui.card}><Text style={ui.text}>{formatPrice(d.total, d.currency)} · {d.buyer_name} · {new Date(d.delivered_at).toLocaleString("pt-AO")}</Text></View>)}</>}
      </>}
    </>}
  </ScrollView>;
}
