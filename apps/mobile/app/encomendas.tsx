import { OrderPoint } from "../components/Place";
import { TeamRequestStatus } from "../components/TeamRequestStatus";
import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { listOrdersV4, changeOrderStatus, formatPrice, friendlyErrorIn, ORDER_STATUS_LABELS, PAYMENT_LABELS, FULFILLMENT_LABELS, NEXT_SELLER_STATUS,
  listMyDeliveries, requestOrderDelivery, cancelDeliveryRequest, latestDeliveryByOrder, isActiveDelivery, DELIVERY_STATUS_LABELS,
  listMyDisputes, latestDisputeByOrder, formatRef, canOpenDispute, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, type MyDispute,
  getPlatformSettings, getProtectedSettings, isActiveDispute, type PlatformSettings,
  type OrderStatus, type PaymentMethod, type Fulfillment, type DeliveryStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { OrderEscrowPanel } from "../components/ProtectedPayment";
import { useT, formatDateTimeIn } from "../lib/i18n";

export default function Encomendas() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ novas?: string; vendas?: string; pagar?: string }>();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"buyer" | "seller">(params.vendas ? "seller" : "buyer");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState(params.pagar ? t("sh.order_made_pay") : params.novas ? t("sh.order_sent") : "");
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [provider, setProvider] = useState<"manual" | "proxypay">("manual");
  useEffect(() => { void getPlatformSettings(supabase()).then(r => setSettings(r.data)); void getProtectedSettings(supabase()).then(r => setProvider(r.data?.payment_provider ?? "manual")); }, []);
  const [deliveries, setDeliveries] = useState<Record<string, any>>({});
  const [disputes, setDisputes] = useState<MyDispute[]>([]);
  async function load(r = role) {
    const [res, d, ds] = await Promise.all([listOrdersV4(supabase(), r), listMyDeliveries(supabase(), "party"), listMyDisputes(supabase())]);
    if (res.error) setError(friendlyErrorIn(res.error, lang)); else setItems((res.data as any[]) ?? []);
    setDeliveries(latestDeliveryByOrder((d.data as any[]) ?? []));
    setDisputes(ds.data);
  }
  const lastDispute = latestDisputeByOrder(disputes);
  async function run(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); await load(); }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, [role]));
  async function act(id: string, status: OrderStatus, paid?: boolean) {
    setError(""); setNotice("");
    const r = await changeOrderStatus(supabase(), id, status, paid);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sh.order_updated")); await load(); }
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.orders")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href={"/loja" as any} style={ui.link}>{"← " + t("nav.shop")}</Link>
    <Text style={ui.h1}>{t("sh.orders")}</Text>
    <TeamRequestStatus />
    <Chips options={[{ value: "buyer" as const, label: t("sh.my_purchases") }, { value: "seller" as const, label: t("sh.my_sales") }]} value={role} onChange={v => { setRole(v); void load(v); }} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>{t("sh.no_orders")}</Text>}
    {items.map(o => {
      const next = NEXT_SELLER_STATUS[o.status as OrderStatus];
      return <View key={o.id} style={ui.card}>
        <Text style={ui.h2}>{o.ref_no ? formatRef("order", o.ref_no) + " · " : ""}{formatPrice(o.total, o.currency)} · {o.protected && o.status === "completed" && o.escrow_status === "held" ? t("sh.delivered") : tc(ORDER_STATUS_LABELS[o.status as OrderStatus] ?? o.status)}{o.payment_status === "paid" ? " · " + t("sh.paid_tag") : o.payment_status === "refunded" ? " · " + t("sh.refunded_tag") : ""}</Text>
        <Text style={ui.text}>{t(role === "seller" ? "sh.customer" : "sh.seller", { name: o.other_name })}</Text>
        {o.subtotal != null && <Text style={ui.label}>{[t("sh.dl.sum_items", { price: formatPrice(o.subtotal, o.currency) }),
          o.fulfillment_type === "delivery" ? (o.delivery_municipality_name ? t("sh.dl.order_delivery_in", { place: o.delivery_municipality_name, price: formatPrice(o.delivery_fee ?? 0, o.currency) }) : t("sh.dl.sum_delivery", { price: formatPrice(o.delivery_fee ?? 0, o.currency) })) : t("sh.dl.choice_pickup"),
          t("sh.dl.sum_total", { price: formatPrice(o.total, o.currency) })].join(" · ")}</Text>}
        <Text style={ui.muted}>{formatDateTimeIn(o.created_at, lang)} · {tc(FULFILLMENT_LABELS[o.fulfillment_type as Fulfillment] ?? "")} · {o.protected ? t("sh.protected_tag") : tc(PAYMENT_LABELS[o.payment_method as PaymentMethod] ?? o.payment_method)}</Text>
        <OrderEscrowPanel order={o} role={role} uid={uid} settings={settings} provider={provider} hasActiveDispute={!!lastDispute[o.id] && isActiveDispute(lastDispute[o.id].status)}
          onChanged={(m, bad) => { if (bad) { setError(m); setNotice(""); } else { setError(""); setNotice(m); void load(); } }} />
        {(o.items ?? []).map((it: any, i: number) => <Text key={i} style={ui.text}>• {it.quantity} × {it.name} — {formatPrice(it.line_total)}</Text>)}
        {!!o.delivery_text && <Text style={ui.text}>{t("sh.delivery_text", { text: o.delivery_text })}</Text>}
        {o.fulfillment_type === "delivery" && <OrderPoint orderId={o.id} canEdit={role === "buyer" && o.status !== "completed" && o.status !== "cancelled"} />}
        {!!o.buyer_note && <Text style={ui.text}>{t("sh.note", { text: o.buyer_note })}</Text>}
        {!!deliveries[o.id] && <Text style={ui.label}>{t("sh.delivery_status", { status: tc(DELIVERY_STATUS_LABELS[deliveries[o.id].status as DeliveryStatus] ?? "") })}{deliveries[o.id].courier_name ? " · " + t("sh.courier_name", { name: deliveries[o.id].courier_name }) : ""}</Text>}
        {!!deliveries[o.id]?.courier_phone && isActiveDelivery(deliveries[o.id].status) && <Button title={t("sh.call_courier", { phone: deliveries[o.id].courier_phone })} variant="secondary" onPress={() => void Linking.openURL("tel:" + deliveries[o.id].courier_phone.replace(/\s/g, ""))} />}
        {role === "seller" && o.fulfillment_type === "delivery" && o.escrow_status !== "awaiting_payment" && !["completed", "cancelled"].includes(o.status) && !(deliveries[o.id] && isActiveDelivery(deliveries[o.id].status)) && <Button title={t("sh.request_courier")} variant="secondary" onPress={() => void run(() => requestOrderDelivery(supabase(), o.id), t("sh.courier_requested"))} />}
        {role === "seller" && !!deliveries[o.id] && ["pending", "assigned", "accepted"].includes(deliveries[o.id].status) && <Button title={t("sh.cancel_courier")} variant="secondary" onPress={() => Alert.alert(t("sh.cancel_courier_q"), "", [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.yes"), onPress: () => void run(() => cancelDeliveryRequest(supabase(), deliveries[o.id].id), t("sh.courier_cancelled")) }])} />}
        {role === "seller" && !!o.contact_phone && <Button title={"📞 " + o.contact_phone} variant="secondary" onPress={() => void Linking.openURL("tel:" + o.contact_phone.replace(/\s/g, ""))} />}
        {role === "seller" && next && !(o.escrow_status === "awaiting_payment" && next !== "confirmed") && <Button title={t("sh.mark_as", { status: o.protected && next === "completed" ? t("sh.delivered") : tc(ORDER_STATUS_LABELS[next]) })} onPress={() => void act(o.id, next)} />}
        {!!lastDispute[o.id] && <Button variant="secondary" title={t("sh.dispute_status", { status: tc(lastDispute[o.id].status === "resolved" && lastDispute[o.id].outcome ? DISPUTE_OUTCOME_LABELS[lastDispute[o.id].outcome!] : DISPUTE_STATUS_LABELS[lastDispute[o.id].status]) })} onPress={() => router.push("/disputas" as any)} />}
        {role === "buyer" && canOpenDispute(o, disputes.filter(d => d.order_id === o.id)).ok && <Button variant="secondary" title={t("sh.ask_return")} onPress={() => router.push({ pathname: "/disputas", params: { encomenda: o.id } } as any)} />}
        {o.status === "completed" && <Button title={role === "seller" ? t("sh.rate_customer") : t("sh.rate_seller")} variant="secondary" onPress={() => router.push("/avaliacoes" as any)} />}
        {role === "seller" && !o.protected && o.payment_status !== "paid" && o.status !== "cancelled" && <Button title={t("sh.mark_paid")} variant="secondary" onPress={() => void act(o.id, o.status as OrderStatus, true)} />}
        {(role === "seller" ? !["completed", "cancelled"].includes(o.status) : o.status === "pending") && <Button title={t("common.cancel")} variant="danger" onPress={() => Alert.alert(t("sh.cancel_order"), o.payment_status === "paid" ? (o.escrow_status === "held" ? t("sh.cancel_paid_held") : t("sh.cancel_paid")) : t("sh.are_you_sure"), [{ text: t("sh.no"), style: "cancel" }, { text: t("sh.cancel_order"), style: "destructive", onPress: () => void act(o.id, "cancelled") }])} />}
      </View>;
    })}
  </ScrollView>;
}
