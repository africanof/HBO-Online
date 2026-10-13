import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";
import { promoFeed, getPromoPost, recordPromoView, savePromoPost, deletePromoPost, myPromoPosts, listMyPromoSubjects, submitPromoBoost, listPromoBoostsForAdmin,
  decidePromoBoost, listPromoPostsForAdmin, setPromoHidden, videoPlatform, youtubeThumb, liveStateAt, liveStateText, viewsText, promoShareMessage, promoRef,
  promoSubjectHref, validatePromo, isoToLocalInput, partsToLocalInput, localInputToParts, formatDate, formatPrice, friendlyError, whatsappShareUrl, uploadClassifiedMedia,
  uploadPaymentProof, base64ToArrayBuffer, paymentProofUrl, getPlatformSettings, updatePlatformSettings, PROMO_KIND_LABELS, PROMO_SUBJECT_LABELS, LIVE_DURATIONS, PLAN_METHOD_LABELS,
  type PromoPost, type PromoKind, type PromoSubject, type PromoSubjectKind, type MyPromoPost, type AdminPromoBoost, type AdminPromoPost, type PaymentMethodPlan,
  type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { ItemCard, Grid, Shelf } from "./ItemCard";
import { LiteImage } from "./LiteImage";
import { VideoField, VideoPlayer } from "./Video";
import { PaymentDetails } from "./Plans";
import { ReportButton } from "./Trust";

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
const thumb = (p: Pick<PromoPost, "cover_url" | "external_url">) => p.cover_url || youtubeThumb(p.external_url);

export function PromoCard({ p, width }: { p: PromoPost; width?: number }) {
  const state = liveStateAt(p); const t = thumb(p);
  return <ItemCard href={"/videos/" + p.id} width={width} media={t ? [t] : null} icon={p.kind === "live" ? "🔴" : "🎬"} title={p.title}
    price={p.kind === "live" ? liveStateText(p) : "🎬 Vídeo"} featured={p.featured} video={p.kind === "video"}
    tag={state === "live" ? "🔴 EM DIRETO" : state === "ended" ? "Terminada" : undefined} tagRed={state === "live"} meta={`${p.subject_name} · ${viewsText(p.views)}`} />;
}

/** Prateleira «Vídeos e lives» (página inicial e perfis). */
export function PromoShelf({ kind, id, title = "🎬 Vídeos e lives" }: { kind?: PromoSubjectKind; id?: string; title?: string }) {
  const [items, setItems] = useState<PromoPost[]>([]);
  useEffect(() => { void promoFeed(supabase(), { subjectKind: kind, subjectId: id, limit: 12 }).then(r => setItems(r.data)); }, [kind, id]);
  if (!items.length) return null;
  return <Shelf title={title} href="/videos">{items.map(p => <PromoCard key={p.id} p={p} />)}</Shelf>;
}

export function PromoListScreen() {
  const router = useRouter(); const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [kind, setKind] = useState<PromoKind | "">(""); const [items, setItems] = useState<PromoPost[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { setItems(null); void promoFeed(supabase(), { kind, limit: 60 }).then(r => { if (r.error) setError(friendlyError(r.error)); else { setError(""); setItems(r.data); } }); }, [kind]);
  const liveNow = items?.filter(p => liveStateAt(p) === "live").length ?? 0;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>🎬 Vídeos e lives</Text>
    <Text style={ui.muted}>Publicidade em vídeo e transmissões em direto de profissionais, lojas e empresas do Huambo.</Text>
    <Button title="➕ Publicar vídeo ou live" onPress={() => router.push("/videos/meus" as any)} />
    <Chips options={[{ value: "all" as const, label: "Todos" }, { value: "live" as const, label: "🔴 Lives" }, { value: "video" as const, label: "🎬 Vídeos" }]} value={kind || "all"} onChange={v => setKind(v === "all" ? "" : v)} />
    {liveNow > 0 && <View style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, fontWeight: "700" }}>🔴 {liveNow === 1 ? "Há 1 live em direto agora" : `Há ${liveNow} lives em direto agora`}.</Text></View>}
    <Message error={error} />
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não há vídeos nem lives.</Text> :
      <Grid>{items.map(p => <PromoCard key={p.id} p={p} width={cardW} />)}</Grid>}
  </ScrollView>;
}

export function PromoDetailScreen({ id }: { id: string }) {
  const router = useRouter(); const { width } = useWindowDimensions();
  const [p, setP] = useState<PromoPost | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    void getPromoPost(supabase(), id).then(r => { if (r.error) setError(friendlyError(r.error)); setP(r.data); });
    void currentUserId().then(setUid); void recordPromoView(supabase(), id);
  }, [id]);
  if (p === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!p) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Vídeo não encontrado</Text><Message error={error} /><Link href="/videos" style={ui.link}>← Vídeos e lives</Link></ScrollView>;
  const mine = uid === p.owner_id; const state = liveStateAt(p); const platform = videoPlatform(p.external_url); const t = thumb(p);
  const share = promoShareMessage(siteUrl, p);
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/videos" style={ui.link}>← Vídeos e lives</Link>
    {p.status === "hidden" && <Text style={ui.error}>Escondido pela administração{p.hidden_reason ? ": " + p.hidden_reason : ""}.</Text>}
    <Text style={ui.muted}>{PROMO_KIND_LABELS[p.kind]}{p.featured ? " · ⭐ Destaque" : ""} · {promoRef(p.ref_no)} · {viewsText(p.views)}</Text>
    <Text style={ui.h1}>{p.title}</Text>
    {p.kind === "live" && <Text style={[ui.h2, state === "live" && { color: C.red }]}>{liveStateText(p)}</Text>}
    {p.video_url ? <VideoPlayer url={p.video_url} /> : t ? <LiteImage placeholder={p.kind === "live" ? "🔴" : "🎬"} source={{ uri: t }} style={{ width: width - 32, height: (width - 32) * 0.5625, borderRadius: 12 }} resizeMode="cover" /> : null}
    {!!p.external_url && <Button variant={state === "live" ? "danger" : "primary"} onPress={() => void Linking.openURL(p.external_url!)}
      title={`${p.kind === "live" ? (state === "live" ? "🔴 Entrar na live" : state === "ended" ? "▶ Ver a gravação" : "📅 Abrir a página da live") : "▶ Ver"} no ${platform ?? "site"}`} />}
    <Pressable accessibilityRole="link" onPress={() => router.push(promoSubjectHref(p.subject_kind, p.subject_id) as any)} style={[ui.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
      {p.subject_picture ? <LiteImage placeholder="👤" source={{ uri: p.subject_picture }} style={{ width: 52, height: 52, borderRadius: 26 }} /> : <Text style={{ fontSize: 34 }}>👤</Text>}
      <View style={{ flex: 1 }}><Text style={ui.label}>{p.subject_name}</Text><Text style={ui.muted}>{PROMO_SUBJECT_LABELS[p.subject_kind]} · Ver perfil e contactos →</Text></View>
    </Pressable>
    {!!p.description && <Text style={ui.text}>{p.description}</Text>}
    <Button title="📲 Partilhar no WhatsApp" variant="secondary" onPress={() => void Linking.openURL(whatsappShareUrl(share))} />
    <Button title="🔗 Partilhar" variant="secondary" onPress={() => void Share.share({ message: share })} />
    {mine && <Button title="✏️ Editar" variant="secondary" onPress={() => router.push(("/videos/publicar?editar=" + p.id) as any)} />}
    {mine && <Button title="⭐ Destacar / os meus vídeos" variant="secondary" onPress={() => router.push("/videos/meus" as any)} />}
    {!mine && <ReportButton type="promo_post" id={p.id} label="Denunciar este vídeo" />}
  </ScrollView>;
}

export function PromoFormScreen() {
  const router = useRouter(); const params = useLocalSearchParams<{ editar?: string; tipo?: string }>();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [subjects, setSubjects] = useState<PromoSubject[] | null>(null); const [editId, setEditId] = useState<string | null>(null);
  const [subject, setSubject] = useState(""); const [kind, setKind] = useState<PromoKind>(params.tipo === "live" ? "live" : "video"); const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState(""); const [externalUrl, setExternalUrl] = useState(""); const [cover, setCover] = useState<string | null>(null); const [photo, setPhoto] = useState<Picked | null>(null);
  const [date, setDate] = useState(""); const [time, setTime] = useState(""); const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    const u = await currentUserId(); setUid(u); if (!u) return;
    const s = await listMyPromoSubjects(supabase()); setSubjects(s.data); if (s.data.length === 1) setSubject(s.data[0].kind + ":" + s.data[0].id);
    if (params.editar) {
      const r = await getPromoPost(supabase(), params.editar); const p = r.data; if (!p) { setError("Vídeo não encontrado."); return; }
      const d = localInputToParts(isoToLocalInput(p.live_starts_at));
      setEditId(p.id); setSubject(p.subject_kind + ":" + p.subject_id); setKind(p.kind); setTitle(p.title); setDescription(p.description ?? ""); setVideoUrl(p.video_url ?? "");
      setExternalUrl(p.external_url ?? ""); setCover(p.cover_url); setDate(d.date); setTime(d.time);
      if (p.live_starts_at && p.live_ends_at) setMinutes(Math.round((Date.parse(p.live_ends_at) - Date.parse(p.live_starts_at)) / 60000));
    }
  })(); }, [params.editar]);
  if (uid === undefined || (uid && subjects === null)) return <View style={ui.screen}><Text style={ui.text}>{error || "A carregar…"}</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>🎬 Publicar vídeo ou live</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  if (!subjects!.length) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>🎬 Publicar vídeo ou live</Text>
    <Text style={ui.text}>Os vídeos e as lives são para profissionais, lojas e empresas. Primeiro crie o seu perfil:</Text>
    <Button title="🧰 Perfil profissional" onPress={() => router.push("/conta/profissional" as any)} />
    <Button title="🏪 Registar empresa" variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />
    <Button title="🛍️ Abrir a loja" variant="secondary" onPress={() => router.push("/conta/produtos" as any)} /></ScrollView>;
  const [subjectKind, subjectId] = subject.split(":") as [PromoSubjectKind | "", string];
  const startsAt = partsToLocalInput(date, time);
  const input = { subjectKind: subjectKind ?? "", subjectId: subjectId ?? "", kind, title, description, videoUrl: videoUrl || null, externalUrl, coverUrl: cover, liveStartsAt: startsAt, liveMinutes: minutes };
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(r); else if (r) setPhoto(r); }
  async function save() {
    const bad = kind === "live" && (date || time) && !startsAt ? "Escreva o dia como 18/10/2026 e a hora como 20:00." : validatePromo(input, editId ? 0 : Date.now());
    if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (photo) { const up = await uploadClassifiedMedia(supabase(), await toBody(photo), uid!, "capa." + (photo.mimeType.split("/")[1] ?? "jpg"), photo.mimeType); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar a capa."); coverUrl = up.data; }
      const r = await savePromoPost(supabase(), { ...input, coverUrl }, editId ?? undefined);
      if (r.error || !r.data) throw r.error ?? new Error("Não foi possível publicar.");
      router.replace(("/videos/" + r.data.id) as any);
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{editId ? "✏️ Editar" : "🎬 Publicar vídeo ou live"}</Text>
    <Text style={ui.label}>Em nome de</Text>
    {editId ? <Text style={ui.text}>{subjects!.find(s => s.kind + ":" + s.id === subject)?.name ?? ""}</Text>
      : <Chips options={subjects!.map(s => ({ value: s.kind + ":" + s.id, label: `${PROMO_SUBJECT_LABELS[s.kind]}: ${s.name}` }))} value={subject} onChange={setSubject} />}
    {!editId && <><Text style={ui.label}>O que quer publicar?</Text>
      <Chips options={[{ value: "video" as const, label: "🎬 Vídeo de publicidade" }, { value: "live" as const, label: "🔴 Anunciar uma live" }]} value={kind} onChange={setKind} /></>}
    <Field label="Título" value={title} onChangeText={setTitle} maxLength={120} placeholder={kind === "live" ? "Ex.: Tiramos dúvidas sobre painéis solares" : "Ex.: Promoção de pneus esta semana"} />
    <Text style={ui.label}>Descrição (opcional)</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} maxLength={1000} accessibilityLabel="Descrição" {...ph} />
    {kind === "video" ? <>
      <VideoField value={videoUrl} onChange={setVideoUrl} />
      <Field label="…ou cole a ligação (YouTube, Facebook, TikTok ou Instagram)" value={externalUrl} onChangeText={setExternalUrl} keyboardType="url" autoCapitalize="none" placeholder="https://youtu.be/…" />
    </> : <>
      <View style={ui.card}><Text style={ui.text}>A live faz-se no YouTube, Facebook, TikTok ou Instagram. Aqui anuncia a hora: os seus seguidores recebem um aviso quando publicar e quando a live começar.</Text></View>
      <Field label="Ligação da live" value={externalUrl} onChangeText={setExternalUrl} keyboardType="url" autoCapitalize="none" placeholder="https://www.facebook.com/…/live" />
      <View style={ui.row}>
        <View style={{ flex: 1, minWidth: 150 }}><Field label="Dia" value={date} onChangeText={setDate} placeholder="18/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        <View style={{ flex: 1, minWidth: 110 }}><Field label="Hora" value={time} onChangeText={setTime} placeholder="20:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      </View>
      <Text style={ui.label}>Dura</Text>
      <Chips options={LIVE_DURATIONS.map(d => ({ value: String(d.minutes), label: d.label }))} value={String(minutes)} onChange={v => setMinutes(Number(v))} />
    </>}
    <View style={ui.card}>
      <Text style={ui.label}>🖼️ Capa (opcional)</Text>
      {(photo || cover) && <Image source={{ uri: photo?.uri ?? cover! }} style={{ width: 140, height: 140, borderRadius: 10 }} accessibilityLabel="Capa" />}
      {(photo || cover) ? <Button title="Tirar a capa" variant="secondary" onPress={() => { setPhoto(null); setCover(null); }} />
        : <View style={ui.row}><Button title="📷 Fotografar" variant="secondary" onPress={() => void choose(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void choose(false)} /></View>}
    </View>
    <Text style={ui.muted}>Só publicidade verdadeira e legal. Vídeos enganosos ou ofensivos são escondidos pela administração.</Text>
    <Message error={error} />
    <Button title={busy ? "A publicar…" : editId ? "Guardar alterações" : "✅ Publicar"} disabled={busy} onPress={() => void save()} />
  </ScrollView>;
}

function PromoBoostBox({ post, uid, settings, onDone }: { post: MyPromoPost; uid: string; settings: PlatformSettings | null; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<Picked | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const featured = !!post.featured_until && Date.parse(post.featured_until) > Date.now();
  const ended = post.kind === "live" && !!post.live_ends_at && Date.parse(post.live_ends_at) < Date.now();
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(r); else if (r) setProof(r); }
  async function send() {
    if (!reference.trim() && !proof) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const up = await uploadPaymentProof(supabase(), uid, await toBody(proof), "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data; }
      const r = await submitPromoBoost(supabase(), post.id, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      setOpen(false); onDone("Pedido de destaque enviado. Fica ativo quando a administração confirmar o pagamento.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  const price = Number(settings?.promo_boost_price_kz ?? 1000); const days = Number(settings?.promo_boost_days ?? 7);
  return <View style={{ gap: 8 }}>
    {featured && <Text style={ui.ok}>⭐ Em destaque até {formatDate(post.featured_until!)}</Text>}
    {post.boost_status === "pending" && <Text style={ui.text}>⏳ Destaque: pagamento à espera de confirmação.</Text>}
    {post.boost_status === "rejected" && !featured && <Text style={ui.error}>Destaque não confirmado{post.boost_note ? ": " + post.boost_note : ""}</Text>}
    {post.status === "published" && !ended && post.boost_status !== "pending" && (open ? <View style={[ui.card, { gap: 10 }]}>
      <Text style={ui.label}>⭐ Destaque: {formatPrice(price)} por {days} dias</Text>
      <Text style={ui.text}>Aparece primeiro em «Vídeos e lives» e na página inicial, com o selo «⭐ Destaque».</Text>
      <Text style={ui.label}>1. Pague ao Huambo Online para estes dados</Text>
      <PaymentDetails s={settings} />
      <Text style={ui.label}>2. Diga-nos como pagou</Text>
      <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" accessibilityLabel="Referência do pagamento" {...ph} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void choose(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void choose(false)} /></View>}
      <Message error={error} />
      <Button title={busy ? "A enviar…" : "Enviar pagamento"} disabled={busy} onPress={() => void send()} />
      <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
    </View> : <Button title={featured ? "⭐ Juntar mais dias de destaque" : `⭐ Destacar (${formatPrice(price)} / ${days} dias)`} variant="secondary" onPress={() => setOpen(true)} />)}
  </View>;
}

export function MyPromosScreen() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyPromoPost[] | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const [a, s] = await Promise.all([myPromoPosts(supabase()), getPlatformSettings(supabase())]); if (a.error) setError(friendlyError(a.error)); setItems(a.data); setSettings(s.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>🎬 Os meus vídeos e lives</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  async function remove(p: MyPromoPost) {
    const r = await deletePromoPost(supabase(), p.id);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Apagado."); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/videos" style={ui.link}>← Vídeos e lives</Link>
    <Text style={ui.h1}>🎬 Os meus vídeos e lives</Text>
    <Button title="🎬 Publicar vídeo" onPress={() => router.push("/videos/publicar" as any)} />
    <Button title="🔴 Anunciar live" variant="secondary" onPress={() => router.push("/videos/publicar?tipo=live" as any)} />
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>A carregar…</Text> : items.length === 0 ? <Text style={ui.text}>Ainda não publicou vídeos nem lives. Mostre o seu trabalho, os seus produtos e as suas promoções!</Text> :
      items.map(p => <View key={p.id} style={ui.card}>
        <Pressable accessibilityRole="link" onPress={() => router.push(("/videos/" + p.id) as any)}><Text style={[ui.link, { fontSize: 18 }]}>{p.title}</Text></Pressable>
        <Text style={ui.muted}>{promoRef(p.ref_no)} · {PROMO_KIND_LABELS[p.kind]} · {p.subject_name} · {viewsText(p.views)}{p.kind === "live" ? " · " + liveStateText(p) : ""}</Text>
        {p.status === "hidden" && <Text style={ui.error}>Escondido pela administração{p.hidden_reason ? ": " + p.hidden_reason : ""}</Text>}
        <PromoBoostBox post={p} uid={uid} settings={settings} onDone={m => { setNotice(m); void load(); }} />
        <Button title="✏️ Editar" variant="secondary" onPress={() => router.push(("/videos/publicar?editar=" + p.id) as any)} />
        <Button title="🗑️ Apagar" variant="secondary" onPress={() => Alert.alert("Apagar?", `«${p.title}» — não dá para voltar atrás.`, [{ text: "Não", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: () => void remove(p) }])} />
      </View>)}
  </ScrollView>;
}

export function AdminPromos() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [boosts, setBoosts] = useState<AdminPromoBoost[]>([]); const [posts, setPosts] = useState<AdminPromoPost[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reason, setReason] = useState(""); const [open, setOpen] = useState<string | null>(null);
  async function load() {
    const [a, b, c] = await Promise.all([getPlatformSettings(supabase()), listPromoBoostsForAdmin(supabase(), "pending"), listPromoPostsForAdmin(supabase())]);
    setS(a.data); if (b.error || c.error) setError(friendlyError(b.error ?? c.error)); setBoosts(b.data); setPosts(c.data);
  }
  useEffect(() => { void load(); }, []);
  async function decide(b: AdminPromoBoost, ok: boolean) {
    if (!ok && !reason.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decidePromoBoost(supabase(), b.id, ok, reason);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Confirmado: fica em destaque." : "Destaque recusado."); setOpen(null); setReason(""); await load(); }
  }
  async function hide(p: AdminPromoPost, hidden: boolean) {
    if (hidden && !reason.trim()) { setError("Escreva porque esconde (o dono vai ler)."); return; }
    const r = await setPromoHidden(supabase(), p.id, hidden, reason);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(hidden ? "Escondido." : "Voltou a aparecer."); setOpen(null); setReason(""); await load(); }
  }
  async function save() {
    if (!s) return;
    const price = Number(s.promo_boost_price_kz), days = Number(s.promo_boost_days);
    if (!(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60) { setError("Verifique o preço e os dias."); return; }
    const r = await updatePlatformSettings(supabase(), { promo_boost_price_kz: price, promo_boost_days: days });
    if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Preço do destaque guardado."); }
  }
  const reasonBox = (label: string) => <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={label} accessibilityLabel="Motivo" {...ph} />;
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>🎬 Vídeos e lives</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label="Preço do destaque (Kz)" value={String(s.promo_boost_price_kz ?? "")} onChangeText={v => setS({ ...s, promo_boost_price_kz: v })} keyboardType="numeric" />
      <Field label="Dias de destaque" value={String(s.promo_boost_days ?? "")} onChangeText={v => setS({ ...s, promo_boost_days: Number(v) || 0 })} keyboardType="numeric" />
      <Button title="Guardar" onPress={() => void save()} />
    </View>}
    <Text style={ui.label}>⭐ Destaques por confirmar ({boosts.length})</Text>
    {boosts.map(b => <View key={b.id} style={ui.card}>
      <Text style={ui.label}>{formatPrice(b.amount)} · {b.days} dias · {b.owner_name}</Text>
      <Text style={ui.muted}>{promoRef(b.post_ref)} {b.post_title} · {PLAN_METHOD_LABELS[b.method]}{b.reference ? " · Ref.: " + b.reference : ""}</Text>
      {!!b.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), b.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyError(r.error)); }} />}
      {open === b.id ? <>{reasonBox("Porque não confirma? (o dono vai ler)")}<Button title="✖ Não recebido" variant="danger" onPress={() => void decide(b, false)} /><Button title="Voltar" variant="secondary" onPress={() => setOpen(null)} /></>
        : <><Button title="✔ Confirmar" onPress={() => Alert.alert("Confirmar destaque", `${formatPrice(b.amount)} de ${b.owner_name}?`, [{ text: "Não", style: "cancel" }, { text: "Confirmar", onPress: () => void decide(b, true) }])} />
          <Button title="✖ Não recebido" variant="secondary" onPress={() => { setOpen(b.id); setReason(""); }} /></>}
    </View>)}
    <Text style={ui.label}>Publicações (as mais denunciadas primeiro)</Text>
    {posts.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{PROMO_KIND_LABELS[p.kind]} · {p.title}</Text>
      <Text style={ui.muted}>{promoRef(p.ref_no)} · {PROMO_SUBJECT_LABELS[p.subject_kind]}: {p.subject_name} · {viewsText(p.views)}{p.reports > 0 ? ` · 🚩 ${p.reports} denúncia(s)` : ""}{p.status === "hidden" ? " · Escondido" : ""}</Text>
      {p.status === "published" ? (open === p.id ? <>{reasonBox("Porque esconde? (o dono vai ler)")}<Button title="🙈 Esconder" variant="danger" onPress={() => void hide(p, true)} /><Button title="Voltar" variant="secondary" onPress={() => setOpen(null)} /></>
        : <Button title="🙈 Esconder" variant="secondary" onPress={() => { setOpen(p.id); setReason(""); }} />)
        : <Button title="👁️ Voltar a mostrar" variant="secondary" onPress={() => void hide(p, false)} />}
    </View>)}
  </View>;
}
