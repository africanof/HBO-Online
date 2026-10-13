import { OrderPoint } from "../components/Place";
import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { listOrders, changeOrderStatus, formatPrice, friendlyError, ORDER_STATUS_LABELS, PAYMENT_LABELS, FULFILLMENT_LABELS, NEXT_SELLER_STATUS,
  listMyDeliveries, requestOrderDelivery, cancelDeliveryRequest, latestDeliveryByOrder, isActiveDelivery, DELIVERY_STATUS_LABELS,
  listMyDisputes, latestDisputeByOrder, formatRef, canOpenDispute, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, type MyDispute,
  getPlatformSettings, getProtectedSettings, isActiveDispute, type PlatformSettings,
  type OrderStatus, type PaymentMethod, type Fulfillment, type DeliveryStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { OrderEscrowPanel } from "../components/ProtectedPayment";

export default function Encomendas() {
  const router = useRouter();
  const params = useLocalSearchParams<{ novas?: string; vendas?: string; pagar?: string }>();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"buyer" | "seller">(params.vendas ? "seller" : "buyer");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(params.pagar ? "Encomenda feita. Agora pague ao Huambo Online: toque em «Pagar agora» na encomenda." : params.novas ? "Encomenda enviada ao vendedor." : "");
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [provider, setProvider] = useState<"manual" | "proxypay">("manual");
  useEffect(() => { void getPlatformSettings(supabase()).then(r => setSettings(r.data)); void getProtectedSettings(supabase()).then(r => setProvider(r.data?.payment_provider ?? "manual")); }, []);
  const [deliveries, setDeliveries] = useState<Record<string, any>>({});
  const [disputes, setDisputes] = useState<MyDispute[]>([]);
  async function load(r = role) {
    const [res, d, ds] = await Promise.all([listOrders(supabase(), r), listMyDeliveries(supabase(), "party"), listMyDisputes(supabase())]);
    if (res.error) setError(friendlyError(res.error)); else setItems((res.data as any[]) ?? []);
    setDeliveries(latestDeliveryByOrder((d.data as any[]) ?? []));
    setDisputes(ds.data);
  }
  const lastDispute = latestDisputeByOrder(disputes);
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
        <Text style={ui.h2}>{o.ref_no ? formatRef("order", o.ref_no) + " · " : ""}{formatPrice(o.total, o.currency)} · {o.protected && o.status === "completed" && o.escrow_status === "held" ? "Entregue" : ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status}{o.payment_status === "paid" ? " · ✅ Paga" : o.payment_status === "refunded" ? " · ↩️ Reembolsada" : ""}</Text>
        <Text style={ui.text}>{role === "seller" ? "Cliente" : "Vendedor"}: {o.other_name}</Text>
        <Text style={ui.muted}>{new Date(o.created_at).toLocaleString("pt-AO")} · {FULFILLMENT_LABELS[o.fulfillment_type as Fulfillment]} · {o.protected ? "🛡️ Pagamento protegido" : PAYMENT_LABELS[o.payment_method as PaymentMethod] ?? o.payment_method}</Text>
        <OrderEscrowPanel order={o} role={role} uid={uid} settings={settings} provider={provider} hasActiveDispute={!!lastDispute[o.id] && isActiveDispute(lastDispute[o.id].status)}
          onChanged={(m, bad) => { if (bad) { setError(m); setNotice(""); } else { setError(""); setNotice(m); void load(); } }} />
        {(o.items ?? []).map((it: any, i: number) => <Text key={i} style={ui.text}>• {it.quantity} × {it.name} — {formatPrice(it.line_total)}</Text>)}
        {!!o.delivery_text && <Text style={ui.text}>Entrega: {o.delivery_text}</Text>}
        {o.fulfillment_type === "delivery" && <OrderPoint orderId={o.id} canEdit={role === "buyer" && o.status !== "completed" && o.status !== "cancelled"} />}
        {!!o.buyer_note && <Text style={ui.text}>Nota: {o.buyer_note}</Text>}
        {!!deliveries[o.id] && <Text style={ui.label}>🛵 Entrega: {DELIVERY_STATUS_LABELS[deliveries[o.id].status as DeliveryStatus]}{deliveries[o.id].courier_name ? " · Estafeta: " + deliveries[o.id].courier_name : ""}</Text>}
        {!!deliveries[o.id]?.courier_phone && isActiveDelivery(deliveries[o.id].status) && <Button title={"📞 Estafeta " + deliveries[o.id].courier_phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + deliveries[o.id].courier_phone.replace(/\s/g, ""))} />}
        {role === "seller" && o.fulfillment_type === "delivery" && o.escrow_status !== "awaiting_payment" && !["completed", "cancelled"].includes(o.status) && !(deliveries[o.id] && isActiveDelivery(deliveries[o.id].status)) && <Button title="🛵 Pedir estafeta" variant="secondary" onPress={() => void run(() => requestOrderDelivery(supabase(), o.id), "Pedido enviado aos estafetas.")} />}
        {role === "seller" && !!deliveries[o.id] && ["pending", "assigned", "accepted"].includes(deliveries[o.id].status) && <Button title="Cancelar estafeta" variant="secondary" onPress={() => Alert.alert("Cancelar o pedido de estafeta?", "", [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void run(() => cancelDeliveryRequest(supabase(), deliveries[o.id].id), "Pedido de estafeta cancelado.") }])} />}
        {role === "seller" && !!o.contact_phone && <Button title={"📞 " + o.contact_phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + o.contact_phone.replace(/\s/g, ""))} />}
        {role === "seller" && next && !(o.escrow_status === "awaiting_payment" && next !== "confirmed") && <Button title={`Marcar como «${o.protected && next === "completed" ? "Entregue" : ORDER_STATUS_LABELS[next]}»`} onPress={() => void act(o.id, next)} />}
        {!!lastDispute[o.id] && <Button variant="secondary" title={"↩️ Devolução / reembolso: " + (lastDispute[o.id].status === "resolved" && lastDispute[o.id].outcome ? DISPUTE_OUTCOME_LABELS[lastDispute[o.id].outcome!] : DISPUTE_STATUS_LABELS[lastDispute[o.id].status])} onPress={() => router.push("/disputas" as any)} />}
        {role === "buyer" && canOpenDispute(o, disputes.filter(d => d.order_id === o.id)).ok && <Button variant="secondary" title="↩️ Pedir devolução ou reembolso" onPress={() => router.push({ pathname: "/disputas", params: { encomenda: o.id } } as any)} />}
        {o.status === "completed" && <Button title={role === "seller" ? "⭐ Avaliar o cliente" : "⭐ Avaliar o vendedor"} variant="secondary" onPress={() => router.push("/avaliacoes" as any)} />}
        {role === "seller" && !o.protected && o.payment_status !== "paid" && o.status !== "cancelled" && <Button title="Marcar como paga" variant="secondary" onPress={() => void act(o.id, o.status as OrderStatus, true)} />}
        {(role === "seller" ? !["completed", "cancelled"].includes(o.status) : o.status === "pending") && <Button title="Cancelar" variant="danger" onPress={() => Alert.alert("Cancelar encomenda", o.payment_status === "paid" ? (o.escrow_status === "held" ? "Esta encomenda já está paga e o dinheiro está guardado pelo Huambo Online. Se a cancelar, o Huambo Online devolve o dinheiro ao cliente." : "Esta encomenda já está paga. Se a cancelar, abre-se um pedido de reembolso e o vendedor tem de devolver o dinheiro.") : "Tem a certeza?", [{ text: "Não", style: "cancel" }, { text: "Cancelar encomenda", style: "destructive", onPress: () => void act(o.id, "cancelled") }])} />}
      </View>;
    })}
  </ScrollView>;
}
