import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";
import { listEvents, getEvent, getEventTickets, getEventPaymentInfo, saveEvent, setEventPublished, cancelEvent, reserveTickets, submitTicketPayment, decideTicketOrder,
  cancelTicketOrder, checkInTicket, myTicketOrders, organizerPanel, submitEventPlatformPayment, listEventPaymentsForAdmin, decideEventPayment, listMyEvents,
  formatEventDate, isoToLocalInput, eventIsOver, eventRef, ticketOrderRef, priceFromText, ticketsLeftText, eventShareMessage, normalizeTicketCode, qrMatrix, ticketUsable,
  partsToLocalInput, localInputToParts, validateEvent, uploadClassifiedMedia, uploadPaymentProof, base64ToArrayBuffer, paymentProofUrl, getPlatformSettings, updatePlatformSettings,
  formatPrice, formatDate, friendlyError, whatsappShareUrl, pointFrom, EVENT_CATEGORY_LABELS, TICKET_ORDER_STATUS_LABELS, TICKET_METHOD_LABELS, CHECKIN_LABELS, PLAN_METHOD_LABELS,
  type EventCategory, type EventSummary, type EventRow, type TicketTypeAvailability, type TicketTypeDraft, type EventPaymentInfo, type MyTicketOrder,
  type OrganizerPanel, type OrganizerOrder, type AdminEventPayment, type CheckInResult, type PaymentMethodPlan, type PlatformSettings, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { ItemCard, Grid } from "./ItemCard";
import { LiteImage } from "./LiteImage";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";

const CATS = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
const METHODS = Object.keys(TICKET_METHOD_LABELS) as PaymentMethodPlan[];
const icon = (c: EventCategory) => EVENT_CATEGORY_LABELS[c].split(" ")[0];
const ph = { placeholderTextColor: C.muted };
type Picked = { uri: string; base64?: string | null; mimeType: string };
const toBody = async (p: Picked) => p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
async function pickImage(camera: boolean): Promise<Picked | string | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return camera ? "Autorize a câmara." : "Autorize o acesso à galeria.";
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;
const Banner = ({ text }: { text: string }) => <View style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>{text}</Text></View>;
function LoginNeeded({ title, text }: { title: string; text?: string }) {
  const router = useRouter();
  return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{title}</Text>{!!text && <Text style={ui.text}>{text}</Text>}<Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
}

/** Lista pública de eventos (os destacados primeiro). */
export function EventListScreen() {
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [cat, setCat] = useState<EventCategory | "">(""); const [q, setQ] = useState(""); const [items, setItems] = useState<EventSummary[] | null>(null); const [error, setError] = useState("");
  async function load() { const r = await listEvents(supabase(), { category: cat, query: q }); if (r.error) setError(friendlyError(r.error)); else { setError(""); setItems(r.data); } }
  useEffect(() => { void load(); }, [cat]);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>🎟️ Eventos no Huambo</Text>
    <View style={ui.row}><Link href="/bilhetes" style={ui.link}>🎟️ Os meus bilhetes</Link><Text style={ui.muted}> · </Text><Link href="/eventos/meus" style={ui.link}>➕ Organizar um evento</Link></View>
    <TextInput style={ui.input} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" placeholder="Ex.: concerto, feira, jogo…" accessibilityLabel="Procurar eventos" {...ph} />
    <Chips options={[{ value: "all" as const, label: "Todos" }, ...CATS.map(c => ({ value: c, label: EVENT_CATEGORY_LABELS[c] }))]} value={cat || "all"} onChange={v => setCat(v === "all" ? "" : v as EventCategory)} />
    <Message error={error} />
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não há eventos nesta pesquisa.</Text> :
      <Grid>{items.map(e => <ItemCard key={e.id} width={cardW} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon={icon(e.category)} title={e.title}
        price={priceFromText(e.price_from)} featured={e.featured} tag={e.tickets_left === 0 ? "Esgotado" : undefined} tagRed={e.tickets_left === 0}
        meta={`📅 ${formatEventDate(e.starts_at)} · ${e.venue}`} />)}</Grid>}
  </ScrollView>;
}

/** Página do evento: detalhes e compra. */
export function EventDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const [e, setE] = useState<EventRow | null | undefined>(undefined); const [types, setTypes] = useState<TicketTypeAvailability[]>([]); const [uid, setUid] = useState<string | null>(null);
  const [typeId, setTypeId] = useState(""); const [qty, setQty] = useState(1); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useFocusEffect(useCallback(() => { void (async () => {
    const [a, b] = await Promise.all([getEvent(supabase(), id), getEventTickets(supabase(), id)]);
    if (a.error) setError(friendlyError(a.error)); setE(a.data); setTypes(b.data.filter(t => t.active)); setUid(await currentUserId());
  })(); }, [id]));
  if (e === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!e) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Evento não encontrado</Text><Message error={error} /><Link href="/eventos" style={ui.link}>← Ver todos os eventos</Link></ScrollView>;
  const mine = uid === e.organizer_id; const over = eventIsOver(e); const onSale = e.status === "published" && !over;
  const chosen = types.find(t => t.id === typeId); const priceFrom = types.length ? Math.min(...types.map(t => t.price)) : null;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now();
  async function buy() {
    if (!chosen) { setError("Escolha o tipo de bilhete."); return; }
    setBusy(true); setError("");
    const r = await reserveTickets(supabase(), chosen.id, qty, name, phone); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    router.push("/bilhetes");
  }
  const share = eventShareMessage(siteUrl + "/", e, priceFrom);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/eventos" style={ui.link}>← Todos os eventos</Link>
    {!!e.cover_url && <LiteImage placeholder="🎟️" source={{ uri: e.cover_url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }} resizeMode="cover" accessibilityLabel={"Cartaz: " + e.title} />}
    <Text style={ui.muted}>{EVENT_CATEGORY_LABELS[e.category]}{featured ? " · ⭐ Destaque" : ""} · {eventRef(e.ref_no)}</Text>
    <Text style={ui.h1}>{e.title}</Text>
    {e.status === "cancelled" && <Banner text={`❌ Evento cancelado${e.cancel_reason ? ": " + e.cancel_reason : ""}. Quem pagou deve falar com o organizador para o reembolso.`} />}
    {e.status === "draft" && <Banner text="📝 Rascunho: só o organizador vê esta página." />}
    {over && e.status === "published" && <Banner text="Este evento já aconteceu." />}
    <View style={ui.card}>
      <Text style={ui.text}>📅 <Text style={ui.label}>{formatEventDate(e.starts_at)}</Text>{e.ends_at ? " até " + formatEventDate(e.ends_at) : ""}</Text>
      <Text style={ui.text}>📍 <Text style={ui.label}>{e.venue}</Text>{e.municipalities?.name ? ", " + e.municipalities.name : ""}</Text>
      <Text style={ui.text}>💰 {priceFromText(priceFrom)}</Text>
    </View>
    {mine && <><Button title="⚙️ Gerir o evento" onPress={() => router.push(`/eventos/${e.id}/gerir` as any)} /><Button title="✏️ Editar" variant="secondary" onPress={() => router.push(`/eventos/${e.id}/editar` as any)} /></>}
    {!!e.description && <Text style={ui.text}>{e.description}</Text>}
    <PlaceView directions={e.directions} lat={e.geo_lat} lng={e.geo_lng} />
    <View style={ui.card}>
      <Text style={ui.h2}>🎟️ Bilhetes</Text>
      {types.length === 0 && <Text style={ui.text}>Ainda não há bilhetes à venda.</Text>}
      {types.map(t => { const on = typeId === t.id; const can = onSale && !mine && t.left_count > 0;
        return <Pressable key={t.id} disabled={!can} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !can }} onPress={() => { setTypeId(t.id); setQty(1); }}
          style={[ui.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: on ? 3 : 1, borderColor: on ? C.blue : C.line }]}>
          <Text style={ui.label}>{onSale && !mine ? (on ? "🔘 " : "⚪ ") : ""}{t.name}</Text>
          <View style={{ alignItems: "flex-end" }}><Text style={ui.price}>{t.price > 0 ? formatPrice(t.price) : "Grátis"}</Text><Text style={t.left_count === 0 ? ui.error : ui.muted}>{ticketsLeftText(t.left_count)}</Text></View>
        </Pressable>; })}
      {onSale && !mine && types.length > 0 && (!uid ? <Button title="Entrar para comprar bilhete" onPress={() => router.push("/login")} /> : <>
        {!!chosen && <><Text style={ui.label}>Quantos bilhetes?</Text>
          <View style={ui.row}><Button title="−" variant="secondary" disabled={qty <= 1} onPress={() => setQty(qty - 1)} /><Text style={[ui.h2, { alignSelf: "center", minWidth: 40, textAlign: "center" }]} accessibilityLabel={`${qty} bilhetes`}>{qty}</Text>
            <Button title="+" variant="secondary" disabled={qty >= Math.min(chosen.max_per_order, chosen.left_count)} onPress={() => setQty(qty + 1)} /></View></>}
        <Field label="O seu nome (aparece no bilhete)" value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
        <Field label="Telefone (opcional)" value={phone} onChangeText={setPhone} maxLength={20} keyboardType="phone-pad" placeholder="9XX XXX XXX" />
        {!!chosen && <Text style={ui.label}>Total: {chosen.price > 0 ? formatPrice(chosen.price * qty) : "Grátis"}</Text>}
        {!!chosen && chosen.price > 0 && <Text style={ui.muted}>Depois de reservar, paga diretamente ao organizador e envia a referência. O bilhete aparece quando o organizador confirmar.</Text>}
        <Message error={error} />
        <Button title={busy ? "A reservar…" : chosen && chosen.price === 0 ? "🎟️ Pedir bilhete grátis" : "🎟️ Reservar bilhete"} disabled={busy || !chosen} onPress={() => void buy()} />
      </>)}
    </View>
    <Button title="📲 Partilhar no WhatsApp" variant="secondary" onPress={() => void Linking.openURL(whatsappShareUrl(share))} />
    <Button title="🔗 Partilhar" variant="secondary" onPress={() => void Share.share({ message: share })} />
    <Text style={ui.muted}>O Huambo Online não organiza este evento. Pague só pelos dados que aparecem depois de reservar e guarde o comprovativo.</Text>
  </ScrollView>;
}

/** Criar ou editar evento. */
export function EventFormScreen({ id }: { id?: string }) {
  const router = useRouter(); const { municipalities } = useTerritory();
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
    const e = a.data; if (!e) { setError("Evento não encontrado."); return; }
    const s = localInputToParts(isoToLocalInput(e.starts_at)), f = localInputToParts(isoToLocalInput(e.ends_at));
    setTitle(e.title); setDescription(e.description ?? ""); setCategory(e.category); setSDate(s.date); setSTime(s.time); setEDate(f.date); setETime(f.time);
    setVenue(e.venue); setMunicipalityId(e.municipality_id ?? ""); setDirections(e.directions ?? ""); setPoint(pointFrom(e.geo_lat, e.geo_lng)); setCover(e.cover_url); setStatus(e.status);
    setPay(c); setExisting(b.data.map(t => ({ id: t.id })));
    if (b.data.length) setTickets(b.data.map(t => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), max_per_order: String(t.max_per_order), active: t.active })));
    setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <View style={ui.screen}><Text style={ui.text}>{error || "A carregar…"}</Text></View>;
  if (!uid) return <LoginNeeded title="🎟️ Organizar um evento" />;
  const setT = (k: number, p: Partial<TicketTypeDraft>) => setTickets(l => l.map((t, i) => i === k ? { ...t, ...p } : t));
  const startsAt = partsToLocalInput(sDate, sTime); const endsAt = eDate || eTime ? partsToLocalInput(eDate, eTime) || "x" : "";
  const input = { title, description, category, startsAt, endsAt: endsAt === "x" ? "invalid" : endsAt, venue, municipalityId, directions, point, coverUrl: cover, pay, tickets };
  const paid = tickets.some(t => Number(t.price.replace(/\s/g, "").replace(",", ".")) > 0);
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(r); else if (r) setPhoto(r); }
  async function save(publish: boolean) {
    const bad = (sDate || sTime) && !startsAt ? "Escreva o dia como 18/10/2026 e a hora como 20:00." : validateEvent(input); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (photo) { const up = await uploadClassifiedMedia(supabase(), await toBody(photo), uid!, "cartaz." + (photo.mimeType.split("/")[1] ?? "jpg"), photo.mimeType); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o cartaz."); coverUrl = up.data; }
      const r = await saveEvent(supabase(), uid!, { ...input, coverUrl }, id, existing);
      if (r.error || !r.data) throw r.error ?? new Error("Não foi possível gravar.");
      if (publish && status !== "published") { const p = await setEventPublished(supabase(), r.data.id, true); if (p.error) { setError(friendlyError(p.error)); if (!id) router.replace(`/eventos/${r.data.id}/editar` as any); return; } }
      router.replace(`/eventos/${r.data.id}/gerir` as any);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{id ? "✏️ Editar evento" : "🎟️ Novo evento"}</Text>
    <Field label="Nome do evento" value={title} onChangeText={setTitle} maxLength={120} placeholder="Ex.: Noite de Kizomba no Cine Ruacaná" />
    <Text style={ui.label}>Tipo</Text>
    <Chips options={CATS.map(c => ({ value: c, label: EVENT_CATEGORY_LABELS[c] }))} value={category} onChange={setCategory} />
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 150 }}><Field label="Dia do início" value={sDate} onChangeText={setSDate} placeholder="18/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
      <View style={{ flex: 1, minWidth: 110 }}><Field label="Hora" value={sTime} onChangeText={setSTime} placeholder="20:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
    </View>
    <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 150 }}><Field label="Dia do fim (opcional)" value={eDate} onChangeText={setEDate} placeholder="19/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
      <View style={{ flex: 1, minWidth: 110 }}><Field label="Hora do fim" value={eTime} onChangeText={setETime} placeholder="02:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
    </View>
    <Field label="Local" value={venue} onChangeText={setVenue} maxLength={120} placeholder="Ex.: Cine Ruacaná" />
    {municipalities.length > 0 && <><Text style={ui.label}>Município</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /></>}
    <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint="Marque a entrada do local para as pessoas chegarem sem se perderem." />
    <Text style={ui.label}>Descrição (programa, artistas, regras de entrada)</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} maxLength={4000} accessibilityLabel="Descrição" {...ph} />
    <View style={ui.card}>
      <Text style={ui.label}>🖼️ Cartaz (opcional)</Text>
      {(photo || cover) && <Image source={{ uri: photo?.uri ?? cover! }} style={{ width: 140, height: 140, borderRadius: 10 }} accessibilityLabel="Cartaz" />}
      {(photo || cover) ? <Button title="Tirar o cartaz" variant="secondary" onPress={() => { setPhoto(null); setCover(null); }} />
        : <View style={ui.row}><Button title="📷 Fotografar" variant="secondary" onPress={() => void choose(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void choose(false)} /></View>}
    </View>
    <View style={ui.card}>
      <Text style={ui.h2}>🎟️ Bilhetes</Text>
      <Text style={ui.muted}>Preço 0 = entrada grátis. Depois da primeira venda já não pode mudar o preço.</Text>
      {tickets.map((t, k) => <View key={k} style={[ui.card, { gap: 8 }]}>
        <Field label={`Bilhete ${k + 1}: nome`} value={t.name} onChangeText={v => setT(k, { name: v })} maxLength={60} placeholder="Normal, VIP, Mesa…" />
        <View style={ui.row}>
          <View style={{ flex: 1, minWidth: 120 }}><Field label="Preço (Kz)" value={t.price} onChangeText={v => setT(k, { price: v })} keyboardType="numeric" placeholder="0" /></View>
          <View style={{ flex: 1, minWidth: 120 }}><Field label="Quantidade" value={t.quantity} onChangeText={v => setT(k, { quantity: v })} keyboardType="numeric" placeholder="100" /></View>
        </View>
        <Button title={(t.active ?? true) ? "✅ À venda (tocar para parar)" : "⏸️ Parado (tocar para vender)"} variant="secondary" onPress={() => setT(k, { active: !(t.active ?? true) })} />
        {tickets.length > 1 && <Button title="Tirar este bilhete" variant="secondary" onPress={() => setTickets(l => l.filter((_, i) => i !== k))} />}
      </View>)}
      <Button title="➕ Outro tipo de bilhete" variant="secondary" onPress={() => setTickets(l => [...l, { name: "", price: "", quantity: "" }])} />
    </View>
    {paid && <View style={ui.card}>
      <Text style={ui.h2}>💰 Onde recebe o dinheiro</Text>
      <Text style={ui.muted}>Os compradores pagam diretamente para si. Estes dados só aparecem a quem reservou bilhete.</Text>
      <Field label="Titular da conta" value={pay.holder} onChangeText={v => setPay({ ...pay, holder: v })} maxLength={80} />
      <Field label="IBAN" value={pay.iban} onChangeText={v => setPay({ ...pay, iban: v })} maxLength={40} placeholder="AO06 …" autoCapitalize="characters" />
      <Field label="Número Multicaixa Express" value={pay.express} onChangeText={v => setPay({ ...pay, express: v })} maxLength={20} keyboardType="phone-pad" />
      <Field label="Nota para quem paga (opcional)" value={pay.note} onChangeText={v => setPay({ ...pay, note: v })} maxLength={200} />
    </View>}
    <Message error={error} />
    {status !== "published" && <Button title={busy ? "A gravar…" : "✅ Publicar o evento"} disabled={busy} onPress={() => void save(true)} />}
    <Button title={busy ? "A gravar…" : status === "published" ? "Guardar alterações" : "Guardar como rascunho"} variant={status === "published" ? "primary" : "secondary"} disabled={busy} onPress={() => void save(false)} />
  </ScrollView>;
}

/** Os meus eventos (organizador). */
export function MyEventsScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<Awaited<ReturnType<typeof listMyEvents>>["data"] | null>(null);
  useFocusEffect(useCallback(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyEvents(supabase(), u)).data); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="🎟️ Os meus eventos" text="Publique o seu concerto, festa, jogo ou feira e venda os bilhetes aqui." />;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/eventos" style={ui.link}>← Todos os eventos</Link>
    <Text style={ui.h1}>🎟️ Os meus eventos</Text>
    <Button title="➕ Novo evento" onPress={() => router.push("/eventos/novo")} />
    <Text style={ui.muted}>Os compradores pagam-lhe diretamente. O Huambo Online cobra uma pequena comissão dos bilhetes pagos que confirmar.</Text>
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não tem eventos.</Text> :
      items.map(e => <Pressable key={e.id} accessibilityRole="link" onPress={() => router.push(`/eventos/${e.id}/gerir` as any)} style={ui.card}>
        <Text style={ui.label}>{e.title}</Text>
        <Text style={ui.muted}>{eventRef(e.ref_no)} · 📅 {formatEventDate(e.starts_at)} · {e.status === "draft" ? "📝 Rascunho" : e.status === "cancelled" ? "❌ Cancelado" : eventIsOver(e) ? "Já aconteceu" : "✅ Publicado"}{e.featured_until && Date.parse(e.featured_until) > Date.now() ? " · ⭐ Destaque" : ""}</Text>
      </Pressable>)}
  </ScrollView>;
}

function PlatformPayBox({ eventId, uid, kind, amount, settings, onDone, onClose }: { eventId: string; uid: string; kind: "fee" | "boost"; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [proof, setProof] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(r); else if (r) setProof(r); }
  async function send() {
    if (!reference.trim() && !proof) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const up = await uploadPaymentProof(supabase(), uid, await toBody(proof), "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data; }
      const r = await submitEventPlatformPayment(supabase(), eventId, kind, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      onDone(kind === "boost" ? "Pedido de destaque enviado. Fica ativo quando a administração confirmar o pagamento." : "Pagamento da comissão enviado. A administração vai confirmar.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.label}>Valor a pagar: {formatPrice(amount)}</Text>
    <Text style={ui.label}>1. Pague ao Huambo Online para estes dados</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>2. Diga-nos como pagou</Text>
    <Chips options={METHODS.map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void choose(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void choose(false)} /></View>}
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar pagamento"} disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={onClose} />
  </View>;
}

/** Painel do organizador. */
export function EventManageScreen({ id }: { id: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [e, setE] = useState<EventRow | null>(null); const [p, setP] = useState<OrganizerPanel | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [open, setOpen] = useState<"" | "fee" | "boost" | "cancel">("");
  const [code, setCode] = useState(""); const [check, setCheck] = useState<CheckInResult | null>(null); const [reason, setReason] = useState("");
  const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b, s] = await Promise.all([getEvent(supabase(), id), organizerPanel(supabase(), id), getPlatformSettings(supabase())]);
    setE(a.data); setSettings(s.data); if (b.error) setError(friendlyError(b.error)); else setP(b.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="⚙️ Gerir evento" />;
  if (!e || !p) return <ScrollView contentContainerStyle={ui.screen}><Message error={error} />{!error && <Text style={ui.text}>A carregar…</Text>}<Link href="/eventos/meus" style={ui.link}>← Os meus eventos</Link></ScrollView>;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now(); const active = e.status === "published" && !eventIsOver(e);
  const waiting = p.orders.filter(o => o.status === "submitted"); const reserved = p.orders.filter(o => o.status === "reserved"); const confirmed = p.orders.filter(o => o.status === "confirmed");
  const done = (m: string) => { setNotice(m); setError(""); setOpen(""); setReject(null); setNote(""); void load(); };
  async function decide(o: OrganizerOrder, ok: boolean) {
    if (!ok && !note.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideTicketOrder(supabase(), o.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else done(ok ? `Pagamento confirmado: ${o.quantity} bilhete(s) enviados a ${o.buyer_name}.` : "Pagamento recusado.");
  }
  async function doCheck() {
    if (!code.trim()) return; setBusy(true); setCheck(null);
    const r = await checkInTicket(supabase(), id, normalizeTicketCode(code)); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function publish(on: boolean) { const r = await setEventPublished(supabase(), id, on); if (r.error) setError(friendlyError(r.error)); else done(on ? "Evento publicado. Já aparece em «Eventos»." : "O evento voltou a rascunho."); }
  async function doCancel() { setBusy(true); const r = await cancelEvent(supabase(), id, reason); setBusy(false); if (r.error) setError(friendlyError(r.error)); else done("Evento cancelado. Avisámos os compradores: devolva o dinheiro a quem pagou."); }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/eventos/meus" style={ui.link}>← Os meus eventos</Link>
    <Text style={ui.h1}>⚙️ {e.title}</Text>
    <Text style={ui.muted}>{eventRef(e.ref_no)} · 📅 {formatEventDate(e.starts_at)} · {e.status === "draft" ? "📝 Rascunho" : e.status === "cancelled" ? "❌ Cancelado" : "✅ Publicado"}{featured ? ` · ⭐ Destaque até ${formatDate(e.featured_until!)}` : ""}</Text>
    <Message error={error} ok={notice} />
    <Button title="👁️ Ver a página" variant="secondary" onPress={() => router.push(`/eventos/${id}` as any)} />
    {e.status !== "cancelled" && <Button title="✏️ Editar" variant="secondary" onPress={() => router.push(`/eventos/${id}/editar` as any)} />}
    {e.status === "draft" && <Button title="✅ Publicar" onPress={() => void publish(true)} />}
    {e.status === "published" && p.sold === 0 && <Button title="Voltar a rascunho" variant="secondary" onPress={() => void publish(false)} />}
    <View style={ui.card}>
      <Text style={ui.text}>🎟️ Bilhetes confirmados: <Text style={ui.label}>{p.sold}</Text></Text>
      <Text style={ui.text}>💰 Recebido: <Text style={ui.label}>{formatPrice(p.revenue)}</Text></Text>
      <Text style={ui.text}>🚪 Já entraram: <Text style={ui.label}>{p.checked_in}</Text></Text>
    </View>
    {active && <View style={ui.card}>
      <Text style={ui.h2}>🚪 Entrada: validar bilhete</Text>
      <TextInput style={[ui.input, { fontSize: 22, letterSpacing: 2 }]} value={code} onChangeText={setCode} onSubmitEditing={() => void doCheck()} placeholder="HO-XXXX-XXXX" autoCapitalize="characters" accessibilityLabel="Código do bilhete" {...ph} />
      <Button title={busy ? "A validar…" : "Validar"} disabled={busy} onPress={() => void doCheck()} />
      {!!check && <Text accessibilityLiveRegion="polite" style={[check.result === "ok" ? ui.ok : ui.error, { fontSize: 22 }]}>{CHECKIN_LABELS[check.result]}{check.type ? ` · ${check.type}` : ""}{check.holder ? ` · ${check.holder}` : ""}</Text>}
      <Text style={ui.muted}>Escreva o código do bilhete (está no telemóvel do comprador). Cada bilhete só entra uma vez.</Text>
    </View>}
    <Text style={ui.h2}>💳 Pagamentos por confirmar ({waiting.length})</Text>
    {waiting.length === 0 && <Text style={ui.muted}>Nenhum pagamento à espera.</Text>}
    {waiting.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{o.buyer_name} — {o.quantity} × {o.type_name} = {formatPrice(o.total)}</Text>
      <Text style={ui.muted}>{ticketOrderRef(o.ref_no)} · {o.method ? TICKET_METHOD_LABELS[o.method] : ""} · Ref.: {o.reference}{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</Text>
      {reject === o.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Porque não confirma? (o comprador vai ler)" accessibilityLabel="Motivo" {...ph} />
        <Button title="❌ Não recebi" variant="danger" onPress={() => void decide(o, false)} /><Button title="Voltar" variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title="✅ Recebi o dinheiro" onPress={() => Alert.alert("Confirmar pagamento", `Recebeu ${formatPrice(o.total)} de ${o.buyer_name}?`, [{ text: "Não", style: "cancel" }, { text: "Sim, recebi", onPress: () => void decide(o, true) }])} />
        <Button title="❌ Não recebi" variant="secondary" onPress={() => { setReject(o.id); setNote(""); }} />
      </>}
    </View>)}
    {reserved.length > 0 && <View style={ui.card}><Text style={ui.label}>⏳ Reservas por pagar ({reserved.length})</Text>
      {reserved.map(o => <Text key={o.id} style={ui.text}>{o.buyer_name} — {o.quantity} × {o.type_name} · {formatPrice(o.total)}</Text>)}</View>}
    {confirmed.length > 0 && <View style={ui.card}><Text style={ui.label}>✅ Compradores confirmados</Text>
      {confirmed.map(o => <Text key={o.id} style={ui.text}>{o.buyer_name} — {o.quantity} × {o.type_name}{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</Text>)}</View>}
    <View style={ui.card}>
      <Text style={ui.h2}>🧾 Comissão do Huambo Online ({p.fee_pct}%)</Text>
      <Text style={ui.text}>Total: {formatPrice(p.fee_total)} · Por pagar: <Text style={ui.label}>{formatPrice(p.fee_due)}</Text></Text>
      {p.fee_pending && <Text style={ui.text}>⏳ Pagamento enviado, à espera de confirmação.</Text>}
      {p.fee_due > 0 && !p.fee_pending && (open === "fee" ? <PlatformPayBox eventId={id} uid={uid} kind="fee" amount={p.fee_due} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <Button title="Pagar a comissão" onPress={() => setOpen("fee")} />)}
      <Text style={ui.muted}>Pague até 7 dias depois do evento. Com comissões em atraso não pode publicar novos eventos.</Text>
    </View>
    {active && <View style={ui.card}>
      <Text style={ui.h2}>⭐ Destacar o evento</Text>
      <Text style={ui.text}>{formatPrice(p.boost_price_kz)} por {p.boost_days} dias: o evento aparece no topo de «Eventos» e na página inicial, com o selo «⭐ Destaque».</Text>
      {featured && <Text style={ui.ok}>⭐ Em destaque até {formatDate(e.featured_until!)}</Text>}
      {p.boost_pending ? <Text style={ui.text}>⏳ Pagamento do destaque à espera de confirmação.</Text> : open === "boost"
        ? <PlatformPayBox eventId={id} uid={uid} kind="boost" amount={p.boost_price_kz} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <Button title={featured ? "⭐ Juntar mais dias" : "⭐ Destacar"} onPress={() => setOpen("boost")} />}
    </View>}
    {p.payments.length > 0 && <View style={ui.card}><Text style={ui.label}>Pagamentos ao Huambo Online</Text>
      {p.payments.map(x => <Text key={x.id} style={ui.text}>P-{x.ref_no} · {x.kind === "boost" ? `Destaque ${x.days} dias` : "Comissão"} · {formatPrice(x.amount)} · {x.status === "pending" ? "⏳ À espera" : x.status === "confirmed" ? "✅ Confirmado" : "❌ Recusado" + (x.admin_note ? ": " + x.admin_note : "")}</Text>)}</View>}
    {e.status === "published" && (open === "cancel" ? <View style={ui.card}>
      <Field label="Motivo do cancelamento (os compradores vão ler)" value={reason} onChangeText={setReason} maxLength={300} />
      <Button title="Cancelar o evento" variant="danger" disabled={busy || !reason.trim()} onPress={() => Alert.alert("Cancelar o evento?", "Os bilhetes são anulados e os compradores recebem um aviso. Não dá para voltar atrás.", [{ text: "Não", style: "cancel" }, { text: "Cancelar evento", style: "destructive", onPress: () => void doCancel() }])} />
      <Button title="Voltar" variant="secondary" onPress={() => setOpen("")} />
    </View> : <Button title="❌ Cancelar o evento" variant="secondary" onPress={() => setOpen("cancel")} />)}
  </ScrollView>;
}

/** Código QR desenhado com quadrados (sem bibliotecas nativas). */
function TicketQr({ code, size = 200 }: { code: string; size?: number }) {
  const m = qrMatrix(code); const n = m.length + 4; const cell = Math.floor(size / n);
  return <View accessible accessibilityLabel={"Código QR do bilhete " + code} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8 }}>
    {m.map((row, y) => <View key={y} style={{ flexDirection: "row" }}>{row.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#000" : "#fff" }} />)}</View>)}
  </View>;
}

/** Os meus bilhetes (comprador). */
export function MyTicketsScreen() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyTicketOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myTicketOrders(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="🎟️ Os meus bilhetes" />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/eventos" style={ui.link}>← Eventos</Link>
    <Text style={ui.h1}>🎟️ Os meus bilhetes</Text>
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não tem bilhetes.</Text> :
      items.map(o => <TicketOrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </ScrollView>;
}
function TicketOrderCard({ o, onDone, onError }: { o: MyTicketOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const [method, setMethod] = useState<PaymentMethodPlan>(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  async function pay() { setBusy(true); const r = await submitTicketPayment(supabase(), o.id, method, reference); setBusy(false); if (r.error) onError(friendlyError(r.error)); else onDone("Referência enviada. O organizador vai confirmar e o bilhete aparece aqui."); }
  async function cancel() { const r = await cancelTicketOrder(supabase(), o.id); if (r.error) onError(friendlyError(r.error)); else onDone("Reserva cancelada."); }
  const usable = ticketUsable(o);
  return <View style={ui.card}>
    <Pressable accessibilityRole="link" onPress={() => router.push(`/eventos/${o.event_id}` as any)}><Text style={[ui.link, { fontSize: 19 }]}>{o.title}</Text></Pressable>
    <Text style={ui.muted}>{ticketOrderRef(o.ref_no)} · 📅 {formatEventDate(o.starts_at)} · 📍 {o.venue}</Text>
    <Text style={ui.text}>{o.quantity} × {o.type_name} · <Text style={ui.label}>{o.total > 0 ? formatPrice(o.total) : "Grátis"}</Text> · {TICKET_ORDER_STATUS_LABELS[o.status]}</Text>
    {o.event_status === "cancelled" && <Text style={ui.error}>❌ Evento cancelado{o.cancel_reason ? ": " + o.cancel_reason : ""}. Fale com o organizador para o reembolso.</Text>}
    {!!o.note && o.status === "rejected" && <Text style={ui.error}>Motivo: {o.note}</Text>}
    {o.status === "reserved" && <>
      <Text style={ui.label}>1. Pague {formatPrice(o.total)} ao organizador{o.pay_by ? ` até ${formatEventDate(o.pay_by)}` : ""}</Text>
      <View style={ui.card}>
        {!!o.pay_holder && <Text style={ui.text}>Titular: <Text style={ui.label}>{o.pay_holder}</Text></Text>}
        {!!o.pay_iban && <Text selectable style={ui.text}>IBAN: <Text style={ui.label}>{o.pay_iban}</Text></Text>}
        {!!o.pay_express && <Text selectable style={ui.text}>Multicaixa Express: <Text style={ui.label}>{o.pay_express}</Text></Text>}
        {!!o.pay_note && <Text style={ui.muted}>{o.pay_note}</Text>}
      </View>
      <Text style={ui.label}>2. Diga como pagou</Text>
      <Chips options={METHODS.map(k => ({ value: k, label: TICKET_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
      <Button title={busy ? "A enviar…" : "Já paguei"} disabled={busy} onPress={() => void pay()} />
      <Button title="Cancelar reserva" variant="secondary" onPress={() => Alert.alert("Cancelar esta reserva?", "", [{ text: "Não", style: "cancel" }, { text: "Cancelar", onPress: () => void cancel() }])} />
    </>}
    {o.status === "confirmed" && o.tickets.map(t => <View key={t.code} style={[ui.card, { alignItems: "center", borderStyle: t.status === "valid" && usable ? "solid" : "dashed" }]}>
      {t.status === "valid" && usable && <TicketQr code={t.code} />}
      <Text selectable style={[ui.h2, { letterSpacing: 2 }]}>{t.code}</Text>
      <Text style={ui.muted}>{t.status === "used" ? "🚪 Já entrou" : t.status === "void" ? "❌ Anulado" : usable ? "Mostre este código à entrada" : "Evento terminado"}</Text>
    </View>)}
  </View>;
}

/** Administração: comissões e destaques dos eventos. */
export function AdminEvents() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [items, setItems] = useState<AdminEventPayment[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected">("pending"); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  async function load() { const [a, b] = await Promise.all([getPlatformSettings(supabase()), listEventPaymentsForAdmin(supabase(), status)]); setS(a.data); if (b.error) setError(friendlyError(b.error)); setItems(b.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(p: AdminEventPayment, ok: boolean) {
    if (!ok && !note.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideEventPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? (p.kind === "boost" ? "Confirmado: o evento fica em destaque." : "Comissão confirmada.") : "Pagamento recusado."); setReject(null); setNote(""); await load(); }
  }
  async function save() {
    if (!s) return;
    const pct = Number(s.event_ticket_fee_pct), price = Number(s.event_boost_price_kz), days = Number(s.event_boost_days), hours = Number(s.event_payment_hours);
    if (!(pct >= 0 && pct <= 30) || !(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60 || !Number.isInteger(hours) || hours < 1 || hours > 168) { setError("Verifique a percentagem, o preço, os dias e as horas."); return; }
    const r = await updatePlatformSettings(supabase(), { event_ticket_fee_pct: pct, event_boost_price_kz: price, event_boost_days: days, event_payment_hours: hours });
    if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Regras dos eventos guardadas."); }
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>🎟️ Eventos: comissões e destaques</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label="Comissão nos bilhetes (%)" value={String(s.event_ticket_fee_pct ?? "")} onChangeText={v => setS({ ...s, event_ticket_fee_pct: v })} keyboardType="decimal-pad" />
      <Field label="Preço do destaque (Kz)" value={String(s.event_boost_price_kz ?? "")} onChangeText={v => setS({ ...s, event_boost_price_kz: v })} keyboardType="numeric" />
      <Field label="Dias de destaque" value={String(s.event_boost_days ?? "")} onChangeText={v => setS({ ...s, event_boost_days: Number(v) || 0 })} keyboardType="numeric" />
      <Field label="Horas para pagar a reserva" value={String(s.event_payment_hours ?? "")} onChangeText={v => setS({ ...s, event_payment_hours: Number(v) || 0 })} keyboardType="numeric" />
      <Button title="Guardar regras" onPress={() => void save()} />
    </View>}
    <Chips options={[{ value: "pending" as const, label: "⏳ Por confirmar" }, { value: "confirmed" as const, label: "✅ Confirmados" }, { value: "rejected" as const, label: "❌ Recusados" }]} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>Nada nesta lista.</Text>}
    {items.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{p.kind === "boost" ? `⭐ Destaque ${p.days} dias` : "🧾 Comissão dos bilhetes"} · {formatPrice(p.amount)}</Text>
      <Text style={ui.text}>{eventRef(p.event_ref)} {p.event_title} · {p.organizer_name}</Text>
      <Text style={ui.muted}>P-{p.ref_no} · {PLAN_METHOD_LABELS[p.method]}{p.reference ? " · Ref.: " + p.reference : ""}</Text>
      {!!p.admin_note && <Text style={ui.muted}>Nota: {p.admin_note}</Text>}
      {!!p.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), p.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyError(r.error)); }} />}
      {p.status === "pending" && (reject === p.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Porque não confirma? (o organizador vai ler)" accessibilityLabel="Motivo" {...ph} />
        <Button title="✖ Não recebido" variant="danger" onPress={() => void decide(p, false)} /><Button title="Voltar" variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title="✔ Confirmar" onPress={() => Alert.alert("Confirmar pagamento", `${formatPrice(p.amount)} de ${p.organizer_name}?`, [{ text: "Não", style: "cancel" }, { text: "Confirmar", onPress: () => void decide(p, true) }])} />
        <Button title="✖ Não recebido" variant="secondary" onPress={() => { setReject(p.id); setNote(""); }} />
      </>)}
    </View>)}
  </View>;
}
