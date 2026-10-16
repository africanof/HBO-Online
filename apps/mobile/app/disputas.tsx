import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { listMyDisputes, listOrders, openDispute, validateDispute, canOpenDispute, requestsFor, refundableAmount, formatPrice, friendlyErrorIn,
  BUYER_REASONS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS, DISPUTE_WINDOW_DAYS, isActiveDispute,
  type DisputeReason, type DisputeRequest, type MyDispute } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { DisputeCard, EvidencePicker, uploadEvidence, type Evidence } from "../components/Disputes";
import { ListingClaims } from "../components/Conformity";
import { useT } from "../lib/i18n";

function NewDispute({ order, uid, onDone, onCancel }: { order: any; uid: string; onDone: () => void; onCancel: () => void }) {
  const { t, tc, lang } = useT();
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
    const invalid = validateDispute(input, max); if (invalid) { setError(tc(invalid)); return; }
    setBusy(true); setError("");
    try {
      const paths = await uploadEvidence(order.id, uid, photos);
      const r = await openDispute(supabase(), order.id, { ...input, photos: paths });
      if (r.error) throw r.error;
      onDone();
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{t("sh.ask_return_title")}</Text>
    <Text style={ui.muted}>{t("sh.order_of_to", { price: formatPrice(order.total), name: order.other_name, items: (order.items ?? []).map((i: any) => `${i.quantity} × ${i.name}`).join(", ") })}</Text>
    <Text style={ui.label}>{t("sh.what_happened")}</Text>
    <Chips options={BUYER_REASONS.map(r => ({ value: r, label: tc(DISPUTE_REASON_LABELS[r]) }))} value={reason} onChange={setReason} />
    <Text style={ui.label}>{t("sh.what_request")}</Text>
    <Chips options={options.map(r => ({ value: r, label: tc(DISPUTE_REQUEST_LABELS[r]) }))} value={request} onChange={setRequest} />
    <Text style={ui.label}>{t("sh.explain_problem")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} accessibilityLabel={t("sh.explain_problem")} placeholder={t("sh.explain_ph")} placeholderTextColor={C.muted} />
    {request !== "replacement" && <>
      <Text style={ui.label}>{t("sh.refund_value")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel={t("sh.refund_value_a11y")} placeholder={t("sh.empty_all", { price: formatPrice(max) })} placeholderTextColor={C.muted} />
    </>}
    <EvidencePicker items={photos} onChange={setPhotos} onError={setError} />
    <Text style={ui.muted}>{t("sh.photos_private")}</Text>
    <Message error={error} />
    <Button title={busy ? t("sh.sending") : t("sh.send_to_seller")} disabled={busy} onPress={() => void send()} />
    <Button title={t("common.cancel")} variant="secondary" onPress={onCancel} />
  </View>;
}

export default function Disputas() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ encomenda?: string }>();
  const [orderId, setOrderId] = useState<string | undefined>(params.encomenda);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyDispute[]>([]); const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [filter, setFilter] = useState<"active" | "all">("active");
  useEffect(() => { setOrderId(params.encomenda); }, [params.encomenda]);
  async function load(oid = orderId) {
    const r = await listMyDisputes(supabase());
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
    if (!oid) { setOrder(null); return; }
    const o = await listOrders(supabase(), "buyer");
    const found = ((o.data as any[]) ?? []).find(x => x.id === oid) ?? null;
    if (!found) { setOrder(null); return; }
    const can = canOpenDispute(found, r.data.filter(d => d.order_id === oid));
    if (can.ok) setOrder(found); else { setOrder(null); setError(tc(can.why)); }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, [orderId]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.returns")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  const active = items.filter(d => isActiveDispute(d.status));
  const shown = filter === "active" ? active : items;
  const close = () => { setOrder(null); setOrderId(undefined); router.setParams({ encomenda: undefined } as any); };
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/encomendas" as any} style={ui.link}>{"← " + t("sh.orders")}</Link>
    <Text style={ui.h1}>{"↩️ " + t("sh.returns")}</Text>
    <Text style={ui.text}>{t("sh.window_days", { n: DISPUTE_WINDOW_DAYS })}</Text>
    <Link href={"/devolucoes" as any} style={ui.link}>{t("sh.how_it_works")}</Link>
    <Message error={error} ok={notice} />
    {order && <NewDispute order={order} uid={uid} onCancel={close} onDone={() => { close(); setNotice(t("sh.request_sent")); void load(undefined); }} />}
    <Chips options={[{ value: "active" as const, label: t("sh.open_n", { n: active.length }) }, { value: "all" as const, label: t("sh.all_n", { n: items.length }) }]} value={filter} onChange={setFilter} />
    {shown.length === 0 && <Text style={ui.text}>{filter === "active" ? t("sh.no_open_requests") : t("sh.no_requests")} {t("sh.how_to_request")}</Text>}
    {shown.map(d => <DisputeCard key={d.id} d={d} uid={uid} onChanged={msg => { setNotice(msg); setError(""); void load(); }} />)}
    <ListingClaims />
  </ScrollView>;
}
