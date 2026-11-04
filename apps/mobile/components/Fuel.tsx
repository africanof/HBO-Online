import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { fuelFeed, getStation, listMyStations, listStationProducts, getStationPay, saveStation, updateFuelProduct, reportFuel, listMyFuelAlerts, addFuelAlert,
  removeFuelAlert, reserveFuel, submitFuelPayment, decideFuelPayment, collectFuel, cancelFuelOrder, myFuelOrders, stationPanel, submitFuelFee, listStationsForAdmin,
  setStationStatus, listFuelPaymentsForAdmin, fuelOrderByToken, listFuelOrdersForAdmin, fuelFeeBreakdown, fuelFeeNotice, fuelVerifyUrl, fuelTransferNote, fuelTokenFromText, sha256Hex, decideFuelFee, getPlatformSettings, updatePlatformSettings, paymentProofUrl, uploadPaymentProof, base64ToArrayBuffer,
  fuelQuantityText, fuelPriceText, minutesAgoText, fuelIsStale, fuelStatusLine, fuelReportsText, fuelShareMessage, validateStation, validateFuelReserve, stationRef,
  fuelOrderRef, holdText, qrMatrix, formatPrice, friendlyErrorIn, LANG_TAGS, whatsappShareUrl, whatsappLink, pointFrom, FUEL_PRODUCTS, FUEL_PRODUCT_LIST, FUEL_KIND_LABELS,
  FUEL_STATUS_LABELS, FUEL_QUEUE_LABELS, FUEL_METHOD_LABELS, FUEL_ORDER_STATUS_LABELS, FUEL_COLLECT_LABELS, PLAN_METHOD_LABELS,
  type FuelProduct, type FuelRow, type FuelStation, type FuelProductRow, type FuelKind, type FuelMethod, type FuelStatus, type FuelQueue, type MyFuelOrder,
  type StationPanel, type StationOrder, type FuelOrderView, type AdminFuelOrder, type FuelOrderStatus, type AdminFuelPayment, type FuelCollectResult, type PlatformSettings, type PaymentMethodPlan, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { usePlatformCollects } from "../lib/platform";
import { useTerritory } from "./Directory";
import { QrScanButton } from "./QrScanner";
import { ProfileQr } from "./ProfileQr";
import { getPublic } from "../lib/public-api";
import { OfflineBanner } from "./Offline";
import { deviceStore } from "./Engage";
import { loadWithCache, isOfflineError } from "@huambo-online/core";
import { fuelFeedCached } from "@huambo-online/core";
import { useT, formatDateTimeIn } from "../lib/i18n";

const ph = { placeholderTextColor: C.muted };
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;
const statusColor = (s: FuelStatus) => s === "available" ? C.green : s === "out" ? C.red : s === "low" ? C.yellowText : C.muted;
const Badge = ({ s }: { s: FuelStatus }) => { const { tc } = useT(); return <Text style={{ color: statusColor(s), fontWeight: "800", fontSize: 16 }}>{tc(FUEL_STATUS_LABELS[s])}</Text>; };
function LoginNeeded({ title }: { title: string }) {
  const router = useRouter(); const { t: tr } = useT();
  return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{title}</Text><Button title={tr("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
}
/** QR único do pedido: leva ao site, que confirma se é verdadeiro. */
function CodeBox({ code, token }: { code: string; token?: string | null }) {
  const { t: tr } = useT();
  const m = qrMatrix(token ? fuelVerifyUrl(siteUrl, token) : code); const cell = Math.floor(190 / (m.length + 4));
  return <View style={[ui.card, { alignItems: "center" }]}>
    <View accessible accessibilityLabel={tr("sv.fu_qr_a11y", { code })} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8 }}>
      {m.map((row, y) => <View key={y} style={{ flexDirection: "row" }}>{row.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#000" : "#fff" }} />)}</View>)}
    </View>
    <Text selectable style={[ui.h2, { letterSpacing: 3 }]}>{code}</Text>
    <Text style={ui.muted}>{tr("sv.fu_qr_hint")}</Text>
  </View>;
}
async function openProof(path: string, onError: (m: string) => void, failMsg: string) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) void Linking.openURL(r.data); else onError(failMsg);
}
type Proof = { uri: string; base64?: string | null; mimeType: string };
async function pickProof(camera: boolean, onError: (m: string) => void, msgs: { camera: string; gallery: string }): Promise<Proof | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { onError(camera ? msgs.camera : msgs.gallery); return null; }
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
async function proofBytes(p: Proof) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }

export function FuelListScreen() {
  const router = useRouter(); const { municipalities } = useTerritory();
  const { t: tr, tc, lang } = useT();
  const [product, setProduct] = useState<FuelProduct | "">(""); const [municipalityId, setMunicipalityId] = useState("");
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; product: FuelProduct; municipality_id: string | null }[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  useEffect(() => { void (async () => {
    // Guarda a última lista para a mostrar sem rede (com o aviso de que pode ter mudado).
    const r = await loadWithCache<FuelRow[]>(deviceStore, `combustivel:${product}:${municipalityId}`, () => fuelFeedCached(getPublic, () => fuelFeed(supabase(), { product, municipalityId }), { product, municipalityId }));
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: r.fromCache ? r.savedAt : null });
    if (r.error && !r.data) { if (!isOfflineError(r.error)) setError(friendlyErrorIn(r.error, lang)); } else { setError(""); setRows(r.data); }
  })(); }, [product, municipalityId]);
  useFocusEffect(useCallback(() => { void currentUserId().then(async u => { setUid(u); if (u) setAlerts((await listMyFuelAlerts(supabase())).data); }); }, []));
  const alert = product ? alerts.find(a => a.product === product && (a.municipality_id ?? "") === municipalityId) : undefined;
  async function toggleAlert() {
    if (!uid) { router.push("/login"); return; }
    if (!product) return;
    const r = alert ? await removeFuelAlert(supabase(), alert.id) : await addFuelAlert(supabase(), uid, product, municipalityId || null);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(alert ? tr("sv.fu_alert_off") : tr("sv.fu_alert_on", { what: tc(FUEL_PRODUCTS[product].label).toLowerCase() }));
    setAlerts((await listMyFuelAlerts(supabase())).data);
  }
  const has = rows?.filter(r => r.status === "available" || r.status === "low").length ?? 0;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{tr("sv.fu_title")}</Text>
    <Text style={ui.muted}>{tr("sv.fu_intro")}</Text>
    <View style={ui.row}><Link href={"/combustivel/pedidos" as any} style={ui.link}>{tr("sv.fu_my_res_link")}</Link><Text style={ui.muted}> · </Text><Link href={"/combustivel/meus" as any} style={ui.link}>{tr("sv.fu_have_station")}</Link></View>
    <Chips options={[{ value: "all", label: tr("sv.f_all_m") }, ...FUEL_PRODUCT_LIST.map(p => ({ value: p, label: `${FUEL_PRODUCTS[p].icon} ${tc(FUEL_PRODUCTS[p].short)}` }))]} value={product || "all"} onChange={v => setProduct(v === "all" ? "" : v as FuelProduct)} />
    {municipalities.length > 0 && <Chips options={[{ value: "all", label: tr("sv.fu_all_munis") }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId || "all"} onChange={v => setMunicipalityId(v === "all" ? "" : v)} />}
    {!!product && <Button title={alert ? tr("sv.fu_alert_off_btn") : tr("sv.fu_alert_btn", { what: tc(FUEL_PRODUCTS[product].short).toLowerCase() })} variant={alert ? "secondary" : "primary"} onPress={() => void toggleAlert()} />}
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    <Message error={error} ok={notice} />
    {rows !== null && <Text style={ui.label}>{has ? tr(has === 1 ? "sv.fu_has_one" : "sv.fu_has_many", { n: has, what: product ? tc(FUEL_PRODUCTS[product].label).toLowerCase() : tr("sv.fu_fuel_or_gas") }) : tr("sv.fu_none_now")}</Text>}
    {rows === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : rows.length === 0 ? <Text style={ui.text}>{tr("sv.fu_no_stations")}</Text> :
      rows.map(r => <Pressable key={r.product_id} accessibilityRole="link" onPress={() => router.push(("/combustivel/" + r.station_id) as any)} style={ui.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={[ui.label, { flex: 1, fontSize: 18 }]}>{FUEL_PRODUCTS[r.product].icon} {tc(FUEL_PRODUCTS[r.product].label)}</Text><Badge s={r.status} /></View>
        <Text style={ui.text}>{r.station_name}{r.municipality_name ? " · " + r.municipality_name : ""}</Text>
        <Text style={ui.muted}>{tc(fuelStatusLine(r))}{fuelIsStale(r.status_at) && r.status !== "unknown" ? tr("sv.fu_stale") : ""}</Text>
        {r.price != null && <Text style={ui.price}>{tc(fuelPriceText(r.product, r.price))}</Text>}
        {(r.yes_2h > 0 || r.no_2h > 0) && <Text style={ui.muted}>{tc(fuelReportsText(r.yes_2h, r.no_2h))}</Text>}
        {r.accepts_reservations && r.reservable_left > 0 && (r.status === "available" || r.status === "low") && <Text style={ui.ok}>{tr("sv.fu_can_reserve", { q: tc(fuelQuantityText(r.product, r.reservable_left)) })}</Text>}
      </Pressable>)}
  </ScrollView>;
}

export function StationScreen({ id }: { id: string }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [st, setSt] = useState<FuelStation | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const [a, b] = await Promise.all([fuelFeed(supabase(), { stationId: id }), getStation(supabase(), id)]); setRows(a.data); setSt(b.data); }
  useFocusEffect(useCallback(() => { void load(); void currentUserId().then(setUid); }, [id]));
  if (rows === null) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!st) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{tr("sv.fu_not_found")}</Text><Link href={"/combustivel" as any} style={ui.link}>{tr("sv.fu_back")}</Link></ScrollView>;
  const mine = uid === st.owner_id; const first = rows[0]; const wa = whatsappLink(st.whatsapp, tr("sv.fu_wa_hello", { name: st.name }));
  async function report(r: FuelRow, has: boolean) {
    if (!uid) { router.push("/login"); return; }
    const x = await reportFuel(supabase(), r.product_id, has);
    if (x.error) { setError(friendlyErrorIn(x.error, lang)); setNotice(""); } else { setError(""); setNotice(tr("sv.fu_report_thanks")); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/combustivel" as any} style={ui.link}>{tr("sv.fu_back")}</Link>
    <Text style={ui.h1}>{st.name}</Text>
    <Text style={ui.muted}>{tc(FUEL_KIND_LABELS[st.kind])} · {stationRef(st.ref_no)}{first?.municipality_name ? " · " + first.municipality_name : ""}</Text>
    {st.status !== "approved" && <Text style={ui.error}>{st.status === "pending" ? tr("sv.fu_pending") : tr("sv.fu_suspended") + (st.admin_note ? ": " + st.admin_note : "")}</Text>}
    {mine && <><Button title={tr("sv.fu_manage")} onPress={() => router.push(`/combustivel/${id}/gerir` as any)} /><Button title={tr("sv.edit_pen")} variant="secondary" onPress={() => router.push(`/combustivel/${id}/editar` as any)} /></>}
    {(!!st.address || !!st.opening_hours) && <Text style={ui.text}>{st.address}{st.address && st.opening_hours ? " · " : ""}{st.opening_hours ? "🕒 " + st.opening_hours : ""}</Text>}
    <View style={ui.row}>
      {!!st.phone && <Button title={tr("sv.call")} variant="secondary" onPress={() => void Linking.openURL("tel:" + st.phone)} />}
      {!!wa && <Button title="WhatsApp" variant="secondary" onPress={() => void Linking.openURL(wa)} />}
      {!!first && <Button title={tr("sv.share_short")} variant="secondary" onPress={() => void Share.share({ message: tc(fuelShareMessage(siteUrl, first)) })} />}
    </View>
    <ProfileQr kind="combustivel" id={id} name={st.name ?? ""} hint={mine ? tr("sv.qr.print_hint") : undefined} />
    <Message error={error} ok={notice} />
    {rows.map(r => <View key={r.product_id} style={ui.card}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={[ui.h2, { flex: 1 }]}>{FUEL_PRODUCTS[r.product].icon} {tc(FUEL_PRODUCTS[r.product].label)}</Text><Badge s={r.status} /></View>
      <Text style={ui.text}>{tc(fuelStatusLine(r))}{fuelIsStale(r.status_at) && r.status !== "unknown" ? tr("sv.fu_stale") : ""}</Text>
      <Text style={ui.price}>{tc(fuelPriceText(r.product, r.price))}</Text>
      {!!r.note && <Text style={ui.text}>{r.note}</Text>}
      {(r.yes_2h > 0 || r.no_2h > 0) && <Text style={ui.muted}>{tc(fuelReportsText(r.yes_2h, r.no_2h))}</Text>}
      {!mine && <><Text style={ui.label}>{tr("sv.fu_passed")}</Text><View style={ui.row}>
        <Button title={tr("sv.fu_yes")} variant="secondary" onPress={() => void report(r, true)} /><Button title={tr("sv.fu_no")} variant="secondary" onPress={() => void report(r, false)} /></View></>}
      {!mine && r.accepts_reservations && (r.status === "available" || r.status === "low") && r.reservable_left > 0 && r.price != null && (open === r.product_id
        ? <ReserveForm r={r} uid={uid} onClose={() => setOpen(null)} />
        : <Button title={tr("sv.fu_reserve_btn", { q: tc(fuelQuantityText(r.product, r.reservable_left)) })} onPress={() => setOpen(r.product_id)} />)}
    </View>)}
    <PlaceView directions={st.directions} lat={st.geo_lat} lng={st.geo_lng} />
    <Text style={ui.muted}>{tr("sv.fu_disclaimer")}</Text>
  </ScrollView>;
}

function ReserveForm({ r, uid, onClose }: { r: FuelRow; uid: string | null; onClose: () => void }) {
  const router = useRouter(); const gas = FUEL_PRODUCTS[r.product].gas;
  const { t: tr, tc, lang } = useT();
  const collects = usePlatformCollects();
  const [method, setMethod] = useState<FuelMethod>("at_station"); const [qty, setQty] = useState(gas ? "1" : "20");
  useEffect(() => { if (collects) setMethod("prepaid"); }, [collects]); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [feePct, setFeePct] = useState<number | null>(null); const [agree, setAgree] = useState(false);
  useEffect(() => { void getPlatformSettings(supabase()).then(s => setFeePct(Number(s.data?.fuel_fee_pct ?? 10))); }, []);
  if (!uid) return <Button title={tr("sv.fu_login_reserve")} onPress={() => router.push("/login")} />;
  const q = Number(qty.replace(",", "."));
  const sum = q > 0 && r.price != null && feePct != null ? fuelFeeBreakdown(r.price, q, feePct) : null;
  async function send() {
    const bad = validateFuelReserve(r, q, name); if (bad) { setError(tc(bad)); return; }
    if (!agree) { setError(tr("sv.fu_agree_need")); return; }
    setBusy(true); setError("");
    const x = await reserveFuel(supabase(), r.product_id, q, method, name, phone, plate); setBusy(false);
    if (x.error) setError(friendlyErrorIn(x.error, lang)); else router.push("/combustivel/pedidos" as any);
  }
  return <View style={[ui.card, { gap: 8 }]}>
    {collects && <Text style={ui.muted}>{tr("pp.pay_platform")}</Text>}
    {r.accepts_prepay && !collects && <Chips options={(["at_station", "prepaid"] as FuelMethod[]).map(m => ({ value: m, label: tc(FUEL_METHOD_LABELS[m]) }))} value={method} onChange={setMethod} />}
    <Field label={gas ? tr("sv.fu_how_many_gas") : tr("sv.fu_how_many_l")} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
    <Text style={ui.muted}>{tr("sv.fu_max", { q: tc(fuelQuantityText(r.product, r.max_per_order)) })}</Text>
    <Field label={tr("sv.your_name")} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
    <Field label={tr("sv.phone_opt")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
    {!gas && <Field label={tr("sv.fu_plate")} value={plate} onChangeText={setPlate} maxLength={20} autoCapitalize="characters" placeholder="LD-12-34-AB" />}
    {!!sum && <View style={ui.card}>
      <Text style={ui.text}>{tc(FUEL_PRODUCTS[r.product].label)}: {formatPrice(sum.subtotal)}</Text>
      <Text style={ui.text}>{tr("sv.fu_fee_line", { pct: feePct ?? 0, v: formatPrice(sum.fee) })}</Text>
      <Text style={ui.label}>{tr("sv.fu_total_station", { v: formatPrice(sum.total) })}</Text>
    </View>}
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agree }} onPress={() => setAgree(!agree)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 48 }}>
      <Text style={{ fontSize: 24, color: C.ink }}>{agree ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{tc(fuelFeeNotice(feePct))}{tr("sv.fu_agree")}</Text>
    </Pressable>
    <Text style={ui.muted}>{method === "at_station" ? tr("sv.fu_at_station_hint", { h: Math.round(r.hold_minutes / 60 * 10) / 10 }) : tr("sv.fu_prepaid_hint")}</Text>
    <Message error={error} />
    <Button title={busy ? tr("sv.ev_reserving") : tr("sv.reserve_ok")} disabled={busy} onPress={() => void send()} />
    <Button title={tr("common.cancel")} variant="secondary" onPress={onClose} />
  </View>;
}

export function MyFuelOrdersScreen() {
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyFuelOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myFuelOrders(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.fu_my_res")} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/combustivel" as any} style={ui.link}>{tr("sv.fu_back")}</Link>
    <Text style={ui.h1}>{tr("sv.fu_my_res")}</Text>
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{tr("sv.fu_no_res")}</Text> :
      items.map(o => <OrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </ScrollView>;
}
function OrderCard({ o, onDone, onError }: { o: MyFuelOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<Proof | null>(null);
  async function pay() {
    if (!proof) { onError(tr("sv.fu_need_proof")); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError(tr("sv.fu_need_ref")); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(tr("sv.sign_in_account"));
      const body = await proofBytes(proof); const hash = sha256Hex(body);
      const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(tr("sv.proof_fail"));
      const r = await submitFuelPayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone(tr("sv.fu_proof_sent"));
    } catch (e) { onError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  async function cancel() { const r = await cancelFuelOrder(supabase(), o.id); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(tr("sv.ev_res_cancelled")); }
  return <View style={ui.card}>
    <Pressable accessibilityRole="link" onPress={() => router.push(("/combustivel/" + o.station_id) as any)}><Text style={[ui.link, { fontSize: 19 }]}>{FUEL_PRODUCTS[o.product].icon} {o.station_name}</Text></Pressable>
    <Text style={ui.muted}>{fuelOrderRef(o.ref_no)} · {tc(FUEL_PRODUCTS[o.product].label)} · {tc(fuelQuantityText(o.product, o.quantity))}{o.plate ? " · " + o.plate : ""}</Text>
    <Text style={ui.label}>{formatPrice(o.total)}</Text>
    {o.fee_amount > 0 && <Text style={ui.muted}>{tr("sv.fu_fee_of_app", { a: formatPrice(o.subtotal), b: formatPrice(o.fee_amount) })}</Text>}
    <Text style={ui.text}>{tc(FUEL_ORDER_STATUS_LABELS[o.status])}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? tr("sv.fu_collect", { when: tc(holdText(o.hold_until)) }) : ""}</Text>
    {!!o.note && (o.status === "rejected" || o.status === "cancelled") && <Text style={ui.error}>{tr("sv.reason", { note: o.note })}</Text>}
    {!!o.code && (o.status === "reserved" || o.status === "paid" || o.status === "submitted") && <CodeBox code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <Text style={ui.muted}>{tr("sv.fu_confirming")}</Text>}
    {o.status === "awaiting_payment" && <>
      <Text style={ui.label}>{tr("sv.fu_pay_station", { v: formatPrice(o.total), by: o.pay_by ? " " + tc(holdText(o.pay_by)) : "" })}</Text>
      <View style={ui.card}>
        {!!o.pay_holder && <Text style={ui.text}>{tr("sv.holder_x")}<Text style={ui.label}>{o.pay_holder}</Text></Text>}
        {!!o.pay_iban && <Text selectable style={ui.text}>IBAN: <Text style={ui.label}>{o.pay_iban}</Text></Text>}
        {!!o.pay_express && <Text selectable style={ui.text}>Multicaixa Express: <Text style={ui.label}>{o.pay_express}</Text></Text>}
        {!!o.pay_note && <Text style={ui.muted}>{o.pay_note}</Text>}
      </View>
      <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12, gap: 4 }}>
        <Text style={ui.label}>✍️ {tc(fuelTransferNote(o.ref_no))}</Text>
        <Text style={ui.text}>{tr("sv.fu_only_station")}</Text>
      </View>
      <Text style={ui.label}>{tr("sv.fu_send_proof")}</Text>
      <Chips options={(["multicaixa_express", "bank_transfer"] as const).map(m => ({ value: m, label: tc(PLAN_METHOD_LABELS[m]) }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={tr("sv.pay_ref_ph")} accessibilityLabel={tr("sv.pay_ref_a11y")} {...ph} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={tr("sv.proof")} /><Button title={tr("sv.proof_change")} variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title={tr("sv.proof_photo")} variant="secondary" onPress={() => void pickProof(true, onError, { camera: tr("sv.cam_perm"), gallery: tr("sv.gallery_perm") }).then(setProof)} /><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void pickProof(false, onError, { camera: tr("sv.cam_perm"), gallery: tr("sv.gallery_perm") }).then(setProof)} /></View>}
      <Button title={busy ? tr("sv.sending") : tr("sv.fu_paid_send")} disabled={busy} onPress={() => void pay()} />
    </>}
    {(o.status === "reserved" || o.status === "awaiting_payment") && <Button title={tr("sv.ev_cancel_res")} variant="secondary" onPress={() => Alert.alert(tr("sv.ev_cancel_res_q"), "", [{ text: tr("sv.no"), style: "cancel" }, { text: tr("common.cancel"), onPress: () => void cancel() }])} />}
  </View>;
}

export function MyStationsScreen() {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<FuelStation[] | null>(null);
  useFocusEffect(useCallback(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyStations(supabase(), u)).data); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.fu_have_station_title")} />;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href={"/combustivel" as any} style={ui.link}>{tr("sv.fu_back")}</Link>
    <Text style={ui.h1}>{tr("sv.fu_my_stations")}</Text>
    <Button title={tr("sv.fu_register_btn")} onPress={() => router.push("/combustivel/registar" as any)} />
    <Text style={ui.muted}>{tr("sv.fu_mine_hint")}</Text>
    {items === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{tr("sv.fu_none_mine")}</Text> :
      items.map(s => <Pressable key={s.id} accessibilityRole="link" onPress={() => router.push(`/combustivel/${s.id}/gerir` as any)} style={ui.card}>
        <Text style={ui.label}>{s.name}</Text>
        <Text style={ui.muted}>{stationRef(s.ref_no)} · {tc(FUEL_KIND_LABELS[s.kind])} · {s.status === "approved" ? tr("sv.st_approved") : s.status === "pending" ? tr("sv.st_pending_approval") : tr("sv.fu_suspended")}</Text>
      </Pressable>)}
  </ScrollView>;
}

export function StationFormScreen({ id }: { id?: string }) {
  const router = useRouter(); const { municipalities } = useTerritory();
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [name, setName] = useState(""); const [kind, setKind] = useState<FuelKind>("fuel"); const [municipalityId, setMunicipalityId] = useState(""); const [address, setAddress] = useState("");
  const [directions, setDirections] = useState(""); const [point, setPoint] = useState<GeoPoint | null>(null); const [phone, setPhone] = useState(""); const [whatsapp, setWhatsapp] = useState("");
  const [hours, setHours] = useState(""); const [reserv, setReserv] = useState(true); const [prepay, setPrepay] = useState(false); const [hold, setHold] = useState("120");
  const [pay, setPay] = useState({ holder: "", iban: "", express: "", note: "" }); const [products, setProducts] = useState<FuelProduct[]>(["gasolina", "gasoleo"]);
  const [existing, setExisting] = useState<FuelProductRow[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loaded, setLoaded] = useState(!id);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => { if (!id) return; void (async () => {
    const [a, b, c] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), getStationPay(supabase(), id)]);
    const s = a.data; if (!s) { setError(tr("sv.fu_not_found_dot")); return; }
    setName(s.name); setKind(s.kind); setMunicipalityId(s.municipality_id ?? ""); setAddress(s.address ?? ""); setDirections(s.directions ?? ""); setPoint(pointFrom(s.geo_lat, s.geo_lng));
    setPhone(s.phone ?? ""); setWhatsapp(s.whatsapp ?? ""); setHours(s.opening_hours ?? ""); setReserv(s.accepts_reservations); setPrepay(s.accepts_prepay); setHold(String(s.hold_minutes));
    setPay(c); setExisting(b.data); setProducts(b.data.map(p => p.product)); setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <View style={ui.screen}><Text style={ui.text}>{error || tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.fu_register_title")} />;
  const input = { name, kind, municipalityId, address, directions, point, phone, whatsapp, openingHours: hours, acceptsReservations: reserv, acceptsPrepay: prepay, holdMinutes: Number(hold), pay, products };
  const allowed = FUEL_PRODUCT_LIST.filter(p => kind === "both" || (kind === "gas") === FUEL_PRODUCTS[p].gas);
  async function save() {
    const bad = validateStation(input); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    const r = await saveStation(supabase(), uid!, input, id, existing); setBusy(false);
    if (r.error || !r.data) setError(friendlyErrorIn(r.error, lang)); else router.replace(`/combustivel/${r.data.id}/gerir` as any);
  }
  const toggle = (p: FuelProduct) => setProducts(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{id ? tr("sv.fu_edit_title") : tr("sv.fu_register_title")}</Text>
    <Text style={ui.muted}>{id ? tr("sv.fu_edit_warn") : tr("sv.fu_new_info")}</Text>
    <Field label={tr("sv.name")} value={name} onChangeText={setName} maxLength={100} placeholder={tr("sv.fu_name_ph")} />
    <Text style={ui.label}>{tr("sv.fu_sells")}</Text>
    <Chips options={(Object.keys(FUEL_KIND_LABELS) as FuelKind[]).map(k => ({ value: k, label: tc(FUEL_KIND_LABELS[k]) }))} value={kind}
      onChange={k => { setKind(k); setProducts(ps => ps.filter(p => k === "both" || (k === "gas") === FUEL_PRODUCTS[p].gas)); }} />
    <Text style={ui.label}>{tr("sv.products")}</Text>
    {allowed.map(p => <Pressable key={p} accessibilityRole="checkbox" accessibilityState={{ checked: products.includes(p) }} onPress={() => toggle(p)} style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "center" }]}>
      <Text style={{ fontSize: 22, color: C.ink }}>{products.includes(p) ? "☑" : "☐"}</Text><Text style={ui.text}>{FUEL_PRODUCTS[p].icon} {tc(FUEL_PRODUCTS[p].label)}</Text>
    </Pressable>)}
    {municipalities.length > 0 && <><Text style={ui.label}>{tr("sv.municipality")}</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /></>}
    <Field label={tr("sv.address_opt")} value={address} onChangeText={setAddress} maxLength={200} />
    <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint={tr("sv.fu_place_hint")} />
    <Field label={tr("sv.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
    <Field label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" maxLength={20} />
    <Field label={tr("sv.hours_opt")} value={hours} onChangeText={setHours} maxLength={120} placeholder={tr("sv.fu_hours_ph")} />
    <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.fu_reservations")}</Text>
      <Button title={reserv ? tr("sv.fu_accept_res") : tr("sv.fu_no_res_accept")} variant="secondary" onPress={() => setReserv(!reserv)} />
      <Button title={prepay ? tr("sv.fu_accept_prepay") : tr("sv.fu_no_prepay")} variant="secondary" onPress={() => setPrepay(!prepay)} />
      <Field label={tr("sv.fu_hold")} value={hold} onChangeText={setHold} keyboardType="numeric" />
      {prepay && <>
        <Field label={tr("sv.holder")} value={pay.holder} onChangeText={v => setPay({ ...pay, holder: v })} maxLength={80} />
        <Field label="IBAN" value={pay.iban} onChangeText={v => setPay({ ...pay, iban: v })} maxLength={40} autoCapitalize="characters" placeholder="AO06 …" />
        <Field label="Multicaixa Express" value={pay.express} onChangeText={v => setPay({ ...pay, express: v })} keyboardType="phone-pad" maxLength={20} />
        <Field label={tr("sv.ev_payer_note")} value={pay.note} onChangeText={v => setPay({ ...pay, note: v })} maxLength={200} />
      </>}
    </View>
    <Message error={error} />
    <Button title={busy ? tr("sv.recording") : id ? tr("common.save") : tr("sv.fu_register_ok")} disabled={busy} onPress={() => void save()} />
  </ScrollView>;
}

function ProductControl({ p, onSaved, onError }: { p: FuelProductRow; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const { t: tr, tc, lang } = useT();
  const [price, setPrice] = useState(p.price == null ? "" : String(p.price)); const [qty, setQty] = useState(String(p.reservable_qty)); const [max, setMax] = useState(String(p.max_per_order));
  const [queue, setQueue] = useState<FuelQueue | "">(p.queue ?? ""); const [note, setNote] = useState(p.note ?? ""); const [busy, setBusy] = useState(false);
  async function save(status?: FuelStatus) {
    setBusy(true);
    const r = await updateFuelProduct(supabase(), p.id, { ...(status ? { status } : {}), price: price.trim() ? Number(price.replace(/\s/g, "").replace(",", ".")) : null,
      reservable_qty: Number(qty.replace(",", ".")) || 0, max_per_order: Number(max.replace(",", ".")) || 1, queue: queue || null, note: note.trim() || null });
    setBusy(false);
    if (r.error) onError(friendlyErrorIn(r.error, lang)); else onSaved(status ? `${tc(FUEL_PRODUCTS[p.product].label)}: ${tc(FUEL_STATUS_LABELS[status])}` : tr("sv.saved_short"));
  }
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}><Text style={[ui.h2, { flex: 1 }]}>{FUEL_PRODUCTS[p.product].icon} {tc(FUEL_PRODUCTS[p.product].label)}</Text><Badge s={p.status} /></View>
    <Text style={ui.muted}>{tr("sv.updated_ago", { when: tc(minutesAgoText(p.status_at)) })}</Text>
    <Button title={tr("sv.fu_s_yes")} disabled={busy} onPress={() => void save("available")} />
    <Button title={tr("sv.fu_s_low")} variant="secondary" disabled={busy} onPress={() => void save("low")} />
    <Button title={tr("sv.fu_s_out")} variant="danger" disabled={busy} onPress={() => void save("out")} />
    <Field label={tr("sv.fu_price_unit", { unit: tc(FUEL_PRODUCTS[p.product].unit) })} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
    <Field label={FUEL_PRODUCTS[p.product].gas ? tr("sv.fu_for_res_gas") : tr("sv.fu_for_res_l")} value={qty} onChangeText={setQty} keyboardType="decimal-pad" />
    <Field label={tr("sv.fu_max_person")} value={max} onChangeText={setMax} keyboardType="decimal-pad" />
    <Text style={ui.label}>{tr("sv.fu_queue")}</Text>
    <Chips options={(Object.keys(FUEL_QUEUE_LABELS) as FuelQueue[]).map(q => ({ value: q, label: tc(FUEL_QUEUE_LABELS[q]) }))} value={queue} onChange={q => setQueue(queue === q ? "" : q)} />
    <Field label={tr("sv.note_opt")} value={note} onChangeText={setNote} maxLength={160} placeholder={tr("sv.fu_note_ph")} />
    <Button title={tr("sv.fu_save_prices")} variant="secondary" disabled={busy} onPress={() => void save()} />
  </View>;
}

export function StationManageScreen({ id }: { id: string }) {
  const collects = usePlatformCollects();
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [st, setSt] = useState<FuelStation | null>(null); const [products, setProducts] = useState<FuelProductRow[]>([]);
  const [panel, setPanel] = useState<StationPanel | null>(null); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [code, setCode] = useState(""); const [check, setCheck] = useState<FuelCollectResult | null>(null); const [payOpen, setPayOpen] = useState(false);
  const [reason, setReason] = useState(""); const [reject, setReject] = useState<string | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c, s] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), stationPanel(supabase(), id), getPlatformSettings(supabase())]);
    setSt(a.data); setProducts(b.data); setSettings(s.data); if (c.error) setError(friendlyErrorIn(c.error, lang)); else setPanel(c.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.fu_manage_title")} />;
  if (!st || !panel) return <ScrollView contentContainerStyle={ui.screen}><Message error={error} />{!error && <Text style={ui.text}>{tr("common.loading")}</Text>}</ScrollView>;
  const done = (m: string) => { setNotice(m); setError(""); setReject(null); setReason(""); void load(); };
  async function doCheck() {
    if (!code.trim()) return; setCheck(null);
    const r = await collectFuel(supabase(), id, code);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: StationOrder, ok: boolean) {
    if (!ok && !reason.trim()) { setError(tr("sv.pra_why_not")); return; }
    const r = await decideFuelPayment(supabase(), o.id, ok, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(ok ? tr("sv.fu_pay_ok") : tr("sv.pay_rejected"));
  }
  async function cancel(o: StationOrder) {
    if (!reason.trim()) { setError(tr("sv.fu_why_cancel")); return; }
    const r = await cancelFuelOrder(supabase(), o.id, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(tr("sv.fu_cancel_done"));
  }
  const waiting = panel.orders.filter(o => o.status === "submitted"); const active = panel.orders.filter(o => o.status === "reserved" || o.status === "paid" || o.status === "awaiting_payment");
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={tr("sv.reason_client_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/combustivel/meus" as any} style={ui.link}>{tr("sv.fu_mine_back")}</Link>
    <Text style={ui.h1}>⚙️ {st.name}</Text>
    <Text style={ui.muted}>{stationRef(st.ref_no)} · {st.status === "approved" ? tr("sv.st_approved") : st.status === "pending" ? tr("sv.st_pending_approval") : tr("sv.fu_suspended") + (st.admin_note ? ": " + st.admin_note : "")}</Text>
    <Button title={tr("sv.view_page")} variant="secondary" onPress={() => router.push(`/combustivel/${id}` as any)} />
    <Button title={tr("sv.edit_pen")} variant="secondary" onPress={() => router.push(`/combustivel/${id}/editar` as any)} />
    <Message error={error} ok={notice} />
    {(st.accepts_reservations || active.length > 0) && <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.fu_client_qr")}</Text>
      <Text style={ui.muted}>{tr("sv.fu_client_qr_hint")}</Text>
      <QrScanButton onCode={text => { const t = fuelTokenFromText(text); if (t) router.push(("/combustivel/v/" + t) as any); else setError(tr("sv.fu_bad_qr")); }} />
      <TextInput style={[ui.input, { fontSize: 22, letterSpacing: 2 }]} value={code} onChangeText={setCode} onSubmitEditing={() => void doCheck()} placeholder="CB-XXXXXX" autoCapitalize="characters" accessibilityLabel={tr("sv.fu_code_a11y")} {...ph} />
      <Button title={tr("sv.validate")} onPress={() => void doCheck()} />
      {!!check && <Text accessibilityLiveRegion="polite" style={[check.result === "ok" ? ui.ok : ui.error, { fontSize: 19 }]}>{tc(FUEL_COLLECT_LABELS[check.result] ?? check.result)}
        {check.result === "ok" && check.product ? ` · ${tc(fuelQuantityText(check.product, Number(check.quantity)))} · ${check.buyer}${check.plate ? " · " + check.plate : ""} · ${check.method === "prepaid" ? tr("sv.fu_paid_caps") : tr("sv.fu_charge", { total: formatPrice(Number(check.total)), fee: formatPrice(Number(check.fee ?? 0)) })}` : check.buyer ? " · " + check.buyer : ""}</Text>}
    </View>}
    <Text style={ui.h2}>{tr("sv.fu_has_or_not")}</Text>
    <Text style={ui.muted}>{tr("sv.fu_has_hint")}</Text>
    {products.map(p => <ProductControl key={p.id} p={p} onSaved={done} onError={setError} />)}
    {waiting.length > 0 && <Text style={ui.h2}>{tr("sv.ev_waiting", { n: waiting.length })}</Text>}
    {waiting.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{o.buyer_name} — {tc(fuelQuantityText(o.product, o.quantity))} = {formatPrice(o.total)}</Text>
      <Text style={ui.muted}>{fuelOrderRef(o.ref_no)}{tr("sv.ref_x", { ref: o.reference ?? "" })}{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</Text>
      <Text style={ui.text}>{tr("sv.fu_check_account", { v: formatPrice(o.total), ref: fuelOrderRef(o.ref_no), fee: formatPrice(o.fee_amount) })}</Text>
      {!!o.proof_path && <Button title={tr("sv.proof_see")} variant="secondary" onPress={() => void openProof(o.proof_path!, setError, tr("sv.proof_open_fail"))} />}
      {collects ? <Text style={ui.muted}>{tr("pp.team_confirms")}</Text> : reject === o.id ? <>{reasonBox}<Button title={tr("sv.ina_not_received")} variant="danger" onPress={() => void decide(o, false)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setReject(null)} /></>
        : <><Button title={tr("sv.ev_got_money")} onPress={() => Alert.alert(tr("sv.ina_confirm_pay"), tr("sv.ev_received_q", { v: formatPrice(o.total), name: o.buyer_name }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes"), onPress: () => void decide(o, true) }])} />
          <Button title={tr("sv.ina_not_received")} variant="secondary" onPress={() => { setReject(o.id); setReason(""); }} /></>}
    </View>)}
    {active.length > 0 && <View style={ui.card}><Text style={ui.label}>{tr("sv.fu_active", { n: active.length })}</Text>
      {active.map(o => <View key={o.id} style={{ gap: 4, paddingVertical: 6 }}>
        <Text style={ui.text}>{fuelOrderRef(o.ref_no)} · {o.buyer_name} · {tc(fuelQuantityText(o.product, o.quantity))}{o.hold_until ? " · " + tc(holdText(o.hold_until)) : ""}</Text>
        {reject === "c" + o.id ? <>{reasonBox}<Button title={tr("sv.fu_cancel_res_btn")} variant="danger" onPress={() => void cancel(o)} /></> : <Button title={tr("common.cancel")} variant="secondary" onPress={() => { setReject("c" + o.id); setReason(""); }} />}
      </View>)}</View>}
    <View style={ui.card}>
      <Text style={ui.text}>{tr("sv.fu_collected_today")}<Text style={ui.label}>{formatPrice(panel.collected_today)}</Text>{tr("sv.fu_total_dot")}<Text style={ui.label}>{formatPrice(panel.collected_total)}</Text></Text>
    </View>
    <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.fu_fee_title", { pct: panel.fee_pct })}</Text>
      <Text style={ui.muted}>{tr("sv.fu_fee_info")}</Text>
      <Text style={ui.text}>{tr("sv.ev_fee_total", { total: formatPrice(panel.fee_total) })}<Text style={ui.label}>{formatPrice(panel.fee_due)}</Text></Text>
      {panel.fee_overdue && <Text style={ui.error}>{tr("sv.fu_fee_overdue")}</Text>}
      {panel.fee_pending && <Text style={ui.text}>{tr("sv.ev_fee_pending")}</Text>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <FeePayBox stationId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <Button title={tr("sv.fu_pay_fee")} onPress={() => setPayOpen(true)} />)}
      <Text style={ui.muted}>{tr("sv.fu_fee_hint")}</Text>
    </View>
  </ScrollView>;
}

function FeePayBox({ stationId, uid, amount, settings, onDone, onClose }: { stationId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const { t: tr, tc, lang } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function pick(camera: boolean) { const p = await pickProof(camera, setError, { camera: tr("sv.cam_perm"), gallery: tr("sv.gallery_perm") }); if (p) setProof(p); }
  async function send() {
    if (!reference.trim() && !proof) { setError(tr("sv.pay_need_ref")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const body = await proofBytes(proof); const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(tr("sv.proof_fail")); path = up.data; }
      const r = await submitFuelFee(supabase(), stationId, { method, reference, proofPath: path }); if (r.error) throw r.error;
      onDone(tr("sv.fu_fee_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.label}>{tr("sv.amount_to_pay", { v: formatPrice(amount) })}</Text>
    <Text style={ui.label}>{tr("sv.pay_step1_plain")}</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>{tr("sv.pay_step2")}</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={tr("sv.pay_ref_ph")} accessibilityLabel={tr("sv.pay_ref_a11y")} {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={tr("sv.proof")} /><Button title={tr("sv.proof_remove")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={tr("sv.proof_photo")} variant="secondary" onPress={() => void pick(true)} /><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void pick(false)} /></View>}
    <Message error={error} />
    <Button title={busy ? tr("sv.sending") : tr("sv.send_payment")} disabled={busy} onPress={() => void send()} />
    <Button title={tr("common.cancel")} variant="secondary" onPress={onClose} />
  </View>;
}

export function AdminFuel() {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [stations, setStations] = useState<(FuelStation & { municipalities?: { name: string } | null })[]>([]); const [status, setStatus] = useState<"pending" | "approved" | "suspended">("pending");
  const [payments, setPayments] = useState<AdminFuelPayment[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reason, setReason] = useState(""); const [open, setOpen] = useState<string | null>(null);
  const [orderStatus, setOrderStatus] = useState<FuelOrderStatus | "all">("submitted"); const [orders, setOrders] = useState<AdminFuelOrder[]>([]);
  async function load() {
    const [a, b, c, d] = await Promise.all([listStationsForAdmin(supabase(), status), listFuelPaymentsForAdmin(supabase(), "pending"), getPlatformSettings(supabase()),
      listFuelOrdersForAdmin(supabase(), orderStatus === "all" ? "" : orderStatus)]);
    setStations(a.data); setPayments(b.data); setS(c.data); setOrders(d.data); if (a.error || b.error || d.error) setError(friendlyErrorIn(a.error ?? b.error ?? d.error, lang));
  }
  async function decideOrder(id: string, ok: boolean) {
    const r = await decideFuelPayment(supabase(), id, ok, ok ? undefined : tr("pp.reject_pay"));
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(tr("pp.decided")); void load(); }
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: FuelStation, to: "approved" | "suspended") {
    if (to === "suspended" && !reason.trim()) { setError(tr("sv.fua_why_suspend")); return; }
    const r = await setStationStatus(supabase(), x.id, to, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(to === "approved" ? tr("sv.fua_approved") : tr("sv.fua_suspended")); setOpen(null); setReason(""); await load(); }
  }
  async function decide(p: AdminFuelPayment, ok: boolean) {
    if (!ok && !reason.trim()) { setError(tr("sv.pra_why_not")); return; }
    const r = await decideFuelFee(supabase(), p.id, ok, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(tr("sv.done")); setOpen(null); setReason(""); await load(); }
  }
  async function save() {
    if (!s) return; const pct = Number(s.fuel_fee_pct), mins = Number(s.fuel_pay_minutes);
    if (!(pct >= 0 && pct <= 30) || !Number.isInteger(mins) || mins < 10 || mins > 1440) { setError(tr("sv.fua_bad")); return; }
    const r = await updatePlatformSettings(supabase(), { fuel_fee_pct: pct, fuel_pay_minutes: mins }); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(tr("sv.rules_saved")); }
  }
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={tr("sv.reason_owner_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />;
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{tr("sv.fu_title")}</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label={tr("sv.fua_fee_pct")} value={String(s.fuel_fee_pct ?? "")} onChangeText={v => setS({ ...s, fuel_fee_pct: v })} keyboardType="decimal-pad" />
      <Field label={tr("sv.fua_minutes")} value={String(s.fuel_pay_minutes ?? "")} onChangeText={v => setS({ ...s, fuel_pay_minutes: Number(v) || 0 })} keyboardType="numeric" />
      <Button title={tr("common.save")} onPress={() => void save()} />
    </View>}
    <Chips options={[{ value: "pending" as const, label: tr("sv.f_to_approve") }, { value: "approved" as const, label: tr("sv.f_approved_m") }, { value: "suspended" as const, label: tr("sv.f_suspended_m") }]} value={status} onChange={setStatus} />
    {stations.length === 0 && <Text style={ui.text}>{tr("sv.fua_no_stations")}</Text>}
    {stations.map(x => <View key={x.id} style={ui.card}>
      <Text style={ui.label}>{x.name}</Text>
      <Text style={ui.muted}>{stationRef(x.ref_no)} · {tc(FUEL_KIND_LABELS[x.kind])} · {x.municipalities?.name ?? "—"}{x.phone ? " · 📞 " + x.phone : ""}</Text>
      {x.status !== "approved" && <Button title={tr("sv.approve")} onPress={() => void setSt(x, "approved")} />}
      {x.status !== "suspended" && (open === x.id ? <>{reasonBox}<Button title={tr("sv.suspend")} variant="danger" onPress={() => void setSt(x, "suspended")} /></> : <Button title={tr("sv.suspend")} variant="secondary" onPress={() => { setOpen(x.id); setReason(""); }} />)}
    </View>)}
    <Text style={ui.label}>{tr("sv.fua_fees", { n: payments.length })}</Text>
    {payments.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(p.amount)} · {p.station_name}</Text>
      <Text style={ui.muted}>{stationRef(p.station_ref)} · {p.owner_name}{p.reference ? tr("sv.ref_x", { ref: p.reference }) : ""}</Text>
      {!!p.proof_path && <Button title={tr("sv.proof_doc")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); }} />}
      <Button title={tr("sv.confirm_ok")} onPress={() => void decide(p, true)} />
      {open === p.id ? <>{reasonBox}<Button title={tr("sv.decline_xx")} variant="danger" onPress={() => void decide(p, false)} /></> : <Button title={tr("sv.decline_xx")} variant="secondary" onPress={() => { setOpen(p.id); setReason(""); }} />}
    </View>)}
    <Text style={ui.label}>{tr("sv.fua_prepaid")}</Text>
    <Text style={ui.muted}>{tr("sv.fua_prepaid_hint")}</Text>
    <Chips options={[{ value: "submitted" as const, label: tr("sv.f_to_confirm") }, { value: "paid" as const, label: tr("sv.f_confirmed_m") }, { value: "rejected" as const, label: tr("sv.f_rejected_m") }, { value: "all" as const, label: tr("sv.f_all_m") }]}
      value={orderStatus} onChange={v => setOrderStatus(v as FuelOrderStatus | "all")} />
    {orders.length === 0 && <Text style={ui.text}>{tr("sv.fua_no_payments")}</Text>}
    {orders.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(o.total)} · {o.station_name} · {o.buyer_name}</Text>
      <Text style={ui.muted}>{fuelOrderRef(o.ref_no)} · {tc(fuelQuantityText(o.product, o.quantity))}{tr("sv.fua_fee", { v: formatPrice(o.fee_amount) })}{o.reference ? tr("sv.ref_x", { ref: o.reference }) : ""} · {tc(FUEL_ORDER_STATUS_LABELS[o.status])}</Text>
      {!!o.proof_path && <Button title={tr("sv.proof_doc")} variant="secondary" onPress={() => void openProof(o.proof_path!, setError, tr("sv.proof_open_fail"))} />}
      <Button title={tr("sv.fua_by_qr")} variant="secondary" onPress={() => router.push(("/combustivel/v/" + o.qr_token) as any)} />
      {o.status === "submitted" && <><Button title={tr("pp.confirm_pay")} onPress={() => void decideOrder(o.id, true)} />
        <Button title={tr("pp.reject_pay")} variant="danger" onPress={() => void decideOrder(o.id, false)} /></>}
    </View>)}
  </View>;
}

/** Ecrã aberto pelo QR: confirma se o pedido é verdadeiro; o posto confirma o pagamento e entrega aqui. */
export function FuelVerifyScreen({ token }: { token: string }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [v, setV] = useState<FuelOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""); const [rejecting, setRejecting] = useState(false);
  async function load() { const r = await fuelOrderByToken(supabase(), token); if (r.error) setError(friendlyErrorIn(r.error, lang)); setV(r.data ?? { result: "invalid" }); }
  useFocusEffect(useCallback(() => { void load(); }, [token]));
  if (!v) return <View style={ui.screen}><Text style={ui.text}>{tr("sv.tv_checking")}</Text></View>;
  if (v.result !== "ok") return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{tr("sv.fv_unknown")}</Text>
    <Text style={[ui.error, { fontSize: 19 }]}>{tr("sv.fv_unknown_text")}</Text>
  </ScrollView>;
  const live = v.status === "reserved" || v.status === "paid" || v.status === "submitted";
  async function deliver() {
    if (!v?.code || !v.station_id) return;
    setBusy(true); const r = await collectFuel(supabase(), v.station_id, v.code); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(tc(FUEL_COLLECT_LABELS[r.data?.result ?? ""] ?? String(r.data?.result))); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    if (!ok && !reason.trim()) { setError(tr("sv.pra_why_not")); return; }
    setBusy(true); const r = await decideFuelPayment(supabase(), v.id, ok, reason); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? tr("sv.fv_paid_ok") : tr("sv.pay_rejected")); setRejecting(false); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{v.status === "collected" ? tr("sv.fv_used") : live ? tr("sv.fv_ok") : tr("sv.fv_void")}</Text>
    <Text style={[live ? ui.ok : ui.error, { fontSize: 19 }]}>{fuelOrderRef(v.ref_no)} · {v.station_name} · {v.product ? tc(FUEL_PRODUCTS[v.product].label) + " · " + tc(fuelQuantityText(v.product, v.quantity ?? 0)) : ""}{"\n"}{v.status ? tc(FUEL_ORDER_STATUS_LABELS[v.status]) : ""}</Text>
    <Message error={error} ok={notice} />
    {v.role === "other" && <View style={ui.card}><Text style={ui.text}>{tr("sv.fv_other", { name: v.station_name ?? "" })}</Text>
      <Button title={tr("auth.login")} onPress={() => router.push("/login")} /></View>}
    {v.role !== "other" && <>
      <View style={ui.card}>
        <Text style={ui.text}>{tr("sv.fv_client")}<Text style={ui.label}>{v.buyer_name}</Text>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}{v.plate ? " · " + v.plate : ""}</Text>
        <Text style={ui.text}>{tr("sv.fv_fuel", { v: formatPrice(v.subtotal ?? 0) })}</Text>
        <Text style={ui.text}>{tr("sv.fv_fee", { pct: v.fee_pct ? ` (${v.fee_pct}%)` : "", v: formatPrice(v.fee_amount ?? 0) })}</Text>
        <Text style={ui.label}>{tr("sv.total", { v: formatPrice(v.total ?? 0) })} · {v.method === "prepaid" ? tr("sv.fv_prepaid") : tr("sv.fv_at_station")}</Text>
        {!!v.reference && <Text style={ui.text}>{tr("sv.fv_ref")}<Text style={ui.label}>{v.reference}</Text></Text>}
        {!!v.code && <Text style={ui.text}>{tr("sv.fv_code")}<Text style={ui.label}>{v.code}</Text></Text>}
      </View>
      {!!v.proof_path && <Button title={tr("sv.proof_see")} variant="secondary" onPress={() => void openProof(v.proof_path!, setError, tr("sv.proof_open_fail"))} />}
      {v.role === "station" && v.status === "submitted" && <View style={ui.card}>
        <Text style={ui.label}>{tr("sv.fv_check", { v: formatPrice(v.total ?? 0), ref: fuelOrderRef(v.ref_no) })}</Text>
        {rejecting ? <><TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={tr("sv.reason_client_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />
          <Button title={tr("sv.ina_not_received")} variant="danger" disabled={busy} onPress={() => void decide(false)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setRejecting(false)} /></>
          : <><Button title={tr("sv.ev_got_money")} disabled={busy} onPress={() => Alert.alert(tr("sv.ina_confirm_pay"), tr("sv.fv_received_q", { v: formatPrice(v.total ?? 0) }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes"), onPress: () => void decide(true) }])} />
            <Button title={tr("sv.ina_not_received")} variant="secondary" onPress={() => setRejecting(true)} /></>}
      </View>}
      {v.role === "station" && (v.status === "reserved" || v.status === "paid") && <Button title={v.status === "reserved" ? tr("sv.fv_charge", { v: formatPrice(v.total ?? 0) }) : tr("sv.fv_paid_deliver")} disabled={busy}
        onPress={() => Alert.alert(tr("sv.fv_deliver"), tr("sv.fv_deliver_q", { q: tc(fuelQuantityText(v.product!, v.quantity ?? 0)), name: v.buyer_name ?? "" }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes"), onPress: () => void deliver() }])} />}
    </>}
  </ScrollView>;
}
