import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { fuelFeed, getStation, listMyStations, listStationProducts, getStationPay, saveStation, updateFuelProduct, reportFuel, listMyFuelAlerts, addFuelAlert,
  removeFuelAlert, reserveFuel, submitFuelPayment, decideFuelPayment, collectFuel, cancelFuelOrder, myFuelOrders, stationPanel, submitFuelFee, listStationsForAdmin,
  setStationStatus, listFuelPaymentsForAdmin, fuelOrderByToken, listFuelOrdersForAdmin, fuelFeeBreakdown, fuelFeeNotice, fuelVerifyUrl, fuelTransferNote, sha256Hex, decideFuelFee, getPlatformSettings, updatePlatformSettings, paymentProofUrl, uploadPaymentProof, base64ToArrayBuffer,
  fuelQuantityText, fuelPriceText, minutesAgoText, fuelIsStale, fuelStatusLine, fuelReportsText, fuelShareMessage, validateStation, validateFuelReserve, stationRef,
  fuelOrderRef, holdText, qrMatrix, formatPrice, friendlyError, whatsappShareUrl, whatsappLink, pointFrom, FUEL_PRODUCTS, FUEL_PRODUCT_LIST, FUEL_KIND_LABELS,
  FUEL_STATUS_LABELS, FUEL_QUEUE_LABELS, FUEL_METHOD_LABELS, FUEL_ORDER_STATUS_LABELS, FUEL_COLLECT_LABELS, PLAN_METHOD_LABELS,
  type FuelProduct, type FuelRow, type FuelStation, type FuelProductRow, type FuelKind, type FuelMethod, type FuelStatus, type FuelQueue, type MyFuelOrder,
  type StationPanel, type StationOrder, type FuelOrderView, type AdminFuelOrder, type FuelOrderStatus, type AdminFuelPayment, type FuelCollectResult, type PlatformSettings, type PaymentMethodPlan, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";

const ph = { placeholderTextColor: C.muted };
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;
const statusColor = (s: FuelStatus) => s === "available" ? C.green : s === "out" ? C.red : s === "low" ? C.yellowText : C.muted;
const Badge = ({ s }: { s: FuelStatus }) => <Text style={{ color: statusColor(s), fontWeight: "800", fontSize: 16 }}>{FUEL_STATUS_LABELS[s]}</Text>;
function LoginNeeded({ title }: { title: string }) {
  const router = useRouter();
  return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{title}</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
}
/** QR único do pedido: leva ao site, que confirma se é verdadeiro. */
function CodeBox({ code, token }: { code: string; token?: string | null }) {
  const m = qrMatrix(token ? fuelVerifyUrl(siteUrl, token) : code); const cell = Math.floor(190 / (m.length + 4));
  return <View style={[ui.card, { alignItems: "center" }]}>
    <View accessible accessibilityLabel={"Código QR " + code} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8 }}>
      {m.map((row, y) => <View key={y} style={{ flexDirection: "row" }}>{row.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#000" : "#fff" }} />)}</View>)}
    </View>
    <Text selectable style={[ui.h2, { letterSpacing: 3 }]}>{code}</Text>
    <Text style={ui.muted}>Mostre este QR no posto. O posto lê com a câmara e o site confirma que é verdadeiro.</Text>
  </View>;
}
async function openProof(path: string, onError: (m: string) => void) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) void Linking.openURL(r.data); else onError("Não foi possível abrir o comprovativo.");
}
type Proof = { uri: string; base64?: string | null; mimeType: string };
async function pickProof(camera: boolean, onError: (m: string) => void): Promise<Proof | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { onError(camera ? "Autorize a câmara." : "Autorize o acesso à galeria."); return null; }
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
async function proofBytes(p: Proof) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }

export function FuelListScreen() {
  const router = useRouter(); const { municipalities } = useTerritory();
  const [product, setProduct] = useState<FuelProduct | "">(""); const [municipalityId, setMunicipalityId] = useState("");
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; product: FuelProduct; municipality_id: string | null }[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  useEffect(() => { void fuelFeed(supabase(), { product, municipalityId }).then(r => { if (r.error) setError(friendlyError(r.error)); else { setError(""); setRows(r.data); } }); }, [product, municipalityId]);
  useFocusEffect(useCallback(() => { void currentUserId().then(async u => { setUid(u); if (u) setAlerts((await listMyFuelAlerts(supabase())).data); }); }, []));
  const alert = product ? alerts.find(a => a.product === product && (a.municipality_id ?? "") === municipalityId) : undefined;
  async function toggleAlert() {
    if (!uid) { router.push("/login"); return; }
    if (!product) return;
    const r = alert ? await removeFuelAlert(supabase(), alert.id) : await addFuelAlert(supabase(), uid, product, municipalityId || null);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice(alert ? "Aviso desligado." : `Pronto! Avisamos quando houver ${FUEL_PRODUCTS[product].label.toLowerCase()}.`);
    setAlerts((await listMyFuelAlerts(supabase())).data);
  }
  const has = rows?.filter(r => r.status === "available" || r.status === "low").length ?? 0;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>⛽ Combustível e gás</Text>
    <Text style={ui.muted}>Veja onde há gasolina, gasóleo, petróleo e gás agora. Os postos marcam quando há, e quem passa confirma.</Text>
    <View style={ui.row}><Link href={"/combustivel/pedidos" as any} style={ui.link}>🧾 As minhas reservas</Link><Text style={ui.muted}> · </Text><Link href={"/combustivel/meus" as any} style={ui.link}>⛽ Tenho um posto</Link></View>
    <Chips options={[{ value: "all", label: "Todos" }, ...FUEL_PRODUCT_LIST.map(p => ({ value: p, label: `${FUEL_PRODUCTS[p].icon} ${FUEL_PRODUCTS[p].short}` }))]} value={product || "all"} onChange={v => setProduct(v === "all" ? "" : v as FuelProduct)} />
    {municipalities.length > 0 && <Chips options={[{ value: "all", label: "Todos os municípios" }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId || "all"} onChange={v => setMunicipalityId(v === "all" ? "" : v)} />}
    {!!product && <Button title={alert ? "🔕 Desligar aviso" : `🔔 Avisar-me quando houver ${FUEL_PRODUCTS[product].short.toLowerCase()}`} variant={alert ? "secondary" : "primary"} onPress={() => void toggleAlert()} />}
    <Message error={error} ok={notice} />
    {rows !== null && <Text style={ui.label}>{has ? `🟢 ${has} ${has === 1 ? "sítio com" : "sítios com"} ${product ? FUEL_PRODUCTS[product].label.toLowerCase() : "combustível ou gás"} agora` : "🔴 Neste momento ninguém marcou que há. Peça um aviso!"}</Text>}
    {rows === null ? <Text style={ui.text}>A carregar…</Text> : rows.length === 0 ? <Text style={ui.text}>Ainda não há postos registados aqui.</Text> :
      rows.map(r => <Pressable key={r.product_id} accessibilityRole="link" onPress={() => router.push(("/combustivel/" + r.station_id) as any)} style={ui.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={[ui.label, { flex: 1, fontSize: 18 }]}>{FUEL_PRODUCTS[r.product].icon} {FUEL_PRODUCTS[r.product].label}</Text><Badge s={r.status} /></View>
        <Text style={ui.text}>{r.station_name}{r.municipality_name ? " · " + r.municipality_name : ""}</Text>
        <Text style={ui.muted}>{fuelStatusLine(r)}{fuelIsStale(r.status_at) && r.status !== "unknown" ? " · ⚠️ pode ter mudado" : ""}</Text>
        {r.price != null && <Text style={ui.price}>{fuelPriceText(r.product, r.price)}</Text>}
        {(r.yes_2h > 0 || r.no_2h > 0) && <Text style={ui.muted}>{fuelReportsText(r.yes_2h, r.no_2h)}</Text>}
        {r.accepts_reservations && r.reservable_left > 0 && (r.status === "available" || r.status === "low") && <Text style={ui.ok}>🧾 Pode reservar ({fuelQuantityText(r.product, r.reservable_left)})</Text>}
      </Pressable>)}
  </ScrollView>;
}

export function StationScreen({ id }: { id: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [st, setSt] = useState<FuelStation | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const [a, b] = await Promise.all([fuelFeed(supabase(), { stationId: id }), getStation(supabase(), id)]); setRows(a.data); setSt(b.data); }
  useFocusEffect(useCallback(() => { void load(); void currentUserId().then(setUid); }, [id]));
  if (rows === null) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!st) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Posto não encontrado</Text><Link href={"/combustivel" as any} style={ui.link}>← Combustível e gás</Link></ScrollView>;
  const mine = uid === st.owner_id; const first = rows[0]; const wa = whatsappLink(st.whatsapp, `Olá, vi o ${st.name} no Huambo Online.`);
  async function report(r: FuelRow, has: boolean) {
    if (!uid) { router.push("/login"); return; }
    const x = await reportFuel(supabase(), r.product_id, has);
    if (x.error) { setError(friendlyError(x.error)); setNotice(""); } else { setError(""); setNotice("Obrigado! A sua informação ajuda outras pessoas."); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/combustivel" as any} style={ui.link}>← Combustível e gás</Link>
    <Text style={ui.h1}>{st.name}</Text>
    <Text style={ui.muted}>{FUEL_KIND_LABELS[st.kind]} · {stationRef(st.ref_no)}{first?.municipality_name ? " · " + first.municipality_name : ""}</Text>
    {st.status !== "approved" && <Text style={ui.error}>{st.status === "pending" ? "⏳ À espera de aprovação: ainda não aparece ao público." : "⛔ Suspenso" + (st.admin_note ? ": " + st.admin_note : "")}</Text>}
    {mine && <><Button title="⚙️ Gerir o posto" onPress={() => router.push(`/combustivel/${id}/gerir` as any)} /><Button title="✏️ Editar" variant="secondary" onPress={() => router.push(`/combustivel/${id}/editar` as any)} /></>}
    {(!!st.address || !!st.opening_hours) && <Text style={ui.text}>{st.address}{st.address && st.opening_hours ? " · " : ""}{st.opening_hours ? "🕒 " + st.opening_hours : ""}</Text>}
    <View style={ui.row}>
      {!!st.phone && <Button title="📞 Ligar" variant="secondary" onPress={() => void Linking.openURL("tel:" + st.phone)} />}
      {!!wa && <Button title="WhatsApp" variant="secondary" onPress={() => void Linking.openURL(wa)} />}
      {!!first && <Button title="📲 Partilhar" variant="secondary" onPress={() => void Share.share({ message: fuelShareMessage(siteUrl, first) })} />}
    </View>
    <Message error={error} ok={notice} />
    {rows.map(r => <View key={r.product_id} style={ui.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={[ui.h2, { flex: 1 }]}>{FUEL_PRODUCTS[r.product].icon} {FUEL_PRODUCTS[r.product].label}</Text><Badge s={r.status} /></View>
      <Text style={ui.text}>{fuelStatusLine(r)}{fuelIsStale(r.status_at) && r.status !== "unknown" ? " · ⚠️ pode ter mudado" : ""}</Text>
      <Text style={ui.price}>{fuelPriceText(r.product, r.price)}</Text>
      {!!r.note && <Text style={ui.text}>{r.note}</Text>}
      {(r.yes_2h > 0 || r.no_2h > 0) && <Text style={ui.muted}>{fuelReportsText(r.yes_2h, r.no_2h)}</Text>}
      {!mine && <><Text style={ui.label}>Passou por aqui?</Text><View style={ui.row}>
        <Button title="👍 Há" variant="secondary" onPress={() => void report(r, true)} /><Button title="👎 Já acabou" variant="secondary" onPress={() => void report(r, false)} /></View></>}
      {!mine && r.accepts_reservations && (r.status === "available" || r.status === "low") && r.reservable_left > 0 && r.price != null && (open === r.product_id
        ? <ReserveForm r={r} uid={uid} onClose={() => setOpen(null)} />
        : <Button title={`🧾 Reservar (${fuelQuantityText(r.product, r.reservable_left)} disponíveis)`} onPress={() => setOpen(r.product_id)} />)}
    </View>)}
    <PlaceView directions={st.directions} lat={st.geo_lat} lng={st.geo_lng} />
    <Text style={ui.muted}>A informação é dada pelo posto e por quem passa. Antes de uma viagem longa, ligue para o posto.</Text>
  </ScrollView>;
}

function ReserveForm({ r, uid, onClose }: { r: FuelRow; uid: string | null; onClose: () => void }) {
  const router = useRouter(); const gas = FUEL_PRODUCTS[r.product].gas;
  const [method, setMethod] = useState<FuelMethod>("at_station"); const [qty, setQty] = useState(gas ? "1" : "20"); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [feePct, setFeePct] = useState<number | null>(null); const [agree, setAgree] = useState(false);
  useEffect(() => { void getPlatformSettings(supabase()).then(s => setFeePct(Number(s.data?.fuel_fee_pct ?? 10))); }, []);
  if (!uid) return <Button title="Entrar para reservar" onPress={() => router.push("/login")} />;
  const q = Number(qty.replace(",", "."));
  const sum = q > 0 && r.price != null && feePct != null ? fuelFeeBreakdown(r.price, q, feePct) : null;
  async function send() {
    const bad = validateFuelReserve(r, q, name); if (bad) { setError(bad); return; }
    if (!agree) { setError("Confirme que percebeu a taxa de serviço do APP."); return; }
    setBusy(true); setError("");
    const x = await reserveFuel(supabase(), r.product_id, q, method, name, phone, plate); setBusy(false);
    if (x.error) setError(friendlyError(x.error)); else router.push("/combustivel/pedidos" as any);
  }
  return <View style={[ui.card, { gap: 8 }]}>
    {r.accepts_prepay && <Chips options={(["at_station", "prepaid"] as FuelMethod[]).map(m => ({ value: m, label: FUEL_METHOD_LABELS[m] }))} value={method} onChange={setMethod} />}
    <Field label={gas ? "Quantas botijas?" : "Quantos litros?"} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
    <Text style={ui.muted}>Máximo por pessoa: {fuelQuantityText(r.product, r.max_per_order)}.</Text>
    <Field label="O seu nome" value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
    <Field label="Telefone (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
    {!gas && <Field label="Matrícula (opcional)" value={plate} onChangeText={setPlate} maxLength={20} autoCapitalize="characters" placeholder="LD-12-34-AB" />}
    {!!sum && <View style={ui.card}>
      <Text style={ui.text}>{FUEL_PRODUCTS[r.product].label}: {formatPrice(sum.subtotal)}</Text>
      <Text style={ui.text}>Taxa de serviço do APP ({feePct}%): {formatPrice(sum.fee)}</Text>
      <Text style={ui.label}>Total a pagar ao posto: {formatPrice(sum.total)}</Text>
    </View>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agree }} onPress={() => setAgree(!agree)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 48 }}>
      <Text style={{ fontSize: 24, color: C.ink }}>{agree ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{fuelFeeNotice(feePct)} Percebi e aceito.</Text>
    </Pressable>
    <Text style={ui.muted}>{method === "at_station" ? `Recebe já um QR único. Vá ao posto em até ${Math.round(r.hold_minutes / 60 * 10) / 10} h, mostre o QR e pague lá.` : "Depois de reservar, paga para a conta do posto e envia a fotografia do comprovativo. Recebe logo um QR único; o posto confirma o pagamento."}</Text>
    <Message error={error} />
    <Button title={busy ? "A reservar…" : "✅ Reservar"} disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={onClose} />
  </View>;
}

export function MyFuelOrdersScreen() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyFuelOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myFuelOrders(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="🧾 As minhas reservas" />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/combustivel" as any} style={ui.link}>← Combustível e gás</Link>
    <Text style={ui.h1}>🧾 As minhas reservas</Text>
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não fez reservas.</Text> :
      items.map(o => <OrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </ScrollView>;
}
function OrderCard({ o, onDone, onError }: { o: MyFuelOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  async function pay() {
    if (!proof) { onError("Junte a fotografia do comprovativo de pagamento."); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError("Escreva a referência ou o número da operação (como está no comprovativo)."); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error("Entre na sua conta.");
      const body = await proofBytes(proof); const hash = sha256Hex(body);
      const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo.");
      const r = await submitFuelPayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone("Comprovativo enviado. O seu QR já está pronto; o posto vai confirmar o pagamento.");
    } catch (e) { onError(friendlyError(e)); } finally { setBusy(false); }
  }
  async function cancel() { const r = await cancelFuelOrder(supabase(), o.id); if (r.error) onError(friendlyError(r.error)); else onDone("Reserva cancelada."); }
  return <View style={ui.card}>
    <Pressable accessibilityRole="link" onPress={() => router.push(("/combustivel/" + o.station_id) as any)}><Text style={[ui.link, { fontSize: 19 }]}>{FUEL_PRODUCTS[o.product].icon} {o.station_name}</Text></Pressable>
    <Text style={ui.muted}>{fuelOrderRef(o.ref_no)} · {FUEL_PRODUCTS[o.product].label} · {fuelQuantityText(o.product, o.quantity)}{o.plate ? " · " + o.plate : ""}</Text>
    <Text style={ui.label}>{formatPrice(o.total)}</Text>
    {o.fee_amount > 0 && <Text style={ui.muted}>{formatPrice(o.subtotal)} + {formatPrice(o.fee_amount)} de taxa do APP</Text>}
    <Text style={ui.text}>{FUEL_ORDER_STATUS_LABELS[o.status]}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · levantar " + holdText(o.hold_until) : ""}</Text>
    {!!o.note && (o.status === "rejected" || o.status === "cancelled") && <Text style={ui.error}>Motivo: {o.note}</Text>}
    {!!o.code && (o.status === "reserved" || o.status === "paid" || o.status === "submitted") && <CodeBox code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <Text style={ui.muted}>O posto está a confirmar o pagamento na conta dele. Pode ir ao posto: lá verificam o QR e o comprovativo.</Text>}
    {o.status === "awaiting_payment" && <>
      <Text style={ui.label}>1. Pague {formatPrice(o.total)} ao posto{o.pay_by ? " " + holdText(o.pay_by) : ""}</Text>
      <View style={ui.card}>
        {!!o.pay_holder && <Text style={ui.text}>Titular: <Text style={ui.label}>{o.pay_holder}</Text></Text>}
        {!!o.pay_iban && <Text selectable style={ui.text}>IBAN: <Text style={ui.label}>{o.pay_iban}</Text></Text>}
        {!!o.pay_express && <Text selectable style={ui.text}>Multicaixa Express: <Text style={ui.label}>{o.pay_express}</Text></Text>}
        {!!o.pay_note && <Text style={ui.muted}>{o.pay_note}</Text>}
      </View>
      <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12, gap: 4 }}>
        <Text style={ui.label}>✍️ {fuelTransferNote(o.ref_no)}</Text>
        <Text style={ui.text}>⚠️ Pague só para a conta do posto mostrada aqui. Nunca pague a quem lhe ligar a pedir outra conta.</Text>
      </View>
      <Text style={ui.label}>2. Envie o comprovativo</Text>
      <Chips options={(["multicaixa_express", "bank_transfer"] as const).map(m => ({ value: m, label: PLAN_METHOD_LABELS[m] }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Trocar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pickProof(true, onError).then(setProof)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pickProof(false, onError).then(setProof)} /></View>}
      <Button title={busy ? "A enviar…" : "✅ Já paguei — enviar comprovativo"} disabled={busy} onPress={() => void pay()} />
    </>}
    {(o.status === "reserved" || o.status === "awaiting_payment") && <Button title="Cancelar reserva" variant="secondary" onPress={() => Alert.alert("Cancelar esta reserva?", "", [{ text: "Não", style: "cancel" }, { text: "Cancelar", onPress: () => void cancel() }])} />}
  </View>;
}

export function MyStationsScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<FuelStation[] | null>(null);
  useFocusEffect(useCallback(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyStations(supabase(), u)).data); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="⛽ Tenho um posto" />;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href={"/combustivel" as any} style={ui.link}>← Combustível e gás</Link>
    <Text style={ui.h1}>⛽ Os meus postos</Text>
    <Button title="➕ Registar posto" onPress={() => router.push("/combustivel/registar" as any)} />
    <Text style={ui.muted}>Registar e marcar quando há é grátis. Nas reservas, o cliente paga ao posto o combustível mais a taxa do APP; o posto entrega essa taxa ao Huambo Online.</Text>
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não registou nenhum posto.</Text> :
      items.map(s => <Pressable key={s.id} accessibilityRole="link" onPress={() => router.push(`/combustivel/${s.id}/gerir` as any)} style={ui.card}>
        <Text style={ui.label}>{s.name}</Text>
        <Text style={ui.muted}>{stationRef(s.ref_no)} · {FUEL_KIND_LABELS[s.kind]} · {s.status === "approved" ? "✅ Aprovado" : s.status === "pending" ? "⏳ À espera de aprovação" : "⛔ Suspenso"}</Text>
      </Pressable>)}
  </ScrollView>;
}

export function StationFormScreen({ id }: { id?: string }) {
  const router = useRouter(); const { municipalities } = useTerritory();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState(""); const [kind, setKind] = useState<FuelKind>("fuel"); const [municipalityId, setMunicipalityId] = useState(""); const [address, setAddress] = useState("");
  const [directions, setDirections] = useState(""); const [point, setPoint] = useState<GeoPoint | null>(null); const [phone, setPhone] = useState(""); const [whatsapp, setWhatsapp] = useState("");
  const [hours, setHours] = useState(""); const [reserv, setReserv] = useState(true); const [prepay, setPrepay] = useState(false); const [hold, setHold] = useState("120");
  const [pay, setPay] = useState({ holder: "", iban: "", express: "", note: "" }); const [products, setProducts] = useState<FuelProduct[]>(["gasolina", "gasoleo"]);
  const [existing, setExisting] = useState<FuelProductRow[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loaded, setLoaded] = useState(!id);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => { if (!id) return; void (async () => {
    const [a, b, c] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), getStationPay(supabase(), id)]);
    const s = a.data; if (!s) { setError("Posto não encontrado."); return; }
    setName(s.name); setKind(s.kind); setMunicipalityId(s.municipality_id ?? ""); setAddress(s.address ?? ""); setDirections(s.directions ?? ""); setPoint(pointFrom(s.geo_lat, s.geo_lng));
    setPhone(s.phone ?? ""); setWhatsapp(s.whatsapp ?? ""); setHours(s.opening_hours ?? ""); setReserv(s.accepts_reservations); setPrepay(s.accepts_prepay); setHold(String(s.hold_minutes));
    setPay(c); setExisting(b.data); setProducts(b.data.map(p => p.product)); setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <View style={ui.screen}><Text style={ui.text}>{error || "A carregar…"}</Text></View>;
  if (!uid) return <LoginNeeded title="⛽ Registar posto" />;
  const input = { name, kind, municipalityId, address, directions, point, phone, whatsapp, openingHours: hours, acceptsReservations: reserv, acceptsPrepay: prepay, holdMinutes: Number(hold), pay, products };
  const allowed = FUEL_PRODUCT_LIST.filter(p => kind === "both" || (kind === "gas") === FUEL_PRODUCTS[p].gas);
  async function save() {
    const bad = validateStation(input); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    const r = await saveStation(supabase(), uid!, input, id, existing); setBusy(false);
    if (r.error || !r.data) setError(friendlyError(r.error)); else router.replace(`/combustivel/${r.data.id}/gerir` as any);
  }
  const toggle = (p: FuelProduct) => setProducts(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{id ? "✏️ Editar posto" : "⛽ Registar posto"}</Text>
    {!id && <Text style={ui.muted}>A administração confirma o posto antes de aparecer ao público (para evitar postos falsos).</Text>}
    <Field label="Nome" value={name} onChangeText={setName} maxLength={100} placeholder="Ex.: Posto Sonangol do Kapango" />
    <Text style={ui.label}>O que vende</Text>
    <Chips options={(Object.keys(FUEL_KIND_LABELS) as FuelKind[]).map(k => ({ value: k, label: FUEL_KIND_LABELS[k] }))} value={kind}
      onChange={k => { setKind(k); setProducts(ps => ps.filter(p => k === "both" || (k === "gas") === FUEL_PRODUCTS[p].gas)); }} />
    <Text style={ui.label}>Produtos</Text>
    {allowed.map(p => <Pressable key={p} accessibilityRole="checkbox" accessibilityState={{ checked: products.includes(p) }} onPress={() => toggle(p)} style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "center" }]}>
      <Text style={{ fontSize: 22, color: C.ink }}>{products.includes(p) ? "☑" : "☐"}</Text><Text style={ui.text}>{FUEL_PRODUCTS[p].icon} {FUEL_PRODUCTS[p].label}</Text>
    </Pressable>)}
    {municipalities.length > 0 && <><Text style={ui.label}>Município</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /></>}
    <Field label="Endereço (opcional)" value={address} onChangeText={setAddress} maxLength={200} />
    <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint="Marque a entrada do posto para as pessoas chegarem sem se perderem." />
    <Field label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
    <Field label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" maxLength={20} />
    <Field label="Horário (opcional)" value={hours} onChangeText={setHours} maxLength={120} placeholder="Ex.: Todos os dias, 6h–22h" />
    <View style={ui.card}>
      <Text style={ui.h2}>🧾 Reservas</Text>
      <Button title={reserv ? "✅ Aceito reservas (paga no posto)" : "⬜ Não aceito reservas"} variant="secondary" onPress={() => setReserv(!reserv)} />
      <Button title={prepay ? "✅ Aceito pagamento adiantado" : "⬜ Sem pagamento adiantado"} variant="secondary" onPress={() => setPrepay(!prepay)} />
      <Field label="Tempo para levantar (minutos)" value={hold} onChangeText={setHold} keyboardType="numeric" />
      {prepay && <>
        <Field label="Titular da conta" value={pay.holder} onChangeText={v => setPay({ ...pay, holder: v })} maxLength={80} />
        <Field label="IBAN" value={pay.iban} onChangeText={v => setPay({ ...pay, iban: v })} maxLength={40} autoCapitalize="characters" placeholder="AO06 …" />
        <Field label="Multicaixa Express" value={pay.express} onChangeText={v => setPay({ ...pay, express: v })} keyboardType="phone-pad" maxLength={20} />
        <Field label="Nota para quem paga (opcional)" value={pay.note} onChangeText={v => setPay({ ...pay, note: v })} maxLength={200} />
      </>}
    </View>
    <Message error={error} />
    <Button title={busy ? "A gravar…" : id ? "Guardar" : "✅ Registar posto"} disabled={busy} onPress={() => void save()} />
  </ScrollView>;
}

function ProductControl({ p, onSaved, onError }: { p: FuelProductRow; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [price, setPrice] = useState(p.price == null ? "" : String(p.price)); const [qty, setQty] = useState(String(p.reservable_qty)); const [max, setMax] = useState(String(p.max_per_order));
  const [queue, setQueue] = useState<FuelQueue | "">(p.queue ?? ""); const [note, setNote] = useState(p.note ?? ""); const [busy, setBusy] = useState(false);
  async function save(status?: FuelStatus) {
    setBusy(true);
    const r = await updateFuelProduct(supabase(), p.id, { ...(status ? { status } : {}), price: price.trim() ? Number(price.replace(/\s/g, "").replace(",", ".")) : null,
      reservable_qty: Number(qty.replace(",", ".")) || 0, max_per_order: Number(max.replace(",", ".")) || 1, queue: queue || null, note: note.trim() || null });
    setBusy(false);
    if (r.error) onError(friendlyError(r.error)); else onSaved(status ? `${FUEL_PRODUCTS[p.product].label}: ${FUEL_STATUS_LABELS[status]}` : "Guardado.");
  }
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={[ui.h2, { flex: 1 }]}>{FUEL_PRODUCTS[p.product].icon} {FUEL_PRODUCTS[p.product].label}</Text><Badge s={p.status} /></View>
    <Text style={ui.muted}>Atualizado {minutesAgoText(p.status_at)}</Text>
    <Button title="🟢 Há" disabled={busy} onPress={() => void save("available")} />
    <Button title="🟡 A acabar" variant="secondary" disabled={busy} onPress={() => void save("low")} />
    <Button title="🔴 Esgotou" variant="danger" disabled={busy} onPress={() => void save("out")} />
    <Field label={`Preço (Kz/${FUEL_PRODUCTS[p.product].unit})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
    <Field label={`Para reservas (${FUEL_PRODUCTS[p.product].gas ? "botijas" : "litros"})`} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
    <Field label="Máximo por pessoa" value={max} onChangeText={setMax} keyboardType="decimal-pad" />
    <Text style={ui.label}>Fila</Text>
    <Chips options={(Object.keys(FUEL_QUEUE_LABELS) as FuelQueue[]).map(q => ({ value: q, label: FUEL_QUEUE_LABELS[q] }))} value={queue} onChange={q => setQueue(queue === q ? "" : q)} />
    <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={160} placeholder="Ex.: Só até às 18h" />
    <Button title="💾 Guardar preço e quantidades" variant="secondary" disabled={busy} onPress={() => void save()} />
  </View>;
}

export function StationManageScreen({ id }: { id: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [st, setSt] = useState<FuelStation | null>(null); const [products, setProducts] = useState<FuelProductRow[]>([]);
  const [panel, setPanel] = useState<StationPanel | null>(null); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [code, setCode] = useState(""); const [check, setCheck] = useState<FuelCollectResult | null>(null); const [payOpen, setPayOpen] = useState(false);
  const [reason, setReason] = useState(""); const [reject, setReject] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c, s] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), stationPanel(supabase(), id), getPlatformSettings(supabase())]);
    setSt(a.data); setProducts(b.data); setSettings(s.data); if (c.error) setError(friendlyError(c.error)); else setPanel(c.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="⚙️ Gerir posto" />;
  if (!st || !panel) return <ScrollView contentContainerStyle={ui.screen}><Message error={error} />{!error && <Text style={ui.text}>A carregar…</Text>}</ScrollView>;
  const done = (m: string) => { setNotice(m); setError(""); setReject(null); setReason(""); void load(); };
  async function doCheck() {
    if (!code.trim()) return; setCheck(null);
    const r = await collectFuel(supabase(), id, code);
    if (r.error) setError(friendlyError(r.error)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: StationOrder, ok: boolean) {
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideFuelPayment(supabase(), o.id, ok, reason); if (r.error) setError(friendlyError(r.error)); else done(ok ? "Pagamento confirmado: o cliente recebeu o código." : "Pagamento recusado.");
  }
  async function cancel(o: StationOrder) {
    if (!reason.trim()) { setError("Escreva porque cancela."); return; }
    const r = await cancelFuelOrder(supabase(), o.id, reason); if (r.error) setError(friendlyError(r.error)); else done("Reserva cancelada. Se o cliente já pagou, devolva o dinheiro.");
  }
  const waiting = panel.orders.filter(o => o.status === "submitted"); const active = panel.orders.filter(o => o.status === "reserved" || o.status === "paid" || o.status === "awaiting_payment");
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder="Motivo (o cliente vai ler)" accessibilityLabel="Motivo" {...ph} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/combustivel/meus" as any} style={ui.link}>← Os meus postos</Link>
    <Text style={ui.h1}>⚙️ {st.name}</Text>
    <Text style={ui.muted}>{stationRef(st.ref_no)} · {st.status === "approved" ? "✅ Aprovado" : st.status === "pending" ? "⏳ À espera de aprovação" : "⛔ Suspenso" + (st.admin_note ? ": " + st.admin_note : "")}</Text>
    <Button title="👁️ Ver a página" variant="secondary" onPress={() => router.push(`/combustivel/${id}` as any)} />
    <Button title="✏️ Editar" variant="secondary" onPress={() => router.push(`/combustivel/${id}/editar` as any)} />
    <Message error={error} ok={notice} />
    {(st.accepts_reservations || active.length > 0) && <View style={ui.card}>
      <Text style={ui.h2}>🧾 Cliente com QR ou código</Text>
      <Text style={ui.muted}>Leia o QR do cliente com a câmara do telemóvel: abre a página que confirma se é verdadeiro e mostra o comprovativo. Ou escreva o código.</Text>
      <TextInput style={[ui.input, { fontSize: 22, letterSpacing: 2 }]} value={code} onChangeText={setCode} onSubmitEditing={() => void doCheck()} placeholder="CB-XXXXXX" autoCapitalize="characters" accessibilityLabel="Código da reserva" {...ph} />
      <Button title="Validar" onPress={() => void doCheck()} />
      {!!check && <Text accessibilityLiveRegion="polite" style={[check.result === "ok" ? ui.ok : ui.error, { fontSize: 19 }]}>{FUEL_COLLECT_LABELS[check.result] ?? check.result}
        {check.result === "ok" && check.product ? ` · ${fuelQuantityText(check.product, Number(check.quantity))} · ${check.buyer}${check.plate ? " · " + check.plate : ""} · ${check.method === "prepaid" ? "JÁ PAGO" : "cobrar " + formatPrice(Number(check.total)) + " (inclui taxa do APP " + formatPrice(Number(check.fee ?? 0)) + ")"}` : check.buyer ? " · " + check.buyer : ""}</Text>}
    </View>}
    <Text style={ui.h2}>Há ou não há?</Text>
    <Text style={ui.muted}>Carregue num botão sempre que mudar. Quem pediu aviso recebe logo uma notificação quando marcar «Há».</Text>
    {products.map(p => <ProductControl key={p.id} p={p} onSaved={done} onError={setError} />)}
    {waiting.length > 0 && <Text style={ui.h2}>💳 Pagamentos por confirmar ({waiting.length})</Text>}
    {waiting.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{o.buyer_name} — {fuelQuantityText(o.product, o.quantity)} = {formatPrice(o.total)}</Text>
      <Text style={ui.muted}>{fuelOrderRef(o.ref_no)} · Ref.: {o.reference}{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</Text>
      <Text style={ui.text}>Veja na conta do posto se entrou {formatPrice(o.total)} com o descritivo {fuelOrderRef(o.ref_no)}. Inclui {formatPrice(o.fee_amount)} de taxa do APP.</Text>
      {!!o.proof_path && <Button title="📄 Ver comprovativo" variant="secondary" onPress={() => void openProof(o.proof_path!, setError)} />}
      {reject === o.id ? <>{reasonBox}<Button title="❌ Não recebi" variant="danger" onPress={() => void decide(o, false)} /><Button title="Voltar" variant="secondary" onPress={() => setReject(null)} /></>
        : <><Button title="✅ Recebi o dinheiro" onPress={() => Alert.alert("Confirmar pagamento", `Recebeu ${formatPrice(o.total)} de ${o.buyer_name}?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void decide(o, true) }])} />
          <Button title="❌ Não recebi" variant="secondary" onPress={() => { setReject(o.id); setReason(""); }} /></>}
    </View>)}
    {active.length > 0 && <View style={ui.card}><Text style={ui.label}>🧾 Reservas ativas ({active.length})</Text>
      {active.map(o => <View key={o.id} style={{ gap: 4, paddingVertical: 6 }}>
        <Text style={ui.text}>{fuelOrderRef(o.ref_no)} · {o.buyer_name} · {fuelQuantityText(o.product, o.quantity)}{o.hold_until ? " · " + holdText(o.hold_until) : ""}</Text>
        {reject === "c" + o.id ? <>{reasonBox}<Button title="Cancelar a reserva" variant="danger" onPress={() => void cancel(o)} /></> : <Button title="Cancelar" variant="secondary" onPress={() => { setReject("c" + o.id); setReason(""); }} />}
      </View>)}</View>}
    <View style={ui.card}>
      <Text style={ui.text}>Levantado hoje: <Text style={ui.label}>{formatPrice(panel.collected_today)}</Text> · Total: <Text style={ui.label}>{formatPrice(panel.collected_total)}</Text></Text>
    </View>
    <View style={ui.card}>
      <Text style={ui.h2}>🧾 Taxa do Huambo Online ({panel.fee_pct}%, já paga pelos clientes)</Text>
      <Text style={ui.muted}>Os clientes pagam ao posto o combustível mais a taxa do APP. Depois de levantarem, o posto entrega a taxa ao Huambo Online.</Text>
      <Text style={ui.text}>Total: {formatPrice(panel.fee_total)} · Por pagar: <Text style={ui.label}>{formatPrice(panel.fee_due)}</Text></Text>
      {panel.fee_overdue && <Text style={ui.error}>Taxa do APP em atraso: as reservas estão paradas até entregar.</Text>}
      {panel.fee_pending && <Text style={ui.text}>⏳ Pagamento enviado, à espera de confirmação.</Text>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <FeePayBox stationId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <Button title="Entregar a taxa do APP" onPress={() => setPayOpen(true)} />)}
      <Text style={ui.muted}>Pague até 7 dias depois do levantamento. Marcar «Há» e registar o posto é sempre grátis.</Text>
    </View>
  </ScrollView>;
}

function FeePayBox({ stationId, uid, amount, settings, onDone, onClose }: { stationId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function pick(camera: boolean) { const p = await pickProof(camera, setError); if (p) setProof(p); }
  async function send() {
    if (!reference.trim() && !proof) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const body = await proofBytes(proof); const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data; }
      const r = await submitFuelFee(supabase(), stationId, { method, reference, proofPath: path }); if (r.error) throw r.error;
      onDone("Pagamento da taxa enviado. A administração vai confirmar.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.label}>Valor a pagar: {formatPrice(amount)}</Text>
    <Text style={ui.label}>1. Pague ao Huambo Online para estes dados</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>2. Diga-nos como pagou</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pick(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pick(false)} /></View>}
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar pagamento"} disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={onClose} />
  </View>;
}

export function AdminFuel() {
  const router = useRouter();
  const [stations, setStations] = useState<(FuelStation & { municipalities?: { name: string } | null })[]>([]); const [status, setStatus] = useState<"pending" | "approved" | "suspended">("pending");
  const [payments, setPayments] = useState<AdminFuelPayment[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reason, setReason] = useState(""); const [open, setOpen] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<FuelOrderStatus | "all">("submitted"); const [orders, setOrders] = useState<AdminFuelOrder[]>([]);
  async function load() {
    const [a, b, c, d] = await Promise.all([listStationsForAdmin(supabase(), status), listFuelPaymentsForAdmin(supabase(), "pending"), getPlatformSettings(supabase()),
      listFuelOrdersForAdmin(supabase(), orderStatus === "all" ? "" : orderStatus)]);
    setStations(a.data); setPayments(b.data); setS(c.data); setOrders(d.data); if (a.error || b.error || d.error) setError(friendlyError(a.error ?? b.error ?? d.error));
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: FuelStation, to: "approved" | "suspended") {
    if (to === "suspended" && !reason.trim()) { setError("Escreva porque suspende."); return; }
    const r = await setStationStatus(supabase(), x.id, to, reason); if (r.error) setError(friendlyError(r.error)); else { setNotice(to === "approved" ? "Posto aprovado." : "Posto suspenso."); setOpen(null); setReason(""); await load(); }
  }
  async function decide(p: AdminFuelPayment, ok: boolean) {
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideFuelFee(supabase(), p.id, ok, reason); if (r.error) setError(friendlyError(r.error)); else { setNotice("Feito."); setOpen(null); setReason(""); await load(); }
  }
  async function save() {
    if (!s) return; const pct = Number(s.fuel_fee_pct), mins = Number(s.fuel_pay_minutes);
    if (!(pct >= 0 && pct <= 30) || !Number.isInteger(mins) || mins < 10 || mins > 1440) { setError("Verifique a percentagem e os minutos."); return; }
    const r = await updatePlatformSettings(supabase(), { fuel_fee_pct: pct, fuel_pay_minutes: mins }); if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Regras guardadas."); }
  }
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder="Motivo (o dono vai ler)" accessibilityLabel="Motivo" {...ph} />;
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>⛽ Combustível e gás</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label="Taxa do APP paga pelo comprador (%)" value={String(s.fuel_fee_pct ?? "")} onChangeText={v => setS({ ...s, fuel_fee_pct: v })} keyboardType="decimal-pad" />
      <Field label="Minutos para pagar adiantado" value={String(s.fuel_pay_minutes ?? "")} onChangeText={v => setS({ ...s, fuel_pay_minutes: Number(v) || 0 })} keyboardType="numeric" />
      <Button title="Guardar" onPress={() => void save()} />
    </View>}
    <Chips options={[{ value: "pending" as const, label: "⏳ Por aprovar" }, { value: "approved" as const, label: "✅ Aprovados" }, { value: "suspended" as const, label: "⛔ Suspensos" }]} value={status} onChange={setStatus} />
    {stations.length === 0 && <Text style={ui.text}>Nenhum posto nesta lista.</Text>}
    {stations.map(x => <View key={x.id} style={ui.card}>
      <Text style={ui.label}>{x.name}</Text>
      <Text style={ui.muted}>{stationRef(x.ref_no)} · {FUEL_KIND_LABELS[x.kind]} · {x.municipalities?.name ?? "—"}{x.phone ? " · 📞 " + x.phone : ""}</Text>
      {x.status !== "approved" && <Button title="✅ Aprovar" onPress={() => void setSt(x, "approved")} />}
      {x.status !== "suspended" && (open === x.id ? <>{reasonBox}<Button title="⛔ Suspender" variant="danger" onPress={() => void setSt(x, "suspended")} /></> : <Button title="⛔ Suspender" variant="secondary" onPress={() => { setOpen(x.id); setReason(""); }} />)}
    </View>)}
    <Text style={ui.label}>🧾 Comissões por confirmar ({payments.length})</Text>
    {payments.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(p.amount)} · {p.station_name}</Text>
      <Text style={ui.muted}>{stationRef(p.station_ref)} · {p.owner_name}{p.reference ? " · Ref.: " + p.reference : ""}</Text>
      {!!p.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); }} />}
      <Button title="✔ Confirmar" onPress={() => void decide(p, true)} />
      {open === p.id ? <>{reasonBox}<Button title="✖ Recusar" variant="danger" onPress={() => void decide(p, false)} /></> : <Button title="✖ Recusar" variant="secondary" onPress={() => { setOpen(p.id); setReason(""); }} />}
    </View>)}
    <Text style={ui.label}>🔎 Pagamentos adiantados de clientes (comprovativos)</Text>
    <Text style={ui.muted}>Para vigiar burlas: cada comprovativo e cada referência só podem ser usados uma vez.</Text>
    <Chips options={[{ value: "submitted" as const, label: "⏳ Por confirmar" }, { value: "paid" as const, label: "✅ Confirmados" }, { value: "rejected" as const, label: "❌ Recusados" }, { value: "all" as const, label: "Todos" }]}
      value={orderStatus} onChange={v => setOrderStatus(v as FuelOrderStatus | "all")} />
    {orders.length === 0 && <Text style={ui.text}>Nenhum pagamento nesta lista.</Text>}
    {orders.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(o.total)} · {o.station_name} · {o.buyer_name}</Text>
      <Text style={ui.muted}>{fuelOrderRef(o.ref_no)} · {fuelQuantityText(o.product, o.quantity)} · taxa {formatPrice(o.fee_amount)}{o.reference ? " · Ref.: " + o.reference : ""} · {FUEL_ORDER_STATUS_LABELS[o.status]}</Text>
      {!!o.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={() => void openProof(o.proof_path!, setError)} />}
      <Button title="🔳 Ver pelo QR" variant="secondary" onPress={() => router.push(("/combustivel/v/" + o.qr_token) as any)} />
    </View>)}
  </View>;
}

/** Ecrã aberto pelo QR: confirma se o pedido é verdadeiro; o posto confirma o pagamento e entrega aqui. */
export function FuelVerifyScreen({ token }: { token: string }) {
  const router = useRouter();
  const [v, setV] = useState<FuelOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""); const [rejecting, setRejecting] = useState(false);
  async function load() { const r = await fuelOrderByToken(supabase(), token); if (r.error) setError(friendlyError(r.error)); setV(r.data ?? { result: "invalid" }); }
  useFocusEffect(useCallback(() => { void load(); }, [token]));
  if (!v) return <View style={ui.screen}><Text style={ui.text}>A verificar…</Text></View>;
  if (v.result !== "ok") return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>❌ QR não reconhecido</Text>
    <Text style={[ui.error, { fontSize: 19 }]}>Este QR não é de nenhum pedido do Huambo Online. Não entregue combustível nem gás.</Text>
  </ScrollView>;
  const live = v.status === "reserved" || v.status === "paid" || v.status === "submitted";
  async function deliver() {
    if (!v?.code || !v.station_id) return;
    setBusy(true); const r = await collectFuel(supabase(), v.station_id, v.code); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(FUEL_COLLECT_LABELS[r.data?.result ?? ""] ?? String(r.data?.result)); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    setBusy(true); const r = await decideFuelPayment(supabase(), v.id, ok, reason); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Pagamento confirmado. Já pode entregar." : "Pagamento recusado."); setRejecting(false); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{v.status === "collected" ? "⚠️ QR JÁ USADO" : live ? "✅ QR verdadeiro" : "❌ Pedido sem efeito"}</Text>
    <Text style={[live ? ui.ok : ui.error, { fontSize: 19 }]}>{fuelOrderRef(v.ref_no)} · {v.station_name} · {v.product ? FUEL_PRODUCTS[v.product].label + " · " + fuelQuantityText(v.product, v.quantity ?? 0) : ""}{"\n"}{v.status ? FUEL_ORDER_STATUS_LABELS[v.status] : ""}</Text>
    <Message error={error} ok={notice} />
    {v.role === "other" && <View style={ui.card}><Text style={ui.text}>Este pedido existe no Huambo Online. Só o posto {v.station_name}, com a sua conta, vê os dados e pode entregar.</Text>
      <Button title="Entrar" onPress={() => router.push("/login")} /></View>}
    {v.role !== "other" && <>
      <View style={ui.card}>
        <Text style={ui.text}>Cliente: <Text style={ui.label}>{v.buyer_name}</Text>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}{v.plate ? " · " + v.plate : ""}</Text>
        <Text style={ui.text}>Combustível/gás: {formatPrice(v.subtotal ?? 0)}</Text>
        <Text style={ui.text}>Taxa do APP{v.fee_pct ? ` (${v.fee_pct}%)` : ""}: {formatPrice(v.fee_amount ?? 0)}</Text>
        <Text style={ui.label}>Total: {formatPrice(v.total ?? 0)} · {v.method === "prepaid" ? "pago adiantado" : "paga no posto"}</Text>
        {!!v.reference && <Text style={ui.text}>Referência do pagamento: <Text style={ui.label}>{v.reference}</Text></Text>}
        {!!v.code && <Text style={ui.text}>Código: <Text style={ui.label}>{v.code}</Text></Text>}
      </View>
      {!!v.proof_path && <Button title="📄 Ver comprovativo" variant="secondary" onPress={() => void openProof(v.proof_path!, setError)} />}
      {v.role === "station" && v.status === "submitted" && <View style={ui.card}>
        <Text style={ui.label}>Veja na conta do posto se entrou {formatPrice(v.total ?? 0)} com o descritivo {fuelOrderRef(v.ref_no)}.</Text>
        {rejecting ? <><TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder="Motivo (o cliente vai ler)" accessibilityLabel="Motivo" {...ph} />
          <Button title="❌ Não recebi" variant="danger" disabled={busy} onPress={() => void decide(false)} /><Button title="Voltar" variant="secondary" onPress={() => setRejecting(false)} /></>
          : <><Button title="✅ Recebi o dinheiro" disabled={busy} onPress={() => Alert.alert("Confirmar pagamento", `Recebeu ${formatPrice(v.total ?? 0)} na conta do posto?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void decide(true) }])} />
            <Button title="❌ Não recebi" variant="secondary" onPress={() => setRejecting(true)} /></>}
      </View>}
      {v.role === "station" && (v.status === "reserved" || v.status === "paid") && <Button title={v.status === "reserved" ? `⛽ Cobrar ${formatPrice(v.total ?? 0)} e entregar` : "⛽ Já pago — entregar"} disabled={busy}
        onPress={() => Alert.alert("Entregar", `Entregar ${fuelQuantityText(v.product!, v.quantity ?? 0)} a ${v.buyer_name}?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void deliver() }])} />}
    </>}
  </ScrollView>;
}
