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
  formatEventDate, friendlyError, whatsappLink, VENUE_KINDS, VENUE_KIND_LIST, VENUE_SUBTYPE_LABELS, VENUE_ORDER_KIND_LABELS, VENUE_METHOD_LABELS, VENUE_STATUS_LABELS,
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
import { useTerritory } from "./Directory";
import { QrScanButton } from "./QrScanner";
import { LiteImage } from "./LiteImage";

const ph = { placeholderTextColor: C.muted };
const Field = ({ label, ...p }: { label: string } & React.ComponentProps<typeof TextInput>) =>
  <View style={{ gap: 4 }}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} style={ui.input} {...ph} {...p} /></View>;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toNum = (s: string) => Number(String(s).replace(/\s/g, "").replace(",", "."));
const qtyLabel = (q: number) => Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100).replace(".", ",");
const LIVE: VenueOrderStatus[] = ["reserved", "paid", "submitted"];

function LoginNeeded({ title }: { title: string }) {
  const router = useRouter();
  return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{title}</Text><Text style={ui.text}>Entre na sua conta para continuar.</Text>
    <Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
}
function Check({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", minHeight: 48 }}>
    <Text style={{ fontSize: 24, color: C.ink }}>{on ? "☑" : "☐"}</Text><Text style={[ui.text, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}
/** QR único do pedido: leva ao site, que confirma se é verdadeiro. */
function CodeBox({ code, token }: { code: string; token?: string | null }) {
  const m = qrMatrix(token ? venueVerifyUrl(siteUrl, token) : code); const cell = Math.floor(200 / (m.length + 4));
  return <View style={[ui.card, { alignItems: "center" }]}>
    <View accessible accessibilityLabel={"Código QR " + code} style={{ backgroundColor: "#fff", padding: cell * 2, borderRadius: 8 }}>
      {m.map((row, y) => <View key={y} style={{ flexDirection: "row" }}>{row.map((on, x) => <View key={x} style={{ width: cell, height: cell, backgroundColor: on ? "#000" : "#fff" }} />)}</View>)}
    </View>
    <Text selectable style={[ui.h1, { letterSpacing: 3 }]}>{code}</Text>
    <Text style={ui.muted}>Mostre este QR (ou diga o código) ao chegar. O estabelecimento lê com a câmara e confirma que é verdadeiro.</Text>
  </View>;
}
async function openProof(path: string, onError: (m: string) => void) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) void Linking.openURL(r.data); else onError("Não foi possível abrir o comprovativo.");
}
type Local = { uri: string; base64?: string | null; mimeType: string };
async function pickProof(camera: boolean, onError: (m: string) => void): Promise<Local | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { onError(camera ? "Autorize a câmara." : "Autorize o acesso à galeria."); return null; }
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
async function localBytes(p: Local) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }
async function pickPhotos(max: number, camera: boolean): Promise<Local[] | string> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return camera ? "Autorize a câmara para fotografar." : "Autorize o acesso à galeria.";
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: !camera && max > 1, selectionLimit: max };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.length) return [];
  return Promise.all(r.assets.slice(0, max).map(a => shrinkAsset(a)));
}
async function uploadPhotos(uid: string, items: Local[]): Promise<string[]> {
  const urls: string[] = [];
  for (const p of items) {
    const r = await uploadClassifiedMedia(supabase(), await localBytes(p), uid, "foto.jpg", p.mimeType || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error("Não foi possível enviar a fotografia.");
    urls.push(r.data);
  }
  return urls;
}
/** Fotografias pequenas; ao tocar abre em grande. */
function PhotoStrip({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null); const { width } = useWindowDimensions();
  if (!photos.length) return null;
  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {photos.map((u, i) => <Pressable key={u} accessibilityRole="button" accessibilityLabel={`Ver fotografia ${i + 1} de ${title}`} onPress={() => setOpen(i)}>
        <LiteImage placeholder="🖼️" source={{ uri: u }} style={{ width: 130, height: 96, borderRadius: 10 }} /></Pressable>)}
    </ScrollView>
    <Modal visible={open !== null} animationType="fade" onRequestClose={() => setOpen(null)}>
      {open !== null && <ScrollView contentContainerStyle={ui.screen}>
        <Image source={{ uri: photos[open] }} style={{ width: "100%", height: width, borderRadius: 12, backgroundColor: "#000" }} resizeMode="contain" accessibilityLabel={`${title} — fotografia ${open + 1} de ${photos.length}`} />
        <Text style={ui.h2}>{title}</Text>
        {photos.length > 1 && <View style={ui.row}>
          <Button title="← Anterior" variant="secondary" onPress={() => setOpen((open - 1 + photos.length) % photos.length)} />
          <Text style={ui.text}>{open + 1} / {photos.length}</Text>
          <Button title="Seguinte →" variant="secondary" onPress={() => setOpen((open + 1) % photos.length)} />
        </View>}
        <Button title="Fechar" onPress={() => setOpen(null)} />
      </ScrollView>}
    </Modal>
  </>;
}
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const today = luandaToday();
  return <View style={{ gap: 6 }}>
    <Field label={label} value={value} onChangeText={onChange} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
    <Chips options={[{ value: today, label: "Hoje" }, { value: addDays(today, 1), label: "Amanhã" }, { value: addDays(today, 2), label: "Depois de amanhã" }]} value={value} onChange={onChange} />
    {DATE_RE.test(value) && <Text style={ui.muted}>📅 {dateText(value)}</Text>}
  </View>;
}
function LinesText({ lines }: { lines: VenueLine[] }) {
  if (!lines.length) return null;
  return <View style={{ gap: 2 }}>{lines.map((l, i) => <Text key={i} style={ui.text}>• {venueLineText(l)}{l.line_total != null ? " — " + formatPrice(l.line_total) : ""}</Text>)}</View>;
}

// --- Lista ------------------------------------------------------------------------------------
export function VenueListScreen({ tipo }: { tipo?: string }) {
  const router = useRouter(); const { municipalities } = useTerritory();
  const [kind, setKind] = useState<VenueKind>(venueKindFromSlug(tipo) ?? "hotel");
  const [q, setQ] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [rows, setRows] = useState<VenueFeedRow[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { const k = venueKindFromSlug(tipo); if (k) setKind(k); }, [tipo]);
  async function load() {
    setRows(null); setError("");
    try { const r = await venueFeed(supabase(), kind, { municipalityId, query: q }); if (r.error) setError(friendlyError(r.error)); setRows(r.data); }
    catch (e) { setError(friendlyError(e)); setRows([]); }
  }
  useEffect(() => { void load(); }, [kind, municipalityId]);
  const K = VENUE_KINDS[kind];
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>🛎️ Reservas</Text>
    <Text style={ui.muted}>Hotéis e hospedagem, restaurantes e armazéns. Veja o que há, reserve e receba um código com QR.</Text>
    <View style={{ gap: 8 }}>
      {VENUE_KIND_LIST.map(k => <Button key={k} title={`${VENUE_KINDS[k].icon} ${VENUE_KINDS[k].label}`} variant={k === kind ? "primary" : "secondary"} onPress={() => setKind(k)} />)}
    </View>
    <View style={ui.row}>
      <Link href={"/reservas/minhas" as any} style={ui.link}>🧾 As minhas reservas</Link>
    </View>
    <Link href={"/reservas/painel" as any} style={ui.link}>🏪 Registar / gerir o meu estabelecimento</Link>
    <TextInput style={ui.input} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} returnKeyType="search" placeholder="Procurar pelo nome…" accessibilityLabel="Procurar" {...ph} />
    <Button title="🔎 Procurar" variant="secondary" onPress={() => void load()} />
    {municipalities.length > 0 && <Chips options={[{ value: "all", label: "Todos os municípios" }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId || "all"} onChange={v => setMunicipalityId(v === "all" ? "" : v)} />}
    <Message error={error} />
    <Text style={ui.h2}>{K.icon} {K.label}</Text>
    {rows === null ? <Text style={ui.text}>A carregar…</Text> : rows.length === 0 ? <Text style={ui.text}>Ainda não há estabelecimentos aqui.</Text> :
      rows.map(r => <Pressable key={r.id} accessibilityRole="link" onPress={() => router.push(("/reservas/" + r.id) as any)} style={[ui.card, { flexDirection: "row", gap: 12 }]}>
        {r.photo || r.logo_url ? <LiteImage placeholder={K.icon} source={{ uri: (r.photo || r.logo_url)! }} style={{ width: 92, height: 92, borderRadius: 12 }} />
          : <View style={{ width: 92, height: 92, borderRadius: 12, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 40 }}>{K.icon}</Text></View>}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ui.label, { fontSize: 18 }]}>{r.name}{r.verified ? " ✔" : ""}</Text>
          <Text style={ui.muted}>{VENUE_SUBTYPE_LABELS[r.subtype]}{r.municipality_name ? " · " + r.municipality_name : ""}</Text>
          <Text style={{ color: r.has_now ? C.green : C.muted, fontWeight: "800", fontSize: 16 }}>{venueFeedBadge(r)}</Text>
          {r.price_from != null && <Text style={ui.label}>Desde {formatPrice(r.price_from)}{kind === "hotel" ? " / noite" : ""}</Text>}
        </View>
      </Pressable>)}
  </ScrollView>;
}

// --- Página do estabelecimento ------------------------------------------------------------------
export function VenueScreen({ id }: { id: string }) {
  const router = useRouter();
  const [d, setD] = useState<VenueDetail | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null);
  const [from, setFrom] = useState(luandaToday()); const [to, setTo] = useState(addDays(luandaToday(), 1));
  const [error, setError] = useState("");
  async function load(f?: string, t?: string) {
    try {
      const r = await venueDetail(supabase(), id, f, t);
      if (r.error) setError(friendlyError(r.error)); else setError("");
      setD(r.data);
      if (r.data?.kind === "hotel" && !f && r.data.from && r.data.to) { setFrom(r.data.from.slice(0, 10)); setTo(r.data.to.slice(0, 10)); }
    } catch (e) { setError(friendlyError(e)); setD(null); }
  }
  useFocusEffect(useCallback(() => { void load(); void currentUserId().then(setUid).catch(() => setUid(null)); }, [id]));
  // Hotel: ao mudar as datas, volta a ver os quartos livres.
  useEffect(() => {
    if (d?.kind !== "hotel" || !DATE_RE.test(from) || !DATE_RE.test(to) || nightsBetween(from, to) < 1) return;
    if (d.from?.slice(0, 10) === from && d.to?.slice(0, 10) === to) return;
    void load(from, to);
  }, [from, to, d?.kind]);
  if (d === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!d) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Estabelecimento não encontrado</Text><Message error={error} /><Link href={"/reservas" as any} style={ui.link}>← Reservas</Link></ScrollView>;
  const K = VENUE_KINDS[d.kind]; const b = d.business; const mine = !!uid && uid === d.owner_id;
  const wa = whatsappLink(b.whatsapp, `Olá, vi o ${b.name} no Huambo Online.`);
  const sections: { name: string; items: VenueItem[] }[] = [];
  for (const it of d.items) { const s = it.section?.trim() || ""; let g = sections.find(x => x.name === s); if (!g) { g = { name: s, items: [] }; sections.push(g); } g.items.push(it); }
  const open = d.status === "approved" && d.accepts_reservations && !mine;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={("/reservas?tipo=" + K.slug) as any} style={ui.link}>← {K.label}</Link>
    {!!b.logo_url && <Image source={{ uri: b.logo_url }} style={{ width: 88, height: 88, borderRadius: 18 }} accessibilityLabel="Logótipo" />}
    <Text style={ui.h1}>{K.icon} {b.name}{b.verified ? " ✔" : ""}</Text>
    <Text style={ui.muted}>{VENUE_SUBTYPE_LABELS[d.subtype]} · {venueRef(d.ref_no)}{b.municipality_name ? " · " + b.municipality_name : ""}</Text>
    {d.status !== "approved" && <Text style={ui.error}>{d.status === "pending" ? "⏳ À espera de aprovação: ainda não aparece ao público." : "⛔ Suspenso: não recebe reservas."}</Text>}
    {mine && <Button title="⚙️ Gerir (é o seu estabelecimento)" onPress={() => router.push(`/reservas/${id}/gerir` as any)} />}
    {!!b.description && <Text style={ui.text}>{b.description}</Text>}
    {!!b.address_text && <Text style={ui.text}>📍 {b.address_text}</Text>}
    {!!d.opening_hours && <Text style={ui.text}>🕒 {d.opening_hours}</Text>}
    {d.kind === "hotel" && (!!d.check_in_time || !!d.check_out_time) && <Text style={ui.text}>🛏️ Entrada a partir das {d.check_in_time ?? "—"} · Saída até às {d.check_out_time ?? "—"}</Text>}
    {!!d.policies && <View style={ui.card}><Text style={ui.label}>📋 Regras da casa</Text><Text style={ui.text}>{d.policies}</Text></View>}
    <View style={ui.row}>
      {!!b.phone && <Button title="📞 Ligar" variant="secondary" onPress={() => void Linking.openURL("tel:" + b.phone!.replace(/\s/g, ""))} />}
      {!!wa && <Button title="WhatsApp" variant="secondary" onPress={() => void Linking.openURL(wa)} />}
      <Button title="📲 Partilhar" variant="secondary" onPress={() => void Share.share({ message: venueShareMessage(siteUrl, { id, name: b.name, kind: d.kind, municipality_name: b.municipality_name }) })} />
    </View>
    <Button title="⭐ Ver portfólio e avaliações" variant="secondary" onPress={() => router.push(("/empresas/" + b.id) as any)} />
    <PlaceView directions={b.directions} lat={b.geo_lat} lng={b.geo_lng} />
    <Message error={error} />
    {d.kind === "hotel" && <View style={ui.card}>
      <Text style={ui.h2}>📅 Quando quer ficar?</Text>
      <DateField label="Entrada (AAAA-MM-DD)" value={from} onChange={v => { setFrom(v); if (DATE_RE.test(v) && !(DATE_RE.test(to) && to > v)) setTo(addDays(v, 1)); }} />
      <Field label="Saída (AAAA-MM-DD)" value={to} onChangeText={setTo} placeholder="AAAA-MM-DD" keyboardType="numbers-and-punctuation" maxLength={10} />
      {DATE_RE.test(from) && <Chips options={[1, 2, 3, 7].map(n => ({ value: addDays(from, n), label: nightsText(n) }))} value={to} onChange={setTo} />}
      {DATE_RE.test(from) && DATE_RE.test(to) && nightsBetween(from, to) >= 1 ? <Text style={ui.label}>{dateText(from)} → {dateText(to)} · {nightsText(nightsBetween(from, to))}</Text>
        : <Text style={ui.error}>Escreva as datas como 2026-10-23. A saída tem de ser depois da entrada.</Text>}
    </View>}
    <ReserveArea d={d} uid={uid} open={open} sections={sections} from={from} to={to} />
  </ScrollView>;
}

function ReserveArea({ d, uid, open, sections, from, to }: { d: VenueDetail; uid: string | null; open: boolean; sections: { name: string; items: VenueItem[] }[]; from: string; to: string }) {
  const router = useRouter(); const K = VENUE_KINDS[d.kind];
  const kinds = venueOrderKinds(d.kind);
  const [orderKind, setOrderKind] = useState<VenueOrderKind>(kinds[0]);
  const [cart, setCart] = useState<Record<string, string>>({}); const [roomId, setRoomId] = useState<string | null>(null); const [rooms, setRooms] = useState("1");
  const [guests, setGuests] = useState("2"); const [day, setDay] = useState(luandaToday()); const [time, setTime] = useState("");
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [method, setMethod] = useState<VenueMethod>(d.accepts_pay_at_place ? "at_place" : "prepaid"); const [agree, setAgree] = useState(false);
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
    if (orderKind !== "stay" && time.trim() && !input.slotAt) { setError("Escreva o dia como 2026-10-23 e a hora como 19:30."); return; }
    const bad = validateVenueReserve(d, input); if (bad) { setError(bad); return; }
    if (!agree) { setError("Confirme que percebeu a taxa de serviço do APP."); return; }
    setBusy(true); setError("");
    try { const r = await reserveVenue(supabase(), d.id, input); if (r.error) throw r.error; router.push("/reservas/minhas" as any); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  const showControls = open && !!uid;
  return <>
    <Text style={ui.h2}>{K.items}</Text>
    {d.items.length === 0 && <Text style={ui.text}>{K.empty}</Text>}
    {sections.map(s => <View key={s.name || "_"} style={{ gap: 10 }}>
      {!!s.name && <Text style={[ui.label, { fontSize: 19 }]}>{s.name}</Text>}
      {s.items.map(it => {
        const inCart = cart[it.id]; const picked = roomId === it.id; const can = it.available && (it.free == null || it.free > 0);
        return <View key={it.id} style={[ui.card, picked ? { borderColor: C.blue, borderWidth: 3 } : null]}>
          <PhotoStrip photos={it.photos} title={it.name} />
          <Text style={[ui.label, { fontSize: 18 }]}>{it.name}</Text>
          {!!it.description && <Text style={ui.text}>{it.description}</Text>}
          <Text style={ui.price}>{venuePriceText(it, d.kind)}</Text>
          <Text style={{ color: can ? C.green : C.red, fontWeight: "800", fontSize: 16 }}>{venueAvailabilityText(it, d.kind)}</Text>
          {d.kind === "hotel" && !!it.capacity && <Text style={ui.muted}>👥 Até {it.capacity} {it.capacity === 1 ? "pessoa" : "pessoas"} por quarto</Text>}
          {d.kind === "warehouse" && it.min_qty > 1 && <Text style={ui.muted}>Mínimo por encomenda: {qtyLabel(it.min_qty)}{it.unit ? " " + it.unit : ""}</Text>}
          {showControls && can && (d.kind === "hotel"
            ? <Button title={picked ? "✅ Escolhido" : "🛏️ Escolher este quarto"} variant={picked ? "primary" : "secondary"} onPress={() => { setRoomId(picked ? null : it.id); setGuests(String(Math.min(Number(guests) || 1, it.capacity ?? 2))); }} />
            : <View style={[ui.row, { alignItems: "center" }]}>
              <Button title="➖" variant="secondary" disabled={!inCart} onPress={() => step(it, -1)} />
              <TextInput style={[ui.input, { minWidth: 80, textAlign: "center" }]} value={inCart ?? ""} placeholder="0" keyboardType="decimal-pad" accessibilityLabel={"Quantidade de " + it.name}
                onChangeText={v => setCart(c => { const n = { ...c }; if (v.trim()) n[it.id] = v; else delete n[it.id]; return n; })} {...ph} />
              <Button title="➕" onPress={() => step(it, 1)} />
              {!!it.unit && <Text style={ui.muted}>{it.unit}</Text>}
            </View>)}
        </View>;
      })}
    </View>)}
    {d.status === "approved" && !d.accepts_reservations &&
      <Text style={ui.text}>Este estabelecimento não está a receber reservas pela APP neste momento. Ligue ou envie WhatsApp.</Text>}
    {open && !uid && <View style={ui.card}><Text style={ui.text}>Para reservar ou encomendar, entre na sua conta.</Text><Button title="Entrar para reservar" onPress={() => router.push("/login")} /></View>}
    {showControls && <View style={[ui.card, { gap: 10 }]}>
      <Text style={ui.h2}>{d.kind === "hotel" ? "🛏️ Reservar quarto" : d.kind === "restaurant" ? "🍽️ Reservar ou encomendar" : "📦 Fazer encomenda"}</Text>
      {kinds.length > 1 && <Chips options={kinds.map(k => ({ value: k, label: VENUE_ORDER_KIND_LABELS[k] }))} value={orderKind} onChange={setOrderKind} />}
      {orderKind === "stay" && <>
        <Text style={ui.text}>{room ? `Quarto: ${room.name}` : "Escolha um quarto na lista acima."}</Text>
        <Field label="Quantos quartos?" value={rooms} onChangeText={setRooms} keyboardType="number-pad" maxLength={3} />
        <Field label="Quantas pessoas?" value={guests} onChangeText={setGuests} keyboardType="number-pad" maxLength={3} />
      </>}
      {orderKind === "table" && <>
        <Field label="Mesa para quantas pessoas?" value={guests} onChangeText={setGuests} keyboardType="number-pad" maxLength={3} />
        <Text style={ui.muted}>Pode também escolher pratos na lista acima (opcional) para estarem prontos quando chegar.</Text>
      </>}
      {orderKind === "order" && <Text style={ui.muted}>{lines.length ? `${lines.length} ${lines.length === 1 ? "produto escolhido" : "produtos escolhidos"}.` : "Escolha os produtos na lista acima com ➕."}</Text>}
      {orderKind !== "stay" && <>
        <DateField label={orderKind === "table" ? "Dia (AAAA-MM-DD)" : "Dia para levantar (AAAA-MM-DD)"} value={day} onChange={setDay} />
        <Field label={orderKind === "table" ? "Hora (HH:MM)" : "Hora para levantar (HH:MM)"} value={time} onChangeText={setTime} placeholder="19:30" keyboardType="numbers-and-punctuation" maxLength={5} />
        <Chips options={["12:00", "13:00", "19:00", "20:00"].map(h => ({ value: h, label: h }))} value={time} onChange={setTime} />
      </>}
      {lines.length > 0 && <View style={{ gap: 2 }}>{lines.map(l => <Text key={l.item.id} style={ui.text}>• {qtyLabel(l.qty || 0)} × {l.item.name}{orderKind === "stay" ? ` × ${nightsText(nights)}` : ""}</Text>)}</View>}
      <Field label="O seu nome" value={name} onChangeText={setName} maxLength={80} autoComplete="name" />
      <Field label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
      <Field label="Nota (opcional)" value={note} onChangeText={setNote} maxLength={300} placeholder={d.kind === "hotel" ? "Ex.: chego de noite" : "Ex.: sem picante"} />
      {d.accepts_pay_at_place && d.accepts_prepay ? <Chips options={(["at_place", "prepaid"] as VenueMethod[]).map(m => ({ value: m, label: VENUE_METHOD_LABELS[m] }))} value={method} onChange={setMethod} />
        : <Text style={ui.label}>💳 {VENUE_METHOD_LABELS[method]}</Text>}
      {lines.length > 0 && <View style={ui.card}>
        <Text style={ui.text}>Preço{orderKind === "stay" ? ` (${nightsText(nights)})` : ""}: {formatPrice(sum.subtotal)}</Text>
        <Text style={ui.text}>Taxa de serviço do APP ({d.client_fee_pct}%): {formatPrice(sum.clientFee)}</Text>
        <Text style={[ui.label, { fontSize: 19 }]}>Total a pagar ao estabelecimento: {formatPrice(sum.total)}</Text>
      </View>}
      <Check on={agree} onPress={() => setAgree(!agree)} label={`${venueFeeNotice(d.client_fee_pct)} Percebi e aceito.`} />
      <Text style={ui.muted}>{method === "at_place" ? `Recebe já um código com QR único. Mostre-o ao chegar e pague lá. Guardamos a reserva até ${Math.round(d.hold_minutes)} minutos depois da hora marcada.`
        : "Depois de reservar, paga para a conta do estabelecimento e envia a fotografia do comprovativo em «As minhas reservas». O estabelecimento confirma o pagamento."}</Text>
      <Message error={error} />
      <Button title={busy ? "A enviar…" : orderKind === "order" ? "✅ Encomendar" : "✅ Reservar"} disabled={busy} onPress={() => void send()} />
    </View>}
  </>;
}

// --- As minhas reservas --------------------------------------------------------------------------
export function MyVenueOrdersScreen() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyVenueOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myVenueOrders(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }).catch(() => setUid(null)); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="🧾 As minhas reservas" />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/reservas" as any} style={ui.link}>← Reservas</Link>
    <Text style={ui.h1}>🧾 As minhas reservas</Text>
    <Text style={ui.muted}>Hotéis, mesas em restaurantes e encomendas em armazéns.</Text>
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não fez reservas nem encomendas.</Text> :
      items.map(o => <MyOrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </ScrollView>;
}
function MyOrderCard({ o, onDone, onError }: { o: MyVenueOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const router = useRouter();
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<Local | null>(null); const [busy, setBusy] = useState(false);
  async function pay() {
    if (!proof) { onError("Junte a fotografia do comprovativo de pagamento."); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError("Escreva a referência ou o número da operação (como está no comprovativo)."); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error("Entre na sua conta.");
      const body = await localBytes(proof); const hash = sha256Hex(body);
      const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo.");
      const r = await submitVenuePayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone("Comprovativo enviado. O estabelecimento vai confirmar o pagamento.");
    } catch (e) { onError(friendlyError(e)); } finally { setBusy(false); }
  }
  async function cancel() { const r = await cancelVenueOrder(supabase(), o.id); if (r.error) onError(friendlyError(r.error)); else onDone("Pedido cancelado."); }
  const needPay = o.method === "prepaid" && (o.status === "awaiting_payment" || o.status === "rejected");
  const ok = o.status === "reserved" || o.status === "paid" || o.status === "completed";
  return <View style={ui.card}>
    <Pressable accessibilityRole="link" onPress={() => router.push(("/reservas/" + o.venue_id) as any)}><Text style={[ui.link, { fontSize: 19 }]}>{VENUE_KINDS[o.venue_kind].icon} {o.venue_name}</Text></Pressable>
    <Text style={ui.muted}>{venueOrderRef(o.ref_no)} · {VENUE_ORDER_KIND_LABELS[o.kind]} · {formatEventDate(o.created_at)}</Text>
    <Text style={ui.text}>{venueOrderSummary(o)}</Text>
    <Text style={[ui.label, { fontSize: 19 }]}>Total: {formatPrice(o.total)}</Text>
    {o.client_fee > 0 && <Text style={ui.muted}>{formatPrice(o.subtotal)} + {formatPrice(o.client_fee)} de taxa do APP ({o.client_fee_pct}%)</Text>}
    <Text style={{ color: ok ? C.green : o.status === "rejected" ? C.red : C.ink, fontWeight: "800", fontSize: 17 }}>{VENUE_ORDER_STATUS_LABELS[o.status]}
      {o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · " + holdText(o.hold_until) : ""}</Text>
    {!!o.note && (o.status === "rejected" || o.status === "cancelled") && <Text style={ui.error}>Motivo: {o.note}</Text>}
    {!!o.code && LIVE.includes(o.status) && <CodeBox code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <Text style={ui.muted}>O estabelecimento está a confirmar o pagamento na conta dele. Pode ir: lá verificam o QR e o comprovativo.</Text>}
    {LIVE.includes(o.status) && <>
      {!!o.address_text && <Text style={ui.text}>📍 {o.address_text}</Text>}
      <PlaceView directions={o.directions} lat={o.geo_lat} lng={o.geo_lng} />
      {!!o.phone && <Button title="📞 Ligar ao estabelecimento" variant="secondary" onPress={() => void Linking.openURL("tel:" + o.phone!.replace(/\s/g, ""))} />}
    </>}
    {needPay && <>
      <Text style={ui.label}>1. Pague {formatPrice(o.total)} ao estabelecimento{o.pay_by ? " " + holdText(o.pay_by) : ""}</Text>
      <View style={ui.card}>
        {!!o.pay_holder && <Text style={ui.text}>Titular: <Text style={ui.label}>{o.pay_holder}</Text></Text>}
        {!!o.pay_iban && <Text selectable style={ui.text}>IBAN: <Text style={ui.label}>{o.pay_iban}</Text></Text>}
        {!!o.pay_express && <Text selectable style={ui.text}>Multicaixa Express: <Text style={ui.label}>{o.pay_express}</Text></Text>}
        {!!o.pay_note && <Text style={ui.muted}>{o.pay_note}</Text>}
      </View>
      <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12, gap: 4 }}>
        <Text style={ui.label}>✍️ {venueTransferNote(o.ref_no)}</Text>
        <Text style={ui.text}>⚠️ Pague só para a conta mostrada aqui. Nunca pague a quem lhe ligar a pedir outra conta.</Text>
      </View>
      <Text style={ui.label}>2. Envie o comprovativo</Text>
      <Chips options={(["multicaixa_express", "bank_transfer"] as const).map(m => ({ value: m, label: PLAN_METHOD_LABELS[m] }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Trocar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pickProof(true, onError).then(p => p && setProof(p))} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pickProof(false, onError).then(p => p && setProof(p))} /></View>}
      <Button title={busy ? "A enviar…" : "✅ Já paguei — enviar comprovativo"} disabled={busy} onPress={() => void pay()} />
    </>}
    {(o.status === "reserved" || o.status === "awaiting_payment" || o.status === "rejected") && <Button title="Cancelar" variant="secondary" onPress={() => Alert.alert("Cancelar este pedido?", "", [{ text: "Não", style: "cancel" }, { text: "Cancelar", onPress: () => void cancel() }])} />}
  </View>;
}

// --- Registar / editar o estabelecimento ---------------------------------------------------------------
type Biz = { id: string; name: string };
function VenueForm({ uid, venue, businesses, onSaved }: { uid: string; venue?: MyVenue; businesses: Biz[]; onSaved: (id: string) => void }) {
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
    const bad = validateVenue(input); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    try { const r = await saveVenue(supabase(), uid, input, venue?.id); if (r.error || !r.data) throw r.error ?? new Error("Não foi possível gravar."); onSaved(r.data.id); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={ui.h2}>{venue ? "✏️ Definições" : "➕ Registar estabelecimento"}</Text>
    {!venue && <>
      <Text style={ui.label}>Qual das suas empresas?</Text>
      {businesses.length === 0 ? <Text style={ui.error}>Primeiro registe a sua empresa em «Empresas» (Conta → Empresas).</Text>
        : <Chips options={businesses.map(b => ({ value: b.id, label: b.name }))} value={businessId} onChange={setBusinessId} />}
      <Text style={ui.label}>O que é?</Text>
      <View style={{ gap: 8 }}>{VENUE_KIND_LIST.map(k => <Button key={k} title={`${VENUE_KINDS[k].icon} ${VENUE_KINDS[k].label}`} variant={k === kind ? "primary" : "secondary"}
        onPress={() => { setKind(k); setSubtype(VENUE_KINDS[k].subtypes[0]); }} />)}</View>
    </>}
    {!!venue && <Text style={ui.text}>{VENUE_KINDS[kind].icon} {VENUE_KINDS[kind].label} · {venue.business_name}</Text>}
    <Text style={ui.label}>Tipo</Text>
    <Chips options={VENUE_KINDS[kind].subtypes.map(s => ({ value: s, label: VENUE_SUBTYPE_LABELS[s] }))} value={subtype} onChange={setSubtype} />
    <Check on={reserv} onPress={() => setReserv(!reserv)} label="Aceito reservas e encomendas pela APP" />
    <Check on={atPlace} onPress={() => setAtPlace(!atPlace)} label="O cliente pode pagar no local" />
    <Check on={prepay} onPress={() => setPrepay(!prepay)} label="O cliente pode pagar adiantado (para a minha conta)" />
    <Field label="Tolerância: quantos minutos guardo a reserva depois da hora? (15 a 1440)" value={hold} onChangeText={setHold} keyboardType="number-pad" maxLength={4} />
    {kind === "hotel" && <View style={ui.row}>
      <View style={{ flex: 1, minWidth: 140 }}><Field label="Entrada a partir das (HH:MM)" value={checkIn} onChangeText={setCheckIn} placeholder="14:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      <View style={{ flex: 1, minWidth: 140 }}><Field label="Saída até às (HH:MM)" value={checkOut} onChangeText={setCheckOut} placeholder="12:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
    </View>}
    <Field label="Horário (opcional)" value={hours} onChangeText={setHours} maxLength={120} placeholder="Ex.: Todos os dias, 7h–23h" />
    <Text style={ui.label}>Regras da casa (opcional)</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={policies} onChangeText={setPolicies} maxLength={600} placeholder="Ex.: Não se aceitam animais. Cancelamento grátis até 24 h antes." accessibilityLabel="Regras da casa" {...ph} />
    {prepay && <View style={ui.card}>
      <Text style={ui.label}>💳 Conta para receber pagamentos adiantados</Text>
      <Text style={ui.muted}>⚠️ Se mudar a conta, o estabelecimento volta a ficar à espera de aprovação da administração (para evitar burlas).</Text>
      <Field label="Titular da conta" value={pay.holder} onChangeText={v => setPay({ ...pay, holder: v })} maxLength={80} />
      <Field label="IBAN" value={pay.iban} onChangeText={v => setPay({ ...pay, iban: v })} maxLength={40} autoCapitalize="characters" placeholder="AO06 …" />
      <Field label="Multicaixa Express" value={pay.express} onChangeText={v => setPay({ ...pay, express: v })} keyboardType="phone-pad" maxLength={20} />
      <Field label="Nota para quem paga (opcional)" value={pay.note} onChangeText={v => setPay({ ...pay, note: v })} maxLength={200} />
    </View>}
    <Message error={error} />
    <Button title={busy ? "A gravar…" : venue ? "💾 Guardar" : "✅ Registar"} disabled={busy} onPress={() => void save()} />
  </View>;
}

export function VenueDashboardScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [venues, setVenues] = useState<MyVenue[] | null>(null); const [biz, setBiz] = useState<Biz[]>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [open, setOpen] = useState(false); const [error, setError] = useState("");
  async function load(u: string) {
    const [a, b, s] = await Promise.all([myVenues(supabase()), listMyBusinesses(supabase(), u), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyError(a.error)); setVenues(a.data); setBiz(((b.data ?? []) as Biz[]).map(x => ({ id: x.id, name: x.name }))); setSettings(s.data as PlatformSettings | null);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }).catch(() => setUid(null)); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="🏪 O meu estabelecimento" />;
  const used = new Set((venues ?? []).map(v => v.business_id)); const free = biz.filter(b => !used.has(b.id));
  const cp = Number(settings?.venue_client_fee_pct ?? 5), bp = Number(settings?.venue_business_fee_pct ?? 5);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/reservas" as any} style={ui.link}>← Reservas</Link>
    <Text style={ui.h1}>🏪 O meu estabelecimento</Text>
    <Text style={ui.text}>Tem um hotel, hospedaria, restaurante ou armazém? Mostre os quartos, o menu ou os produtos e receba reservas e encomendas.</Text>
    <Text style={ui.muted}>1. A sua empresa tem de estar registada em «Empresas» (com portfólio). 2. Registe aqui o estabelecimento. 3. A administração confirma antes de aparecer ao público (para evitar burlas).</Text>
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 14, padding: 12 }}><Text style={ui.text}>{venueOwnerFeeNotice(cp, bp)}</Text></View>
    <Message error={error} />
    {venues === null ? <Text style={ui.text}>A carregar…</Text> : venues.map(v => <Pressable key={v.id} accessibilityRole="link" onPress={() => router.push(`/reservas/${v.id}/gerir` as any)} style={ui.card}>
      <Text style={[ui.label, { fontSize: 18 }]}>{VENUE_KINDS[v.kind].icon} {v.business_name}</Text>
      <Text style={ui.muted}>{venueRef(v.ref_no)} · {VENUE_SUBTYPE_LABELS[v.subtype]}</Text>
      <Text style={{ color: v.status === "approved" ? C.green : v.status === "suspended" ? C.red : C.ink, fontWeight: "800", fontSize: 16 }}>{VENUE_STATUS_LABELS[v.status]}</Text>
      {!!v.admin_note && v.status !== "approved" && <Text style={ui.error}>Nota da administração: {v.admin_note}</Text>}
      <Text style={ui.link}>⚙️ Gerir →</Text>
    </Pressable>)}
    {venues !== null && (open ? <VenueForm uid={uid} businesses={free} onSaved={id => router.replace(`/reservas/${id}/gerir` as any)} />
      : <Button title="➕ Registar estabelecimento" onPress={() => setOpen(true)} />)}
    {venues !== null && free.length === 0 && <Button title="🏢 Registar a minha empresa" variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />}
  </ScrollView>;
}

// --- Gerir --------------------------------------------------------------------------------------
type ItemDraft = { name: string; section: string; description: string; price: string; unit: string; capacity: string; qty: string; minQty: string; available: boolean; photos: string[]; local: Local[] };
const emptyDraft: ItemDraft = { name: "", section: "", description: "", price: "", unit: "", capacity: "2", qty: "", minQty: "1", available: true, photos: [], local: [] };

function ItemForm({ uid, venueId, kind, item, onDone, onClose }: { uid: string; venueId: string; kind: VenueKind; item?: VenueItem; onDone: (m: string) => void; onClose: () => void }) {
  const [f, setF] = useState<ItemDraft>(item ? { name: item.name, section: item.section ?? "", description: item.description ?? "", price: String(item.price), unit: item.unit ?? "",
    capacity: String(item.capacity ?? 2), qty: item.qty_total == null ? "" : String(item.qty_total), minQty: String(item.min_qty || 1), available: item.available, photos: item.photos, local: [] } : emptyDraft);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const total = f.photos.length + f.local.length;
  async function add(camera: boolean) {
    const p = await pickPhotos(VENUE_MAX_PHOTOS - total, camera);
    if (typeof p === "string") { setError(p); return; }
    setF(x => ({ ...x, local: [...x.local, ...p].slice(0, VENUE_MAX_PHOTOS - x.photos.length) }));
  }
  async function save() {
    const base = { name: f.name, section: f.section, description: f.description, price: toNum(f.price), unit: f.unit, available: f.available,
      capacity: kind === "hotel" ? Math.round(toNum(f.capacity)) : null, qtyTotal: f.qty.trim() ? toNum(f.qty) : (kind === "hotel" ? NaN : null), minQty: kind === "warehouse" ? toNum(f.minQty) || 1 : 1 };
    const bad = validateVenueItem(kind, { ...base, photos: [...f.photos, ...f.local.map(l => l.uri)] }); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    try {
      const uploaded = await uploadPhotos(uid, f.local);
      const r = await saveVenueItem(supabase(), venueId, kind, { ...base, photos: [...f.photos, ...uploaded] }, item?.id); if (r.error) throw r.error;
      onDone(item ? "Guardado." : "Juntado à lista.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  const K = VENUE_KINDS[kind];
  return <View style={[ui.card, { gap: 10, borderColor: C.blue, borderWidth: 2 }]}>
    <Text style={ui.h2}>{item ? "✏️ Editar" : "➕ " + K.item}</Text>
    <Field label={kind === "hotel" ? "Tipo de quarto" : "Nome"} value={f.name} onChangeText={v => setF({ ...f, name: v })} maxLength={100} placeholder={kind === "hotel" ? "Ex.: Quarto duplo" : kind === "restaurant" ? "Ex.: Muamba de galinha" : "Ex.: Arroz 25 kg"} />
    <Field label="Secção (opcional)" value={f.section} onChangeText={v => setF({ ...f, section: v })} maxLength={60} placeholder={kind === "hotel" ? "Ex.: Quartos" : kind === "restaurant" ? "Ex.: Pratos do dia, Bebidas" : "Ex.: Cereais"} />
    <Text style={ui.label}>Descrição (opcional)</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={f.description} onChangeText={v => setF({ ...f, description: v })} maxLength={600} accessibilityLabel="Descrição" {...ph} />
    <Field label={`Preço (Kz) por ${f.unit.trim() || (kind === "hotel" ? "noite" : kind === "warehouse" ? "unidade" : "prato")}`} value={f.price} onChangeText={v => setF({ ...f, price: v })} keyboardType="decimal-pad" />
    <Field label="Unidade (opcional)" value={f.unit} onChangeText={v => setF({ ...f, unit: v })} maxLength={30} placeholder={kind === "hotel" ? "noite" : kind === "warehouse" ? "Ex.: saco, caixa, grade" : "Ex.: prato, garrafa"} />
    {kind === "hotel" && <>
      <Field label="Quantos quartos deste tipo tem?" value={f.qty} onChangeText={v => setF({ ...f, qty: v })} keyboardType="number-pad" maxLength={4} />
      <Field label="Quantas pessoas cabem em cada quarto?" value={f.capacity} onChangeText={v => setF({ ...f, capacity: v })} keyboardType="number-pad" maxLength={2} />
    </>}
    {kind !== "hotel" && <Field label="Quantidade disponível (opcional — vazio = não conto)" value={f.qty} onChangeText={v => setF({ ...f, qty: v })} keyboardType="decimal-pad" />}
    {kind === "warehouse" && <Field label="Quantidade mínima por encomenda" value={f.minQty} onChangeText={v => setF({ ...f, minQty: v })} keyboardType="decimal-pad" />}
    <Check on={f.available} onPress={() => setF({ ...f, available: !f.available })} label={kind === "hotel" ? "Disponível para reservar" : "Há (disponível)"} />
    <Text style={ui.label}>Fotografias ({total}/{VENUE_MAX_PHOTOS})</Text>
    <View style={ui.row}>
      {f.photos.map(u => <Pressable key={u} onPress={() => setF({ ...f, photos: f.photos.filter(x => x !== u) })} accessibilityLabel="Tirar fotografia"><Image source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>✖ tirar</Text></Pressable>)}
      {f.local.map((l, i) => <Pressable key={l.uri} onPress={() => setF({ ...f, local: f.local.filter((_, j) => j !== i) })} accessibilityLabel="Tirar fotografia"><Image source={{ uri: l.uri }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>✖ tirar</Text></Pressable>)}
    </View>
    {total < VENUE_MAX_PHOTOS && <View style={ui.row}><Button title="🖼️ Galeria" variant="secondary" onPress={() => void add(false)} /><Button title="📷 Fotografar" variant="secondary" onPress={() => void add(true)} /></View>}
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "💾 Guardar"} disabled={busy} onPress={() => void save()} />
    <Button title="Cancelar" variant="secondary" onPress={onClose} />
  </View>;
}

function ItemRow({ it, kind, onEdit, onDone, onError }: { it: VenueItem; kind: VenueKind; onEdit: () => void; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [qty, setQty] = useState(it.qty_total == null ? "" : String(it.qty_total)); const [busy, setBusy] = useState(false);
  useEffect(() => { setQty(it.qty_total == null ? "" : String(it.qty_total)); }, [it.qty_total]);
  async function set(available: boolean, withQty = false) {
    setBusy(true);
    const q = withQty ? (qty.trim() ? toNum(qty) : null) : undefined;
    if (withQty && q != null && !(q >= 0)) { setBusy(false); onError("Quantidade inválida."); return; }
    const r = await setVenueItemAvailable(supabase(), it.id, available, q); setBusy(false);
    if (r.error) onError(friendlyError(r.error)); else onDone(`${it.name}: ${available ? "🟢 Há" : "🔴 Não há"}`);
  }
  function remove() {
    Alert.alert("Apagar", `Apagar «${it.name}»?`, [{ text: "Não", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: async () => {
      const r = await deleteVenueItem(supabase(), it.id); if (r.error) onError(friendlyError(r.error)); else onDone("Apagado (se já tinha pedidos, fica só como «não há»).");
    } }]);
  }
  return <View style={ui.card}>
    <View style={{ flexDirection: "row", gap: 10 }}>
      {it.photos[0] ? <LiteImage placeholder="🖼️" source={{ uri: it.photos[0] }} style={{ width: 72, height: 72, borderRadius: 10 }} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={ui.label}>{it.name}{it.section ? ` · ${it.section}` : ""}</Text>
        <Text style={ui.text}>{venuePriceText(it, kind)}</Text>
        <Text style={{ color: it.available ? C.green : C.red, fontWeight: "800", fontSize: 16 }}>{it.available ? "🟢 Há" : "🔴 Não há"}{it.qty_total != null ? ` · ${kind === "hotel" ? "quartos" : "quantidade"}: ${qtyLabel(it.qty_total)}` : ""}</Text>
      </View>
    </View>
    <View style={ui.row}>
      <Button title="🟢 Há" variant={it.available ? "primary" : "secondary"} disabled={busy} onPress={() => void set(true)} />
      <Button title="🔴 Não há" variant={it.available ? "secondary" : "danger"} disabled={busy} onPress={() => void set(false)} />
    </View>
    <View style={[ui.row, { alignItems: "center" }]}>
      <TextInput style={[ui.input, { minWidth: 100 }]} value={qty} onChangeText={setQty} keyboardType="decimal-pad" placeholder={kind === "hotel" ? "Quartos" : "Quantidade"} accessibilityLabel={"Quantidade de " + it.name} {...ph} />
      <Button title="💾 Quantidade" variant="secondary" disabled={busy} onPress={() => void set(it.available, true)} />
    </View>
    <View style={ui.row}>
      <Button title="✏️ Editar" variant="secondary" onPress={onEdit} />
      <Button title="Apagar" variant="danger" onPress={remove} />
    </View>
  </View>;
}

function CompleteResult({ r }: { r: VenueCompleteResult }) {
  const ok = r.result === "ok";
  return <View accessibilityLiveRegion="polite" style={{ backgroundColor: ok ? C.green : C.red, borderRadius: 14, padding: 14, gap: 6 }}>
    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>{VENUE_COMPLETE_LABELS[r.result] ?? r.result}</Text>
    {!!r.code && <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>{r.code}{r.kind ? " · " + VENUE_ORDER_KIND_LABELS[r.kind] : ""}</Text>}
    {!!r.buyer && <Text style={{ color: "#fff", fontSize: 18 }}>Cliente: {r.buyer}{r.guests ? ` · ${r.guests} ${r.guests === 1 ? "pessoa" : "pessoas"}` : ""}</Text>}
    {(!!r.check_in || !!r.check_out) && <Text style={{ color: "#fff", fontSize: 17 }}>{dateText(r.check_in)} → {dateText(r.check_out)}</Text>}
    {!!r.slot_at && <Text style={{ color: "#fff", fontSize: 17 }}>🕒 {formatEventDate(r.slot_at)}</Text>}
    {(r.lines ?? []).map((l, i) => <Text key={i} style={{ color: "#fff", fontSize: 17 }}>• {venueLineText(l)}</Text>)}
    {ok && r.total != null && <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{r.method === "prepaid" ? "JÁ PAGO" : "Cobrar " + formatPrice(r.total)}</Text>}
  </View>;
}

type OrderFilter = "submitted" | "active" | "completed" | "all";
export function VenueManageScreen({ id }: { id: string }) {
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
      if (b.error) setError(friendlyError(b.error)); else setPanel(b.data);
    } catch (e) { setError(friendlyError(e)); setVenue(null); }
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }).catch(() => setUid(null)); }, [id]));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <LoginNeeded title="⚙️ Gerir estabelecimento" />;
  if (venue === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!venue) return <ScrollView contentContainerStyle={ui.screen}><Link href={"/reservas/painel" as any} style={ui.link}>← O meu estabelecimento</Link>
    <Text style={ui.h1}>Sem acesso</Text><Message error={error || "Este estabelecimento não é seu."} /></ScrollView>;
  const v = venue; const K = VENUE_KINDS[v.kind];
  const done = (m: string) => { setNotice(m); setError(""); setReject(null); setReason(""); void load(); };
  async function doCheck(text = code) {
    if (!text.trim()) return; setCheck(null); setError("");
    const r = await completeVenueOrder(supabase(), id, text);
    if (r.error) setError(friendlyError(r.error)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: VenueOrder, ok: boolean) {
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideVenuePayment(supabase(), o.id, ok, reason); if (r.error) setError(friendlyError(r.error)); else done(ok ? "Pagamento confirmado." : "Pagamento recusado.");
  }
  async function cancel(o: VenueOrder) {
    if (!reason.trim()) { setError("Escreva porque cancela."); return; }
    const r = await cancelVenueOrder(supabase(), o.id, reason); if (r.error) setError(friendlyError(r.error)); else done("Pedido cancelado. Se o cliente já pagou, devolva o dinheiro.");
  }
  const orders = panel?.orders ?? [];
  const shown = orders.filter(o => filter === "all" ? true : filter === "submitted" ? o.status === "submitted" : filter === "completed" ? o.status === "completed"
    : o.status === "reserved" || o.status === "paid" || o.status === "awaiting_payment");
  const waitingCount = orders.filter(o => o.status === "submitted").length;
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder="Motivo (o cliente vai ler)" accessibilityLabel="Motivo" {...ph} />;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href={"/reservas/painel" as any} style={ui.link}>← O meu estabelecimento</Link>
    <Text style={ui.h1}>⚙️ {K.icon} {v.business_name}</Text>
    <Text style={ui.muted}>{venueRef(v.ref_no)} · {VENUE_SUBTYPE_LABELS[v.subtype]}</Text>
    <View style={{ backgroundColor: v.status === "approved" ? C.green : v.status === "suspended" ? C.red : C.yellowSoft, borderRadius: 14, padding: 12 }}>
      <Text style={{ color: v.status === "pending" ? C.ink : "#fff", fontWeight: "800", fontSize: 18 }}>{VENUE_STATUS_LABELS[v.status]}</Text>
      {v.status === "pending" && <Text style={ui.text}>A administração vai confirmar o estabelecimento. Entretanto, prepare a lista de {K.items.toLowerCase()}.</Text>}
      {!!v.admin_note && v.status !== "approved" && <Text style={{ color: v.status === "pending" ? C.ink : "#fff", fontSize: 16 }}>Nota: {v.admin_note}</Text>}
    </View>
    <View style={ui.row}>
      <Button title="👁️ Ver a página" variant="secondary" onPress={() => router.push(`/reservas/${id}` as any)} />
      <Button title={editing ? "Fechar definições" : "✏️ Definições"} variant="secondary" onPress={() => setEditing(!editing)} />
    </View>
    {editing && <VenueForm uid={uid} venue={v} businesses={[]} onSaved={() => { setEditing(false); done("Definições guardadas."); }} />}
    <Message error={error} ok={notice} />

    <View style={ui.card}>
      <Text style={ui.h2}>🔳 Cliente chegou? Confirmar entrada / entrega</Text>
      <Text style={ui.muted}>Leia o QR do cliente ou escreva o código (RV-XXXXXX). Cada código só se usa uma vez.</Text>
      <QrScanButton onCode={text => { const t = venueTokenFromText(text); if (t) router.push(("/reservas/v/" + t) as any); else void doCheck(text); }} />
      <TextInput style={[ui.input, { fontSize: 22, letterSpacing: 2 }]} value={code} onChangeText={setCode} onSubmitEditing={() => void doCheck()} placeholder="RV-XXXXXX" autoCapitalize="characters" accessibilityLabel="Código da reserva" {...ph} />
      <Button title="✅ Confirmar entrada / entrega" onPress={() => void doCheck()} />
      {!!check && <CompleteResult r={check} />}
    </View>

    <Text style={ui.h2}>{K.icon} {K.items} ({items.length})</Text>
    <Text style={ui.muted}>Carregue em «Há» ou «Não há» sempre que mudar.</Text>
    {itemForm === "new" ? <ItemForm uid={uid} venueId={id} kind={v.kind} onDone={m => { setItemForm(null); done(m); }} onClose={() => setItemForm(null)} />
      : <Button title={"➕ Juntar " + K.item.toLowerCase()} onPress={() => setItemForm("new")} />}
    {items.length === 0 && itemForm !== "new" && <Text style={ui.text}>{K.empty}</Text>}
    {items.map(it => itemForm === it.id
      ? <ItemForm key={it.id} uid={uid} venueId={id} kind={v.kind} item={it} onDone={m => { setItemForm(null); done(m); }} onClose={() => setItemForm(null)} />
      : <ItemRow key={it.id} it={it} kind={v.kind} onEdit={() => setItemForm(it.id)} onDone={done} onError={setError} />)}

    <Text style={ui.h2}>🧾 Pedidos</Text>
    <Chips options={[{ value: "submitted" as const, label: `💳 Pagamentos por confirmar (${waitingCount})` }, { value: "active" as const, label: "Ativos" }, { value: "completed" as const, label: "Concluídos" }, { value: "all" as const, label: "Todos" }]}
      value={filter} onChange={setFilter} />
    {panel === null ? <Text style={ui.text}>A carregar…</Text> : shown.length === 0 ? <Text style={ui.text}>Nenhum pedido nesta lista.</Text> :
      shown.map(o => <View key={o.id} style={ui.card}>
        <Text style={[ui.label, { fontSize: 18 }]}>{o.buyer_name} — {formatPrice(o.total)}</Text>
        <Text style={ui.muted}>{venueOrderRef(o.ref_no)} · {VENUE_ORDER_KIND_LABELS[o.kind]}{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</Text>
        <Text style={ui.text}>{venueOrderSummary(o)}</Text>
        {!!o.buyer_note && <Text style={ui.text}>📝 {o.buyer_note}</Text>}
        <Text style={ui.muted}>Preço {formatPrice(o.subtotal)} + taxa paga pelo cliente {formatPrice(o.client_fee)} · a sua parte da taxa {formatPrice(o.business_fee)}</Text>
        <Text style={ui.label}>{VENUE_ORDER_STATUS_LABELS[o.status]} · {o.method === "prepaid" ? "adiantado" : "paga no local"}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · " + holdText(o.hold_until) : ""}</Text>
        {!!o.reference && <Text style={ui.text}>Ref. do pagamento: <Text style={ui.label}>{o.reference}</Text></Text>}
        {!!o.note && <Text style={ui.muted}>Nota: {o.note}</Text>}
        {!!o.proof_path && <Button title="📄 Ver comprovativo" variant="secondary" onPress={() => void openProof(o.proof_path!, setError)} />}
        {o.status === "submitted" && <>
          <Text style={ui.text}>Veja na sua conta se entrou {formatPrice(o.total)} com o descritivo {venueOrderRef(o.ref_no)}.</Text>
          {reject === o.id ? <>{reasonBox}<Button title="❌ Não recebi" variant="danger" onPress={() => void decide(o, false)} /><Button title="Voltar" variant="secondary" onPress={() => setReject(null)} /></>
            : <><Button title="✅ Recebi o dinheiro" onPress={() => Alert.alert("Confirmar pagamento", `Recebeu ${formatPrice(o.total)} de ${o.buyer_name}?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void decide(o, true) }])} />
              <Button title="❌ Não recebi" variant="secondary" onPress={() => { setReject(o.id); setReason(""); }} /></>}
        </>}
        {VENUE_ACTIVE_ORDER.includes(o.status) && (reject === "c" + o.id ? <>{reasonBox}<Button title="Cancelar o pedido" variant="danger" onPress={() => void cancel(o)} /><Button title="Voltar" variant="secondary" onPress={() => setReject(null)} /></>
          : <Button title="Cancelar pedido" variant="secondary" onPress={() => { setReject("c" + o.id); setReason(""); }} />)}
        <Button title="🔳 Abrir pelo QR" variant="secondary" onPress={() => router.push(("/reservas/v/" + o.qr_token) as any)} />
      </View>)}

    {!!panel && <View style={ui.card}>
      <Text style={ui.h2}>🧾 Taxa do Huambo Online</Text>
      <Text style={ui.text}>{venueOwnerFeeNotice(panel.client_fee_pct, panel.business_fee_pct)}</Text>
      <Text style={ui.text}>Pedidos concluídos: <Text style={ui.label}>{formatPrice(panel.completed_total)}</Text></Text>
      <Text style={ui.text}>Taxa total: {formatPrice(panel.fee_total)} · Por entregar: <Text style={[ui.label, { fontSize: 19 }]}>{formatPrice(panel.fee_due)}</Text></Text>
      {panel.fee_overdue && <Text style={ui.error}>⚠️ Taxa em atraso: as reservas ficam paradas até entregar.</Text>}
      {panel.fee_pending && <Text style={ui.text}>⏳ Pagamento enviado, à espera de confirmação da administração.</Text>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <FeePayBox venueId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <Button title="💳 Entregar a taxa ao Huambo Online" onPress={() => setPayOpen(true)} />)}
      {panel.payments.length > 0 && <>
        <Text style={ui.label}>Pagamentos feitos</Text>
        {panel.payments.map(p => <Text key={p.id} style={ui.text}>{formatEventDate(p.created_at)} · {formatPrice(p.amount)} · {p.status === "confirmed" ? "✅ Confirmado" : p.status === "rejected" ? "❌ Recusado" : "⏳ Por confirmar"}{p.admin_note ? " — " + p.admin_note : ""}</Text>)}
      </>}
    </View>}
  </ScrollView>;
}

function FeePayBox({ venueId, uid, amount, settings, onDone, onClose }: { venueId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState("");
  const [proof, setProof] = useState<Local | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !proof) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const up = await uploadPaymentProof(supabase(), uid, await localBytes(proof), "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data; }
      const r = await submitVenueFee(supabase(), venueId, { method, reference, proofPath: path }); if (r.error) throw r.error;
      onDone("Pagamento da taxa enviado. A administração vai confirmar.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={[ui.card, { gap: 10 }]}>
    <Text style={[ui.label, { fontSize: 19 }]}>Valor a pagar: {formatPrice(amount)}</Text>
    <Text style={ui.label}>1. Pague ao Huambo Online para estes dados</Text>
    <PaymentDetails s={settings} />
    <Text style={ui.label}>2. Diga-nos como pagou</Text>
    <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
    <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
    {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
      : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pickProof(true, setError).then(p => p && setProof(p))} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pickProof(false, setError).then(p => p && setProof(p))} /></View>}
    <Message error={error} />
    <Button title={busy ? "A enviar…" : "Enviar pagamento"} disabled={busy} onPress={() => void send()} />
    <Button title="Cancelar" variant="secondary" onPress={onClose} />
  </View>;
}

// --- Verificar pelo QR ------------------------------------------------------------------------------
export function VenueVerifyScreen({ token }: { token: string }) {
  const router = useRouter();
  const [v, setV] = useState<VenueOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState(""); const [rejecting, setRejecting] = useState(false); const [result, setResult] = useState<VenueCompleteResult | null>(null);
  async function load() {
    try { const r = await venueOrderByToken(supabase(), token); if (r.error) setError(friendlyError(r.error)); setV(r.data ?? { result: "invalid" }); }
    catch (e) { setError(friendlyError(e)); setV({ result: "invalid" }); }
  }
  useFocusEffect(useCallback(() => { void load(); }, [token]));
  if (!v) return <View style={ui.screen}><Text style={ui.text}>A verificar…</Text></View>;
  if (v.result !== "ok") return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>❌ QR não reconhecido</Text>
    <Text style={[ui.error, { fontSize: 19 }]}>Este QR não é de nenhuma reserva do Huambo Online. Não atenda nem entregue.</Text>
    <Message error={error} />
  </ScrollView>;
  const live = !!v.status && LIVE.includes(v.status); const isVenue = v.role === "venue";
  async function complete() {
    if (!v?.code || !v.venue_id) return;
    setBusy(true); const r = await completeVenueOrder(supabase(), v.venue_id, v.code); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setResult(r.data); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    setBusy(true); const r = await decideVenuePayment(supabase(), v.id, ok, reason); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Pagamento confirmado. Já pode atender." : "Pagamento recusado."); setRejecting(false); await load(); }
  }
  const summary = v.kind ? venueOrderSummary({ kind: v.kind, guests: v.guests ?? null, check_in: v.check_in ?? null, check_out: v.check_out ?? null, slot_at: v.slot_at ?? null, lines: v.lines ?? [] }) : "";
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{v.status === "completed" ? "⚠️ QR JÁ USADO" : live ? "✅ QR verdadeiro" : "❌ Pedido sem efeito"}</Text>
    <Text style={[live ? ui.ok : ui.error, { fontSize: 19 }]}>{venueOrderRef(v.ref_no)} · {v.venue_kind ? VENUE_KINDS[v.venue_kind].icon + " " : ""}{v.venue_name}{"\n"}{v.status ? VENUE_ORDER_STATUS_LABELS[v.status] : ""}</Text>
    {!!result && <CompleteResult r={result} />}
    <Message error={error} ok={notice} />
    {v.role === "other" && <View style={ui.card}><Text style={ui.text}>Esta reserva existe no Huambo Online. Só o estabelecimento {v.venue_name}, com a sua conta, vê os dados e pode confirmar a entrada.</Text>
      <Button title="Entrar" onPress={() => router.push("/login")} /></View>}
    {v.role !== "other" && <>
      <View style={ui.card}>
        {!!v.kind && <Text style={ui.label}>{VENUE_ORDER_KIND_LABELS[v.kind]}</Text>}
        <Text style={ui.text}>Cliente: <Text style={ui.label}>{v.buyer_name}</Text>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}</Text>
        {!!summary && <Text style={ui.text}>{summary}</Text>}
        <LinesText lines={v.lines ?? []} />
        {!!v.buyer_note && <Text style={ui.text}>📝 {v.buyer_note}</Text>}
        <Text style={ui.text}>Preço: {formatPrice(v.subtotal ?? 0)}</Text>
        <Text style={ui.text}>Taxa do APP{v.client_fee_pct ? ` (${v.client_fee_pct}%)` : ""}: {formatPrice(v.client_fee ?? 0)}</Text>
        <Text style={[ui.label, { fontSize: 19 }]}>Total: {formatPrice(v.total ?? 0)} · {v.method === "prepaid" ? "pago adiantado" : "paga no local"}</Text>
        {!!v.reference && <Text style={ui.text}>Referência do pagamento: <Text style={ui.label}>{v.reference}</Text></Text>}
        {!!v.code && <Text style={ui.text}>Código: <Text style={ui.label}>{v.code}</Text></Text>}
      </View>
      {!!v.proof_path && v.role !== "buyer" && <Button title="📄 Ver comprovativo" variant="secondary" onPress={() => void openProof(v.proof_path!, setError)} />}
      {isVenue && v.status === "submitted" && <View style={ui.card}>
        <Text style={ui.label}>Veja na sua conta se entrou {formatPrice(v.total ?? 0)} com o descritivo {venueOrderRef(v.ref_no)}.</Text>
        {rejecting ? <><TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder="Motivo (o cliente vai ler)" accessibilityLabel="Motivo" {...ph} />
          <Button title="❌ Não recebi" variant="danger" disabled={busy} onPress={() => void decide(false)} /><Button title="Voltar" variant="secondary" onPress={() => setRejecting(false)} /></>
          : <><Button title="✅ Recebi o dinheiro" disabled={busy} onPress={() => Alert.alert("Confirmar pagamento", `Recebeu ${formatPrice(v.total ?? 0)} na sua conta?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void decide(true) }])} />
            <Button title="❌ Não recebi" variant="secondary" onPress={() => setRejecting(true)} /></>}
      </View>}
      {isVenue && (v.status === "reserved" || v.status === "paid") && <Button title={v.status === "reserved" ? `✅ Confirmar entrada — cobrar ${formatPrice(v.total ?? 0)}` : "✅ Já pago — confirmar entrada / entrega"} disabled={busy}
        onPress={() => Alert.alert("Confirmar", `Confirmar a entrada / entrega de ${v.buyer_name}?`, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void complete() }])} />}
      {v.role === "buyer" && <Button title="🧾 As minhas reservas" variant="secondary" onPress={() => router.push("/reservas/minhas" as any)} />}
    </>}
  </ScrollView>;
}

// --- Administração ------------------------------------------------------------------------------
export function AdminVenues() {
  const router = useRouter();
  const [status, setStatus] = useState<VenueStatus | "all">("pending"); const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [payments, setPayments] = useState<AdminVenuePayment[]>([]); const [orderStatus, setOrderStatus] = useState<VenueOrderStatus | "all">("submitted"); const [orders, setOrders] = useState<AdminVenueOrder[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reason, setReason] = useState(""); const [open, setOpen] = useState<string | null>(null);
  async function load() {
    try {
      const [a, b, c] = await Promise.all([listVenuesForAdmin(supabase(), status === "all" ? "" : status), listVenuePaymentsForAdmin(supabase(), "pending"),
        listVenueOrdersForAdmin(supabase(), orderStatus === "all" ? "" : orderStatus)]);
      setVenues(a.data); setPayments(b.data); setOrders(c.data); if (a.error || b.error || c.error) setError(friendlyError(a.error ?? b.error ?? c.error));
    } catch (e) { setError(friendlyError(e)); }
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: AdminVenue, to: VenueStatus) {
    if (to === "suspended" && !reason.trim()) { setError("Escreva porque suspende."); return; }
    const r = await setVenueStatus(supabase(), x.id, to, reason); if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice(to === "approved" ? "Estabelecimento aprovado." : "Estabelecimento suspenso."); setOpen(null); setReason(""); await load(); }
  }
  async function decide(p: AdminVenuePayment, ok: boolean) {
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideVenueFee(supabase(), p.id, ok, reason); if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Feito."); setOpen(null); setReason(""); await load(); }
  }
  const reasonBox = <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder="Motivo (o dono vai ler)" accessibilityLabel="Motivo" {...ph} />;
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>🏨 Reservas (hotéis, restaurantes, armazéns)</Text>
    <Message error={error} ok={notice} />
    <Text style={ui.muted}>Antes de aprovar, confirme que a empresa existe e que a conta para pagamentos é do dono (nome do titular igual).</Text>
    <Chips options={[{ value: "pending" as const, label: "⏳ Por aprovar" }, { value: "approved" as const, label: "✅ Aprovados" }, { value: "suspended" as const, label: "⛔ Suspensos" }, { value: "all" as const, label: "Todos" }]} value={status} onChange={setStatus} />
    {venues.length === 0 && <Text style={ui.text}>Nenhum estabelecimento nesta lista.</Text>}
    {venues.map(x => <View key={x.id} style={ui.card}>
      <Text style={[ui.label, { fontSize: 18 }]}>{VENUE_KINDS[x.kind].icon} {x.name}{x.verified ? " ✔" : ""}</Text>
      <Text style={ui.muted}>{venueRef(x.ref_no)} · {VENUE_SUBTYPE_LABELS[x.subtype]} · dono: {x.owner_name}{x.phone ? " · 📞 " + x.phone : ""}</Text>
      {!!x.address_text && <Text style={ui.text}>📍 {x.address_text}</Text>}
      <Text style={ui.text}>{VENUE_STATUS_LABELS[x.status]}{x.admin_note ? " — " + x.admin_note : ""}</Text>
      {x.pay ? <View style={ui.card}>
        <Text style={ui.label}>💳 Conta para pagamentos adiantados{x.accepts_prepay ? "" : " (não usa)"}</Text>
        {!!x.pay.holder && <Text selectable style={ui.text}>Titular: {x.pay.holder}</Text>}
        {!!x.pay.iban && <Text selectable style={ui.text}>IBAN: {x.pay.iban}</Text>}
        {!!x.pay.express && <Text selectable style={ui.text}>Multicaixa Express: {x.pay.express}</Text>}
        {!!x.pay.note && <Text style={ui.muted}>{x.pay.note}</Text>}
      </View> : <Text style={ui.muted}>Sem conta para pagamentos adiantados.</Text>}
      <Text style={x.fee_overdue ? ui.error : ui.text}>Taxa por entregar: {formatPrice(x.fee_due)}{x.fee_overdue ? " · EM ATRASO" : ""}</Text>
      <Button title="👁️ Ver a página" variant="secondary" onPress={() => router.push(("/reservas/" + x.id) as any)} />
      <Button title="🏢 Ver a empresa" variant="secondary" onPress={() => router.push(("/empresas/" + x.business_id) as any)} />
      {x.status !== "approved" && <Button title="✅ Aprovar" onPress={() => void setSt(x, "approved")} />}
      {x.status !== "suspended" && (open === x.id ? <>{reasonBox}<Button title="⛔ Suspender" variant="danger" onPress={() => void setSt(x, "suspended")} /></> : <Button title="⛔ Suspender" variant="secondary" onPress={() => { setOpen(x.id); setReason(""); }} />)}
    </View>)}
    <Text style={ui.label}>🧾 Taxas entregues por confirmar ({payments.length})</Text>
    {payments.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(p.amount)} · {p.venue_name}</Text>
      <Text style={ui.muted}>{venueRef(p.venue_ref)} · {p.owner_name} · {PLAN_METHOD_LABELS[p.method as PaymentMethodPlan] ?? p.method}{p.reference ? " · Ref.: " + p.reference : ""} · {formatEventDate(p.created_at)}</Text>
      {!!p.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={() => void openProof(p.proof_path!, setError)} />}
      <Button title="✔ Confirmar" onPress={() => void decide(p, true)} />
      {open === p.id ? <>{reasonBox}<Button title="✖ Recusar" variant="danger" onPress={() => void decide(p, false)} /></> : <Button title="✖ Recusar" variant="secondary" onPress={() => { setOpen(p.id); setReason(""); }} />}
    </View>)}
    <Text style={ui.label}>🔎 Pedidos e pagamentos de clientes</Text>
    <Text style={ui.muted}>Para vigiar burlas: cada comprovativo e cada referência só podem ser usados uma vez.</Text>
    <Chips options={[{ value: "submitted" as const, label: "⏳ Por confirmar" }, { value: "paid" as const, label: "✅ Pagos" }, { value: "rejected" as const, label: "❌ Recusados" }, { value: "completed" as const, label: "✔ Concluídos" }, { value: "all" as const, label: "Todos" }]}
      value={orderStatus} onChange={v => setOrderStatus(v as VenueOrderStatus | "all")} />
    {orders.length === 0 && <Text style={ui.text}>Nenhum pedido nesta lista.</Text>}
    {orders.map(o => <View key={o.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(o.total)} · {o.venue_name} · {o.buyer_name}</Text>
      <Text style={ui.muted}>{venueOrderRef(o.ref_no)} · {VENUE_ORDER_KIND_LABELS[o.kind]} · {o.method === "prepaid" ? "adiantado" : "no local"} · taxas {formatPrice(o.client_fee + o.business_fee)}{o.reference ? " · Ref.: " + o.reference : ""}</Text>
      <Text style={ui.text}>{VENUE_ORDER_STATUS_LABELS[o.status]} · {formatEventDate(o.created_at)}</Text>
      {!!o.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={() => void openProof(o.proof_path!, setError)} />}
      <Button title="🔳 Ver pelo QR" variant="secondary" onPress={() => router.push(("/reservas/v/" + o.qr_token) as any)} />
    </View>)}
  </View>;
}
