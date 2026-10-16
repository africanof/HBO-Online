import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { listPortfolio, savePortfolioItem, deletePortfolioItem, reorderPortfolio, movePortfolio, validatePortfolioItem, portfolioDateLabel, uploadClassifiedMedia,
  removeClassifiedMedia, base64ToArrayBuffer, toIsoMonth, friendlyErrorIn, formatPrice, listBusinessProducts, PORTFOLIO_MAX_ITEMS, PORTFOLIO_MAX_PHOTOS,
  type PortfolioItem, type PortfolioTarget } from "@huambo-online/core";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { LiteImage } from "./LiteImage";
import { useT } from "../lib/i18n";

type Local = { uri: string; base64?: string | null; mimeType: string };
/** Devolve as fotografias escolhidas, ou a chave do texto do erro (sv.…). */
async function pickPhotos(max: number, camera = false): Promise<Local[] | string> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return camera ? "sv.cam_perm_photo" : "sv.gallery_perm";
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: !camera && max > 1, selectionLimit: max };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.length) return [];
  return Promise.all(r.assets.slice(0, max).map(a => shrinkAsset(a)));
}
async function uploadAll(uid: string, items: Local[], failMsg: string): Promise<string[]> {
  const urls: string[] = [];
  for (const p of items) {
    const body = p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
    const r = await uploadClassifiedMedia(supabase(), body, uid, "foto.jpg", p.mimeType || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error(failMsg);
    urls.push(r.data);
  }
  return urls;
}

/** Fotografia do perfil ou logótipo. */
export function PhotoPicker({ uid, current, label, onSave }: { uid: string; current: string | null; label: string; onSave: (url: string | null) => PromiseLike<{ error: any }> }) {
  const { t, lang } = useT();
  const [url, setUrl] = useState(current); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => setUrl(current), [current]);
  async function choose(camera: boolean) {
    const picked = await pickPhotos(1, camera);
    if (typeof picked === "string") { setError(t(picked)); return; }
    if (!picked.length) return;
    setBusy(true); setError("");
    try { const [u] = await uploadAll(uid, picked, t("sv.photo_upload_fail")); const r = await onSave(u); if (r.error) throw r.error; setUrl(u); }
    catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {url ? <Image source={{ uri: url }} style={{ width: 96, height: 96, borderRadius: 18 }} accessibilityLabel={label} /> : <Text style={{ fontSize: 44 }}>📷</Text>}
    <View style={ui.row}>
      <Button title={busy ? t("sv.sending") : t("sv.gallery")} variant="secondary" disabled={busy} onPress={() => void choose(false)} />
      <Button title={t("sv.id_shoot")} variant="secondary" disabled={busy} onPress={() => void choose(true)} />
      {!!url && <Button title={t("sv.remove")} variant="secondary" disabled={busy} onPress={async () => { const r = await onSave(null); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setUrl(null); }} />}
    </View>
    <Message error={error} />
  </View>;
}

const empty = { title: "", description: "", doneOn: "", photos: [] as string[], local: [] as Local[] };

export function PortfolioManager({ uid, target }: { uid: string; target: PortfolioTarget }) {
  const { t, tc, lang } = useT();
  const [items, setItems] = useState<PortfolioItem[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const key = "providerId" in target ? target.providerId : target.businessId;
  async function load() { const r = await listPortfolio(supabase(), target); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [key]);
  const total = form.photos.length + form.local.length;
  async function add(camera: boolean) {
    const picked = await pickPhotos(PORTFOLIO_MAX_PHOTOS - total, camera);
    if (typeof picked === "string") { setError(t(picked)); return; }
    setForm(f => ({ ...f, local: [...f.local, ...picked].slice(0, PORTFOLIO_MAX_PHOTOS - f.photos.length) }));
  }
  async function save() {
    const doneOn = form.doneOn.trim() ? toIsoMonth(form.doneOn) : null;
    if (form.doneOn.trim() && !doneOn) { setError(t("sv.pf_bad_date")); return; }
    const invalid = validatePortfolioItem({ title: form.title, description: form.description, photos: [...form.photos, ...form.local.map(l => l.uri)], doneOn }); if (invalid) { setError(tc(invalid)); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const uploaded = await uploadAll(uid, form.local, t("sv.photo_upload_fail"));
      const r = await savePortfolioItem(supabase(), uid, target, { title: form.title, description: form.description, photos: [...form.photos, ...uploaded], doneOn }, editing ?? undefined);
      if (r.error) throw r.error;
      setNotice(editing ? t("sv.pf_updated") : t("sv.pf_added")); setForm(empty); setEditing(null); setOpen(false); await load();
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  function remove(it: PortfolioItem) {
    Alert.alert(t("sv.pf_delete"), t("sv.pf_delete_q", { title: it.title }), [{ text: t("sv.no"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: async () => {
      const r = await deletePortfolioItem(supabase(), it.id);
      if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
      void removeClassifiedMedia(supabase(), it.photos); setNotice(t("sv.pf_deleted")); await load();
    } }]);
  }
  async function move(id: string, dir: -1 | 1) {
    const next = movePortfolio(items, id, dir); if (next === items) return;
    setItems(next); const r = await reorderPortfolio(supabase(), next.map(x => x.id)); if (r.error) setError(friendlyErrorIn(r.error, lang));
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>{t("sv.pf_title", { n: items.length, max: PORTFOLIO_MAX_ITEMS })}</Text>
    <Text style={ui.text}>{t("sv.pf_intro")}</Text>
    <Message error={error} ok={notice} />
    {!open && items.length < PORTFOLIO_MAX_ITEMS && <Button title={t("sv.pf_add")} onPress={() => { setOpen(true); setEditing(null); setForm(empty); }} />}
    {open && <View style={ui.card}>
      <Text style={ui.label}>{t("sv.title")}</Text>
      <TextInput style={ui.input} value={form.title} onChangeText={v => setForm({ ...form, title: v })} maxLength={120} placeholder={t("sv.pf_title_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sv.title")} />
      <Text style={ui.label}>{t("sv.description_opt")}</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={v => setForm({ ...form, description: v })} placeholder={t("sv.pf_desc_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("sv.description")} />
      <Text style={ui.label}>{t("sv.pf_when")}</Text>
      <TextInput style={ui.input} value={form.doneOn} onChangeText={v => setForm({ ...form, doneOn: v })} keyboardType="numbers-and-punctuation" placeholder="09/2026" placeholderTextColor={C.muted} accessibilityLabel={t("sv.month_year")} />
      <Text style={ui.label}>{t("sv.photos_count", { n: total, max: PORTFOLIO_MAX_PHOTOS })}</Text>
      <View style={ui.row}>
        {form.photos.map(u => <Pressable key={u} onPress={() => setForm({ ...form, photos: form.photos.filter(x => x !== u) })} accessibilityLabel={t("sv.remove_photo")}><Image source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>{t("sv.remove_x")}</Text></Pressable>)}
        {form.local.map((l, i) => <Pressable key={l.uri} onPress={() => setForm({ ...form, local: form.local.filter((_, j) => j !== i) })} accessibilityLabel={t("sv.remove_photo")}><Image source={{ uri: l.uri }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>{t("sv.remove_x")}</Text></Pressable>)}
      </View>
      {total < PORTFOLIO_MAX_PHOTOS && <View style={ui.row}><Button title={t("sv.gallery")} variant="secondary" onPress={() => void add(false)} /><Button title={t("sv.id_shoot")} variant="secondary" onPress={() => void add(true)} /></View>}
      <Button title={busy ? t("sv.sending") : editing ? t("common.save") : t("sv.pf_join")} disabled={busy} onPress={() => void save()} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => { setOpen(false); setEditing(null); }} />
    </View>}
    {items.length === 0 && !open && <Text style={ui.muted}>{t("sv.pf_empty")}</Text>}
    {items.map((it, i) => <View key={it.id} style={[ui.card, { flexDirection: "row", gap: 10 }]}>
      <Image source={{ uri: it.photos[0] }} style={{ width: 72, height: 72, borderRadius: 10 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={ui.label}>{it.title}</Text>
        <Text style={ui.muted}>{t("sv.n_photos", { n: it.photos.length })}{it.done_on ? " · " + tc(portfolioDateLabel(it.done_on)) : ""}</Text>
        <View style={ui.row}>
          <Button title="↑" variant="secondary" disabled={i === 0} onPress={() => void move(it.id, -1)} />
          <Button title="↓" variant="secondary" disabled={i === items.length - 1} onPress={() => void move(it.id, 1)} />
          <Button title={t("common.edit")} variant="secondary" onPress={() => { setEditing(it.id); setOpen(true); setForm({ title: it.title, description: it.description ?? "", doneOn: it.done_on ? it.done_on.slice(5, 7) + "/" + it.done_on.slice(0, 4) : "", photos: it.photos, local: [] }); }} />
          <Button title={t("common.delete")} variant="danger" onPress={() => remove(it)} />
        </View>
      </View>
    </View>)}
  </View>;
}

/** Portfólio público: miniaturas; ao tocar abre as fotografias em grande. */
export function PortfolioGallery({ target }: { target: PortfolioTarget }) {
  const { t, tc } = useT();
  const [items, setItems] = useState<PortfolioItem[]>([]); const [view, setView] = useState<{ item: PortfolioItem; i: number } | null>(null);
  const { width } = useWindowDimensions();
  const key = "providerId" in target ? target.providerId : target.businessId;
  useEffect(() => { void listPortfolio(supabase(), target).then(r => setItems(r.data)); }, [key]);
  if (!items.length) return null;
  const tile = Math.floor((Math.min(width, 600) - 32 - 10) / 2);
  return <View style={{ gap: 8 }}>
    <Text style={ui.h2}>{t("sv.pf_done", { n: items.length })}</Text>
    <View style={[ui.row, { gap: 10 }]}>
      {items.map(it => <Pressable key={it.id} onPress={() => setView({ item: it, i: 0 })} accessibilityRole="button" accessibilityLabel={t("sv.pf_view_a11y", { title: it.title, n: it.photos.length })} style={{ width: tile, gap: 4 }}>
        <LiteImage placeholder="🖼️" source={{ uri: it.photos[0] }} style={{ width: tile, height: tile, borderRadius: 12 }} />
        <Text style={ui.label} numberOfLines={2}>{it.title}</Text>
        {(it.done_on || it.photos.length > 1) && <Text style={ui.muted}>{[tc(portfolioDateLabel(it.done_on)), it.photos.length > 1 ? "📷 " + it.photos.length : ""].filter(Boolean).join(" · ")}</Text>}
      </Pressable>)}
    </View>
    <Modal visible={!!view} animationType="fade" onRequestClose={() => setView(null)}>
      {view && <ScrollView contentContainerStyle={[ui.screen, { backgroundColor: C.white }]}>
        <Image source={{ uri: view.item.photos[view.i] }} style={{ width: "100%", height: width, borderRadius: 12, backgroundColor: "#000" }} resizeMode="contain" accessibilityLabel={t("sv.pf_photo_a11y", { title: view.item.title, i: view.i + 1, n: view.item.photos.length })} />
        <Text style={ui.h2}>{view.item.title}</Text>
        {!!view.item.done_on && <Text style={ui.muted}>{tc(portfolioDateLabel(view.item.done_on))}</Text>}
        {!!view.item.description && <Text style={ui.text}>{view.item.description}</Text>}
        {view.item.photos.length > 1 && <View style={ui.row}>
          <Button title={t("sv.prev")} variant="secondary" onPress={() => setView({ ...view, i: (view.i - 1 + view.item.photos.length) % view.item.photos.length })} />
          <Text style={ui.text}>{view.i + 1} / {view.item.photos.length}</Text>
          <Button title={t("sv.next")} variant="secondary" onPress={() => setView({ ...view, i: (view.i + 1) % view.item.photos.length })} />
        </View>}
        <Button title={t("common.close")} onPress={() => setView(null)} />
      </ScrollView>}
    </Modal>
  </View>;
}

/** Produtos da empresa na Loja. */
export function BusinessProducts({ ownerId, businessId }: { ownerId: string; businessId: string }) {
  const router = useRouter(); const { t } = useT(); const [items, setItems] = useState<any[]>([]);
  useEffect(() => { void listBusinessProducts(supabase(), ownerId, businessId).then(r => setItems(r.data)); }, [businessId]);
  if (!items.length) return null;
  return <View style={{ gap: 8 }}>
    <Text style={ui.h2}>{t("sv.biz_products", { n: items.length })}</Text>
    {items.slice(0, 12).map(p => <Pressable key={p.id} onPress={() => router.push(("/loja/" + p.id) as any)} accessibilityRole="link" style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "center" }]}>
      {(p.media ?? [])[0] ? <LiteImage placeholder="📦" source={{ uri: p.media[0] }} style={{ width: 56, height: 56, borderRadius: 8 }} /> : <Text style={{ fontSize: 32 }}>📦</Text>}
      <View style={{ flex: 1 }}><Text style={ui.label}>{p.name}</Text><Text style={ui.text}>{formatPrice(p.price, p.currency)}</Text></View>
    </Pressable>)}
  </View>;
}
