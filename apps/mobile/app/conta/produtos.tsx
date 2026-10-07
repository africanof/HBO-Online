import { useEffect, useRef, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { listMyProducts, saveProduct, deleteProduct, listProductCategories, uploadClassifiedMedia, removeClassifiedMedia, base64ToArrayBuffer,
  parsePrice, formatPrice, friendlyError, MAX_PRODUCT_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";

type Option = { id: string; name: string };
type Photo = { key: string; uri: string; base64?: string | null; mimeType?: string; remote?: boolean };
const empty = { name: "", description: "", price: "", stock: "1", categoryId: "", municipalityId: "", active: true };

export default function MeusProdutos() {
  const router = useRouter(); const scroll = useRef<ScrollView>(null);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [photos, setPhotos] = useState<Photo[]>([]); const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyProducts(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function pick() {
    const room = MAX_PRODUCT_PHOTOS - photos.length; if (room <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Autorize o acesso às fotografias."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7, base64: true });
    if (r.canceled) return;
    const ok = r.assets.filter(a => !a.fileSize || a.fileSize <= CLASSIFIED_MAX_PHOTO_BYTES);
    setPhotos(p => [...p, ...ok.slice(0, room).map(a => ({ key: a.assetId ?? a.uri, uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? "image/jpeg" }))]);
  }
  function edit(p: any) {
    setEditing(p.id); setRemoved([]);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), stock: String(p.stock), categoryId: p.category_id ?? "", municipalityId: p.municipality_id ?? "", active: p.active });
    setPhotos((Array.isArray(p.media) ? p.media : []).map((u: string) => ({ key: u, uri: u, remote: true })));
    scroll.current?.scrollToEnd();
  }
  function reset() { setEditing(null); setForm(empty); setPhotos([]); setRemoved([]); }

  async function submit() {
    if (!uid || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const media: string[] = [];
      for (const p of photos) {
        if (p.remote) { media.push(p.uri); continue; }
        const body = p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
        const up = await uploadClassifiedMedia(supabase(), body, uid, "produto." + ((p.mimeType ?? "image/jpeg").split("/")[1] ?? "jpg"), p.mimeType ?? "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("Falha no envio da fotografia.");
        media.push(up.data);
      }
      const r = await saveProduct(supabase(), uid, { name: form.name, description: form.description, price: parsePrice(form.price) ?? NaN, stock: Number(form.stock),
        categoryId: form.categoryId, municipalityId: form.municipalityId, media, active: form.active }, editing ?? undefined);
      if (r.error) throw r.error;
      if (removed.length) await removeClassifiedMedia(supabase(), removed);
      setNotice(editing ? "Produto atualizado." : "Produto publicado na loja."); reset(); await load(uid);
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Os meus produtos</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;

  return <ScrollView ref={scroll} contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← Conta</Link>
    <Text style={ui.h1}>Os meus produtos</Text>
    <Button title="📦 As minhas vendas" variant="secondary" onPress={() => router.push("/encomendas?vendas=1" as any)} />
    <Message error={error} ok={notice} />
    {items.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{p.name}{p.active ? "" : " (oculto)"}</Text>
      <Text style={ui.text}>{formatPrice(p.price, p.currency)} · {p.stock} em stock</Text>
      <Button title="Ver" variant="secondary" onPress={() => router.push(("/loja/" + p.id) as any)} />
      <Button title="Editar" variant="secondary" onPress={() => edit(p)} />
      <Button title="Apagar" variant="danger" onPress={() => Alert.alert("Apagar produto", "Tem a certeza?", [{ text: "Cancelar", style: "cancel" }, { text: "Apagar", style: "destructive", onPress: async () => { const r = await deleteProduct(supabase(), p.id); if (r.error) setError(friendlyError(r.error)); else { await removeClassifiedMedia(supabase(), p.media ?? []); await load(uid); } } }])} />
    </View>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{editing ? "Editar produto" : "Novo produto"}</Text>
      <Text style={ui.label}>Nome</Text><TextInput style={ui.input} value={form.name} onChangeText={set("name")} />
      <Text style={ui.label}>Descrição</Text><TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={set("description")} />
      <Text style={ui.label}>Preço (Kz)</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={form.price} onChangeText={set("price")} />
      <Text style={ui.label}>Quantidade em stock</Text><TextInput style={ui.input} keyboardType="number-pad" value={form.stock} onChangeText={set("stock")} />
      <Text style={ui.label}>Categoria</Text><Chips options={categories.map(c => ({ value: c.id, label: c.name }))} value={form.categoryId} onChange={set("categoryId")} />
      <Text style={ui.label}>Província</Text><Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); set("municipalityId")(""); }} />
      <Text style={ui.label}>Município</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={set("municipalityId")} />
      <Text style={ui.label}>Fotografias ({photos.length}/{MAX_PRODUCT_PHOTOS})</Text>
      <Button title="📷 Selecionar fotografias" variant="secondary" disabled={photos.length >= MAX_PRODUCT_PHOTOS} onPress={() => void pick()} />
      <View style={ui.row}>{photos.map((p, i) => <View key={p.key} style={{ width: 100, gap: 6 }}>
        <Image source={{ uri: p.uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
        <Pressable accessibilityRole="button" onPress={() => { if (p.remote) setRemoved(r => [...r, p.uri]); setPhotos(x => x.filter((_, j) => j !== i)); }} style={[ui.buttonSecondary, { minHeight: 40 }]}><Text style={ui.buttonSecondaryText}>Remover</Text></Pressable>
      </View>)}</View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={ui.label}>Visível na loja</Text><Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))} /></View>
      <Button title={busy ? "A guardar…" : editing ? "Guardar" : "Publicar produto"} disabled={busy} onPress={() => void submit()} />
      {editing && <Button title="Cancelar" variant="secondary" onPress={reset} />}
    </View>
  </ScrollView>;
}
