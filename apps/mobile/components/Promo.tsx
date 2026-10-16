import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from "react-native";
import { promoFeed, getPromoPost, recordPromoView, savePromoPost, deletePromoPost, myPromoPosts, listMyPromoSubjects, submitPromoBoost, listPromoBoostsForAdmin,
  decidePromoBoost, listPromoPostsForAdmin, setPromoHidden, videoPlatform, embedUrl, embedHint, youtubeThumb, liveStateAt, liveStateText, viewsText, promoShareMessage, promoRef,
  promoSubjectHref, validatePromo, isoToLocalInput, partsToLocalInput, localInputToParts, formatDate, formatPrice, friendlyErrorIn, whatsappShareUrl, LANG_TAGS, uploadClassifiedMedia,
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
import { EmbedPlayer } from "./EmbedPlayer";
import { useDataSaver } from "../lib/dataSaver";
import { useT } from "../lib/i18n";

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
const thumb = (p: Pick<PromoPost, "cover_url" | "external_url">) => p.cover_url || youtubeThumb(p.external_url);

export function PromoCard({ p, width }: { p: PromoPost; width?: number }) {
  const { t, tc } = useT();
  const state = liveStateAt(p); const th = thumb(p);
  return <ItemCard href={"/videos/" + p.id} width={width} media={th ? [th] : null} icon={p.kind === "live" ? "🔴" : "🎬"} title={p.title}
    price={p.kind === "live" ? tc(liveStateText(p)) : t("sv.pr_video")} featured={p.featured} video={p.kind === "video"}
    tag={state === "live" ? t("sv.pr_live_now") : state === "ended" ? t("sv.pr_ended") : undefined} tagRed={state === "live"} meta={`${p.subject_name} · ${tc(viewsText(p.views))}`} />;
}

/** Prateleira «Vídeos e lives» (página inicial e perfis). */
export function PromoShelf({ kind, id, title }: { kind?: PromoSubjectKind; id?: string; title?: string }) {
  const { t } = useT();
  const [items, setItems] = useState<PromoPost[]>([]);
  useEffect(() => { void promoFeed(supabase(), { subjectKind: kind, subjectId: id, limit: 12 }).then(r => setItems(r.data)); }, [kind, id]);
  if (!items.length) return null;
  return <Shelf title={title ?? t("sv.pr_title")} href="/videos">{items.map(p => <PromoCard key={p.id} p={p} />)}</Shelf>;
}

export function PromoListScreen() {
  const router = useRouter(); const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2; const { t, lang } = useT();
  const [kind, setKind] = useState<PromoKind | "">(""); const [items, setItems] = useState<PromoPost[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { setItems(null); void promoFeed(supabase(), { kind, limit: 60 }).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setItems(r.data); } }); }, [kind]);
  const liveNow = items?.filter(p => liveStateAt(p) === "live").length ?? 0;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Text style={ui.h1}>{t("sv.pr_title")}</Text>
    <Text style={ui.muted}>{t("sv.pr_intro")}</Text>
    <Button title={t("sv.pr_publish_btn")} onPress={() => router.push("/videos/meus" as any)} />
    <Chips options={[{ value: "all" as const, label: t("sv.f_all_m") }, { value: "live" as const, label: t("sv.pr_f_lives") }, { value: "video" as const, label: t("sv.pr_f_videos") }]} value={kind || "all"} onChange={v => setKind(v === "all" ? "" : v)} />
    {liveNow > 0 && <View style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, fontWeight: "700" }}>{liveNow === 1 ? t("sv.pr_live_one") : t("sv.pr_live_many", { n: liveNow })}</Text></View>}
    <Message error={error} />
    {items === null ? <Text style={ui.text}>{t("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{t("sv.pr_empty")}</Text> :
      <Grid>{items.map(p => <PromoCard key={p.id} p={p} width={cardW} />)}</Grid>}
  </ScrollView>;
}

export function PromoDetailScreen({ id }: { id: string }) {
  const router = useRouter(); const { width } = useWindowDimensions(); const { t, tc, lang } = useT();
  const [p, setP] = useState<PromoPost | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  const [embed, setEmbed] = useState(false); const { on: lite } = useDataSaver();
  useEffect(() => {
    void getPromoPost(supabase(), id).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); setP(r.data); });
    void currentUserId().then(setUid); void recordPromoView(supabase(), id);
  }, [id]);
  if (p === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!p) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.pr_not_found")}</Text><Message error={error} /><Link href="/videos" style={ui.link}>{t("sv.pr_back")}</Link></ScrollView>;
  const mine = uid === p.owner_id; const state = liveStateAt(p); const platform = videoPlatform(p.external_url); const th = thumb(p); const src = embedUrl(p.external_url);
  const share = tc(promoShareMessage(siteUrl, p));
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/videos" style={ui.link}>{t("sv.pr_back")}</Link>
    {p.status === "hidden" && <Text style={ui.error}>{t("sv.pr_hidden")}{p.hidden_reason ? ": " + p.hidden_reason : ""}.</Text>}
    <Text style={ui.muted}>{tc(PROMO_KIND_LABELS[p.kind])}{p.featured ? t("sv.featured_dot") : ""} · {promoRef(p.ref_no)} · {tc(viewsText(p.views))}</Text>
    <Text style={ui.h1}>{p.title}</Text>
    {p.kind === "live" && <Text style={[ui.h2, state === "live" && { color: C.red }]}>{tc(liveStateText(p))}</Text>}
    {p.video_url ? <VideoPlayer url={p.video_url} /> : embed && src ? <EmbedPlayer src={src} title={p.title} width={width - 32} /> : th ? <LiteImage placeholder={p.kind === "live" ? "🔴" : "🎬"} source={{ uri: th }} style={{ width: width - 32, height: (width - 32) * 0.5625, borderRadius: 12 }} resizeMode="cover" /> : null}
    {!!src && !embed && <Button variant={state === "live" ? "danger" : "primary"} onPress={() => setEmbed(true)}
      title={t(p.kind === "live" ? (state === "live" ? "sv.pr_watch_live" : state === "ended" ? "sv.pr_watch_rec" : "sv.pr_open_live") : "sv.pr_watch_here") + (lite ? t("sv.pr_uses_data") : "")} />}
    {!!p.external_url && <Button variant={src ? "secondary" : state === "live" ? "danger" : "primary"} onPress={() => void Linking.openURL(p.external_url!)}
      title={src ? t("sv.pr_open_in", { p: platform ?? "" }) : t(p.kind === "live" ? (state === "live" ? "sv.pr_join_live" : state === "ended" ? "sv.pr_see_rec" : "sv.pr_live_page") : "sv.pr_see_on", { p: platform ?? t("sv.site") })} />}
    <Pressable accessibilityRole="link" onPress={() => router.push(promoSubjectHref(p.subject_kind, p.subject_id) as any)} style={[ui.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
      {p.subject_picture ? <LiteImage placeholder="👤" source={{ uri: p.subject_picture }} style={{ width: 52, height: 52, borderRadius: 26 }} /> : <Text style={{ fontSize: 34 }}>👤</Text>}
      <View style={{ flex: 1 }}><Text style={ui.label}>{p.subject_name}</Text><Text style={ui.muted}>{tc(PROMO_SUBJECT_LABELS[p.subject_kind])}{t("sv.pr_profile")}</Text></View>
    </Pressable>
    {!!p.description && <Text style={ui.text}>{p.description}</Text>}
    <Button title={t("sv.share_wa")} variant="secondary" onPress={() => void Linking.openURL(whatsappShareUrl(share))} />
    <Button title={t("sv.share")} variant="secondary" onPress={() => void Share.share({ message: share })} />
    {mine && <Button title={t("sv.edit_pen")} variant="secondary" onPress={() => router.push(("/videos/publicar?editar=" + p.id) as any)} />}
    {mine && <Button title={t("sv.pr_feature_mine")} variant="secondary" onPress={() => router.push("/videos/meus" as any)} />}
    {!mine && <ReportButton type="promo_post" id={p.id} label={t("sv.pr_report")} />}
  </ScrollView>;
}

function EmbedHintText({ url }: { url: string }) {
  const { tc } = useT();
  const h = embedHint(url);
  return h ? <Text accessibilityLiveRegion="polite" style={h.ok ? ui.ok : ui.muted}>{tc(h.text)}</Text> : null;
}

export function PromoFormScreen() {
  const router = useRouter(); const params = useLocalSearchParams<{ editar?: string; tipo?: string }>(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [subjects, setSubjects] = useState<PromoSubject[] | null>(null); const [editId, setEditId] = useState<string | null>(null);
  const [subject, setSubject] = useState(""); const [kind, setKind] = useState<PromoKind>(params.tipo === "live" ? "live" : "video"); const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState(""); const [externalUrl, setExternalUrl] = useState(""); const [cover, setCover] = useState<string | null>(null); const [photo, setPhoto] = useState<Picked | null>(null);
  const [date, setDate] = useState(""); const [time, setTime] = useState(""); const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    const u = await currentUserId(); setUid(u); if (!u) return;
    const s = await listMyPromoSubjects(supabase()); setSubjects(s.data); if (s.data.length === 1) setSubject(s.data[0].kind + ":" + s.data[0].id);
    if (params.editar) {
      const r = await getPromoPost(supabase(), params.editar); const p = r.data; if (!p) { setError(t("sv.pr_not_found_dot")); return; }
      const d = localInputToParts(isoToLocalInput(p.live_starts_at));
      setEditId(p.id); setSubject(p.subject_kind + ":" + p.subject_id); setKind(p.kind); setTitle(p.title); setDescription(p.description ?? ""); setVideoUrl(p.video_url ?? "");
      setExternalUrl(p.external_url ?? ""); setCover(p.cover_url); setDate(d.date); setTime(d.time);
      if (p.live_starts_at && p.live_ends_at) setMinutes(Math.round((Date.parse(p.live_ends_at) - Date.parse(p.live_starts_at)) / 60000));
    }
  })(); }, [params.editar]);
  if (uid === undefined || (uid && subjects === null)) return <View style={ui.screen}><Text style={ui.text}>{error || t("common.loading")}</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.pr_form_title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  if (!subjects!.length) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.pr_form_title")}</Text>
    <Text style={ui.text}>{t("sv.pr_need_profile")}</Text>
    <Button title={t("sv.pr_pro")} onPress={() => router.push("/conta/profissional" as any)} />
    <Button title={t("sv.pr_biz")} variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />
    <Button title={t("sv.pr_shop")} variant="secondary" onPress={() => router.push("/conta/produtos" as any)} /></ScrollView>;
  const [subjectKind, subjectId] = subject.split(":") as [PromoSubjectKind | "", string];
  const startsAt = partsToLocalInput(date, time);
  const input = { subjectKind: subjectKind ?? "", subjectId: subjectId ?? "", kind, title, description, videoUrl: videoUrl || null, externalUrl, coverUrl: cover, liveStartsAt: startsAt, liveMinutes: minutes };
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(t(r)); else if (r) setPhoto(r); }
  async function save() {
    const bad = kind === "live" && (date || time) && !startsAt ? t("sv.pr_bad_date") : validatePromo(input, editId ? 0 : Date.now());
    if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (photo) { const up = await uploadClassifiedMedia(supabase(), await toBody(photo), uid!, "capa." + (photo.mimeType.split("/")[1] ?? "jpg"), photo.mimeType); if (up.error || !up.data) throw up.error ?? new Error(t("sv.pr_cover_fail")); coverUrl = up.data; }
      const r = await savePromoPost(supabase(), { ...input, coverUrl }, editId ?? undefined);
      if (r.error || !r.data) throw r.error ?? new Error(t("sv.pr_publish_fail"));
      router.replace(("/videos/" + r.data.id) as any);
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{editId ? t("sv.edit_pen_title") : t("sv.pr_form_title")}</Text>
    <Text style={ui.label}>{t("sv.pr_on_behalf")}</Text>
    {editId ? <Text style={ui.text}>{subjects!.find(s => s.kind + ":" + s.id === subject)?.name ?? ""}</Text>
      : <Chips options={subjects!.map(s => ({ value: s.kind + ":" + s.id, label: `${tc(PROMO_SUBJECT_LABELS[s.kind])}: ${s.name}` }))} value={subject} onChange={setSubject} />}
    {!editId && <><Text style={ui.label}>{t("sv.pr_what")}</Text>
      <Chips options={[{ value: "video" as const, label: t("sv.pr_kind_video") }, { value: "live" as const, label: t("sv.pr_kind_live") }]} value={kind} onChange={setKind} /></>}
    <Field label={t("sv.title")} value={title} onChangeText={setTitle} maxLength={120} placeholder={kind === "live" ? t("sv.pr_title_live_ph") : t("sv.pr_title_video_ph")} />
    <Text style={ui.label}>{t("sv.description_opt")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} maxLength={1000} accessibilityLabel={t("sv.description")} {...ph} />
    {kind === "video" ? <>
      <VideoField value={videoUrl} onChange={setVideoUrl} />
      <Field label={t("sv.pr_or_link")} value={externalUrl} onChangeText={setExternalUrl} keyboardType="url" autoCapitalize="none" placeholder="https://youtu.be/…" />
      <EmbedHintText url={externalUrl} />
    </> : <>
      <View style={ui.card}><Text style={ui.text}>{t("sv.pr_live_info")}</Text></View>
      <Field label={t("sv.pr_live_link")} value={externalUrl} onChangeText={setExternalUrl} keyboardType="url" autoCapitalize="none" placeholder="https://www.youtube.com/live/…" />
      <EmbedHintText url={externalUrl} />
      <View style={ui.row}>
        <View style={{ flex: 1, minWidth: 150 }}><Field label={t("sv.day")} value={date} onChangeText={setDate} placeholder="18/10/2026" keyboardType="numbers-and-punctuation" maxLength={10} /></View>
        <View style={{ flex: 1, minWidth: 110 }}><Field label={t("sv.hour")} value={time} onChangeText={setTime} placeholder="20:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View>
      </View>
      <Text style={ui.label}>{t("sv.pr_lasts")}</Text>
      <Chips options={LIVE_DURATIONS.map(d => ({ value: String(d.minutes), label: tc(d.label) }))} value={String(minutes)} onChange={v => setMinutes(Number(v))} />
    </>}
    <View style={ui.card}>
      <Text style={ui.label}>{t("sv.pr_cover")}</Text>
      {(photo || cover) && <Image source={{ uri: photo?.uri ?? cover! }} style={{ width: 140, height: 140, borderRadius: 10 }} accessibilityLabel={t("sv.cover")} />}
      {(photo || cover) ? <Button title={t("sv.pr_cover_remove")} variant="secondary" onPress={() => { setPhoto(null); setCover(null); }} />
        : <View style={ui.row}><Button title={t("sv.id_shoot")} variant="secondary" onPress={() => void choose(true)} /><Button title={t("sv.gallery")} variant="secondary" onPress={() => void choose(false)} /></View>}
    </View>
    <Text style={ui.muted}>{t("sv.pr_rules")}</Text>
    <Message error={error} />
    <Button title={busy ? t("sv.publishing") : editId ? t("sv.save_changes") : t("sv.publish_ok")} disabled={busy} onPress={() => void save()} />
  </ScrollView>;
}

function PromoBoostBox({ post, uid, settings, onDone }: { post: MyPromoPost; uid: string; settings: PlatformSettings | null; onDone: (m: string) => void }) {
  const { t, tc, lang } = useT();
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<Picked | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const featured = !!post.featured_until && Date.parse(post.featured_until) > Date.now();
  const ended = post.kind === "live" && !!post.live_ends_at && Date.parse(post.live_ends_at) < Date.now();
  async function choose(camera: boolean) { const r = await pickImage(camera); if (typeof r === "string") setError(t(r)); else if (r) setProof(r); }
  async function send() {
    if (!reference.trim() && !proof) { setError(t("sv.pay_need_ref")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) { const up = await uploadPaymentProof(supabase(), uid, await toBody(proof), "comprovativo.jpg", proof.mimeType || "image/jpeg"); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail")); path = up.data; }
      const r = await submitPromoBoost(supabase(), post.id, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      setOpen(false); onDone(t("sv.pr_boost_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  const price = Number(settings?.promo_boost_price_kz ?? 1000); const days = Number(settings?.promo_boost_days ?? 7);
  return <View style={{ gap: 8 }}>
    {featured && <Text style={ui.ok}>{t("sv.pr_featured_until", { date: new Date(post.featured_until!).toLocaleDateString(LANG_TAGS[lang]) })}</Text>}
    {post.boost_status === "pending" && <Text style={ui.text}>{t("sv.pr_boost_pending")}</Text>}
    {post.boost_status === "rejected" && !featured && <Text style={ui.error}>{t("sv.pr_boost_rejected")}{post.boost_note ? ": " + post.boost_note : ""}</Text>}
    {post.status === "published" && !ended && post.boost_status !== "pending" && (open ? <View style={[ui.card, { gap: 10 }]}>
      <Text style={ui.label}>{t("sv.pr_boost_price", { price: formatPrice(price), days })}</Text>
      <Text style={ui.text}>{t("sv.pr_boost_info")}</Text>
      <Text style={ui.label}>{t("sv.pay_step1_plain")}</Text>
      <PaymentDetails s={settings} />
      <Text style={ui.label}>{t("sv.pay_step2")}</Text>
      <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("sv.pay_ref_ph")} accessibilityLabel={t("sv.pay_ref_a11y")} {...ph} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={t("sv.proof")} /><Button title={t("sv.proof_remove")} variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title={t("sv.proof_photo")} variant="secondary" onPress={() => void choose(true)} /><Button title={t("sv.gallery")} variant="secondary" onPress={() => void choose(false)} /></View>}
      <Message error={error} />
      <Button title={busy ? t("sv.sending") : t("sv.send_payment")} disabled={busy} onPress={() => void send()} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} />
    </View> : <Button title={featured ? t("sv.pr_more_days") : t("sv.pr_boost_btn", { price: formatPrice(price), days })} variant="secondary" onPress={() => setOpen(true)} />)}
  </View>;
}

export function MyPromosScreen() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyPromoPost[] | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const [a, s] = await Promise.all([myPromoPosts(supabase()), getPlatformSettings(supabase())]); if (a.error) setError(friendlyErrorIn(a.error, lang)); setItems(a.data); setSettings(s.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.pr_mine")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  async function remove(p: MyPromoPost) {
    const r = await deletePromoPost(supabase(), p.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.deleted")); await load(); }
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/videos" style={ui.link}>{t("sv.pr_back")}</Link>
    <Text style={ui.h1}>{t("sv.pr_mine")}</Text>
    <Button title={t("sv.pr_post_video")} onPress={() => router.push("/videos/publicar" as any)} />
    <Button title={t("sv.pr_announce_live")} variant="secondary" onPress={() => router.push("/videos/publicar?tipo=live" as any)} />
    <Message error={error} ok={notice} />
    {items === null ? <Text style={ui.text}>{t("common.loading")}</Text> : items.length === 0 ? <Text style={ui.text}>{t("sv.pr_mine_empty")}</Text> :
      items.map(p => <View key={p.id} style={ui.card}>
        <Pressable accessibilityRole="link" onPress={() => router.push(("/videos/" + p.id) as any)}><Text style={[ui.link, { fontSize: 18 }]}>{p.title}</Text></Pressable>
        <Text style={ui.muted}>{promoRef(p.ref_no)} · {tc(PROMO_KIND_LABELS[p.kind])} · {p.subject_name} · {tc(viewsText(p.views))}{p.kind === "live" ? " · " + tc(liveStateText(p)) : ""}</Text>
        {p.status === "hidden" && <Text style={ui.error}>{t("sv.pr_hidden")}{p.hidden_reason ? ": " + p.hidden_reason : ""}</Text>}
        <PromoBoostBox post={p} uid={uid} settings={settings} onDone={m => { setNotice(m); void load(); }} />
        <Button title={t("sv.edit_pen")} variant="secondary" onPress={() => router.push(("/videos/publicar?editar=" + p.id) as any)} />
        <Button title={t("sv.delete_bin")} variant="secondary" onPress={() => Alert.alert(t("sv.delete_q"), t("sv.pr_delete_text", { title: p.title }), [{ text: t("sv.no"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: () => void remove(p) }])} />
      </View>)}
  </ScrollView>;
}

export function AdminPromos() {
  const { t, tc, lang } = useT();
  const [s, setS] = useState<PlatformSettings | null>(null); const [boosts, setBoosts] = useState<AdminPromoBoost[]>([]); const [posts, setPosts] = useState<AdminPromoPost[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reason, setReason] = useState(""); const [open, setOpen] = useState<string | null>(null);
  async function load() {
    const [a, b, c] = await Promise.all([getPlatformSettings(supabase()), listPromoBoostsForAdmin(supabase(), "pending"), listPromoPostsForAdmin(supabase())]);
    setS(a.data); if (b.error || c.error) setError(friendlyErrorIn(b.error ?? c.error, lang)); setBoosts(b.data); setPosts(c.data);
  }
  useEffect(() => { void load(); }, []);
  async function decide(b: AdminPromoBoost, ok: boolean) {
    if (!ok && !reason.trim()) { setError(t("sv.pra_why_not")); return; }
    const r = await decidePromoBoost(supabase(), b.id, ok, reason);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("sv.pra_confirmed") : t("sv.pra_rejected")); setOpen(null); setReason(""); await load(); }
  }
  async function hide(p: AdminPromoPost, hidden: boolean) {
    if (hidden && !reason.trim()) { setError(t("sv.pra_why_hide")); return; }
    const r = await setPromoHidden(supabase(), p.id, hidden, reason);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(hidden ? t("sv.hidden") : t("sv.shown_again")); setOpen(null); setReason(""); await load(); }
  }
  async function save() {
    if (!s) return;
    const price = Number(s.promo_boost_price_kz), days = Number(s.promo_boost_days);
    if (!(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60) { setError(t("sv.pra_bad")); return; }
    const r = await updatePlatformSettings(supabase(), { promo_boost_price_kz: price, promo_boost_days: days });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(t("sv.pra_saved")); }
  }
  const reasonBox = (label: string) => <TextInput style={[ui.input, ui.area]} multiline value={reason} onChangeText={setReason} placeholder={label} accessibilityLabel={t("sv.reason_plain")} {...ph} />;
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("sv.pr_title")}</Text>
    <Message error={error} ok={notice} />
    {!!s && <View style={ui.card}>
      <Field label={t("sv.pra_price")} value={String(s.promo_boost_price_kz ?? "")} onChangeText={v => setS({ ...s, promo_boost_price_kz: v })} keyboardType="numeric" />
      <Field label={t("sv.pra_days")} value={String(s.promo_boost_days ?? "")} onChangeText={v => setS({ ...s, promo_boost_days: Number(v) || 0 })} keyboardType="numeric" />
      <Button title={t("common.save")} onPress={() => void save()} />
    </View>}
    <Text style={ui.label}>{t("sv.pra_pending", { n: boosts.length })}</Text>
    {boosts.map(b => <View key={b.id} style={ui.card}>
      <Text style={ui.label}>{t("sv.pra_line", { price: formatPrice(b.amount), days: b.days, owner: b.owner_name })}</Text>
      <Text style={ui.muted}>{promoRef(b.post_ref)} {b.post_title} · {tc(PLAN_METHOD_LABELS[b.method])}{b.reference ? t("sv.ina_ref", { ref: b.reference }) : ""}</Text>
      {!!b.proof_path && <Button title={t("sv.proof_doc")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), b.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyErrorIn(r.error, lang)); }} />}
      {open === b.id ? <>{reasonBox(t("sv.pra_why_not_ph"))}<Button title={t("sv.not_received")} variant="danger" onPress={() => void decide(b, false)} /><Button title={t("common.back")} variant="secondary" onPress={() => setOpen(null)} /></>
        : <><Button title={t("sv.confirm_ok")} onPress={() => Alert.alert(t("sv.pra_confirm_q"), t("sv.pra_confirm_text", { price: formatPrice(b.amount), owner: b.owner_name }), [{ text: t("sv.no"), style: "cancel" }, { text: t("common.confirm"), onPress: () => void decide(b, true) }])} />
          <Button title={t("sv.not_received")} variant="secondary" onPress={() => { setOpen(b.id); setReason(""); }} /></>}
    </View>)}
    <Text style={ui.label}>{t("sv.pra_posts")}</Text>
    {posts.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.label}>{tc(PROMO_KIND_LABELS[p.kind])} · {p.title}</Text>
      <Text style={ui.muted}>{promoRef(p.ref_no)} · {tc(PROMO_SUBJECT_LABELS[p.subject_kind])}: {p.subject_name} · {tc(viewsText(p.views))}{p.reports > 0 ? t("sv.pra_reports", { n: p.reports }) : ""}{p.status === "hidden" ? t("sv.hidden_dot") : ""}</Text>
      {p.status === "published" ? (open === p.id ? <>{reasonBox(t("sv.pra_why_hide_ph"))}<Button title={t("sv.hide")} variant="danger" onPress={() => void hide(p, true)} /><Button title={t("common.back")} variant="secondary" onPress={() => setOpen(null)} /></>
        : <Button title={t("sv.hide")} variant="secondary" onPress={() => { setOpen(p.id); setReason(""); }} />)
        : <Button title={t("sv.show_again")} variant="secondary" onPress={() => void hide(p, false)} />}
    </View>)}
  </View>;
}
