import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";
import { venueFeed, venueDetail, myVenues, saveVenue, listVenueItems, saveVenueItem, setVenueItemAvailable, deleteVenueItem, reserveVenue, submitVenuePayment,
  decideVenuePayment, completeVenueOrder, cancelVenueOrder, venueOrderByToken, myVenueOrders, venuePanel, submitVenueFee, listVenuesForAdmin, setVenueStatus,
  listVenuePaymentsForAdmin, decideVenueFee, listVenueOrdersForAdmin, venueKindFromSlug, venueOrderKinds, venueRef, venueOrderRef, nightsBetween, nightsText,
  dateText, luandaToday, addDays, luandaDateTimeToIso, venuePriceText, venueAvailabilityText, venueFeedBadge, venueLineText, venueOrderSummary, venueFeeBreakdown,
  venueFeeNotice, venueOwnerFeeNotice, venueVerifyUrl, venueTokenFromText, venueTransferNote, venueShareMessage, validateVenue, validateVenueItem, validateVenueReserve,
  listMyBusinesses, getPlatformSettings, paymentProofUrl, uploadPaymentProof, uploadClassifiedMedia, base64ToArrayBuffer, sha256Hex, qrMatrix, holdText, formatPrice,
  formatEventDate, friendlyErrorIn, whatsappLink, LANG_TAGS, VENUE_KINDS, VENUE_KIND_LIST, VENUE_SUBTYPE_LABELS, VENUE_ORDER_KIND_LABELS, VENUE_METHOD_LABELS, VENUE_STATUS_LABELS,
  VENUE_ORDER_STATUS_LABELS, VENUE_COMPLETE_LABELS, VENUE_ACTIVE_ORDER, VENUE_MAX_PHOTOS, PLAN_METHOD_LABELS,
  type VenueKind, type VenueSubtype, type VenueOrderKind, type VenueMethod, type VenueStatus, type VenueOrderStatus, type VenueFeedRow, type VenueItem, type VenueDetail,
  type MyVenue, type MyVenueOrder, type VenueOrder, type VenuePanel, type VenueOrderView, type VenueCompleteResult, type VenueLine, type AdminVenue,
  type AdminVenuePayment, type AdminVenueOrder, type VenueReserveInput, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { usePlatformCollects } from "../lib/platform";
import { useTerritory } from "./Directory";
import { QrScanButton } from "./QrScanner";
import { LiteImage } from "./LiteImage";
import { ProfileQr } from "./ProfileQr";
import { useT, formatDateTimeIn } from "../lib/i18n";

const ph = { placeholderTextColor: C.muted };
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toNum = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", "."));
const qtyLabel = (q: number) => Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100).replace(".", ",");
const LIVE: VenueOrderStatus[] = ["reserved", "paid", "submitted"];

function LoginNeeded({ title }: { title: string }) {
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{title}</Text><Text style={ui.text}>{tr("sv.login_continue")}</Text>
    <Button title={tr("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
}
function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { t: tr, tc, lang } = useT();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 48 }}>
    <Text style={{ fontSize: 24, color: C.ink }}>{on ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}
/** QR único do pedido: leva ao site, que confirma se é verdadeiro. */
function CodeBox({ code, token }: { code: string; token?: string | null }) {
  const { t: tr, tc, lang } = useT();
  const m = qrMatrix(token ? venueVerifyUrl(siteUrl, token) : code); const cell = Math.floor(200 / (m.length + 4));
  return <View style={[ui.card, { alignItems: "center" }]}>
    <View accessible accessibilityLabel={tr("sv.fu_qr_a11y", { code })} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8 }}>
      {m.map((row, y) => <View key={y} style={{ flexDirection: "row" }}>{row.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#000" : "#fff" }} />)}</View>)}
    </View>
    <Text selectable style={[ui.h1, { letterSpacing: 3 }]}>{code}</Text>
    <Text style={ui.muted}>{tr("sv.ve_qr_hint")}</Text>
  </View>;
}
async function openProof(path: string, onError: (m: string) => void, tr: (k: string) => string) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) void Linking.openURL(r.data); else onError(tr("sv.proof_open_fail"));
}
type Local = { uri: string; base64?: string | null; mimeType: string };
async function pickProof(camera: boolean, onError: (m: string) => void, tr: (k: string) => string): Promise<Local | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { onError(camera ? tr("sv.cam_perm") : tr("sv.gallery_perm")); return null; }
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
async function localBytes(p: Local) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }
async function pickPhotos(max: number, camera: boolean): Promise<Local[] | string> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return camera ? "sv.cam_perm_photo" : "sv.gallery_perm"; // chave do texto do erro
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: !camera && max > 1, selectionLimit: max };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.length) return [];
  return Promise.all(r.assets.slice(0, max).map(a => shrinkAsset(a)));
}
async function uploadPhotos(uid: string, items: Local[], failMsg: string): Promise<string[]> {
  const urls: string[] = [];
  for (const p of items) {
    const r = await uploadClassifiedMedia(supabase(), await localBytes(p), uid, "foto.jpg", p.mimeType || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error(failMsg);
    urls.push(r.data);
  }
  return urls;
}
/** Fotografias pequenas; ao tocar abre em grande. */
function PhotoStrip({ photos, title }: { photos: string[]; title: string }) {
  const { t: tr, tc, lang } = useT();
  const [open, setOpen] = useState<number | null>(null); const { width } = useWindowDimensions();
  if (!photos.length) return null;
  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {photos.map((u, i) => <Pressable key={u} accessibilityRole="button" accessibilityLabel={tr("sv.ve_photo_a11y", { i: i + 1, title })} onPress={() => setOpen(i)}>
        <LiteImage placeholder="🖼️" source={{ uri: u }} style={{ width: 130, height: 96, borderRadius: 10 }} /></Pressable>)}
    </ScrollView>
    <Modal visible={open !== null} animationType="fade" onRequestClose={() => setOpen(null)}>
      {open !== null && <ScrollView contentContainerStyle={ui.screen}>
        <Image source={{ uri: photos[open] }} style={{ width: "100%", height: width, borderRadius: 12, backgroundColor: "#000" }} resizeMode="contain" accessibilityLabel={tr("sv.pf_photo_a11y", { title, i: open + 1, n: photos.length })} />
        <Text style={ui.h2}>{title}</Text>
        {photos.length > 1 && <View style={ui.row}>
          <Button title={tr("sv.prev")} variant="secondary" onPress={() => setOpen((open - 1 + photos.length) % photos.length)} />
          <Text style={ui.text}>{open + 1} / {photos.length}</Text>
          <Button title={tr("sv.next")} variant="secondary" onPress={() => setOpen((open + 1) % photos.length)} />
        </View>}
        <Button title={tr("common.close")} onPress={() => setOpen(null)} />
      </ScrollView>}
    </Modal>
  </>;
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t: tr, tc, lang } = useT();
  const today = luandaToday();
  return <View style={{ gap: 6 }}>
    <Field label={label} value={value} onChangeText={onChange} placeholder={tr("sv.date_ph")} keyboardType="numbers-and-punctuation" maxLength={10} />
    <Chips options={[{ value: today, label: tr("sv.today") }, { value: addDays(today, 1), label: tr("sv.tomorrow") }, { value: addDays(today, 2), label: tr("sv.after_tomorrow") }]} value={value} onChange={onChange} />
    {DATE_RE.test(value) && <Text style={ui.muted}>📅 {tc(dateText(value))}</Text>}
  </View>;
}
function LinesText({ lines }: { lines: VenueLine[] }) {
  const { t: tr, tc, lang } = useT();
  if (!lines.length) return null;
  return <View style={{ gap: 2 }}>{lines.map((l, i) => <Text key={i} style={ui.text}>• {tc(venueLineText(l))}{l.line_total != null ? " — " + formatPrice(l.line_total) : ""}</Text>)}</View>;
}

// --- Lista ------------------------------------------------------------------------------------
export function VenueListScreen({ tipo }: { tipo?: string }) {
  const { t: tr, tc, lang } = useT();
  const router = useRouter(); const { municipalities } = useTerritory();
  const [kind, setKind] = useState<VenueKind>(venueKindFromSlug(tipo) ?? "hotel");
  const [q, setQ] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [rows, setRows] = useState<VenueFeedRow[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { const k = venueKindFromSlug(tipo); if (k) setKind(k); }, [tipo]);
  async function load() {
    setRows(null); setError("");
    try { const r = await venueFeed(supabase(), kind, { municipalityId, query: q }); if (r.error) setError(friendlyErrorIn(r.error, lang)); setRows(r.data); }
    catch (e) { setError(friendlyErrorIn(e, lang)); setRows([]); }
  }
  useEffect(() => { void load(); }, [kind, municipalityId]);
  const K = VENUE_KINDS[kind];
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{tr("sv.ve_title")}</Text>
    <Text style={ui.muted}>{tr("sv.ve_intro")}</Text>
    <View style={{ gap: 8 }}>
      {VENUE_KIND_LIST.map(k => <Button key={k} title={`${VENUE_KINDS[k].icon} ${tc(VENUE_KINDS[k].label)}`} variant={k === kind ? "primary" : "secondary"} onPress={() => setKind(k)} />)}
    </View>
    <View style={ui.row}>
      <Link href={"/reservas/minhas" as any} style={ui.link}>{tr("sv.ve_my_link")}</Link>
    </View>
    <Link href={"/reservas/painel" as any} style={ui.link}>{tr("sv.ve_register_link")}</Link>
    <TextInput style={ui.input} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" placeholder={tr("sv.ve_search_ph")} accessibilityLabel={tr("sv.search_plain")} {...ph} />
    <Button title={tr("sv.search_btn")} variant="secondary" onPress={() => void load()} />
    {municipalities.length > 0 && <Chips options={[{ value: "all", label: tr("sv.fu_all_munis") }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId || "all"} onChange={v => setMunicipalityId(v === "all" ? "" : v)} />}
    <Message error={error} />
    <Text style={ui.h2}>{K.icon} {tc(K.label)}</Text>
    {rows === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : rows.length === 0 ? <Text style={ui.text}>{tr("sv.ve_none")}</Text> :
      rows.map(r => <Pressable key={r.id} accessibilityRole="link" onPress={() => router.push(("/reservas/" + r.id) as any)} style={[ui.card, { flexDirection: "row", gap: 12 }]}>
        {r.photo || r.logo_url ? <LiteImage placeholder={K.icon} source={{ uri: (r.photo || r.logo_url)! }} style={{ width: 92, height: 92, borderRadius: 12 }} />
          : <View style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 40 }}>{K.icon}</Text></View>}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ui.label, { fontSize: 18 }]}>{r.name}{r.verified ? " ✔" : ""}</Text>
          <Text style={ui.muted}>{tc(VENUE_SUBTYPE_LABELS[r.subtype])}{r.municipality_name ? " · " + r.municipality_name : ""}</Text>
          <Text style={{ color: r.has_now ? C.green : C.muted, fontWeight: "800", fontSize: 16 }}>{tc(venueFeedBadge(r))}</Text>
          {r.price_from != null && <Text style={ui.label}>{tr("sv.price_from_cap", { price: formatPrice(r.price_from) })}{kind === "hotel" ? tr("sv.per_night") : ""}</Text>}
        </View>
      </Pressable>)}
  </ScrollView>;
}

// --- Página do estabelecimento ------------------------------------------------------------------
export function VenueScreen({ id }: { id: string }) {
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  const [d, setD] = useState<VenueDetail | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null);
  const [from, setFrom] = useState(luandaToday()); const [to, setTo] = useState(addDays(luandaToday(), 1));
  const [error, setError] = useState("");
  async function load(f?: string, t?: string) {
    try {
      const r = await venueDetail(supabase(), id, f, t);
      if (r.error) setError(friendlyErrorIn(r.error, lang)); else setError("");
      setD(r.data);
      if (r.data?.kind === "hotel" && !f && r.data.from && r.data.to) { setFrom(r.data.from.slice(0, 10)); setTo(r.data.to.slice(0, 10)); }
    } catch (e) { setError(friendlyErrorIn(e, lang)); setD(null); }
  }
  useFocusEffect(useCallback(() => { void load(); void currentUserId().then(setUid).catch(() => setUid(null)); }, [id]));
  // Hotel: ao mudar as datas, volta a ver os quartos livres.
  useEffect(() => {
    if (d?.kind !== "hotel" || !DATE_RE.test(from) || !DATE_RE.test(to) || nightsBetween(from, to) < 1) return;
    if (d.from?.slice(0, 10) === from && d.to?.slice(0, 10) === to) return;
    void load(from, to);
  }, [from, to, d?.kind]);
  if (d === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!d) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{tr("sv.ve_not_found")}</Text><Message error={error} /><Link href={"/reservas" as any} style={ui.link}>{tr("sv.ve_back")}</Link></ScrollView>;
  const K = VENUE_KINDS[d.kind]; const b = d.business; const mine = !!uid && uid === d.owner_id;
  const wa = whatsappLink(b.whatsapp, tr("sv.fu_wa_hello", { name: b.name }));
  const sections: { name: string; items: VenueItem[] }[] = [];
  for (const it of d.items) { const s = it.section?.trim() || ""; let g = sections.find(x => x.name === s); if (!g) { g = { name: s, items: [] }; sections.push(g); } g.items.push(it); }
  const open = d.status === "approved" && d.accepts_reservations && !mine;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={("/reservas?tipo=" + K.slug) as any} style={ui.link}>← {tc(K.label)}</Link>
    {!!b.logo_url && <Image source={{ uri: b.logo_url }} style={{ width: 88, height: 88, borderRadius: 18 }} accessibilityLabel={tr("sv.logo")} />}
    <Text style={ui.h1}>{K.icon} {b.name}{b.verified ? " ✔" : ""}</Text>
    <Text style={ui.muted}>{tc(VENUE_SUBTYPE_LABELS[d.subtype])} · {venueRef(d.ref_no)}{b.municipality_name ? " · " + b.municipality_name : ""}</Text>
    {d.status !== "approved" && <Text style={ui.error}>{d.status === "pending" ? tr("sv.ve_pending") : tr("sv.ve_suspended")}</Text>}
    {mine && <Button title={tr("sv.ve_manage_mine")} onPress={() => router.push(`/reservas/${id}/gerir` as any)} />}
    {!!b.description && <Text style={ui.text}>{b.description}</Text>}
    {!!b.address_text && <Text style={ui.text}>📍 {b.address_text}</Text>}
    {!!d.opening_hours && <Text style={ui.text}>🕒 {d.opening_hours}</Text>}
    {d.kind === "hotel" && (!!d.check_in_time || !!d.check_out_time) && <Text style={ui.text}>{tr("sv.ve_checkin", { a: d.check_in_time ?? "—", b: d.check_out_time ?? "—" })}</Text>}
    {!!d.policies && <View style={ui.card}><Text style={ui.label}>{tr("sv.ve_rules")}</Text><Text style={ui.text}>{d.policies}</Text></View>}
    <View style={ui.row}>
      {!!b.phone && <Button title={tr("sv.call")} variant="secondary" onPress={() => void Linking.openURL("tel:" + b.phone!.replace(/\s/g, ""))} />}
      {!!wa && <Button title="WhatsApp" variant="secondary" onPress={() => void Linking.openURL(wa)} />}
      <Button title={tr("sv.share_short")} variant="secondary" onPress={() => void Share.share({ message: tc(venueShareMessage(siteUrl, { id, name: b.name, kind: d.kind, municipality_name: b.municipality_name })) })} />
    </View>
    <ProfileQr kind="reservas" id={id} name={b.name ?? ""} hint={mine ? tr("sv.qr.print_hint") : undefined} />
    <Button title={tr("sv.ve_portfolio")} variant="secondary" onPress={() => router.push(("/empresas/" + b.id) as any)} />
    <PlaceView directions={b.directions} lat={b.geo_lat} lng={b.geo_lng} />
    <Message error={error} />
    {d.kind === "hotel" && <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ve_when")}</Text>
      <DateField label={tr("sv.ve_in_date")} value={from} onChange={v => { setFrom(v); if (DATE_RE.test(v) && !(DATE_RE.test(to) && to > v)) setTo(addDays(v, 1)); }} />
      <Field label={tr("sv.ve_out_date")} value={to} onChangeText={setTo} placeholder={tr("sv.date_ph")} keyboardType="numbers-and-punctuation" maxLength={10} />
      {DATE_RE.test(from) && <Chips options={[1, 2, 3, 7].map(n => ({ value: addDays(from, n), label: tc(nightsText(n)) }))} value={to} onChange={setTo} />}
      {DATE_RE.test(from) && DATE_RE.test(to) && nightsBetween(from, to) >= 1 ? <Text style={ui.label}>{tc(dateText(from))} → {tc(dateText(to))} · {tc(nightsText(nightsBetween(from, to)))}</Text>
        : <Text style={ui.error}>{tr("sv.ve_bad_dates")}</Text>}
    </View>}
    <ReserveArea d={d} uid={uid} open={open} sections={sections} from={from} to={to} />
  </ScrollView>;
}

function ReserveArea({ d, uid, open, sections, from, to }: { d: VenueDetail; uid: string | null; open: boolean; sections: { name: string; items: VenueItem[] }[]; from: string; to: string }) {
  const { t: tr, tc, lang } = useT();
  const router = useRouter(); const K = VENUE_KINDS[d.kind];
  const kinds = venueOrderKinds(d.kind);
  const [orderKind, setOrderKind] = useState<VenueOrderKind>(kinds[0]);
  const [cart, setCart] = useState<Record<string, string>>({}); const [roomId, setRoomId] = useState<string | null>(null); const [rooms, setRooms] = useState("1");
  const [guests, setGuests] = useState("2"); const [day, setDay] = useState(luandaToday()); const [time, setTime] = useState("");
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const collects = usePlatformCollects();
  const [method, setMethod] = useState<VenueMethod>(d.accepts_pay_at_place ? "at_place" : "prepaid"); const [agree, setAgree] = useState(false);
  useEffect(() => { if (collects) setMethod("prepaid"); }, [collects]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const byId = (iid: string) => d.items.find(i => i.id === iid);
  function step(it: VenueItem, delta: number) {
    setCart(c => {
      const cur = toNum(c[it.id] ?? "0") || 0; const min = Math.max(1, it.min_qty || 1);
      let next = cur === 0 && delta > 0 ? min : cur + delta;
      if (next < min) next = 0;
      if (it.free != null && next > it.free) next = it.free;
      const n = { ...c }; if (next > 0) n[it.id] = qtyLabel(next); else delete n[it.id]; return n;
    });
  }
  const nights = d.kind === "hotel" ? nightsBetween(from, to) : 1;
  const room = roomId ? byId(roomId) : undefined;
  const lines = orderKind === "stay" ? (room ? [{ item: room, qty: toNum(rooms) }] : [])
    : Object.entries(cart).map(([iid, q]) => ({ item: byId(iid), qty: toNum(q) })).filter((l): l is { item: VenueItem; qty: number } => !!l.item && l.qty > 0);
  const sum = venueFeeBreakdown(lines.map(l => ({ price: l.item.price, qty: l.qty || 0 })), d.client_fee_pct, d.business_fee_pct, Math.max(1, nights));
  async function send() {
    const input: VenueReserveInput = { kind: orderKind, method, name, phone, lines, note,
      checkIn: orderKind === "stay" ? from : undefined, checkOut: orderKind === "stay" ? to : undefined,
      guests: orderKind === "order" ? undefined : Math.round(toNum(guests)) || undefined,
      slotAt: orderKind === "stay" ? null : luandaDateTimeToIso(day.trim(), time.trim()) };
    if (orderKind !== "stay" && time.trim() && !input.slotAt) { setError(tr("sv.ve_bad_time")); return; }
    const bad = validateVenueReserve(d, input); if (bad) { setError(tc(bad)); return; }
    if (!agree) { setError(tr("sv.fu_agree_need")); return; }
    setBusy(true); setError("");
    try { const r = await reserveVenue(supabase(), d.id, input); if (r.error) throw r.error; router.push("/reservas/minhas" as any); }
    catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  const showControls = open && !!uid;
  return <>
    <Text style={ui.h2}>{tc(K.items)}</Text>
    {d.items.length === 0 && <Text style={ui.text}>{tc(K.empty)}</Text>}
    {sections.map(s => <View key={s.name || "_"} style={{ gap: 10 }}>
      {!!s.name && <Text style={[ui.label, { fontSize: 19 }]}>{s.name}</Text>}
      {s.items.map(it => {
        const inCart = cart[it.id]; const picked = roomId === it.id; const can = it.available && (it.free == null || it.free > 0);
        return <View key={it.id} style={[ui.card, picked ? { borderColor: C.blue, borderWidth: 3 } : null]}>
          <PhotoStrip photos={it.photos} title={it.name} />
          <Text style={[ui.label, { fontSize: 18 }]}>{it.name}</Text>
          {!!it.description && <Text style={ui.text}>{it.description}</Text>}
          <Text style={ui.price}>{tc(venuePriceText(it, d.kind))}</Text>
          <Text style={{ color: can ? C.green : C.red, fontWeight: "800", fontSize: 16 }}>{tc(venueAvailabilityText(it, d.kind))}</Text>
          {d.kind === "hotel" && !!it.capacity && <Text style={ui.muted}>{it.capacity === 1 ? tr("sv.ve_capacity_one") : tr("sv.ve_capacity", { n: it.capacity })}</Text>}
          {d.kind === "warehouse" && it.min_qty > 1 && <Text style={ui.muted}>{tr("sv.ve_min", { q: qtyLabel(it.min_qty) + (it.unit ? " " + it.unit : "") })}</Text>}
          {showControls && can && (d.kind === "hotel"
            ? <Button title={picked ? tr("sv.ve_chosen") : tr("sv.ve_choose_room")} variant={picked ? "primary" : "secondary"} onPress={() => { setRoomId(picked ? null : it.id); setGuests(String(Math.min(Number(guests) || 1, it.capacity ?? 2))); }} />
            : <View style={[ui.row, { alignItems: "center" }]}>
              <Button title="➖" variant="secondary" disabled={!inCart} onPress={() => step(it, -1)} />
              <TextInput style={[ui.input, { minWidth: 80, textAlign: "center" }]} value={inCart ?? ""} placeholder="0" keyboardType="decimal-pad" accessibilityLabel={tr("sv.qty_of", { name: it.name })}
                onChangeText={v => setCart(c => { const n = { ...c }; if (v.trim()) n[it.id] = v; else delete n[it.id]; return n; })} {...ph} />
              <Button title="➕" onPress={() => step(it, 1)} />
              {!!it.unit && <Text style={ui.muted}>{it.unit}</Text>}
            </View>)}
        </View>;
      })}
    </View>)}
    {d.status === "approved" && !d.accepts_reservations &&
      <Text style={ui.text}>{tr("sv.ve_not_taking")}</Text>}
    {open && !uid && <View style={ui.card}><Text style={ui.text}>{tr("sv.ve_login_text")}</Text><Button title={tr("sv.fu_login_reserve")} onPress={() => router.push("/login")} /></View>}
    {showControls && <View style={[ui.card, { gap: 10 }]}>
      <Text style={ui.h2}>{d.kind === "hotel" ? tr("sv.ve_book_room") : d.kind === "restaurant" ? tr("sv.ve_book_or_order") : tr("sv.ve_place_order")}</Text>
      {kinds.length > 1 && <Chips options={kinds.map(k => ({ value: k, label: tc(VENUE_ORDER_KIND_LABELS[k]) }))} value={orderKind} onChange={setOrderKind} />}
      {orderKind === "stay" && <>
        <Text style={ui.text}>{room ? tr("sv.ve_room", { name: room.name }) : tr("sv.ve_pick_room")}</Text>
        <Field label={tr("sv.ve_rooms_q")} value={rooms} onChangeText={setRooms} keyboardType="number-pad" maxLength={3} />
        <Field label={tr("sv.ve_people_q")} value={guests} onChangeText={setGuests} keyboardType="number-pad" maxLength={3} />
      </>}
      {orderKind === "table" && <>
        <Field label={tr("sv.ve_table_q")} value={guests} onChangeText={setGuests} keyboardType="number-pad" maxLength={3} />
        <Text style={ui.muted}>{tr("sv.ve_table_hint")}</Text>
      </>}
      {orderKind === "order" && <Text style={ui.muted}>{lines.length ? (lines.length === 1 ? tr("sv.ve_one_product") : tr("sv.ve_n_products", { n: lines.length })) : tr("sv.ve_pick_products")}</Text>}
      {orderKind !== "stay" && <>
        <DateField label={orderKind === "table" ? tr("sv.ve_day") : tr("sv.ve_pickup_day")} value={day} onChange={setDay} />
        <Field label={orderKind === "table" ? tr("sv.ina_hour") : tr("sv.ve_pickup_hour")} value={time} onChangeText={setTime} placeholder="19:30" keyboardType="numbers-and-punctuation" maxLength={5} />
        <Chips options={["12:00", "13:00", "19:00", "20:00"].map(h => ({ value: h, label: h }))} value={time} onChange={setTime} />
      </>}
      {lines.length > 0 && <View style={{ gap: 2 }}>{lines.map(l => <Text key={l.item.id} style={ui.text}>• {qtyLabel(l.qty || 0)} × {l.item.name}{orderKind === "stay" ? ` × ${tc(nightsText(nights))}` : ""}</Text>)}</View>}
      <Field label={tr("sv.your_name")} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
      <Field label={tr("sv.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      <Field label={tr("sv.note_opt")} value={note} onChangeText={setNote} maxLength={300} placeholder={d.kind === "hotel" ? tr("sv.ve_note_hotel_ph") : tr("sv.ve_note_food_ph")} />
      {collects ? <Text style={ui.muted}>{tr("pp.pay_platform")}</Text> : d.accepts_pay_at_place && d.accepts_prepay ? <Chips options={(["at_place", "prepaid"] as VenueMethod[]).map(m => ({ value: m, label: tc(VENUE_METHOD_LABELS[m]) }))} value={method} onChange={setMethod} />
        : <Text style={ui.label}>💳 {tc(VENUE_METHOD_LABELS[method])}</Text>}
      {lines.length > 0 && <View style={ui.card}>
        <Text style={ui.text}>{tr("sv.ve_price", { n: orderKind === "stay" ? ` (${tc(nightsText(nights))})` : "", v: formatPrice(sum.subtotal) })}</Text>
        <Text style={ui.text}>{tr("sv.fu_fee_line", { pct: d.client_fee_pct, v: formatPrice(sum.clientFee) })}</Text>
        <Text style={[ui.label, { fontSize: 19 }]}>{tr("sv.ve_total_place", { v: formatPrice(sum.total) })}</Text>
      </View>}
      <Check on={agree} onPress={() => setAgree(!agree)} label={tc(venueFeeNotice(d.client_fee_pct)) + tr("sv.fu_agree")} />
      <Text style={ui.muted}>{method === "at_place" ? tr("sv.ve_at_place_hint", { n: Math.round(d.hold_minutes) })
        : tr("sv.ve_prepaid_hint")}</Text>
      <Message error={error} />
      <Button title={busy ? tr("sv.sending") : orderKind === "order" ? tr("sv.order_ok") : tr("sv.reserve_ok")} disabled={busy} onPress={() => void send()} />
    </View>}
  </>;
}

// --- As minhas reservas --------------------------------------------------------------------------
export function MyVenueOrdersScreen() {
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyVenueOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myVenueOrders(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }).catch(() => setUid(null)); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.ve_my")} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/reservas" as any} style={ui.link}>{tr("sv.ve_back")}</Link>
    <Text style={ui.h1}>{tr("sv.ve_my")}</Text>
    <Text style={ui.muted}>{tr("sv.ve_my_hint")}</Text>
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{tr("sv.ve_my_empty")}</Text> :
      items.map(o => <MyOrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </ScrollView>;
}
function MyOrderCard({ o, onDone, onError }: { o: MyVenueOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<Local | null>(null); const [busy, setBusy] = useState(false);
  async function pay() {
    if (!proof) { onError(tr("sv.fu_need_proof")); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError(tr("sv.fu_need_ref")); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(tr("sv.sign_in_account"));
      const body = await localBytes(proof); const hash = sha256Hex(body);
      const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(tr("sv.proof_fail"));
      const r = await submitVenuePayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone(tr("sv.ve_proof_sent"));
    } catch (e) { onError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  async function cancel() { const r = await cancelVenueOrder(supabase(), o.id); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(tr("sv.order_cancelled")); }
  const needPay = o.method === "prepaid" && (o.status === "awaiting_payment" || o.status === "rejected");
  const ok = o.status === "reserved" || o.status === "paid" || o.status === "completed";
  return <View style={ui.card}>
    <Pressable accessibilityRole="link" onPress={() => router.push(("/reservas/" + o.venue_id) as any)}><Text style={[ui.link, { fontSize: 19 }]}>{VENUE_KINDS[o.venue_kind].icon} {o.venue_name}</Text></Pressable>
    <Text style={ui.muted}>{venueOrderRef(o.ref_no)} · {tc(VENUE_ORDER_KIND_LABELS[o.kind])} · {formatDateTimeIn(o.created_at, lang)}</Text>
    <Text style={ui.text}>{tc(venueOrderSummary(o))}</Text>
    <Text style={[ui.label, { fontSize: 19 }]}>{tr("sv.total", { v: formatPrice(o.total) })}</Text>
    {o.client_fee > 0 && <Text style={ui.muted}>{tr("sv.ve_fee_line", { a: formatPrice(o.subtotal), b: formatPrice(o.client_fee), pct: o.client_fee_pct })}</Text>}
    <Text style={{ color: ok ? C.green : o.status === "rejected" ? C.red : C.ink, fontWeight: "800", fontSize: 17 }}>{tc(VENUE_ORDER_STATUS_LABELS[o.status])}
      {o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · " + tc(holdText(o.hold_until)) : ""}</Text>
    {!!o.note && (o.status === "rejected" || o.status === "cancelled") && <Text style={ui.error}>{tr("sv.reason", { note: o.note })}</Text>}
    {!!o.code && LIVE.includes(o.status) && <CodeBox code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <Text style={ui.muted}>{tr("sv.ve_confirming")}</Text>}
    {LIVE.includes(o.status) && <>
      {!!o.address_text && <Text style={ui.text}>📍 {o.address_text}</Text>}
      <PlaceView directions={o.directions} lat={o.geo_lat} lng={o.geo_lng} />
      {!!o.phone && <Button title={tr("sv.ve_call")} variant="secondary" onPress={() => void Linking.openURL("tel:" + o.phone!.replace(/\s/g, ""))} />}
    </>}
    {needPay && <>
      <Text style={ui.label}>{tr("sv.ve_pay_place", { v: formatPrice(o.total), by: o.pay_by ? " " + tc(holdText(o.pay_by)) : "" })}</Text>
      <View style={ui.card}>
        {!!o.pay_holder && <Text style={ui.text}>{tr("sv.holder_x")}<Text style={ui.label}>{o.pay_holder}</Text></Text>}
        {!!o.pay_iban && <Text selectable style={ui.text}>IBAN: <Text style={ui.label}>{o.pay_iban}</Text></Text>}
        {!!o.pay_express && <Text selectable style={ui.text}>Multicaixa Express: <Text style={ui.label}>{o.pay_express}</Text></Text>}
        {!!o.pay_note && <Text style={ui.muted}>{o.pay_note}</Text>}
      </View>
      <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12, gap: 4 }}>
        <Text style={ui.label}>✍️ {tc(venueTransferNote(o.ref_no))}</Text>
        <Text style={ui.text}>{tr("sv.ve_only_account")}</Text>
      </View>
      <Text style={ui.label}>{tr("sv.fu_send_proof")}</Text>
      <Chips options={(["multicaixa_express", "bank_transfer"] as const).map(m => ({ value: m, label: tc(PLAN_METHOD_LABELS[m]) }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={tr("sv.pay_ref_ph")} accessibilityLabel={tr("sv.pay_ref_a11y")} {...ph} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={tr("sv.proof")} /><Button title={tr("sv.proof_change")} variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title={tr("sv.proof_photo")} variant="secondary" onPress={() => void pickProof(true, onError, tr).then(p => p && setProof(p))} /><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void pickProof(false, onError, tr).then(p => p && setProof(p))} /></View>}
      <Button title={busy ? tr("sv.sending") : tr("sv.fu_paid_send")} disabled={busy} onPress={() => void pay()} />
    </>}
    {(o.status === "reserved" || o.status === "awaiting_payment" || o.status === "rejected") && <Button title={tr("common.cancel")} variant="secondary" onPress={() => Alert.alert(tr("sv.ve_cancel_q"), "", [{ text: tr("sv.no"), style: "cancel" }, { text: tr("common.cancel"), onPress: () => void cancel() }])} />}
  </View>;
}

// --- Registar / editar o estabelecimento ---------------------------------------------------------------
type Biz = { id: string; name: string };
function VenueForm({ uid, venue, businesses, onSaved }: { uid: string; venue?: MyVenue; businesses: Biz[]; onSaved: (id: string) => void }) {
  const { t: tr, tc, lang } = useT();
  const [businessId, setBusinessId] = useState(venue?.business_id ?? (businesses.length === 1 ? businesses[0].id : ""));
  const [kind, setKind] = useState<VenueKind>(venue?.kind ?? "hotel"); const [subtype, setSubtype] = useState<VenueSubtype>(venue?.subtype ?? "hotel");
  const [reserv, setReserv] = useState(venue?.accepts_reservations ?? true); const [atPlace, setAtPlace] = useState(venue?.accepts_pay_at_place ?? true);
  const [prepay, setPrepay] = useState(venue?.accepts_prepay ?? false); const [hold, setHold] = useState(String(venue?.hold_minutes ?? 60));
  const [checkIn, setCheckIn] = useState(venue?.check_in_time ?? ""); const [checkOut, setCheckOut] = useState(venue?.check_out_time ?? "");
  const [hours, setHours] = useState(venue?.opening_hours ?? ""); const [policies, setPolicies] = useState(venue?.policies ?? "");
  const [pay, setPay] = useState({ holder: venue?.pay?.holder ?? "", iban: venue?.pay?.iban ?? "", express: venue?.pay?.express ?? "", note: venue?.pay?.note ?? "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save() {
    const input = { businessId, kind, subtype, acceptsReservations: reserv, acceptsPayAtPlace: atPlace, acceptsPrepay: prepay, holdMinutes: Math.round(toNum(hold)),
      checkInTime: kind === "hotel" ? checkIn : "", checkOutTime: kind === "hotel" ? checkOut : "", openingHours: hours, policies, pay };
    const bad = validateVenue(input); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    try { const r = await saveVenue(supabase(), uid, input, venue?.id); if (r.error || !r.data) throw r.error ?? new Error(tr("sv.save_fail")); onSaved(r.data.id); }
    catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>{venue ? tr("sv.ve_settings") : tr("sv.ve_register")}</Text>
    {!venue && <>
      <Text style={ui.label}>{tr("sv.ve_which_biz")}</Text>
      {businesses.length === 0 ? <Text style={ui.error}>{tr("sv.ve_need_biz")}</Text>
        : <Chips options={businesses.map(b => ({ value: b.id, label: b.name }))} value={businessId} onChange={setBusinessId} />}
      <Text style={ui.label}>{tr("sv.ve_what")}</Text>
      <View style={{ gap: 8 }}>{VENUE_KIND_LIST.map(k => <Button key={k} title={`${VENUE_KINDS[k].icon} ${tc(VENUE_KINDS[k].label)}`} variant={k === kind ? "primary" : "secondary"}
        onPress={() => { setKind(k); setSubtype(VENUE_KINDS[k].subtypes[0]); }} />)}</View>
    </>}
    {!!venue && <Text style={ui.text}>{VENUE_KINDS[kind].icon} {tc(VENUE_KINDS[kind].label)} · {venue.business_name}</Text>}
    <Text style={ui.label}>{tr("sv.type")}</Text>
    <Chips options={VENUE_KINDS[kind].subtypes.map(s => ({ value: s, label: tc(VENUE_SUBTYPE_LABELS[s]) }))} value={subtype} onChange={setSubtype} />
    <Check on={reserv} onPress={() => setReserv(!reserv)} label={tr("sv.ve_accept")} />
    <Check on={atPlace} onPress={() => setAtPlace(!atPlace)} label={tr("sv.ve_pay_place_ok")} />
    <Check on={prepay} onPress={() => setPrepay(!prepay)} label={tr("sv.ve_prepay_ok")} />
    <Field label={tr("sv.ve_hold")} value={hold} onChangeText={setHold} keyboardType="number-pad" maxLength={4} />
    {kind === "hotel" && <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 140 }}><Field label={tr("sv.ve_checkin_from")} value={checkIn} onChangeText={setCheckIn} placeholder="14:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      <View style={{ flex: 1, minWidth: 140 }}><Field label={tr("sv.ve_checkout_by")} value={checkOut} onChangeText={setCheckOut} placeholder="12:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
    </View>}
    <Field label={tr("sv.hours_opt")} value={hours} onChangeText={setHours} maxLength={120} placeholder={tr("sv.ve_hours_ph")} />
    <Text style={ui.label}>{tr("sv.ve_rules_opt")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={policies} onChangeText={setPolicies} maxLength={600} placeholder={tr("sv.ve_rules_ph")} accessibilityLabel={tr("sv.ve_rules_plain")} {...ph} />
    {prepay && <View style={ui.card}>
      <Text style={ui.label}>{tr("sv.ve_pay_account")}</Text>
      <Text style={ui.muted}>{tr("sv.ve_account_warn")}</Text>
      <Field label={tr("sv.holder")} value={pay.holder} onChangeText={v => setPay({ ...pay, holder: v })} maxLength={80} />
      <Field label="IBAN" value={pay.iban} onChangeText={v => setPay({ ...pay, iban: v })} maxLength={40} autoCapitalize="characters" placeholder="AO06 …" />
      <Field label="Multicaixa Express" value={pay.express} onChangeText={v => setPay({ ...pay, express: v })} keyboardType="phone-pad" maxLength={20} />
      <Field label={tr("sv.ev_payer_note")} value={pay.note} onChangeText={v => setPay({ ...pay, note: v })} maxLength={200} />
    </View>}
    <Message error={error} />
    <Button title={busy ? tr("sv.recording") : venue ? tr("sv.save_disk") : tr("sv.register_ok")} disabled={busy} onPress={() => void save()} />
  </View>;
}

export function VenueDashboardScreen() {
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [venues, setVenues] = useState<MyVenue[] | null>(null); const [biz, setBiz] = useState<Biz[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  async function load(u: string) {
    const [a, b, s] = await Promise.all([myVenues(supabase()), listMyBusinesses(supabase(), u), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); setVenues(a.data); setBiz(((b.data ?? []) as Biz[]).map(x => ({ id: x.id, name: x.name }))); setSettings(s.data as PlatformSettings | null);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }).catch(() => setUid(null)); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.ve_my_venue")} />;
  const used = new Set((venues ?? []).map(v => v.business_id)); const free = biz.filter(b => !used.has(b.id));
  const cp = Number(settings?.venue_client_fee_pct ?? 5), bp = Number(settings?.venue_business_fee_pct ?? 5);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/reservas" as any} style={ui.link}>{tr("sv.ve_back")}</Link>
    <Text style={ui.h1}>{tr("sv.ve_my_venue")}</Text>
    <Text style={ui.text}>{tr("sv.vd_intro")}</Text>
    <Text style={ui.muted}>{tr("sv.vd_steps")}</Text>
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12 }}><Text style={ui.text}>{tc(venueOwnerFeeNotice(cp, bp))}</Text></View>
    <Message error={error} />
    {venues === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : venues.map(v => <Pressable key={v.id} accessibilityRole="link" onPress={() => router.push(`/reservas/${v.id}/gerir` as any)} style={ui.card}>
      <Text style={[ui.label, { fontSize: 18 }]}>{VENUE_KINDS[v.kind].icon} {v.business_name}</Text>
      <Text style={ui.muted}>{venueRef(v.ref_no)} · {tc(VENUE_SUBTYPE_LABELS[v.subtype])}</Text>
      <Text style={{ color: v.status === "approved" ? C.green : v.status === "suspended" ? C.red : C.ink, fontWeight: "800", fontSize: 16 }}>{tc(VENUE_STATUS_LABELS[v.status])}</Text>
      {!!v.admin_note && v.status !== "approved" && <Text style={ui.error}>{tr("sv.admin_note", { note: v.admin_note })}</Text>}
      <Text style={ui.link}>{tr("sv.manage_arrow")}</Text>
    </Pressable>)}
    {venues !== null && (open ? <VenueForm uid={uid} businesses={free} onSaved={id => router.replace(`/reservas/${id}/gerir` as any)} />
      : <Button title={tr("sv.ve_register")} onPress={() => setOpen(true)} />)}
    {venues !== null && free.length === 0 && <Button title={tr("sv.vd_register_biz")} variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />}
  </ScrollView>;
}

// --- Gerir --------------------------------------------------------------------------------------
type ItemDraft = { name: string; section: string; description: string; price: string; unit: string; capacity: string; qty: string; minQty: string; available: boolean; photos: string[]; local: Local[] };
const emptyDraft: ItemDraft = { name: "", section: "", description: "", price: "", unit: "", capacity: "2", qty: "", minQty: "1", available: true, photos: [], local: [] };

function ItemForm({ uid, venueId, kind, item, onDone, onClose }: { uid: string; venueId: string; kind: VenueKind; item?: VenueItem; onDone: (m: string) => void; onClose: () => void }) {
  const { t: tr, tc, lang } = useT();
  const [f, setF] = useState<ItemDraft>(item ? { name: item.name, section: item.section ?? "", description: item.description ?? "", price: String(item.price), unit: item.unit ?? "",
    capacity: String(item.capacity ?? 2), qty: item.qty_total == null ? "" : String(item.qty_total), minQty: String(item.min_qty || 1), available: item.available, photos: item.photos, local: [] } : emptyDraft);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const total = f.photos.length + f.local.length;
  async function add(camera: boolean) {
    const p = await pickPhotos(VENUE_MAX_PHOTOS - total, camera);
    if (typeof p === "string") { setError(tr(p)); return; }
    setF(x => ({ ...x, local: [...x.local, ...p].slice(0, VENUE_MAX_PHOTOS - x.photos.length) }));
  }
  async function save() {
    const base = { name: f.name, section: f.section, description: f.description, price: toNum(f.price), unit: f.unit, available: f.available,
      capacity: kind === "hotel" ? Math.round(toNum(f.capacity)) : null, qtyTotal: f.qty.trim() ? toNum(f.qty) : (kind === "hotel" ? NaN : null), minQty: kind === "warehouse" ? toNum(f.minQty) || 1 : 1 };
    const bad = validateVenueItem(kind, { ...base, photos: [...f.photos, ...f.local.map(l => l.uri)] }); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    try {
      const uploaded = await uploadPhotos(uid, f.local, tr("sv.photo_upload_fail"));
      const r = await saveVenueItem(supabase(), venueId, kind, { ...base, photos: [...f.photos, ...uploaded] }, item?.id); if (r.error) throw r.error;
      onDone(item ? tr("sv.saved_short") : tr("sv.added_to_list"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  const K = VENUE_KINDS[kind];
  return <View style={[ui.card, { gap: 10, borderColor: C.blue, borderWidth: 2 }]}>
    <Text style={ui.h2}>{item ? tr("sv.edit_pen") : "➕ " + tc(K.item)}</Text>
    <Field label={kind === "hotel" ? tr("sv.vi_room_type") : tr("sv.name")} value={f.name} onChangeText={v => setF({ ...f, name: v })} maxLength={100} placeholder={kind === "hotel" ? tr("sv.vi_name_hotel_ph") : kind === "restaurant" ? tr("sv.vi_name_food_ph") : tr("sv.vi_name_wh_ph")} />
    <Field label={tr("sv.vi_section")} value={f.section} onChangeText={v => setF({ ...f, section: v })} maxLength={60} placeholder={kind === "hotel" ? tr("sv.vi_sec_hotel_ph") : kind === "restaurant" ? tr("sv.vi_sec_food_ph") : tr("sv.vi_sec_wh_ph")} />
    <Text style={ui.label}>{tr("sv.description_opt")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={f.description} onChangeText={v => setF({ ...f, description: v })} maxLength={600} accessibilityLabel={tr("sv.description")} {...ph} />
    <Field label={tr("sv.vi_price_per", { unit: f.unit.trim() || (kind === "hotel" ? tr("sv.unit_night") : kind === "warehouse" ? tr("sv.unit_unit") : tr("sv.unit_dish")) })} value={f.price} onChangeText={v => setF({ ...f, price: v })} keyboardType="decimal-pad" />
    <Field label={tr("sv.vi_unit")} value={f.unit} onChangeText={v => setF({ ...f, unit: v })} maxLength={30} placeholder={kind === "hotel" ? tr("sv.unit_night") : kind === "warehouse" ? tr("sv.vi_unit_wh_ph") : tr("sv.vi_unit_food_ph")} />
    {kind === "hotel" && <>
      <Field label={tr("sv.vi_rooms_count")} value={f.qty} onChangeText={v => setF({ ...f, qty: v })} keyboardType="number-pad" maxLength={4} />
      <Field label={tr("sv.vi_capacity")} value={f.capacity} onChangeText={v => setF({ ...f, capacity: v })} keyboardType="number-pad" maxLength={2} />
    </>}
    {kind !== "hotel" && <Field label={tr("sv.vi_qty")} value={f.qty} onChangeText={v => setF({ ...f, qty: v })} keyboardType="decimal-pad" />}
    {kind === "warehouse" && <Field label={tr("sv.vi_min")} value={f.minQty} onChangeText={v => setF({ ...f, minQty: v })} keyboardType="decimal-pad" />}
    <Check on={f.available} onPress={() => setF({ ...f, available: !f.available })} label={kind === "hotel" ? tr("sv.vi_available_hotel") : tr("sv.vi_available")} />
    <Text style={ui.label}>{tr("sv.photos_count", { n: total, max: VENUE_MAX_PHOTOS })}</Text>
    <View style={ui.row}>
      {f.photos.map(u => <Pressable key={u} onPress={() => setF({ ...f, photos: f.photos.filter(x => x !== u) })} accessibilityLabel={tr("sv.remove_photo")}><Image source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>{tr("sv.remove_x")}</Text></Pressable>)}
      {f.local.map((l, i) => <Pressable key={l.uri} onPress={() => setF({ ...f, local: f.local.filter((_, j) => j !== i) })} accessibilityLabel={tr("sv.remove_photo")}><Image source={{ uri: l.uri }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>{tr("sv.remove_x")}</Text></Pressable>)}
    </View>
    {total < VENUE_MAX_PHOTOS && <View style={ui.row}><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void add(false)} /><Button title={tr("sv.id_shoot")} variant="secondary" onPress={() => void add(true)} /></View>}
    <Message error={error} />
    <Button title={busy ? tr("sv.sending") : tr("sv.save_disk")} disabled={busy} onPress={() => void save()} />
    <Button title={tr("common.cancel")} variant="secondary" onPress={onClose} />
  </View>;
}

function ItemRow({ it, kind, onEdit, onDone, onError }: { it: VenueItem; kind: VenueKind; onEdit: () => void; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { t: tr, tc, lang } = useT();
  const [qty, setQty] = useState(it.qty_total == null ? "" : String(it.qty_total)); const [busy, setBusy] = useState(false);
  useEffect(() => { setQty(it.qty_total == null ? "" : String(it.qty_total)); }, [it.qty_total]);
  async function set(available: boolean, withQty = false) {
    setBusy(true);
    const q = withQty ? (qty.trim() ? toNum(qty) : null) : undefined;
    if (withQty && q != null && !(q >= 0)) { setBusy(false); onError(tr("sv.bad_qty")); return; }
    const r = await setVenueItemAvailable(supabase(), it.id, available, q); setBusy(false);
    if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(`${it.name}: ${available ? tr("sv.vi_has") : tr("sv.vi_hasnt")}`);
  }
  function remove() {
    Alert.alert(tr("common.delete"), tr("sv.vi_delete_q", { name: it.name }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("common.delete"), style: "destructive", onPress: async () => {
      const r = await deleteVenueItem(supabase(), it.id); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(tr("sv.vi_deleted"));
    } }]);
  }
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", gap: 10 }}>
      {it.photos[0] ? <LiteImage placeholder="🖼️" source={{ uri: it.photos[0] }} style={{ width: 72, height: 72, borderRadius: 10 }} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.label}>{it.name}{it.section ? ` · ${it.section}` : ""}</Text>
        <Text style={ui.text}>{tc(venuePriceText(it, kind))}</Text>
        <Text style={{ color: it.available ? C.green : C.red, fontWeight: "800", fontSize: 16 }}>{it.available ? tr("sv.vi_has") : tr("sv.vi_hasnt")}{it.qty_total != null ? ` · ${kind === "hotel" ? tr("sv.vi_rooms_x") : tr("sv.vi_qty_x")}: ${qtyLabel(it.qty_total)}` : ""}</Text>
      </View>
    </View>
    <View style={ui.row}>
      <Button title={tr("sv.vi_has")} variant={it.available ? "primary" : "secondary"} disabled={busy} onPress={() => void set(true)} />
      <Button title={tr("sv.vi_hasnt")} variant={it.available ? "secondary" : "danger"} disabled={busy} onPress={() => void set(false)} />
    </View>
    <View style={[ui.row, { alignItems: "center" }]}>
      <TextInput style={[ui.input, { minWidth: 100 }]} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder={kind === "hotel" ? tr("sv.vi_rooms_ph") : tr("sv.quantity")} accessibilityLabel={tr("sv.qty_of", { name: it.name })} {...ph} />
      <Button title={tr("sv.vi_save_qty")} variant="secondary" disabled={busy} onPress={() => void set(it.available, true)} />
    </View>
    <View style={ui.row}>
      <Button title={tr("sv.edit_pen")} variant="secondary" onPress={onEdit} />
      <Button title={tr("common.delete")} variant="danger" onPress={remove} />
    </View>
  </View>;
}

function CompleteResult({ r }: { r: VenueCompleteResult }) {
  const { t: tr, tc, lang } = useT();
  const ok = r.result === "ok";
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: ok ? C.green : C.red, borderRadius: 14, padding: 14, gap: 6 }}>
    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>{tc(VENUE_COMPLETE_LABELS[r.result] ?? r.result)}</Text>
    {!!r.code && <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{r.code}{r.kind ? " · " + tc(VENUE_ORDER_KIND_LABELS[r.kind]) : ""}</Text>}
    {!!r.buyer && <Text style={{ color: "#fff", fontSize: 18 }}>{tr("sv.vc_client", { name: r.buyer })}{r.guests ? (r.guests === 1 ? tr("sv.vc_one_person") : tr("sv.vc_people", { n: r.guests })) : ""}</Text>}
    {(!!r.check_in || !!r.check_out) && <Text style={{ color: "#fff", fontSize: 17 }}>{tc(dateText(r.check_in))} → {tc(dateText(r.check_out))}</Text>}
    {!!r.slot_at && <Text style={{ color: "#fff", fontSize: 17 }}>🕒 {formatDateTimeIn(r.slot_at, lang)}</Text>}
    {(r.lines ?? []).map((l, i) => <Text key={i} style={{ color: "#fff", fontSize: 17 }}>• {tc(venueLineText(l))}</Text>)}
    {ok && r.total != null && <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{r.method === "prepaid" ? tr("sv.fu_paid_caps") : tr("sv.vc_charge", { v: formatPrice(r.total) })}</Text>}
  </View>;
}

type OrderFilter = "submitted" | "active" | "completed" | "all";
export function VenueManageScreen({ id }: { id: string }) {
  const collects = usePlatformCollects();
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [venue, setVenue] = useState<MyVenue | null | undefined>(undefined);
  const [panel, setPanel] = useState<VenuePanel | null>(null); const [items, setItems] = useState<VenueItem[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [editing, setEditing] = useState(false); const [itemForm, setItemForm] = useState<string | null>(null);
  const [code, setCode] = useState(""); const [check, setCheck] = useState<VenueCompleteResult | null>(null); const [filter, setFilter] = useState<OrderFilter>("active");
  const [reason, setReason] = useState(""); const [reject, setReject] = useState<string | null>(null); const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    try {
      const [a, b, c, s] = await Promise.all([myVenues(supabase()), venuePanel(supabase(), id), listVenueItems(supabase(), id), getPlatformSettings(supabase())]);
      setVenue(a.data.find(v => v.id === id) ?? null); setItems(c.data); setSettings(s.data as PlatformSettings | null);
      if (b.error) setError(friendlyErrorIn(b.error, lang)); else setPanel(b.data);
    } catch (e) { setError(friendlyErrorIn(e, lang)); setVenue(null); }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }).catch(() => setUid(null)); }, [id]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.vm_title")} />;
  if (venue === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!venue) return <ScrollView contentContainerStyle={ui.screen}><Link href={"/reservas/painel" as any} style={ui.link}>{tr("sv.vm_back")}</Link>
    <Text style={ui.h1}>{tr("sv.vm_no_access")}</Text><Message error={error || tr("sv.vm_not_yours")} /></ScrollView>;
  const v = venue; const K = VENUE_KINDS[v.kind];
  const done = (m: string) => { setNotice(m); setError(""); setReject(null); setReason(""); void load(); };
  async function doCheck(text = code) {
    if (!text.trim()) return; setCheck(null); setError("");
    const r = await completeVenueOrder(supabase(), id, text);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: VenueOrder, ok: boolean) {
    if (!ok && !reason.trim()) { setError(tr("sv.pra_why_not")); return; }
    const r = await decideVenuePayment(supabase(), o.id, ok, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(ok ? tr("sv.pay_ok") : tr("sv.pay_rejected"));
  }
  async function cancel(o: VenueOrder) {
    if (!reason.trim()) { setError(tr("sv.fu_why_cancel")); return; }
    const r = await cancelVenueOrder(supabase(), o.id, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(tr("sv.vm_cancel_done"));
  }
  const orders = panel?.orders ?? [];
  const shown = orders.filter(o => filter === "all" ? true : filter === "submitted" ? o.status === "submitted" : filter === "completed" ? o.status === "completed"
    : o.status === "reserved" || o.status === "paid" || o.status === "awaiting_payment");
  const waitingCount = orders.filter(o => o.status === "submitted").length;
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={tr("sv.reason_client_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/reservas/painel" as any} style={ui.link}>{tr("sv.vm_back")}</Link>
    <Text style={ui.h1}>⚙️ {K.icon} {v.business_name}</Text>
    <Text style={ui.muted}>{venueRef(v.ref_no)} · {tc(VENUE_SUBTYPE_LABELS[v.subtype])}</Text>
    <View style={{ backgroundColor: v.status === "approved" ? C.green : v.status === "suspended" ? C.red : C.yellowSoft, borderRadius: 14, padding: 12 }}>
      <Text style={{ color: v.status === "pending" ? C.ink : "#fff", fontWeight: "800", fontSize: 18 }}>{tc(VENUE_STATUS_LABELS[v.status])}</Text>
      {v.status === "pending" && <Text style={ui.text}>{tr("sv.vm_pending", { items: tc(K.items).toLowerCase() })}</Text>}
      {!!v.admin_note && v.status !== "approved" && <Text style={{ color: v.status === "pending" ? C.ink : "#fff", fontSize: 16 }}>{tr("sv.note_x", { note: v.admin_note })}</Text>}
    </View>
    <View style={ui.row}>
      <Button title={tr("sv.view_page")} variant="secondary" onPress={() => router.push(`/reservas/${id}` as any)} />
      <Button title={editing ? tr("sv.vm_close_settings") : tr("sv.ve_settings")} variant="secondary" onPress={() => setEditing(!editing)} />
    </View>
    {editing && <VenueForm uid={uid} venue={v} businesses={[]} onSaved={() => { setEditing(false); done(tr("sv.vm_settings_saved")); }} />}
    <Message error={error} ok={notice} />

    <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.vm_arrived")}</Text>
      <Text style={ui.muted}>{tr("sv.vm_arrived_hint")}</Text>
      <QrScanButton onCode={text => { const t = venueTokenFromText(text); if (t) router.push(("/reservas/v/" + t) as any); else void doCheck(text); }} />
      <TextInput style={[ui.input, { fontSize: 22, letterSpacing: 2 }]} value={code} onChangeText={setCode} onSubmitEditing={() => void doCheck()} placeholder="RV-XXXXXX" autoCapitalize="characters" accessibilityLabel={tr("sv.fu_code_a11y")} {...ph} />
      <Button title={tr("sv.vm_confirm_entry")} onPress={() => void doCheck()} />
      {!!check && <CompleteResult r={check} />}
    </View>

    <Text style={ui.h2}>{K.icon} {tc(K.items)} ({items.length})</Text>
    <Text style={ui.muted}>{tr("sv.vm_items_hint")}</Text>
    {itemForm === "new" ? <ItemForm uid={uid} venueId={id} kind={v.kind} onDone={m => { setItemForm(null); done(m); }} onClose={() => setItemForm(null)} />
      : <Button title={tr("sv.vm_add_item", { item: tc(K.item).toLowerCase() })} onPress={() => setItemForm("new")} />}
    {items.length === 0 && itemForm !== "new" && <Text style={ui.text}>{tc(K.empty)}</Text>}
    {items.map(it => itemForm === it.id
      ? <ItemForm key={it.id} uid={uid} venueId={id} kind={v.kind} item={it} onDone={m => { setItemForm(null); done(m); }} onClose={() => setItemForm(null)} />
      : <ItemRow key={it.id} it={it} kind={v.kind} onEdit={() => setItemForm(it.id)} onDone={done} onError={setError} />)}

    <Text style={ui.h2}>{tr("sv.vm_orders")}</Text>
    <Chips options={[{ value: "submitted" as const, label: tr("sv.vm_f_waiting", { n: waitingCount }) }, { value: "active" as const, label: tr("sv.vm_f_active") }, { value: "completed" as const, label: tr("sv.vm_f_done") }, { value: "all" as const, label: tr("sv.f_all_m") }]}
      value={filter} onChange={setFilter} />
    {panel === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : shown.length === 0 ? <Text style={ui.text}>{tr("sv.vm_none")}</Text> :
      shown.map(o => <View key={o.id} style={ui.card}>
        <Text style={[ui.label, { fontSize: 18 }]}>{o.buyer_name} — {formatPrice(o.total)}</Text>
        <Text style={ui.muted}>{venueOrderRef(o.ref_no)} · {tc(VENUE_ORDER_KIND_LABELS[o.kind])}{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</Text>
        <Text style={ui.text}>{tc(venueOrderSummary(o))}</Text>
        {!!o.buyer_note && <Text style={ui.text}>📝 {o.buyer_note}</Text>}
        <Text style={ui.muted}>{tr("sv.vm_price_line", { a: formatPrice(o.subtotal), b: formatPrice(o.client_fee), c: formatPrice(o.business_fee) })}</Text>
        <Text style={ui.label}>{tc(VENUE_ORDER_STATUS_LABELS[o.status])} · {o.method === "prepaid" ? tr("sv.vm_prepaid") : tr("sv.vm_at_place")}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · " + tc(holdText(o.hold_until)) : ""}</Text>
        {!!o.reference && <Text style={ui.text}>{tr("sv.vm_ref")}<Text style={ui.label}>{o.reference}</Text></Text>}
        {!!o.note && <Text style={ui.muted}>{tr("sv.note_x", { note: o.note })}</Text>}
        {!!o.proof_path && <Button title={tr("sv.proof_see")} variant="secondary" onPress={() => void openProof(o.proof_path!, setError, tr)} />}
        {o.status === "submitted" && <>
          <Text style={ui.text}>{tr("sv.vm_check_account", { v: formatPrice(o.total), ref: venueOrderRef(o.ref_no) })}</Text>
          {collects ? <Text style={ui.muted}>{tr("pp.team_confirms")}</Text> : reject === o.id ? <>{reasonBox}<Button title={tr("sv.ina_not_received")} variant="danger" onPress={() => void decide(o, false)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setReject(null)} /></>
            : <><Button title={tr("sv.ev_got_money")} onPress={() => Alert.alert(tr("sv.ina_confirm_pay"), tr("sv.ev_received_q", { v: formatPrice(o.total), name: o.buyer_name }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes"), onPress: () => void decide(o, true) }])} />
              <Button title={tr("sv.ina_not_received")} variant="secondary" onPress={() => { setReject(o.id); setReason(""); }} /></>}
        </>}
        {VENUE_ACTIVE_ORDER.includes(o.status) && (reject === "c" + o.id ? <>{reasonBox}<Button title={tr("sv.vm_cancel_order")} variant="danger" onPress={() => void cancel(o)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setReject(null)} /></>
          : <Button title={tr("sv.vm_cancel")} variant="secondary" onPress={() => { setReject("c" + o.id); setReason(""); }} />)}
        <Button title={tr("sv.vm_open_qr")} variant="secondary" onPress={() => router.push(("/reservas/v/" + o.qr_token) as any)} />
      </View>)}

    {!!panel && <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.vm_fee_title")}</Text>
      <Text style={ui.text}>{tc(venueOwnerFeeNotice(panel.client_fee_pct, panel.business_fee_pct))}</Text>
      <Text style={ui.text}>{tr("sv.vm_completed")}<Text style={ui.label}>{formatPrice(panel.completed_total)}</Text></Text>
      <Text style={ui.text}>{tr("sv.vm_fee_total", { total: formatPrice(panel.fee_total) })}<Text style={[ui.label, { fontSize: 19 }]}>{formatPrice(panel.fee_due)}</Text></Text>
      {panel.fee_overdue && <Text style={ui.error}>{tr("sv.vm_fee_overdue")}</Text>}
      {panel.fee_pending && <Text style={ui.text}>{tr("sv.vm_fee_pending")}</Text>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <FeePayBox venueId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <Button title={tr("sv.vm_pay_fee")} onPress={() => setPayOpen(true)} />)}
      {panel.payments.length > 0 && <>
        <Text style={ui.label}>{tr("sv.vm_payments")}</Text>
        {panel.payments.map(p => <Text key={p.id} style={ui.text}>{formatDateTimeIn(p.created_at, lang)} · {formatPrice(p.amount)} · {p.status === "confirmed" ? tr("sv.st_confirmed") : p.status === "rejected" ? tr("sv.st_rejected") : tr("sv.f_to_confirm")}{p.admin_note ? " — " + p.admin_note : ""}</Text>)}
      </>}
    </View>}
  </ScrollView>;
}

function FeePayBox({ venueId, uid, amount, settings, onDone, onClose }: { venueId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const { t: tr, tc, lang } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<Local | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !proof) { setError(tr("sv.pay_need_ref")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const up = await uploadPaymentProof(supabase(), uid, await localBytes(proof), "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(tr("sv.proof_fail")); path = up.data; }
      const r = await submitVenueFee(supabase(), venueId, { method, reference, proofPath: path }); if (r.error) throw r.error;
      onDone(tr("sv.fu_fee_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={[ui.label, { fontSize: 19 }]}>{tr("sv.amount_to_pay", { v: formatPrice(amount) })}</Text>
    <Text style={ui.label}>{tr("sv.pay_step1_plain")}</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>{tr("sv.pay_step2")}</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={tr("sv.pay_ref_ph")} accessibilityLabel={tr("sv.pay_ref_a11y")} {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={tr("sv.proof")} /><Button title={tr("sv.proof_remove")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={tr("sv.proof_photo")} variant="secondary" onPress={() => void pickProof(true, setError, tr).then(p => p && setProof(p))} /><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void pickProof(false, setError, tr).then(p => p && setProof(p))} /></View>}
    <Message error={error} />
    <Button title={busy ? tr("sv.sending") : tr("sv.send_payment")} disabled={busy} onPress={() => void send()} />
    <Button title={tr("common.cancel")} variant="secondary" onPress={onClose} />
  </View>;
}

// --- Verificar pelo QR ------------------------------------------------------------------------------
export function VenueVerifyScreen({ token }: { token: string }) {
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  const [v, setV] = useState<VenueOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""); const [rejecting, setRejecting] = useState(false); const [result, setResult] = useState<VenueCompleteResult | null>(null);
  async function load() {
    try { const r = await venueOrderByToken(supabase(), token); if (r.error) setError(friendlyErrorIn(r.error, lang)); setV(r.data ?? { result: "invalid" }); }
    catch (e) { setError(friendlyErrorIn(e, lang)); setV({ result: "invalid" }); }
  }
  useFocusEffect(useCallback(() => { void load(); }, [token]));
  if (!v) return <View style={ui.screen}><Text style={ui.text}>{tr("sv.tv_checking")}</Text></View>;
  if (v.result !== "ok") return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{tr("sv.fv_unknown")}</Text>
    <Text style={[ui.error, { fontSize: 19 }]}>{tr("sv.vv_unknown_text")}</Text>
    <Message error={error} />
  </ScrollView>;
  const live = !!v.status && LIVE.includes(v.status); const isVenue = v.role === "venue";
  async function complete() {
    if (!v?.code || !v.venue_id) return;
    setBusy(true); const r = await completeVenueOrder(supabase(), v.venue_id, v.code); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setResult(r.data); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    if (!ok && !reason.trim()) { setError(tr("sv.pra_why_not")); return; }
    setBusy(true); const r = await decideVenuePayment(supabase(), v.id, ok, reason); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? tr("sv.vv_paid_ok") : tr("sv.pay_rejected")); setRejecting(false); await load(); }
  }
  const summary = v.kind ? tc(venueOrderSummary({ kind: v.kind, guests: v.guests ?? null, check_in: v.check_in ?? null, check_out: v.check_out ?? null, slot_at: v.slot_at ?? null, lines: v.lines ?? [] })) : "";
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{v.status === "completed" ? tr("sv.fv_used") : live ? tr("sv.fv_ok") : tr("sv.fv_void")}</Text>
    <Text style={[live ? ui.ok : ui.error, { fontSize: 19 }]}>{venueOrderRef(v.ref_no)} · {v.venue_kind ? VENUE_KINDS[v.venue_kind].icon + " " : ""}{v.venue_name}{"\n"}{v.status ? tc(VENUE_ORDER_STATUS_LABELS[v.status]) : ""}</Text>
    {!!result && <CompleteResult r={result} />}
    <Message error={error} ok={notice} />
    {v.role === "other" && <View style={ui.card}><Text style={ui.text}>{tr("sv.vv_other", { name: v.venue_name ?? "" })}</Text>
      <Button title={tr("auth.login")} onPress={() => router.push("/login")} /></View>}
    {v.role !== "other" && <>
      <View style={ui.card}>
        {!!v.kind && <Text style={ui.label}>{tc(VENUE_ORDER_KIND_LABELS[v.kind])}</Text>}
        <Text style={ui.text}>{tr("sv.fv_client")}<Text style={ui.label}>{v.buyer_name}</Text>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}</Text>
        {!!summary && <Text style={ui.text}>{summary}</Text>}
        <LinesText lines={v.lines ?? []} />
        {!!v.buyer_note && <Text style={ui.text}>📝 {v.buyer_note}</Text>}
        <Text style={ui.text}>{tr("sv.vv_price", { v: formatPrice(v.subtotal ?? 0) })}</Text>
        <Text style={ui.text}>{tr("sv.fv_fee", { pct: v.client_fee_pct ? ` (${v.client_fee_pct}%)` : "", v: formatPrice(v.client_fee ?? 0) })}</Text>
        <Text style={[ui.label, { fontSize: 19 }]}>{tr("sv.total", { v: formatPrice(v.total ?? 0) })} · {v.method === "prepaid" ? tr("sv.fv_prepaid") : tr("sv.vm_at_place")}</Text>
        {!!v.reference && <Text style={ui.text}>{tr("sv.fv_ref")}<Text style={ui.label}>{v.reference}</Text></Text>}
        {!!v.code && <Text style={ui.text}>{tr("sv.fv_code")}<Text style={ui.label}>{v.code}</Text></Text>}
      </View>
      {!!v.proof_path && v.role !== "buyer" && <Button title={tr("sv.proof_see")} variant="secondary" onPress={() => void openProof(v.proof_path!, setError, tr)} />}
      {isVenue && v.status === "submitted" && <View style={ui.card}>
        <Text style={ui.label}>{tr("sv.vm_check_account", { v: formatPrice(v.total ?? 0), ref: venueOrderRef(v.ref_no) })}</Text>
        {rejecting ? <><TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={tr("sv.reason_client_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />
          <Button title={tr("sv.ina_not_received")} variant="danger" disabled={busy} onPress={() => void decide(false)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setRejecting(false)} /></>
          : <><Button title={tr("sv.ev_got_money")} disabled={busy} onPress={() => Alert.alert(tr("sv.ina_confirm_pay"), tr("sv.vv_received_q", { v: formatPrice(v.total ?? 0) }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes"), onPress: () => void decide(true) }])} />
            <Button title={tr("sv.ina_not_received")} variant="secondary" onPress={() => setRejecting(true)} /></>}
      </View>}
      {isVenue && (v.status === "reserved" || v.status === "paid") && <Button title={v.status === "reserved" ? tr("sv.vv_confirm_charge", { v: formatPrice(v.total ?? 0) }) : tr("sv.vv_paid_confirm")} disabled={busy}
        onPress={() => Alert.alert(tr("common.confirm"), tr("sv.vv_confirm_q", { name: v.buyer_name ?? "" }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes"), onPress: () => void complete() }])} />}
      {v.role === "buyer" && <Button title={tr("sv.ve_my")} variant="secondary" onPress={() => router.push("/reservas/minhas" as any)} />}
    </>}
  </ScrollView>;
}

// --- Administração ------------------------------------------------------------------------------
export function AdminVenues() {
  const { t: tr, tc, lang } = useT();
  const router = useRouter();
  const [status, setStatus] = useState<VenueStatus | "all">("pending"); const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [payments, setPayments] = useState<AdminVenuePayment[]>([]); const [orderStatus, setOrderStatus] = useState<VenueOrderStatus | "all">("submitted"); const [orders, setOrders] = useState<AdminVenueOrder[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reason, setReason] = useState(""); const [open, setOpen] = useState<string | null>(null);
  async function load() {
    try {
      const [a, b, c] = await Promise.all([listVenuesForAdmin(supabase(), status === "all" ? "" : status), listVenuePaymentsForAdmin(supabase(), "pending"),
        listVenueOrdersForAdmin(supabase(), orderStatus === "all" ? "" : orderStatus)]);
      setVenues(a.data); setPayments(b.data); setOrders(c.data); if (a.error || b.error || c.error) setError(friendlyErrorIn(a.error ?? b.error ?? c.error, lang));
    } catch (e) { setError(friendlyErrorIn(e, lang)); }
  }
  async function decideOrder(id: string, ok: boolean) {
    const r = await decideVenuePayment(supabase(), id, ok, ok ? undefined : tr("pp.reject_pay"));
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(tr("pp.decided")); void load(); }
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: AdminVenue, to: VenueStatus) {
    if (to === "suspended" && !reason.trim()) { setError(tr("sv.fua_why_suspend")); return; }
    const r = await setVenueStatus(supabase(), x.id, to, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(to === "approved" ? tr("sv.va_approved") : tr("sv.va_suspended")); setOpen(null); setReason(""); await load(); }
  }
  async function decide(p: AdminVenuePayment, ok: boolean) {
    if (!ok && !reason.trim()) { setError(tr("sv.pra_why_not")); return; }
    const r = await decideVenueFee(supabase(), p.id, ok, reason); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(tr("sv.done")); setOpen(null); setReason(""); await load(); }
  }
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={tr("sv.reason_owner_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />;
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{tr("sv.va_title")}</Text>
    <Message error={error} ok={notice} />
    <Text style={ui.muted}>{tr("sv.va_hint")}</Text>
    <Chips options={[{ value: "pending" as const, label: tr("sv.f_to_approve") }, { value: "approved" as const, label: tr("sv.f_approved_m") }, { value: "suspended" as const, label: tr("sv.f_suspended_m") }, { value: "all" as const, label: tr("sv.f_all_m") }]} value={status} onChange={setStatus} />
    {venues.length === 0 && <Text style={ui.text}>{tr("sv.va_none")}</Text>}
    {venues.map(x => <View key={x.id} style={ui.card}>
      <Text style={[ui.label, { fontSize: 18 }]}>{VENUE_KINDS[x.kind].icon} {x.name}{x.verified ? " ✔" : ""}</Text>
      <Text style={ui.muted}>{venueRef(x.ref_no)} · {tc(VENUE_SUBTYPE_LABELS[x.subtype])}{tr("sv.ina_owner", { name: x.owner_name })}{x.phone ? " · 📞 " + x.phone : ""}</Text>
      {!!x.address_text && <Text style={ui.text}>📍 {x.address_text}</Text>}
      <Text style={ui.text}>{tc(VENUE_STATUS_LABELS[x.status])}{x.admin_note ? " — " + x.admin_note : ""}</Text>
      {x.pay ? <View style={ui.card}>
        <Text style={ui.label}>{tr("sv.va_account")}{x.accepts_prepay ? "" : tr("sv.va_not_used")}</Text>
        {!!x.pay.holder && <Text selectable style={ui.text}>{tr("sv.va_holder", { v: x.pay.holder })}</Text>}
        {!!x.pay.iban && <Text selectable style={ui.text}>IBAN: {x.pay.iban}</Text>}
        {!!x.pay.express && <Text selectable style={ui.text}>Multicaixa Express: {x.pay.express}</Text>}
        {!!x.pay.note && <Text style={ui.muted}>{x.pay.note}</Text>}
      </View> : <Text style={ui.muted}>{tr("sv.va_no_account")}</Text>}
      <Text style={x.fee_overdue ? ui.error : ui.text}>{tr("sv.va_fee_due", { v: formatPrice(x.fee_due) })}{x.fee_overdue ? tr("sv.va_overdue") : ""}</Text>
      <Button title={tr("sv.view_page")} variant="secondary" onPress={() => router.push(("/reservas/" + x.id) as any)} />
      <Button title={tr("sv.va_see_biz")} variant="secondary" onPress={() => router.push(("/empresas/" + x.business_id) as any)} />
      {x.status !== "approved" && <Button title={tr("sv.approve")} onPress={() => void setSt(x, "approved")} />}
      {x.status !== "suspended" && (open === x.id ? <>{reasonBox}<Button title={tr("sv.suspend")} variant="danger" onPress={() => void setSt(x, "suspended")} /></> : <Button title={tr("sv.suspend")} variant="secondary" onPress={() => { setOpen(x.id); setReason(""); }} />)}
    </View>)}
    <Text style={ui.label}>{tr("sv.va_fees", { n: payments.length })}</Text>
    {payments.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(p.amount)} · {p.venue_name}</Text>
      <Text style={ui.muted}>{venueRef(p.venue_ref)} · {p.owner_name} · {tc(PLAN_METHOD_LABELS[p.method as PaymentMethodPlan] ?? p.method)}{p.reference ? tr("sv.ref_x", { ref: p.reference }) : ""} · {formatDateTimeIn(p.created_at, lang)}</Text>
      {!!p.proof_path && <Button title={tr("sv.proof_doc")} variant="secondary" onPress={() => void openProof(p.proof_path!, setError, tr)} />}
      <Button title={tr("sv.confirm_ok")} onPress={() => void decide(p, true)} />
      {open === p.id ? <>{reasonBox}<Button title={tr("sv.decline_xx")} variant="danger" onPress={() => void decide(p, false)} /></> : <Button title={tr("sv.decline_xx")} variant="secondary" onPress={() => { setOpen(p.id); setReason(""); }} />}
    </View>)}
    <Text style={ui.label}>{tr("sv.va_orders")}</Text>
    <Text style={ui.muted}>{tr("sv.fua_prepaid_hint")}</Text>
    <Chips options={[{ value: "submitted" as const, label: tr("sv.f_to_confirm") }, { value: "paid" as const, label: tr("sv.f_paid_m") }, { value: "rejected" as const, label: tr("sv.f_rejected_m") }, { value: "completed" as const, label: tr("sv.f_done_m") }, { value: "all" as const, label: tr("sv.f_all_m") }]}
      value={orderStatus} onChange={v => setOrderStatus(v as VenueOrderStatus | "all")} />
    {orders.length === 0 && <Text style={ui.text}>{tr("sv.vm_none")}</Text>}
    {orders.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(o.total)} · {o.venue_name} · {o.buyer_name}</Text>
      <Text style={ui.muted}>{venueOrderRef(o.ref_no)} · {tc(VENUE_ORDER_KIND_LABELS[o.kind])} · {o.method === "prepaid" ? tr("sv.vm_prepaid") : tr("sv.va_on_site")}{tr("sv.va_fees_x", { v: formatPrice(o.client_fee + o.business_fee) })}{o.reference ? tr("sv.ref_x", { ref: o.reference }) : ""}</Text>
      <Text style={ui.text}>{tc(VENUE_ORDER_STATUS_LABELS[o.status])} · {formatDateTimeIn(o.created_at, lang)}</Text>
      {!!o.proof_path && <Button title={tr("sv.proof_doc")} variant="secondary" onPress={() => void openProof(o.proof_path!, setError, tr)} />}
      <Button title={tr("sv.fua_by_qr")} variant="secondary" onPress={() => router.push(("/reservas/v/" + o.qr_token) as any)} />
      {o.status === "submitted" && <><Button title={tr("pp.confirm_pay")} onPress={() => void decideOrder(o.id, true)} />
        <Button title={tr("pp.reject_pay")} variant="danger" onPress={() => void decideOrder(o.id, false)} /></>}
    </View>)}
  </View>;
}
