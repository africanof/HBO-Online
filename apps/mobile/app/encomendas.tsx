import { useCallback, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { listOrders, changeOrderStatus, formatPrice, friendlyError, ORDER_STATUS_LABELS, PAYMENT_LABELS, FULFILLMENT_LABELS, NEXT_SELLER_STATUS,
  listMyDeliveries, requestOrderDelivery, cancelDeliveryRequest, latestDeliveryByOrder, isActiveDelivery, DELIVERY_STATUS_LABELS,
  type OrderStatus, type PaymentMethod, type Fulfillment, type DeliveryStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

export default function Encomendas() {
  const router = useRouter();
  const params = useLocalSearchParams<{ novas?: string; vendas?: string }>();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"buyer" | "seller">(params.vendas ? "seller" : "buyer");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(params.novas ? "Encomenda enviada ao vendedor." : "");
  const [deliveries, setDeliveries] = useState<Record<string, any>>({});
  async function load(r = role) {
    const [res, d] = await Promise.all([listOrders(supabase(), r), listMyDeliveries(supabase(), "party")]);
    if (res.error) setError(friendlyError(res.error)); else setItems((res.data as any[]) ?? []);
    setDeliveries(latestDeliveryByOrder((d.data as any[]) ?? []));
  }
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); await load(); }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, [role]));
  async function act(id: string, status: OrderStatus, paid?: boolean) {
    setError(""); setNotice("");
    const r = await changeOrderStatus(supabase(), id, status, paid);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Encomenda atualizada."); await load(); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Encomendas</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href={"/loja" as any} style={ui.link}>← Loja</Link>
    <Text style={ui.h1}>Encomendas</Text>
    <Chips options={[{ value: "buyer" as const, label: "As minhas compras" }, { value: "seller" as const, label: "As minhas vendas" }]} value={role} onChange={v => { setRole(v); void load(v); }} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Sem encomendas.</Text>}
    {items.map(o => {
      const next = NEXT_SELLER_STATUS[o.status as OrderStatus];
      return <View key={o.id} style={ui.card}>
        <Text style={ui.h2}>{formatPrice(o.total, o.currency)} · {ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}{o.payment_status === "paid" ? " · ✅ Paga" : ""}</Text>
        <Text style={ui.text}>{role === "seller" ? "Cliente" : "Vendedor"}: {o.other_name}</Text>
        <Text style={ui.muted}>{new Date(o.created_at).toLocaleString("pt-AO")} · {FULFILLMENT_LABELS[o.fulfillment_type as Fulfillment]} · {PAYMENT_LABELS[o.payment_method as PaymentMethod] ?? o.payment_method}</Text>
        {(o.items ?? []).map((it: any, i: number) => <Text key={i} style={ui.text}>• {it.quantity} × {it.name} — {formatPrice(it.line_total)}</Text>)}
        {!!o.delivery_text && <Text style={ui.text}>Entrega: {o.delivery_text}</Text>}
        {!!o.buyer_note && <Text style={ui.text}>Nota: {o.buyer_note}</Text>}
        {!!deliveries[o.id] && <Text style={ui.label}>🛵 Entrega: {DELIVERY_STATUS_LABELS[deliveries[o.id].status as DeliveryStatus]}{deliveries[o.id].courier_name ? " · Estafeta: " + deliveries[o.id].courier_name : ""}</Text>}
        {!!deliveries[o.id]?.courier_phone && isActiveDelivery(deliveries[o.id].status) && <Button title={"📞 Estafeta " + deliveries[o.id].courier_phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + deliveries[o.id].courier_phone.replace(/\s/g, ""))} />}
        {role === "seller" && o.fulfillment_type === "delivery" && !["completed", "cancelled"].includes(o.status) && !(deliveries[o.id] && isActiveDelivery(deliveries[o.id].status)) && <Button title="🛵 Pedir estafeta" variant="secondary" onPress={() => void run(() => requestOrderDelivery(supabase(), o.id), "Pedido enviado aos estafetas.")} />}
        {role === "seller" && !!deliveries[o.id] && ["pending", "assigned", "accepted"].includes(deliveries[o.id].status) && <Button title="Cancelar estafeta" variant="secondary" onPress={() => Alert.alert("Cancelar o pedido de estafeta?", "", [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void run(() => cancelDeliveryRequest(supabase(), deliveries[o.id].id), "Pedido de estafeta cancelado.") }])} />}
        {role === "seller" && !!o.contact_phone && <Button title={"📞 " + o.contact_phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + o.contact_phone.replace(/\s/g, ""))} />}
        {role === "seller" && next && <Button title={`Marcar como «${ORDER_STATUS_LABELS[next]}»`} onPress={() => void act(o.id, next)} />}
        {role === "seller" && o.payment_status !== "paid" && o.status !== "cancelled" && <Button title="Marcar como paga" variant="secondary" onPress={() => void act(o.id, o.status as OrderStatus, true)} />}
        {(role === "seller" ? !["completed", "cancelled"].includes(o.status) : o.status === "pending") && <Button title="Cancelar" variant="danger" onPress={() => Alert.alert("Cancelar encomenda", "Tem a certeza?", [{ text: "Não", style: "cancel" }, { text: "Cancelar encomenda", style: "destructive", onPress: () => void act(o.id, "cancelled") }])} />}
      </View>;
    })}
  </ScrollView>;
}
