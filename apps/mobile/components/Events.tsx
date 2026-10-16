import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";
import { listEvents, getEvent, getEventTickets, getEventPaymentInfo, saveEvent, setEventPublished, cancelEvent, reserveTickets, submitTicketPayment, decideTicketOrder,
  cancelTicketOrder, checkInTicket, myTicketOrders, organizerPanel, submitEventPlatformPayment, listEventPaymentsForAdmin, decideEventPayment, listMyEvents,
  formatEventDate, isoToLocalInput, eventIsOver, eventRef, ticketOrderRef, priceFromText, ticketsLeftText, eventShareMessage, normalizeTicketCode, qrMatrix, ticketUsable,
  partsToLocalInput, localInputToParts, validateEvent, uploadClassifiedMedia, uploadPaymentProof, base64ToArrayBuffer, paymentProofUrl, getPlatformSettings, updatePlatformSettings,
  formatPrice, formatDate, friendlyErrorIn, whatsappShareUrl, LANG_TAGS, pointFrom, EVENT_CATEGORY_LABELS, TICKET_ORDER_STATUS_LABELS, TICKET_METHOD_LABELS, CHECKIN_LABELS, PLAN_METHOD_LABELS,
  type EventCategory, type EventSummary, type EventRow, type TicketTypeAvailability, type TicketTypeDraft, type EventPaymentInfo, type MyTicketOrder,
  type OrganizerPanel, type OrganizerOrder, type AdminEventPayment, type CheckInResult, type PaymentMethodPlan, type PlatformSettings, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { ticketVerifyUrl, ticketByCode, type TicketView } from "@huambo-online/core";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { ItemCard, Grid } from "./ItemCard";
import { LiteImage } from "./LiteImage";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";
import { QrScanButton } from "./QrScanner";
import { useT, coreText, formatDateTimeIn } from "../lib/i18n";

const CATS = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
const METHODS = Object.keys(TICKET_METHOD_LABELS) as PaymentMethodPlan[];
const icon = (c: EventCategory) => EVENT_CATEGORY_LABELS[c].split(" ")[0];
const ph = { placeholderTextColor: C.muted };
type Picked = { uri: string; base64?: string | null; mimeType: string };
const toBody = async (p: Picked) => p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
async function pickImage(camera: boolean): Promise<Picked | string | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return camera ? "sv.cam_perm" : "sv.gallery_perm"; // chave do texto do erro
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;
const Banner = ({ text }: { text: string }) => <View style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>{text}</Text></View>;
function LoginNeeded({ title, text }: { title: string; text?: string }) {
  const router = useRouter(); const { t: tr } = useT();
  return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{title}</Text>{!!text && <Text style={ui.text}>{text}</Text>}<Button title={tr("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
}

/** Lista pública de eventos (os destacados primeiro). */
export function EventListScreen() {
  const { t: tr, tc, lang } = useT();
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [cat, setCat] = useState<EventCategory | "">(""); const [q, setQ] = useState(""); const [items, setItems] = useState<EventSummary[] | null>(null); const [error, setError] = useState("");
  async function load() { const r = await listEvents(supabase(), { category: cat, query: q }); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setItems(r.data); } }
  useEffect(() => { void load(); }, [cat]);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{tr("sv.ev_title")}</Text>
    <View style={ui.row}><Link href="/bilhetes" style={ui.link}>{tr("sv.ev_my_tickets_link")}</Link><Text style={ui.muted}> · </Text><Link href="/eventos/meus" style={ui.link}>{tr("sv.ev_organize_link")}</Link></View>
    <TextInput style={ui.input} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" placeholder={tr("sv.ev_search_ph")} accessibilityLabel={tr("sv.ev_search_a11y")} {...ph} />
    <Chips options={[{ value: "all" as const, label: tr("sv.f_all_m") }, ...CATS.map(c => ({ value: c, label: tc(EVENT_CATEGORY_LABELS[c]) }))]} value={cat || "all"} onChange={v => setCat(v === "all" ? "" : v as EventCategory)} />
    <Message error={error} />
    {items === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{tr("sv.ev_empty")}</Text> :
      <Grid>{items.map(e => <ItemCard key={e.id} width={cardW} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon={icon(e.category)} title={e.title}
        price={coreText(priceFromText(e.price_from), tr) ?? ""} featured={e.featured} tag={e.tickets_left === 0 ? tr("tag.sold_out") : undefined} tagRed={e.tickets_left === 0}
        meta={`📅 ${formatDateTimeIn(e.starts_at, lang)} · ${e.venue}`} />)}</Grid>}
  </ScrollView>;
}

/** Página do evento: detalhes e compra. */
export function EventDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [e, setE] = useState<EventRow | null | undefined>(undefined); const [types, setTypes] = useState<TicketTypeAvailability[]>([]); const [uid, setUid] = useState<string | null>(null);
  const [typeId, setTypeId] = useState(""); const [qty, setQty] = useState(1); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { void (async () => {
    const [a, b] = await Promise.all([getEvent(supabase(), id), getEventTickets(supabase(), id)]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); setE(a.data); setTypes(b.data.filter(t => t.active)); setUid(await currentUserId());
  })(); }, [id]));
  if (e === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!e) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{tr("sv.ev_not_found")}</Text><Message error={error} /><Link href="/eventos" style={ui.link}>{tr("sv.ev_see_all")}</Link></ScrollView>;
  const mine = uid === e.organizer_id; const over = eventIsOver(e); const onSale = e.status === "published" && !over;
  const chosen = types.find(t => t.id === typeId); const priceFrom = types.length ? Math.min(...types.map(t => t.price)) : null;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now();
  async function buy() {
    if (!chosen) { setError(tr("sv.ev_choose_type")); return; }
    setBusy(true); setError("");
    const r = await reserveTickets(supabase(), chosen.id, qty, name, phone); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    router.push("/bilhetes");
  }
  const share = tc(eventShareMessage(siteUrl + "/", e, priceFrom));
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/eventos" style={ui.link}>{tr("sv.ev_all_back")}</Link>
    {!!e.cover_url && <LiteImage placeholder="🎟️" source={{ uri: e.cover_url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }} resizeMode="cover" accessibilityLabel={tr("sv.ev_poster_a11y", { title: e.title })} />}
    <Text style={ui.muted}>{tc(EVENT_CATEGORY_LABELS[e.category])}{featured ? tr("sv.featured_dot") : ""} · {eventRef(e.ref_no)}</Text>
    <Text style={ui.h1}>{e.title}</Text>
    {e.status === "cancelled" && <Banner text={tr("sv.ev_cancelled_banner", { reason: e.cancel_reason ? ": " + e.cancel_reason : "" })} />}
    {e.status === "draft" && <Banner text={tr("sv.ev_draft_banner")} />}
    {over && e.status === "published" && <Banner text={tr("sv.ev_over")} />}
    <View style={ui.card}>
      <Text style={ui.text}>📅 <Text style={ui.label}>{formatDateTimeIn(e.starts_at, lang)}</Text>{e.ends_at ? tr("sv.until", { date: formatDateTimeIn(e.ends_at, lang) }) : ""}</Text>
      <Text style={ui.text}>📍 <Text style={ui.label}>{e.venue}</Text>{e.municipalities?.name ? ", " + e.municipalities.name : ""}</Text>
      <Text style={ui.text}>💰 {coreText(priceFromText(priceFrom), tr)}</Text>
    </View>
    {mine && <><Button title={tr("sv.ev_manage")} onPress={() => router.push(`/eventos/${e.id}/gerir` as any)} /><Button title={tr("sv.edit_pen")} variant="secondary" onPress={() => router.push(`/eventos/${e.id}/editar` as any)} /></>}
    {!!e.description && <Text style={ui.text}>{e.description}</Text>}
    <PlaceView directions={e.directions} lat={e.geo_lat} lng={e.geo_lng} />
    <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ev_tickets")}</Text>
      {types.length === 0 && <Text style={ui.text}>{tr("sv.ev_no_tickets")}</Text>}
      {types.map(t => { const on = typeId === t.id; const can = onSale && !mine && t.left_count > 0;
        return <Pressable key={t.id} disabled={!can} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !can }} onPress={() => { setTypeId(t.id); setQty(1); }}
          style={[ui.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: on ? 3 : 1, borderColor: on ? C.blue : C.line }]}>
          <Text style={ui.label}>{onSale && !mine ? (on ? "🔘 " : "⚪ ") : ""}{t.name}</Text>
          <View style={{ alignItems: "flex-end" }}><Text style={ui.price}>{t.price > 0 ? formatPrice(t.price) : tr("price.free")}</Text><Text style={t.left_count === 0 ? ui.error : ui.muted}>{tc(ticketsLeftText(t.left_count))}</Text></View>
        </Pressable>; })}
      {onSale && !mine && types.length > 0 && (!uid ? <Button title={tr("sv.ev_login_buy")} onPress={() => router.push("/login")} /> : <>
        {!!chosen && <><Text style={ui.label}>{tr("sv.ev_how_many")}</Text>
          <View style={ui.row}><Button title="−" variant="secondary" disabled={qty <= 1} onPress={() => setQty(qty - 1)} /><Text style={[ui.h2, { alignSelf: "center", minWidth: 40, textAlign: "center" }]} accessibilityLabel={tr("sv.ev_n_tickets", { n: qty })}>{qty}</Text>
            <Button title="+" variant="secondary" disabled={qty >= Math.min(chosen.max_per_order, chosen.left_count)} onPress={() => setQty(qty + 1)} /></View></>}
        <Field label={tr("sv.ev_your_name")} value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
        <Field label={tr("sv.phone_opt")} value={phone} onChangeText={setPhone} maxLength={20} keyboardType="phone-pad" placeholder="9XX XXX XXX" />
        {!!chosen && <Text style={ui.label}>{tr("sv.total", { v: chosen.price > 0 ? formatPrice(chosen.price * qty) : tr("price.free") })}</Text>}
        {!!chosen && chosen.price > 0 && <Text style={ui.muted}>{tr("sv.ev_pay_info")}</Text>}
        <Message error={error} />
        <Button title={busy ? tr("sv.ev_reserving") : chosen && chosen.price === 0 ? tr("sv.ev_free_ticket") : tr("sv.ev_reserve")} disabled={busy || !chosen} onPress={() => void buy()} />
      </>)}
    </View>
    <Button title={tr("sv.share_wa")} variant="secondary" onPress={() => void Linking.openURL(whatsappShareUrl(share))} />
    <Button title={tr("sv.share")} variant="secondary" onPress={() => void Share.share({ message: share })} />
    <Text style={ui.muted}>{tr("sv.ev_disclaimer")}</Text>
  </ScrollView>;
}

/** Criar ou editar evento. */
export function EventFormScreen({ id }: { id?: string }) {
  const router = useRouter(); const { municipalities } = useTerritory();
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState<EventCategory>("music");
  const [sDate, setSDate] = useState(""); const [sTime, setSTime] = useState(""); const [eDate, setEDate] = useState(""); const [eTime, setETime] = useState("");
  const [venue, setVenue] = useState(""); const [municipalityId, setMunicipalityId] = useState(""); const [directions, setDirections] = useState(""); const [point, setPoint] = useState<GeoPoint | null>(null);
  const [cover, setCover] = useState<string | null>(null); const [photo, setPhoto] = useState<Picked | null>(null);
  const [pay, setPay] = useState<EventPaymentInfo>({ holder: "", iban: "", express: "", note: "" });
  const [tickets, setTickets] = useState<TicketTypeDraft[]>([{ name: "Normal", price: "", quantity: "" }]); const [existing, setExisting] = useState<{ id: string }[]>([]);
  const [status, setStatus] = useState("draft"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loaded, setLoaded] = useState(!id);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => { if (!id) return; void (async () => {
    const [a, b, c] = await Promise.all([getEvent(supabase(), id), getEventTickets(supabase(), id), getEventPaymentInfo(supabase(), id)]);
    const e = a.data; if (!e) { setError(tr("sv.ev_not_found_dot")); return; }
    const s = localInputToParts(isoToLocalInput(e.starts_at)), f = localInputToParts(isoToLocalInput(e.ends_at));
    setTitle(e.title); setDescription(e.description ?? ""); setCategory(e.category); setSDate(s.date); setSTime(s.time); setEDate(f.date); setETime(f.time);
    setVenue(e.venue); setMunicipalityId(e.municipality_id ?? ""); setDirections(e.directions ?? ""); setPoint(pointFrom(e.geo_lat, e.geo_lng)); setCover(e.cover_url); setStatus(e.status);
    setPay(c); setExisting(b.data.map(t => ({ id: t.id })));
    if (b.data.length) setTickets(b.data.map(t => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), max_per_order: String(t.max_per_order), active: t.active })));
    setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <View style={ui.screen}><Text style={ui.text}>{error || tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.ev_organize_title")} />;
  const setT = (k: number, p: Partial<TicketTypeDraft>) => setTickets(l => l.map((t, i) => i === k ? { ...t, ...p } : t));
  const startsAt = partsToLocalInput(sDate, sTime); const endsAt = eDate || eTime ? partsToLocalInput(eDate, eTime) || "x" : "";
  const input = { title, description, category, startsAt, endsAt: endsAt === "x" ? "invalid" : endsAt, venue, municipalityId, directions, point, coverUrl: cover, pay, tickets };
  const paid = tickets.some(t => Number(t.price.replace(/\s/g, "").replace(",", ".")) > 0);
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(tr(r)); else if (r) setPhoto(r); }
  async function save(publish: boolean) {
    const bad = (sDate || sTime) && !startsAt ? tr("sv.pr_bad_date") : validateEvent(input); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (photo) { const up = await uploadClassifiedMedia(supabase(), await toBody(photo), uid!, "cartaz." + (photo.mimeType.split("/")[1] ?? "jpg"), photo.mimeType); if (up.error || !up.data) throw up.error ?? new Error(tr("sv.ev_poster_fail")); coverUrl = up.data; }
      const r = await saveEvent(supabase(), uid!, { ...input, coverUrl }, id, existing);
      if (r.error || !r.data) throw r.error ?? new Error(tr("sv.save_fail"));
      if (publish && status !== "published") { const p = await setEventPublished(supabase(), r.data.id, true); if (p.error) { setError(friendlyErrorIn(p.error, lang)); if (!id) router.replace(`/eventos/${r.data.id}/editar` as any); return; } }
      router.replace(`/eventos/${r.data.id}/gerir` as any);
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{id ? tr("sv.ev_edit") : tr("sv.ev_new")}</Text>
    <Field label={tr("sv.ev_name")} value={title} onChangeText={setTitle} maxLength={120} placeholder={tr("sv.ev_name_ph")} />
    <Text style={ui.label}>{tr("sv.type")}</Text>
    <Chips options={CATS.map(c => ({ value: c, label: tc(EVENT_CATEGORY_LABELS[c]) }))} value={category} onChange={setCategory} />
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 150 }}><Field label={tr("sv.ev_start_day")} value={sDate} onChangeText={setSDate} placeholder="18/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
      <View style={{ flex: 1, minWidth: 110 }}><Field label={tr("sv.hour")} value={sTime} onChangeText={setSTime} placeholder="20:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
    </View>
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 150 }}><Field label={tr("sv.ev_end_day")} value={eDate} onChangeText={setEDate} placeholder="19/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
      <View style={{ flex: 1, minWidth: 110 }}><Field label={tr("sv.ev_end_hour")} value={eTime} onChangeText={setETime} placeholder="02:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
    </View>
    <Field label={tr("sv.venue")} value={venue} onChangeText={setVenue} maxLength={120} placeholder={tr("sv.ev_venue_ph")} />
    {municipalities.length > 0 && <><Text style={ui.label}>{tr("sv.municipality")}</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /></>}
    <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint={tr("sv.ev_place_hint")} />
    <Text style={ui.label}>{tr("sv.ev_desc")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} maxLength={4000} accessibilityLabel={tr("sv.description")} {...ph} />
    <View style={ui.card}>
      <Text style={ui.label}>{tr("sv.ev_poster")}</Text>
      {(photo || cover) && <Image source={{ uri: photo?.uri ?? cover! }} style={{ width: 140, height: 140, borderRadius: 10 }} accessibilityLabel={tr("sv.poster")} />}
      {(photo || cover) ? <Button title={tr("sv.ev_poster_remove")} variant="secondary" onPress={() => { setPhoto(null); setCover(null); }} />
        : <View style={ui.row}><Button title={tr("sv.id_shoot")} variant="secondary" onPress={() => void choose(true)} /><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void choose(false)} /></View>}
    </View>
    <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ev_tickets")}</Text>
      <Text style={ui.muted}>{tr("sv.ev_tickets_hint")}</Text>
      {tickets.map((t, k) => <View key={k} style={[ui.card, { gap: 8 }]}>
        <Field label={tr("sv.ev_ticket_name", { n: k + 1 })} value={t.name} onChangeText={v => setT(k, { name: v })} maxLength={60} placeholder={tr("sv.ev_ticket_name_ph")} />
        <View style={ui.row}>
          <View style={{ flex: 1, minWidth: 120 }}><Field label={tr("sv.price_kz")} value={t.price} onChangeText={v => setT(k, { price: v })} keyboardType="numeric" placeholder="0" /></View>
          <View style={{ flex: 1, minWidth: 120 }}><Field label={tr("sv.quantity")} value={t.quantity} onChangeText={v => setT(k, { quantity: v })} keyboardType="numeric" placeholder="100" /></View>
        </View>
        <Button title={(t.active ?? true) ? tr("sv.ev_on_sale") : tr("sv.ev_stopped")} variant="secondary" onPress={() => setT(k, { active: !(t.active ?? true) })} />
        {tickets.length > 1 && <Button title={tr("sv.ev_ticket_remove")} variant="secondary" onPress={() => setTickets(l => l.filter((_, i) => i !== k))} />}
      </View>)}
      <Button title={tr("sv.ev_ticket_add")} variant="secondary" onPress={() => setTickets(l => [...l, { name: "", price: "", quantity: "" }])} />
    </View>
    {paid && <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ev_money")}</Text>
      <Text style={ui.muted}>{tr("sv.ev_money_hint")}</Text>
      <Field label={tr("sv.holder")} value={pay.holder} onChangeText={v => setPay({ ...pay, holder: v })} maxLength={80} />
      <Field label="IBAN" value={pay.iban} onChangeText={v => setPay({ ...pay, iban: v })} maxLength={40} placeholder="AO06 …" autoCapitalize="characters" />
      <Field label={tr("sv.express_number")} value={pay.express} onChangeText={v => setPay({ ...pay, express: v })} maxLength={20} keyboardType="phone-pad" />
      <Field label={tr("sv.ev_payer_note")} value={pay.note} onChangeText={v => setPay({ ...pay, note: v })} maxLength={200} />
    </View>}
    <Message error={error} />
    {status !== "published" && <Button title={busy ? tr("sv.recording") : tr("sv.ev_publish")} disabled={busy} onPress={() => void save(true)} />}
    <Button title={busy ? tr("sv.recording") : status === "published" ? tr("sv.save_changes") : tr("sv.save_draft")} variant={status === "published" ? "primary" : "secondary"} disabled={busy} onPress={() => void save(false)} />
  </ScrollView>;
}

/** Os meus eventos (organizador). */
export function MyEventsScreen() {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<Awaited<ReturnType<typeof listMyEvents>>["data"] | null>(null);
  useFocusEffect(useCallback(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyEvents(supabase(), u)).data); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.ev_mine")} text={tr("sv.ev_mine_login")} />;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/eventos" style={ui.link}>{tr("sv.ev_all_back")}</Link>
    <Text style={ui.h1}>{tr("sv.ev_mine")}</Text>
    <Button title={tr("sv.ev_new_btn")} onPress={() => router.push("/eventos/novo")} />
    <Text style={ui.muted}>{tr("sv.ev_mine_hint")}</Text>
    {items === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{tr("sv.ev_mine_empty")}</Text> :
      items.map(e => <Pressable key={e.id} accessibilityRole="link" onPress={() => router.push(`/eventos/${e.id}/gerir` as any)} style={ui.card}>
        <Text style={ui.label}>{e.title}</Text>
        <Text style={ui.muted}>{eventRef(e.ref_no)} · 📅 {formatDateTimeIn(e.starts_at, lang)} · {e.status === "draft" ? tr("sv.st_draft") : e.status === "cancelled" ? tr("sv.st_cancelled") : eventIsOver(e) ? tr("sv.st_over") : tr("sv.st_published")}{e.featured_until && Date.parse(e.featured_until) > Date.now() ? tr("sv.featured_dot") : ""}</Text>
      </Pressable>)}
  </ScrollView>;
}

function PlatformPayBox({ eventId, uid, kind, amount, settings, onDone, onClose }: { eventId: string; uid: string; kind: "fee" | "boost"; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const { t: tr, tc, lang } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [proof, setProof] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(tr(r)); else if (r) setProof(r); }
  async function send() {
    if (!reference.trim() && !proof) { setError(tr("sv.pay_need_ref")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const up = await uploadPaymentProof(supabase(), uid, await toBody(proof), "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(tr("sv.proof_fail")); path = up.data; }
      const r = await submitEventPlatformPayment(supabase(), eventId, kind, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      onDone(kind === "boost" ? tr("sv.ev_boost_sent") : tr("sv.ev_fee_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.label}>{tr("sv.amount_to_pay", { v: formatPrice(amount) })}</Text>
    <Text style={ui.label}>{tr("sv.pay_step1_plain")}</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>{tr("sv.pay_step2")}</Text>
    <Chips options={METHODS.map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={tr("sv.pay_ref_ph")} accessibilityLabel={tr("sv.pay_ref_a11y")} {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={tr("sv.proof")} /><Button title={tr("sv.proof_remove")} variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title={tr("sv.proof_photo")} variant="secondary" onPress={() => void choose(true)} /><Button title={tr("sv.gallery")} variant="secondary" onPress={() => void choose(false)} /></View>}
    <Message error={error} />
    <Button title={busy ? tr("sv.sending") : tr("sv.send_payment")} disabled={busy} onPress={() => void send()} />
    <Button title={tr("common.cancel")} variant="secondary" onPress={onClose} />
  </View>;
}

/** Painel do organizador. */
export function EventManageScreen({ id }: { id: string }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [e, setE] = useState<EventRow | null>(null); const [p, setP] = useState<OrganizerPanel | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [open, setOpen] = useState<"" | "fee" | "boost" | "cancel">("");
  const [code, setCode] = useState(""); const [check, setCheck] = useState<CheckInResult | null>(null); const [reason, setReason] = useState("");
  const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b, s] = await Promise.all([getEvent(supabase(), id), organizerPanel(supabase(), id), getPlatformSettings(supabase())]);
    setE(a.data); setSettings(s.data); if (b.error) setError(friendlyErrorIn(b.error, lang)); else setP(b.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.ev_manage_title")} />;
  if (!e || !p) return <ScrollView contentContainerStyle={ui.screen}><Message error={error} />{!error && <Text style={ui.text}>{tr("common.loading")}</Text>}<Link href="/eventos/meus" style={ui.link}>{tr("sv.ev_mine_back")}</Link></ScrollView>;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now(); const active = e.status === "published" && !eventIsOver(e);
  const waiting = p.orders.filter(o => o.status === "submitted"); const reserved = p.orders.filter(o => o.status === "reserved"); const confirmed = p.orders.filter(o => o.status === "confirmed");
  const done = (m: string) => { setNotice(m); setError(""); setOpen(""); setReject(null); setNote(""); void load(); };
  async function decide(o: OrganizerOrder, ok: boolean) {
    if (!ok && !note.trim()) { setError(tr("sv.pra_why_not")); return; }
    const r = await decideTicketOrder(supabase(), o.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(ok ? tr("sv.ev_pay_ok", { n: o.quantity, name: o.buyer_name }) : tr("sv.pay_rejected"));
  }
  async function doCheck(scanned?: string) {
    const c = scanned ?? code; if (!c.trim()) return; setBusy(true); setCheck(null);
    const r = await checkInTicket(supabase(), id, normalizeTicketCode(c)); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function publish(on: boolean) { const r = await setEventPublished(supabase(), id, on); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(on ? tr("sv.ev_published") : tr("sv.ev_back_draft")); }
  async function doCancel() { setBusy(true); const r = await cancelEvent(supabase(), id, reason); setBusy(false); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(tr("sv.ev_cancel_done")); }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/eventos/meus" style={ui.link}>{tr("sv.ev_mine_back")}</Link>
    <Text style={ui.h1}>⚙️ {e.title}</Text>
    <Text style={ui.muted}>{eventRef(e.ref_no)} · 📅 {formatDateTimeIn(e.starts_at, lang)} · {e.status === "draft" ? tr("sv.st_draft") : e.status === "cancelled" ? tr("sv.st_cancelled") : tr("sv.st_published")}{featured ? tr("sv.featured_until_dot", { date: new Date(e.featured_until!).toLocaleDateString(LANG_TAGS[lang]) }) : ""}</Text>
    <Message error={error} ok={notice} />
    <Button title={tr("sv.view_page")} variant="secondary" onPress={() => router.push(`/eventos/${id}` as any)} />
    {e.status !== "cancelled" && <Button title={tr("sv.edit_pen")} variant="secondary" onPress={() => router.push(`/eventos/${id}/editar` as any)} />}
    {e.status === "draft" && <Button title={tr("sv.publish_ok")} onPress={() => void publish(true)} />}
    {e.status === "published" && p.sold === 0 && <Button title={tr("sv.back_draft")} variant="secondary" onPress={() => void publish(false)} />}
    <View style={ui.card}>
      <Text style={ui.text}>{tr("sv.ev_sold")}<Text style={ui.label}>{p.sold}</Text></Text>
      <Text style={ui.text}>{tr("sv.ev_revenue")}<Text style={ui.label}>{formatPrice(p.revenue)}</Text></Text>
      <Text style={ui.text}>{tr("sv.ev_checked")}<Text style={ui.label}>{p.checked_in}</Text></Text>
    </View>
    {active && <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ev_entry")}</Text>
      <QrScanButton title={tr("sv.ev_scan")} onCode={text => void doCheck(text)} />
      <TextInput style={[ui.input, { fontSize: 22, letterSpacing: 2 }]} value={code} onChangeText={setCode} onSubmitEditing={() => void doCheck()} placeholder="HO-XXXX-XXXX" autoCapitalize="characters" accessibilityLabel={tr("sv.ev_code_a11y")} {...ph} />
      <Button title={busy ? tr("sv.validating") : tr("sv.validate")} disabled={busy} onPress={() => void doCheck()} />
      {!!check && <Text accessibilityLiveRegion="polite" style={[check.result === "ok" ? ui.ok : ui.error, { fontSize: 22 }]}>{tc(CHECKIN_LABELS[check.result])}{check.type ? ` · ${check.type}` : ""}{check.holder ? ` · ${check.holder}` : ""}</Text>}
      <Text style={ui.muted}>{tr("sv.ev_code_hint")}</Text>
    </View>}
    <Text style={ui.h2}>{tr("sv.ev_waiting", { n: waiting.length })}</Text>
    {waiting.length === 0 && <Text style={ui.muted}>{tr("sv.ev_none_waiting")}</Text>}
    {waiting.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{o.buyer_name} — {o.quantity} × {o.type_name} = {formatPrice(o.total)}</Text>
      <Text style={ui.muted}>{ticketOrderRef(o.ref_no)} · {o.method ? tc(TICKET_METHOD_LABELS[o.method]) : ""}{tr("sv.ref_x", { ref: o.reference ?? "" })}{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</Text>
      {reject === o.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={tr("sv.ev_why_not_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />
        <Button title={tr("sv.ina_not_received")} variant="danger" onPress={() => void decide(o, false)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title={tr("sv.ev_got_money")} onPress={() => Alert.alert(tr("sv.ina_confirm_pay"), tr("sv.ev_received_q", { v: formatPrice(o.total), name: o.buyer_name }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.yes_received"), onPress: () => void decide(o, true) }])} />
        <Button title={tr("sv.ina_not_received")} variant="secondary" onPress={() => { setReject(o.id); setNote(""); }} />
      </>}
    </View>)}
    {reserved.length > 0 && <View style={ui.card}><Text style={ui.label}>{tr("sv.ev_reserved", { n: reserved.length })}</Text>
      {reserved.map(o => <Text key={o.id} style={ui.text}>{o.buyer_name} — {o.quantity} × {o.type_name} · {formatPrice(o.total)}</Text>)}</View>}
    {confirmed.length > 0 && <View style={ui.card}><Text style={ui.label}>{tr("sv.ev_confirmed_buyers")}</Text>
      {confirmed.map(o => <Text key={o.id} style={ui.text}>{o.buyer_name} — {o.quantity} × {o.type_name}{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</Text>)}</View>}
    <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ev_fee_title", { pct: p.fee_pct })}</Text>
      <Text style={ui.text}>{tr("sv.ev_fee_total", { total: formatPrice(p.fee_total) })}<Text style={ui.label}>{formatPrice(p.fee_due)}</Text></Text>
      {p.fee_pending && <Text style={ui.text}>{tr("sv.ev_fee_pending")}</Text>}
      {p.fee_due > 0 && !p.fee_pending && (open === "fee" ? <PlatformPayBox eventId={id} uid={uid} kind="fee" amount={p.fee_due} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <Button title={tr("sv.ev_pay_fee")} onPress={() => setOpen("fee")} />)}
      <Text style={ui.muted}>{tr("sv.ev_fee_hint")}</Text>
    </View>
    {active && <View style={ui.card}>
      <Text style={ui.h2}>{tr("sv.ev_boost_title")}</Text>
      <Text style={ui.text}>{tr("sv.ev_boost_info", { price: formatPrice(p.boost_price_kz), days: p.boost_days })}</Text>
      {featured && <Text style={ui.ok}>{tr("sv.pr_featured_until", { date: new Date(e.featured_until!).toLocaleDateString(LANG_TAGS[lang]) })}</Text>}
      {p.boost_pending ? <Text style={ui.text}>{tr("sv.ev_boost_pending")}</Text> : open === "boost"
        ? <PlatformPayBox eventId={id} uid={uid} kind="boost" amount={p.boost_price_kz} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <Button title={featured ? tr("sv.more_days") : tr("sv.feature")} onPress={() => setOpen("boost")} />}
    </View>}
    {p.payments.length > 0 && <View style={ui.card}><Text style={ui.label}>{tr("sv.ev_payments")}</Text>
      {p.payments.map(x => <Text key={x.id} style={ui.text}>P-{x.ref_no} · {x.kind === "boost" ? tr("sv.boost_days", { n: x.days ?? 0 }) : tr("sv.commission")} · {formatPrice(x.amount)} · {x.status === "pending" ? tr("sv.st_waiting") : x.status === "confirmed" ? tr("sv.st_confirmed") : tr("sv.st_rejected") + (x.admin_note ? ": " + x.admin_note : "")}</Text>)}</View>}
    {e.status === "published" && (open === "cancel" ? <View style={ui.card}>
      <Field label={tr("sv.ev_cancel_reason")} value={reason} onChangeText={setReason} maxLength={300} />
      <Button title={tr("sv.ev_cancel_btn")} variant="danger" disabled={busy || !reason.trim()} onPress={() => Alert.alert(tr("sv.ev_cancel_q"), tr("sv.ev_cancel_warn"), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("sv.ev_cancel_confirm"), style: "destructive", onPress: () => void doCancel() }])} />
      <Button title={tr("common.back")} variant="secondary" onPress={() => setOpen("")} />
    </View> : <Button title={tr("sv.ev_cancel_x")} variant="secondary" onPress={() => setOpen("cancel")} />)}
  </ScrollView>;
}

/** Código QR desenhado com quadrados (sem bibliotecas nativas). */
function TicketQr({ code, size = 200 }: { code: string; size?: number }) {
  const { t: tr } = useT();
  const m = qrMatrix(ticketVerifyUrl(siteUrl, code)); const n = m.length + 4; const cell = Math.floor(size / n);
  return <View accessible accessibilityLabel={tr("sv.ev_qr_a11y", { code })} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8 }}>
    {m.map((row, y) => <View key={y} style={{ flexDirection: "row" }}>{row.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#000" : "#fff" }} />)}</View>)}
  </View>;
}

/** Os meus bilhetes (comprador). */
export function MyTicketsScreen() {
  const { t: tr, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyTicketOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myTicketOrders(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!uid) return <LoginNeeded title={tr("sv.ev_my_tickets")} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/eventos" style={ui.link}>{tr("sv.ev_back")}</Link>
    <Text style={ui.h1}>{tr("sv.ev_my_tickets")}</Text>
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>{tr("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{tr("sv.ev_no_my_tickets")}</Text> :
      items.map(o => <TicketOrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </ScrollView>;
}
function TicketOrderCard({ o, onDone, onError }: { o: MyTicketOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  async function pay() { setBusy(true); const r = await submitTicketPayment(supabase(), o.id, method, reference); setBusy(false); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(tr("sv.ev_ref_sent")); }
  async function cancel() { const r = await cancelTicketOrder(supabase(), o.id); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(tr("sv.ev_res_cancelled")); }
  const usable = ticketUsable(o);
  return <View style={ui.card}>
    <Pressable accessibilityRole="link" onPress={() => router.push(`/eventos/${o.event_id}` as any)}><Text style={[ui.link, { fontSize: 19 }]}>{o.title}</Text></Pressable>
    <Text style={ui.muted}>{ticketOrderRef(o.ref_no)} · 📅 {formatDateTimeIn(o.starts_at, lang)} · 📍 {o.venue}</Text>
    <Text style={ui.text}>{o.quantity} × {o.type_name} · <Text style={ui.label}>{o.total > 0 ? formatPrice(o.total) : tr("price.free")}</Text> · {tc(TICKET_ORDER_STATUS_LABELS[o.status])}</Text>
    {o.event_status === "cancelled" && <Text style={ui.error}>{tr("sv.ev_cancelled_refund", { reason: o.cancel_reason ? ": " + o.cancel_reason : "" })}</Text>}
    {!!o.note && o.status === "rejected" && <Text style={ui.error}>{tr("sv.reason", { note: o.note })}</Text>}
    {o.status === "reserved" && <>
      <Text style={ui.label}>{tr("sv.ev_pay_org", { v: formatPrice(o.total), by: o.pay_by ? tr("sv.until", { date: formatDateTimeIn(o.pay_by, lang) }) : "" })}</Text>
      <View style={ui.card}>
        {!!o.pay_holder && <Text style={ui.text}>{tr("sv.holder_x")}<Text style={ui.label}>{o.pay_holder}</Text></Text>}
        {!!o.pay_iban && <Text selectable style={ui.text}>IBAN: <Text style={ui.label}>{o.pay_iban}</Text></Text>}
        {!!o.pay_express && <Text selectable style={ui.text}>Multicaixa Express: <Text style={ui.label}>{o.pay_express}</Text></Text>}
        {!!o.pay_note && <Text style={ui.muted}>{o.pay_note}</Text>}
      </View>
      <Text style={ui.label}>{tr("sv.ev_say_paid")}</Text>
      <Chips options={METHODS.map(k => ({ value: k, label: tc(TICKET_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={tr("sv.pay_ref_ph")} accessibilityLabel={tr("sv.pay_ref_a11y")} {...ph} />
      <Button title={busy ? tr("sv.sending") : tr("sv.paid_plain")} disabled={busy} onPress={() => void pay()} />
      <Button title={tr("sv.ev_cancel_res")} variant="secondary" onPress={() => Alert.alert(tr("sv.ev_cancel_res_q"), "", [{ text: tr("sv.no"), style: "cancel" }, { text: tr("common.cancel"), onPress: () => void cancel() }])} />
    </>}
    {o.status === "confirmed" && o.tickets.map(t => <View key={t.code} style={[ui.card, { alignItems: "center", borderStyle: t.status === "valid" && usable ? "solid" : "dashed" }]}>
      {t.status === "valid" && usable && <TicketQr code={t.code} />}
      <Text selectable style={[ui.h2, { letterSpacing: 2 }]}>{t.code}</Text>
      <Text style={ui.muted}>{t.status === "used" ? tr("sv.tk_used") : t.status === "void" ? tr("sv.tk_void") : usable ? tr("sv.tk_show") : tr("sv.tk_ended")}</Text>
    </View>)}
  </View>;
}

/** Administração: comissões e destaques dos eventos. */
export function AdminEvents() {
  const { t: tr, tc, lang } = useT();
  const [s, setS] = useState<PlatformSettings | null>(null); const [items, setItems] = useState<AdminEventPayment[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected">("pending"); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  async function load() { const [a, b] = await Promise.all([getPlatformSettings(supabase()), listEventPaymentsForAdmin(supabase(), status)]); setS(a.data); if (b.error) setError(friendlyErrorIn(b.error, lang)); setItems(b.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(p: AdminEventPayment, ok: boolean) {
    if (!ok && !note.trim()) { setError(tr("sv.pra_why_not")); return; }
    const r = await decideEventPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? (p.kind === "boost" ? tr("sv.eva_confirmed_boost") : tr("sv.eva_fee_ok")) : tr("sv.pay_rejected")); setReject(null); setNote(""); await load(); }
  }
  async function save() {
    if (!s) return;
    const pct = Number(s.event_ticket_fee_pct), price = Number(s.event_boost_price_kz), days = Number(s.event_boost_days), hours = Number(s.event_payment_hours);
    if (!(pct >= 0 && pct <= 30) || !(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60 || !Number.isInteger(hours) || hours < 1 || hours > 168) { setError(tr("sv.eva_bad")); return; }
    const r = await updatePlatformSettings(supabase(), { event_ticket_fee_pct: pct, event_boost_price_kz: price, event_boost_days: days, event_payment_hours: hours });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(tr("sv.eva_saved")); }
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{tr("sv.eva_title")}</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label={tr("sv.eva_fee_pct")} value={String(s.event_ticket_fee_pct ?? "")} onChangeText={v => setS({ ...s, event_ticket_fee_pct: v })} keyboardType="decimal-pad" />
      <Field label={tr("sv.pra_price")} value={String(s.event_boost_price_kz ?? "")} onChangeText={v => setS({ ...s, event_boost_price_kz: v })} keyboardType="numeric" />
      <Field label={tr("sv.pra_days")} value={String(s.event_boost_days ?? "")} onChangeText={v => setS({ ...s, event_boost_days: Number(v) || 0 })} keyboardType="numeric" />
      <Field label={tr("sv.eva_hours")} value={String(s.event_payment_hours ?? "")} onChangeText={v => setS({ ...s, event_payment_hours: Number(v) || 0 })} keyboardType="numeric" />
      <Button title={tr("sv.aga_save_rules")} onPress={() => void save()} />
    </View>}
    <Chips options={[{ value: "pending" as const, label: tr("sv.f_to_confirm") }, { value: "confirmed" as const, label: tr("sv.f_confirmed_m") }, { value: "rejected" as const, label: tr("sv.f_rejected_m") }]} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>{tr("sv.nothing_in_list")}</Text>}
    {items.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{p.kind === "boost" ? tr("sv.eva_boost", { n: p.days ?? 0 }) : tr("sv.eva_fee")} · {formatPrice(p.amount)}</Text>
      <Text style={ui.text}>{eventRef(p.event_ref)} {p.event_title} · {p.organizer_name}</Text>
      <Text style={ui.muted}>P-{p.ref_no} · {tc(PLAN_METHOD_LABELS[p.method])}{p.reference ? tr("sv.ref_x", { ref: p.reference }) : ""}</Text>
      {!!p.admin_note && <Text style={ui.muted}>{tr("sv.note_x", { note: p.admin_note })}</Text>}
      {!!p.proof_path && <Button title={tr("sv.proof_doc")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyErrorIn(r.error, lang)); }} />}
      {p.status === "pending" && (reject === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={tr("sv.eva_why_not_ph")} accessibilityLabel={tr("sv.reason_plain")} {...ph} />
        <Button title={tr("sv.not_received")} variant="danger" onPress={() => void decide(p, false)} /><Button title={tr("common.back")} variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title={tr("sv.confirm_ok")} onPress={() => Alert.alert(tr("sv.ina_confirm_pay"), tr("sv.pra_confirm_text", { price: formatPrice(p.amount), owner: p.organizer_name }), [{ text: tr("sv.no"), style: "cancel" }, { text: tr("common.confirm"), onPress: () => void decide(p, true) }])} />
        <Button title={tr("sv.not_received")} variant="secondary" onPress={() => { setReject(p.id); setNote(""); }} />
      </>)}
    </View>)}
  </View>;
}

/** Ecrã aberto pelo QR do bilhete: diz se é verdadeiro; o organizador deixa entrar aqui. */
export function TicketVerifyScreen({ code }: { code: string }) {
  const router = useRouter();
  const { t: tr, tc, lang } = useT();
  const [v, setV] = useState<TicketView | null>(null); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await ticketByCode(supabase(), code); if (r.error) setError(friendlyErrorIn(r.error, lang)); setV(r.data ?? { result: "invalid" }); }
  useEffect(() => { void load(); }, [code]);
  if (!v) return <View style={ui.screen}><Text style={ui.text}>{tr("sv.tv_checking")}</Text></View>;
  if (v.result !== "ok") return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{tr("sv.tv_unknown")}</Text>
    <Text style={[ui.error, { fontSize: 19 }]}>{tr("sv.tv_unknown_text")}</Text>
  </ScrollView>;
  const usable = v.status === "valid" && v.event_status !== "cancelled";
  async function letIn() {
    if (!v?.event_id || !v.code) return;
    setBusy(true); const r = await checkInTicket(supabase(), v.event_id, v.code); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setMsg(tc(CHECKIN_LABELS[r.data?.result ?? "invalid"])); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{v.status === "used" ? tr("sv.tv_used") : usable ? tr("sv.tv_ok") : tr("sv.tv_void")}</Text>
    <Text style={[usable ? ui.ok : ui.error, { fontSize: 19 }]}>{v.code} · {v.event_title}{v.starts_at ? " · " + formatDateTimeIn(v.starts_at, lang) : ""}</Text>
    <Message error={error} ok={msg} />
    {v.role === "other" && <View style={ui.card}><Text style={ui.text}>{tr("sv.tv_other")}</Text>
      <Button title={tr("auth.login")} onPress={() => router.push("/login")} /></View>}
    {v.role !== "other" && <View style={ui.card}>
      {!!v.holder && <Text style={ui.text}>{tr("sv.tv_name")}<Text style={ui.label}>{v.holder}</Text></Text>}
      {!!v.type && <Text style={ui.text}>{tr("sv.tv_ticket", { v: v.type })}</Text>}
      {!!v.venue && <Text style={ui.text}>{tr("sv.tv_venue", { v: v.venue })}</Text>}
      {!!v.checked_in_at && <Text style={ui.text}>{tr("sv.tv_entered", { v: formatDateTimeIn(v.checked_in_at, lang) })}</Text>}
    </View>}
    {v.role === "organizer" && usable && <Button title={tr("sv.tv_let_in")} disabled={busy} onPress={() => void letIn()} />}
    <Button title={tr("sv.tv_see_event")} variant="secondary" onPress={() => router.push(("/eventos/" + v.event_id) as any)} />
  </ScrollView>;
}
