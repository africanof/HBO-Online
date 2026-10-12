import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { listPortfolio, savePortfolioItem, deletePortfolioItem, reorderPortfolio, movePortfolio, validatePortfolioItem, portfolioDateLabel, uploadClassifiedMedia,
  removeClassifiedMedia, base64ToArrayBuffer, toIsoMonth, friendlyError, formatPrice, listBusinessProducts, PORTFOLIO_MAX_ITEMS, PORTFOLIO_MAX_PHOTOS,
  type PortfolioItem, type PortfolioTarget } from "@huambo-online/core";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

type Local = { uri: string; base64?: string | null; mimeType: string };
async function pickPhotos(max: number, camera = false): Promise<Local[] | string> {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return camera ? "Autorize a câmara para fotografar." : "Autorize o acesso à galeria.";
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: !camera && max > 1, selectionLimit: max };
  const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.length) return [];
  return Promise.all(r.assets.slice(0, max).map(a => shrinkAsset(a)));
}
async function uploadAll(uid: string, items: Local[]): Promise<string[]> {
  const urls: string[] = [];
  for (const p of items) {
    const body = p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
    const r = await uploadClassifiedMedia(supabase(), body, uid, "foto.jpg", p.mimeType || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error("Não foi possível enviar a fotografia.");
    urls.push(r.data);
  }
  return urls;
}

/** Fotografia do perfil ou logótipo. */
export function PhotoPicker({ uid, current, label, onSave }: { uid: string; current: string | null; label: string; onSave: (url: string | null) => PromiseLike<{ error: any }> }) {
  const [url, setUrl] = useState(current); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => setUrl(current), [current]);
  async function choose(camera: boolean) {
    const picked = await pickPhotos(1, camera);
    if (typeof picked === "string") { setError(picked); return; }
    if (!picked.length) return;
    setBusy(true); setError("");
    try { const [u] = await uploadAll(uid, picked); const r = await onSave(u); if (r.error) throw r.error; setUrl(u); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {url ? <Image source={{ uri: url }} style={{ width: 96, height: 96, borderRadius: 18 }} accessibilityLabel={label} /> : <Text style={{ fontSize: 44 }}>📷</Text>}
    <View style={ui.row}>
      <Button title={busy ? "A enviar…" : "🖼️ Galeria"} variant="secondary" disabled={busy} onPress={() => void choose(false)} />
      <Button title="📷 Fotografar" variant="secondary" disabled={busy} onPress={() => void choose(true)} />
      {!!url && <Button title="Tirar" variant="secondary" disabled={busy} onPress={async () => { const r = await onSave(null); if (r.error) setError(friendlyError(r.error)); else setUrl(null); }} />}
    </View>
    <Message error={error} />
  </View>;
}

const empty = { title: "", description: "", doneOn: "", photos: [] as string[], local: [] as Local[] };

export function PortfolioManager({ uid, target }: { uid: string; target: PortfolioTarget }) {
  const [items, setItems] = useState<PortfolioItem[]>([]); const [form, setForm] = useState(empty); const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const key = "providerId" in target ? target.providerId : target.businessId;
  async function load() { const r = await listPortfolio(supabase(), target); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [key]);
  const total = form.photos.length + form.local.length;
  async function add(camera: boolean) {
    const picked = await pickPhotos(PORTFOLIO_MAX_PHOTOS - total, camera);
    if (typeof picked === "string") { setError(picked); return; }
    setForm(f => ({ ...f, local: [...f.local, ...picked].slice(0, PORTFOLIO_MAX_PHOTOS - f.photos.length) }));
  }
  async function save() {
    const doneOn = form.doneOn.trim() ? toIsoMonth(form.doneOn) : null;
    if (form.doneOn.trim() && !doneOn) { setError("Escreva a data como mês/ano, ex.: 09/2026."); return; }
    const invalid = validatePortfolioItem({ title: form.title, description: form.description, photos: [...form.photos, ...form.local.map(l => l.uri)], doneOn }); if (invalid) { setError(invalid); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const uploaded = await uploadAll(uid, form.local);
      const r = await savePortfolioItem(supabase(), uid, target, { title: form.title, description: form.description, photos: [...form.photos, ...uploaded], doneOn }, editing ?? undefined);
      if (r.error) throw r.error;
      setNotice(editing ? "Trabalho atualizado." : "Trabalho juntado ao portfólio."); setForm(empty); setEditing(null); setOpen(false); await load();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  function remove(it: PortfolioItem) {
    Alert.alert("Apagar trabalho", `Apagar «${it.title}» do portfólio?`, [{ text: "Não", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: async () => {
      const r = await deletePortfolioItem(supabase(), it.id);
      if (r.error) { setError(friendlyError(r.error)); return; }
      void removeClassifiedMedia(supabase(), it.photos); setNotice("Trabalho apagado."); await load();
    } }]);
  }
  async function move(id: string, dir: -1 | 1) {
    const next = movePortfolio(items, id, dir); if (next === items) return;
    setItems(next); const r = await reorderPortfolio(supabase(), next.map(x => x.id)); if (r.error) setError(friendlyError(r.error));
  }
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>📸 Portfólio ({items.length}/{PORTFOLIO_MAX_ITEMS})</Text>
    <Text style={ui.text}>Mostre trabalhos que já fez, com fotografias. Os clientes confiam mais quando veem o resultado.</Text>
    <Message error={error} ok={notice} />
    {!open && items.length < PORTFOLIO_MAX_ITEMS && <Button title="➕ Juntar trabalho" onPress={() => { setOpen(true); setEditing(null); setForm(empty); }} />}
    {open && <View style={ui.card}>
      <Text style={ui.label}>Título</Text>
      <TextInput style={ui.input} value={form.title} onChangeText={v => setForm({ ...form, title: v })} maxLength={120} placeholder="Ex.: Instalação elétrica de uma vivenda" placeholderTextColor={C.muted} accessibilityLabel="Título" />
      <Text style={ui.label}>Descrição (opcional)</Text>
      <TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={v => setForm({ ...form, description: v })} placeholder="O que foi feito, materiais, prazo, bairro…" placeholderTextColor={C.muted} accessibilityLabel="Descrição" />
      <Text style={ui.label}>Quando foi feito (opcional, mês/ano)</Text>
      <TextInput style={ui.input} value={form.doneOn} onChangeText={v => setForm({ ...form, doneOn: v })} keyboardType="numbers-and-punctuation" placeholder="09/2026" placeholderTextColor={C.muted} accessibilityLabel="Mês e ano" />
      <Text style={ui.label}>Fotografias ({total}/{PORTFOLIO_MAX_PHOTOS})</Text>
      <View style={ui.row}>
        {form.photos.map(u => <Pressable key={u} onPress={() => setForm({ ...form, photos: form.photos.filter(x => x !== u) })} accessibilityLabel="Tirar fotografia"><Image source={{ uri: u }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>✖ tirar</Text></Pressable>)}
        {form.local.map((l, i) => <Pressable key={l.uri} onPress={() => setForm({ ...form, local: form.local.filter((_, j) => j !== i) })} accessibilityLabel="Tirar fotografia"><Image source={{ uri: l.uri }} style={{ width: 72, height: 72, borderRadius: 10 }} /><Text style={ui.muted}>✖ tirar</Text></Pressable>)}
      </View>
      {total < PORTFOLIO_MAX_PHOTOS && <View style={ui.row}><Button title="🖼️ Galeria" variant="secondary" onPress={() => void add(false)} /><Button title="📷 Fotografar" variant="secondary" onPress={() => void add(true)} /></View>}
      <Button title={busy ? "A enviar…" : editing ? "Guardar" : "Juntar ao portfólio"} disabled={busy} onPress={() => void save()} />
      <Button title="Cancelar" variant="secondary" onPress={() => { setOpen(false); setEditing(null); }} />
    </View>}
    {items.length === 0 && !open && <Text style={ui.muted}>Ainda não tem trabalhos no portfólio.</Text>}
    {items.map((it, i) => <View key={it.id} style={[ui.card, { flexDirection: "row", gap: 10 }]}>
      <Image source={{ uri: it.photos[0] }} style={{ width: 72, height: 72, borderRadius: 10 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={ui.label}>{it.title}</Text>
        <Text style={ui.muted}>{it.photos.length} fotografia(s){it.done_on ? " · " + portfolioDateLabel(it.done_on) : ""}</Text>
        <View style={ui.row}>
          <Button title="↑" variant="secondary" disabled={i === 0} onPress={() => void move(it.id, -1)} />
          <Button title="↓" variant="secondary" disabled={i === items.length - 1} onPress={() => void move(it.id, 1)} />
          <Button title="Editar" variant="secondary" onPress={() => { setEditing(it.id); setOpen(true); setForm({ title: it.title, description: it.description ?? "", doneOn: it.done_on ? it.done_on.slice(5, 7) + "/" + it.done_on.slice(0, 4) : "", photos: it.photos, local: [] }); }} />
          <Button title="Apagar" variant="danger" onPress={() => remove(it)} />
        </View>
      </View>
    </View>)}
  </View>;
}

/** Portfólio público: miniaturas; ao tocar abre as fotografias em grande. */
export function PortfolioGallery({ target }: { target: PortfolioTarget }) {
  const [items, setItems] = useState<PortfolioItem[]>([]); const [view, setView] = useState<{ item: PortfolioItem; i: number } | null>(null);
  const { width } = useWindowDimensions();
  const key = "providerId" in target ? target.providerId : target.businessId;
  useEffect(() => { void listPortfolio(supabase(), target).then(r => setItems(r.data)); }, [key]);
  if (!items.length) return null;
  const tile = Math.floor((Math.min(width, 600) - 32 - 10) / 2);
  return <View style={{ gap: 8 }}>
    <Text style={ui.h2}>📸 Trabalhos realizados ({items.length})</Text>
    <View style={[ui.row, { gap: 10 }]}>
      {items.map(it => <Pressable key={it.id} onPress={() => setView({ item: it, i: 0 })} accessibilityRole="button" accessibilityLabel={`Ver «${it.title}», ${it.photos.length} fotografias`} style={{ width: tile, gap: 4 }}>
        <Image source={{ uri: it.photos[0] }} style={{ width: tile, height: tile, borderRadius: 12 }} />
        <Text style={ui.label} numberOfLines={2}>{it.title}</Text>
        {(it.done_on || it.photos.length > 1) && <Text style={ui.muted}>{[portfolioDateLabel(it.done_on), it.photos.length > 1 ? "📷 " + it.photos.length : ""].filter(Boolean).join(" · ")}</Text>}
      </Pressable>)}
    </View>
    <Modal visible={!!view} animationType="fade" onRequestClose={() => setView(null)}>
      {view && <ScrollView contentContainerStyle={[ui.screen, { backgroundColor: C.white }]}>
        <Image source={{ uri: view.item.photos[view.i] }} style={{ width: "100%", height: width, borderRadius: 12, backgroundColor: "#000" }} resizeMode="contain" accessibilityLabel={`${view.item.title} — fotografia ${view.i + 1} de ${view.item.photos.length}`} />
        <Text style={ui.h2}>{view.item.title}</Text>
        {!!view.item.done_on && <Text style={ui.muted}>{portfolioDateLabel(view.item.done_on)}</Text>}
        {!!view.item.description && <Text style={ui.text}>{view.item.description}</Text>}
        {view.item.photos.length > 1 && <View style={ui.row}>
          <Button title="← Anterior" variant="secondary" onPress={() => setView({ ...view, i: (view.i - 1 + view.item.photos.length) % view.item.photos.length })} />
          <Text style={ui.text}>{view.i + 1} / {view.item.photos.length}</Text>
          <Button title="Seguinte →" variant="secondary" onPress={() => setView({ ...view, i: (view.i + 1) % view.item.photos.length })} />
        </View>}
        <Button title="Fechar" onPress={() => setView(null)} />
      </ScrollView>}
    </Modal>
  </View>;
}

/** Produtos da empresa na Loja. */
export function BusinessProducts({ ownerId, businessId }: { ownerId: string; businessId: string }) {
  const router = useRouter(); const [items, setItems] = useState<any[]>([]);
  useEffect(() => { void listBusinessProducts(supabase(), ownerId, businessId).then(r => setItems(r.data)); }, [businessId]);
  if (!items.length) return null;
  return <View style={{ gap: 8 }}>
    <Text style={ui.h2}>🛍️ Produtos na Loja ({items.length})</Text>
    {items.slice(0, 12).map(p => <Pressable key={p.id} onPress={() => router.push(("/loja/" + p.id) as any)} accessibilityRole="link" style={[ui.card, { flexDirection: "row", gap: 10, alignItems: "center" }]}>
      {(p.media ?? [])[0] ? <Image source={{ uri: p.media[0] }} style={{ width: 56, height: 56, borderRadius: 8 }} /> : <Text style={{ fontSize: 32 }}>📦</Text>}
      <View style={{ flex: 1 }}><Text style={ui.label}>{p.name}</Text><Text style={ui.text}>{formatPrice(p.price, p.currency)}</Text></View>
    </Pressable>)}
  </View>;
}
