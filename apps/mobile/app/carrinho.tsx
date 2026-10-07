import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { getMyCart, setCartQuantity, placeOrders, groupCartBySeller, formatPrice, friendlyError, PAYMENT_LABELS, FULFILLMENT_LABELS,
  type Fulfillment, type PaymentMethod } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

export default function Carrinho() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery"); const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [phone, setPhone] = useState(""); const [address, setAddress] = useState(""); const [note, setNote] = useState("");
  async function load() { const r = await getMyCart(supabase()); if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function qty(productId: string, q: number) { const r = await setCartQuantity(supabase(), productId, q); if (r.error) setError(friendlyError(r.error)); else await load(); }
  async function checkout() {
    if (busy) return; setError(""); setBusy(true);
    const r = await placeOrders(supabase(), { fulfillment, paymentMethod: payment, phone, deliveryText: address, note }); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); await load(); return; }
    router.replace("/encomendas?novas=1" as any);
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Link href={"/loja" as any} style={ui.link}>← Loja</Link><Text style={ui.h1}>Carrinho</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const groups = groupCartBySeller(items);
  const total = groups.reduce((s, g) => s + g.total, 0);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/loja" as any} style={ui.link}>← Loja</Link>
    <Text style={ui.h1}>Carrinho</Text>
    <Message error={error} />
    {items.length === 0 && <Text style={ui.text}>O carrinho está vazio.</Text>}
    {groups.map(g => <View key={g.sellerId} style={ui.card}>
      <Text style={ui.label}>Vendedor: {g.sellerName}</Text>
      {g.items.map((it: any) => <View key={it.product_id} style={{ gap: 6, borderTopWidth: 1, borderColor: "#eee", paddingTop: 8 }}>
        <Text style={ui.text}>{it.name} — {formatPrice(it.price, it.currency)}</Text>
        {(!it.active || it.stock < it.quantity) && <Text style={ui.error}>Stock insuficiente</Text>}
        <View style={ui.row}>
          <Button title="−" variant="secondary" onPress={() => void qty(it.product_id, it.quantity - 1)} />
          <Text style={[ui.h2, { alignSelf: "center" }]}>{it.quantity}</Text>
          <Button title="+" variant="secondary" disabled={it.quantity >= it.stock} onPress={() => void qty(it.product_id, it.quantity + 1)} />
          <Button title="Remover" variant="danger" onPress={() => void qty(it.product_id, 0)} />
        </View>
      </View>)}
      <Text style={ui.label}>Subtotal: {formatPrice(g.total)}</Text>
    </View>)}
    {items.length > 0 && <View style={ui.card}>
      <Text style={ui.h2}>Finalizar compra — {formatPrice(total)}</Text>
      {groups.length > 1 && <Text style={ui.text}>Vai criar {groups.length} encomendas, uma por vendedor.</Text>}
      <Text style={ui.label}>Receber</Text>
      <Chips options={Object.entries(FULFILLMENT_LABELS).map(([value, label]) => ({ value: value as Fulfillment, label }))} value={fulfillment} onChange={setFulfillment} />
      {fulfillment === "delivery" && <><Text style={ui.label}>Morada / referência</Text><TextInput style={ui.input} value={address} onChangeText={setAddress} placeholder="Bairro, rua, referência" /></>}
      <Text style={ui.label}>Pagamento</Text>
      <Chips options={Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value: value as PaymentMethod, label }))} value={payment} onChange={setPayment} />
      <Text style={ui.label}>Telefone para contacto</Text><TextInput style={ui.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="923 000 000" />
      <Text style={ui.label}>Nota (opcional)</Text><TextInput style={ui.input} value={note} onChangeText={setNote} />
      <Text style={ui.muted}>O pagamento é combinado com o vendedor. Ainda não há pagamentos online.</Text>
      <Button title={busy ? "A enviar…" : "Confirmar encomenda"} disabled={busy} onPress={() => void checkout()} />
    </View>}
  </ScrollView>;
}
