import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { listLostFound, getLostFound, myLostFound, createLostFound, resolveLostFound, removeLostFound, lostFoundContact, lostFoundMessage, lostFoundRef,
  uploadClassifiedMedia, base64ToArrayBuffer, whatsappLink, formatPrice, friendlyErrorIn, isModerator, todayIso, isoToDmy, dmyToIso, dayBefore,
  LOST_FOUND_CATEGORIES, LOST_FOUND_ICONS, type LostFoundCategory, type LostFoundKind, type LostFoundPost } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message, SmallButton } from "./Ui";
import { useT, timeAgoIn } from "../lib/i18n";

const ph = { placeholderTextColor: C.muted };
type Pic = { uri: string; base64?: string | null; mimeType: string };

async function pickPhoto(camera: boolean, onError: (m: string) => void, msgs: { camera: string; gallery: string }): Promise<Pic | null> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) { onError(camera ? msgs.camera : msgs.gallery); return null; }
  const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  return !r.canceled && r.assets?.[0] ? await shrinkAsset(r.assets[0]) : null;
}
async function bytes(p: Pic) { return p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer(); }

/** Ecrã «Perdidos e achados»: avisos abertos, filtros, publicar e os meus avisos. */
export function LostFoundScreen() {
  const { t, lang } = useT(); const router = useRouter();
  const params = useLocalSearchParams<{ aviso?: string; tipo?: string }>();
  const startKind: LostFoundKind | "all" = params.tipo === "perdidos" ? "lost" : params.tipo === "achados" ? "found" : "all";
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [staff, setStaff] = useState(false);
  const [kind, setKind] = useState<LostFoundKind | "all">(startKind); const [category, setCategory] = useState<LostFoundCategory | "all">("all");
  const [q, setQ] = useState(""); const [items, setItems] = useState<LostFoundPost[] | null>(null); const [error, setError] = useState("");
  const [focus, setFocus] = useState<LostFoundPost | null>(null);
  const [form, setForm] = useState<LostFoundKind | null>(null);
  const [mine, setMine] = useState<LostFoundPost[]>([]);

  async function load(k = kind, c = category, query = q) {
    setError("");
    const r = await listLostFound(supabase(), { kind: k === "all" ? "" : k, category: c === "all" ? "" : c, query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
  }
  async function loadMine(u: string) { setMine((await myLostFound(supabase(), u)).data); }
  useFocusEffect(useCallback(() => {
    void load();
    if (params.aviso) void getLostFound(supabase(), params.aviso).then(r => setFocus(r.data));
    void currentUserId().then(u => { setUid(u); if (u) { void loadMine(u); void isModerator(supabase()).then(setStaff); } });
  }, [params.aviso]));
  function changed() { void load(); if (uid) void loadMine(uid); }
  function openForm(k: LostFoundKind) {
    if (uid === null) { Alert.alert(t("lf.title"), t("lf.login_post"), [{ text: t("lf.cancel"), style: "cancel" }, { text: t("auth.login"), onPress: () => router.push("/login" as any) }]); return; }
    setForm(k);
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <View style={{ backgroundColor: C.yellowSoft, borderRadius: 20, padding: 18, gap: 8 }}>
      <Text style={ui.h1}>{t("lf.title")}</Text>
      <Text style={ui.text}>{t("lf.intro")}</Text>
      <Button title={"😟 " + t("lf.post_lost")} onPress={() => openForm("lost")} />
      <Button title={"🙌 " + t("lf.post_found")} variant="secondary" onPress={() => openForm("found")} />
    </View>

    {form && uid && <LostFoundForm key={form} uid={uid} kind={form} onCancel={() => setForm(null)} onSent={() => { setForm(null); changed(); }} />}
    {focus && <LostFoundCard p={focus} uid={uid} staff={staff} onChange={changed} highlight />}

    <Chips options={[{ value: "all" as const, label: t("lf.all") }, { value: "lost" as const, label: "😟 " + t("lf.k.lost") }, { value: "found" as const, label: "🙌 " + t("lf.k.found") }]}
      value={kind} onChange={k => { setKind(k); void load(k, category, q); }} />
    <Chips options={[{ value: "all" as const, label: t("lf.all") }, ...LOST_FOUND_CATEGORIES.map(c => ({ value: c, label: LOST_FOUND_ICONS[c] + " " + t("lf.c." + c) }))]}
      value={category} onChange={c => { setCategory(c); void load(kind, c, q); }} />
    <TextInput style={ui.input} value={q} onChangeText={setQ} placeholder={t("lf.search_ph")} returnKeyType="search" onSubmitEditing={() => void load()} accessibilityLabel={t("lf.search")} {...ph} />
    <Message error={error} />
    {items?.length === 0 && <Text style={ui.text}>{t("lf.empty")}</Text>}
    {items?.filter(p => p.id !== focus?.id).map(p => <LostFoundCard key={p.id} p={p} uid={uid} staff={staff} onChange={changed} />)}
    <Text style={ui.muted}>{t("lf.safety")}</Text>

    {!!uid && mine.length > 0 && <View style={{ gap: 10 }}>
      <Text style={ui.h2}>{t("lf.mine")}</Text>
      {mine.map(p => <LostFoundCard key={p.id} p={p} uid={uid} staff={staff} onChange={changed} />)}
    </View>}
  </ScrollView>;
}

function LostFoundCard({ p, uid, staff, onChange, highlight = false }: { p: LostFoundPost; uid: string | null | undefined; staff: boolean; onChange: () => void; highlight?: boolean }) {
  const { t, lang } = useT(); const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const mineToo = uid === p.user_id;
  async function contact() {
    setError("");
    if (!uid) { router.push("/login" as any); return; }
    const r = await lostFoundContact(supabase(), p.id);
    if (r.error || !r.data) setError(friendlyErrorIn(r.error, lang)); else setPhone(r.data);
  }
  async function act(fn: () => PromiseLike<{ error: any }>) {
    setBusy(true); setError("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onChange();
  }
  function remove() {
    Alert.alert(t("lf.title"), t("lf.confirm_remove"), [{ text: t("lf.cancel"), style: "cancel" }, { text: t("lf.remove"), style: "destructive", onPress: () => void act(() => removeLostFound(supabase(), p.id)) }]);
  }
  function share() {
    const text = (p.kind === "lost" ? "😟 " : "🙌 ") + p.title + " · " + p.place + "\n" + siteUrl + "/perdidos-achados?aviso=" + p.id;
    void Share.share({ message: text }).catch(() => undefined);
  }
  const wa = phone ? whatsappLink(phone, lostFoundMessage(p, t)) : null;
  return <View style={[ui.card, { borderLeftWidth: 6, borderLeftColor: p.kind === "lost" ? C.yellow : C.green }, highlight ? { borderWidth: 2, borderColor: C.yellow } : null]}>
    <Text style={ui.muted}>{p.kind === "lost" ? "😟" : "🙌"} {t("lf.k." + p.kind)} · {LOST_FOUND_ICONS[p.category]} {t("lf.c." + p.category)}</Text>
    {p.photos.length > 0 && <ScrollView horizontal contentContainerStyle={{ gap: 6 }}>
      {p.photos.map(src => <Image key={src} source={{ uri: src }} accessibilityLabel={p.title} style={{ width: p.photos.length === 1 ? 260 : 130, height: 130, borderRadius: 10 }} />)}
    </ScrollView>}
    <Text style={ui.h2}>{p.title}</Text>
    <Text style={ui.muted}>{t(p.kind === "lost" ? "lf.lost_on" : "lf.found_on", { date: isoToDmy(p.happened_on), place: p.place })}</Text>
    {!!p.description && <Text style={ui.text}>{p.description}</Text>}
    {p.reward != null && <Text style={[ui.text, { fontWeight: "800" }]}>🎁 {t("lf.reward", { value: formatPrice(p.reward) })}</Text>}
    <Text style={ui.muted}>{lostFoundRef(p.ref_no)} · {timeAgoIn(p.created_at, t, lang)}{p.status !== "open" ? " · " + t("lf.s." + p.status) : ""}</Text>
    {p.status === "open" && !mineToo && (phone
      ? <View style={ui.row}>
        <SmallButton primary title={"📞 " + t("lf.call") + " " + phone} onPress={() => void Linking.openURL("tel:" + phone.replace(/[^\d+]/g, ""))} />
        {!!wa && <SmallButton title={"💬 " + t("lf.whatsapp")} onPress={() => void Linking.openURL(wa)} />}
      </View>
      : <SmallButton primary title={t("lf.contact")} onPress={() => void contact()} />)}
    {!uid && p.status === "open" && <Text style={ui.muted}>{t("lf.login_contact")}</Text>}
    <View style={ui.row}>
      {p.status === "open" && <SmallButton title={"🔗 " + t("lf.share")} onPress={share} />}
      {mineToo && p.status === "open" && <SmallButton disabled={busy} title={"✅ " + t(p.kind === "lost" ? "lf.resolve_lost" : "lf.resolve_found")} onPress={() => void act(() => resolveLostFound(supabase(), p.id))} />}
      {(mineToo || staff) && p.status !== "removed" && <SmallButton disabled={busy} title={t("lf.remove")} onPress={remove} />}
    </View>
    <Message error={error} />
  </View>;
}

function LostFoundForm({ uid, kind, onCancel, onSent }: { uid: string; kind: LostFoundKind; onCancel: () => void; onSent: () => void }) {
  const { t, lang } = useT();
  const today = todayIso();
  const [category, setCategory] = useState<LostFoundCategory>("documentos");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [place, setPlace] = useState("");
  const [date, setDate] = useState(isoToDmy(today));
  const [reward, setReward] = useState(""); const [phone, setPhone] = useState(""); const [photos, setPhotos] = useState<Pic[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const msgs = { camera: t("sv.cam_perm"), gallery: t("sv.gallery_perm") };
  async function add(camera: boolean) { const p = await pickPhoto(camera, setError, msgs); if (p) setPhotos(list => [...list, p].slice(0, 4)); }
  async function send() {
    setError("");
    const happenedOn = dmyToIso(date);
    if (!happenedOn) { setError(t("lf.err_date")); return; }
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const p of photos) {
        const up = await uploadClassifiedMedia(supabase(), await bytes(p), uid, "foto.jpg", p.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("UPLOAD");
        urls.push(up.data);
      }
      const r = await createLostFound(supabase(), { kind, category, title, description, place, municipality: "huambo", happenedOn, photos: urls,
        reward: reward.trim() ? Number(reward.replace(/\D/g, "")) : null, phone });
      if (r.error) throw r.error;
      Alert.alert(t("lf.title"), t("lf.published")); onSent();
    } catch (e: any) { setError(String(e?.message ?? "").startsWith("lf.") ? t(e.message) : friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{kind === "lost" ? "😟 " + t("lf.form_title_lost") : "🙌 " + t("lf.form_title_found")}</Text>
    <Text style={ui.label}>{t("lf.f_category")}</Text>
    <Chips options={LOST_FOUND_CATEGORIES.map(c => ({ value: c, label: LOST_FOUND_ICONS[c] + " " + t("lf.c." + c) }))} value={category} onChange={setCategory} />
    {category === "documentos" && <Text style={ui.muted}>⚠️ {t("lf.doc_tip")}</Text>}
    <Text style={ui.label}>{t("lf.f_title")}</Text>
    <TextInput style={ui.input} value={title} onChangeText={setTitle} maxLength={120} placeholder={t("lf.f_title_ph")} {...ph} />
    <Text style={ui.label}>{t("lf.f_description")}</Text>
    <TextInput style={[ui.input, ui.area]} value={description} onChangeText={setDescription} maxLength={1500} multiline />
    <Text style={ui.label}>{t("lf.f_place")}</Text>
    <TextInput style={ui.input} value={place} onChangeText={setPlace} maxLength={200} placeholder={t("lf.f_place_ph")} {...ph} />
    <Text style={ui.label}>{t("lf.f_date")}</Text>
    <View style={ui.row}>
      <SmallButton title={t("lf.today")} primary={date === isoToDmy(today)} onPress={() => setDate(isoToDmy(today))} />
      <SmallButton title={t("lf.yesterday")} primary={date === isoToDmy(dayBefore(today))} onPress={() => setDate(isoToDmy(dayBefore(today)))} />
    </View>
    <TextInput style={ui.input} value={date} onChangeText={setDate} maxLength={10} placeholder={t("lf.f_date_ph")} keyboardType="numbers-and-punctuation" {...ph} />
    {kind === "lost" && <><Text style={ui.label}>{t("lf.f_reward")}</Text>
      <TextInput style={ui.input} value={reward} onChangeText={setReward} keyboardType="number-pad" /></>}
    <Text style={ui.label}>{t("lf.f_photos")}</Text>
    {photos.length > 0 && <View style={ui.row}>{photos.map((p, i) => <Pressable key={p.uri + i} accessibilityRole="button" accessibilityLabel={t("lf.remove_photo")} onPress={() => setPhotos(list => list.filter((_, j) => j !== i))}>
      <Image source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} /><Text style={ui.muted}>✕ {t("lf.remove_photo")}</Text></Pressable>)}</View>}
    {photos.length < 4 && <View style={ui.row}>
      <SmallButton title={t("lf.camera")} onPress={() => void add(true)} />
      <SmallButton title={t("sv.gallery")} onPress={() => void add(false)} />
    </View>}
    <Text style={ui.label}>{t("lf.f_phone")}</Text>
    <TextInput style={ui.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={30} />
    <Text style={ui.muted}>{t("lf.f_phone_note")}</Text>
    <Message error={error} />
    <Button title={busy ? t("common.loading") : t("lf.publish")} disabled={busy} onPress={() => void send()} />
    <Button title={t("lf.cancel")} variant="secondary" onPress={onCancel} />
  </View>;
}
