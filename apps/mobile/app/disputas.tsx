import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { listMyDisputes, listOrders, openDispute, validateDispute, canOpenDispute, requestsFor, refundableAmount, formatPrice, friendlyError,
  BUYER_REASONS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS, DISPUTE_WINDOW_DAYS, isActiveDispute,
  type DisputeReason, type DisputeRequest, type MyDispute } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { DisputeCard, EvidencePicker, uploadEvidence, type Evidence } from "../components/Disputes";

function NewDispute({ order, uid, onDone, onCancel }: { order: any; uid: string; onDone: () => void; onCancel: () => void }) {
  const [reason, setReason] = useState<DisputeReason>("damaged");
  const [request, setRequest] = useState<DisputeRequest>("return_refund");
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState(""); const [photos, setPhotos] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const max = refundableAmount(order);
  const options = requestsFor(reason);
  useEffect(() => { if (!options.includes(request)) setRequest(options[0]); }, [reason]);
  async function send() {
    const value = amount.trim() ? Number(amount.replace(/\s/g, "").replace(",", ".")) : null;
    const input = { request, reason, description, amount: value, photos: photos.map(p => p.uri) };
    const invalid = validateDispute(input, max); if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const paths = await uploadEvidence(order.id, uid, photos);
      const r = await openDispute(supabase(), order.id, { ...input, photos: paths });
      if (r.error) throw r.error;
      onDone();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>Pedir devolução ou reembolso</Text>
    <Text style={ui.muted}>Encomenda de {formatPrice(order.total)} a {order.other_name}: {(order.items ?? []).map((i: any) => `${i.quantity} × ${i.name}`).join(", ")}</Text>
    <Text style={ui.label}>O que aconteceu?</Text>
    <Chips options={BUYER_REASONS.map(r => ({ value: r, label: DISPUTE_REASON_LABELS[r] }))} value={reason} onChange={setReason} />
    <Text style={ui.label}>O que pede?</Text>
    <Chips options={options.map(r => ({ value: r, label: DISPUTE_REQUEST_LABELS[r] }))} value={request} onChange={setRequest} />
    <Text style={ui.label}>Explique o problema</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} accessibilityLabel="Explique o problema" placeholder="Ex.: o ecrã chegou partido no canto." placeholderTextColor={C.muted} />
    {request !== "replacement" && <>
      <Text style={ui.label}>Valor a devolver (Kz)</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Valor a devolver em Kz" placeholder={"Vazio = tudo (" + formatPrice(max) + ")"} placeholderTextColor={C.muted} />
    </>}
    <EvidencePicker items={photos} onChange={setPhotos} onError={setError} />
    <Text style={ui.muted}>🔒 As fotografias ficam privadas: só o vendedor e a administração as veem.</Text>
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar pedido ao vendedor"} disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={onCancel} />
  </View>;
}

export default function Disputas() {
  const router = useRouter();
  const params = useLocalSearchParams<{ encomenda?: string }>();
  const [orderId, setOrderId] = useState<string | undefined>(params.encomenda);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyDispute[]>([]); const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [filter, setFilter] = useState<"active" | "all">("active");
  useEffect(() => { setOrderId(params.encomenda); }, [params.encomenda]);
  async function load(oid = orderId) {
    const r = await listMyDisputes(supabase());
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data);
    if (!oid) { setOrder(null); return; }
    const o = await listOrders(supabase(), "buyer");
    const found = ((o.data as any[]) ?? []).find(x => x.id === oid) ?? null;
    if (!found) { setOrder(null); return; }
    const can = canOpenDispute(found, r.data.filter(d => d.order_id === oid));
    if (can.ok) setOrder(found); else { setOrder(null); setError(can.why); }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, [orderId]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Devoluções e reembolsos</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const active = items.filter(d => isActiveDispute(d.status));
  const shown = filter === "active" ? active : items;
  const close = () => { setOrder(null); setOrderId(undefined); router.setParams({ encomenda: undefined } as any); };
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/encomendas" as any} style={ui.link}>← Encomendas</Link>
    <Text style={ui.h1}>↩️ Devoluções e reembolsos</Text>
    <Text style={ui.text}>Pode pedir até {DISPUTE_WINDOW_DAYS} dias depois da entrega.</Text>
    <Link href={"/devolucoes" as any} style={ui.link}>Como funciona →</Link>
    <Message error={error} ok={notice} />
    {order && <NewDispute order={order} uid={uid} onCancel={close} onDone={() => { close(); setNotice("Pedido enviado ao vendedor. Vai receber uma notificação a cada passo."); void load(undefined); }} />}
    <Chips options={[{ value: "active" as const, label: `Abertos (${active.length})` }, { value: "all" as const, label: `Todos (${items.length})` }]} value={filter} onChange={setFilter} />
    {shown.length === 0 && <Text style={ui.text}>{filter === "active" ? "Não tem pedidos abertos." : "Ainda não há pedidos."} Para pedir, abra «Encomendas» e escolha a encomenda.</Text>}
    {shown.map(d => <DisputeCard key={d.id} d={d} uid={uid} onChanged={msg => { setNotice(msg); setError(""); void load(); }} />)}
  </ScrollView>;
}
