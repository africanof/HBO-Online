import { useEffect, useRef, useState } from "react";
import { ConformityCheck } from "../../components/Conformity";
import { Link, useRouter } from "expo-router";
import { Alert, Image, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { listMyProducts, saveProduct, deleteProduct, listProductCategories, uploadClassifiedMedia, removeClassifiedMedia, base64ToArrayBuffer,
  parsePrice, formatPrice, friendlyErrorIn, MAX_PRODUCT_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES, formatRef } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { MarketPicker } from "../../components/MarketPicker";
import { VideoField } from "../../components/Video";
import { Button, Chips, Message } from "../../components/Ui";
import { PlanBanner } from "../../components/Plans";
import { useTerritory } from "../../components/Directory";
import { shrinkAsset } from "../../lib/image";
import { useT } from "../../lib/i18n";

type Option = { id: string; name: string };
type Photo = { key: string; uri: string; base64?: string | null; mimeType?: string; remote?: boolean };
const empty = { name: "", description: "", price: "", stock: "1", categoryId: "", municipalityId: "", marketId: "", videoUrl: "", active: true };

export default function MeusProdutos() {
  const router = useRouter(); const scroll = useRef<ScrollView>(null); const { t, lang } = useT();
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
    if (!perm.granted) { setError(t("sh.allow_photos")); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 0.9 });
    if (r.canceled) return;
    // Fotografias mais leves: reduzidas no telemóvel antes de enviar (poupa dados).
    const ready = await Promise.all(r.assets.slice(0, room).map(async a => ({ key: a.assetId ?? a.uri, ...(await shrinkAsset(a)) })));
    setPhotos(p => [...p, ...ready]);
  }
  function edit(p: any) {
    setEditing(p.id); setRemoved([]);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), stock: String(p.stock), categoryId: p.category_id ?? "", municipalityId: p.municipality_id ?? "", marketId: p.market_id ?? "", videoUrl: p.video_url ?? "", active: p.active }); setConform(!!p.conformity_accepted_at);
    setPhotos((Array.isArray(p.media) ? p.media : []).map((u: string) => ({ key: u, uri: u, remote: true })));
    scroll.current?.scrollToEnd();
  }
  const [conform, setConform] = useState(false);
  function reset() { setEditing(null); setForm(empty); setPhotos([]); setRemoved([]); setConform(false); }

  async function submit() {
    if (!uid || busy) return;
    if (form.active && !conform) { setError(t("sh.confirm_conformity")); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const media: string[] = [];
      for (const p of photos) {
        if (p.remote) { media.push(p.uri); continue; }
        const body = p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
        const up = await uploadClassifiedMedia(supabase(), body, uid, "produto." + ((p.mimeType ?? "image/jpeg").split("/")[1] ?? "jpg"), p.mimeType ?? "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error(t("sh.photo_upload_failed"));
        media.push(up.data);
      }
      const r = await saveProduct(supabase(), uid, { name: form.name, description: form.description, price: parsePrice(form.price) ?? NaN, stock: Number(form.stock),
        categoryId: form.categoryId, municipalityId: form.municipalityId, marketId: form.marketId, videoUrl: form.videoUrl, media, active: form.active, conformity: conform }, editing ?? undefined);
      if (r.error) throw r.error;
      if (removed.length) await removeClassifiedMedia(supabase(), removed);
      setNotice(editing ? t("sh.product_updated") : t("sh.product_published")); reset(); await load(uid);
    } catch (err) { setError(friendlyErrorIn(err, lang)); } finally { setBusy(false); }
  }

  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.my_products")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;

  return <ScrollView ref={scroll} contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{"← " + t("nav.account_short")}</Link>
    <Text style={ui.h1}>{t("sh.my_products")}</Text>
    <Button title={t("sh.view_stats")} variant="secondary" onPress={() => router.push("/conta/estatisticas" as any)} />
    <PlanBanner kind="store" subjectId={uid} />
    <Button title={t("sh.dl.title")} variant="secondary" onPress={() => router.push("/conta/entregas" as any)} />
    <Button title={"📦 " + t("sh.my_sales")} variant="secondary" onPress={() => router.push("/encomendas?vendas=1" as any)} />
    <Message error={error} ok={notice} />
    {items.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{p.name}{p.active ? "" : " " + t("sh.hidden")}</Text>
      {!!p.ref_no && <Text style={ui.muted}>{t("sh.no_ref", { ref: formatRef("product", p.ref_no) })}</Text>}
      <Text style={ui.text}>{formatPrice(p.price, p.currency)} · {t("sh.in_stock", { n: p.stock })}</Text>
      <Button title={t("sh.view")} variant="secondary" onPress={() => router.push(("/loja/" + p.id) as any)} />
      <Button title={t("common.edit")} variant="secondary" onPress={() => edit(p)} />
      <Button title={t("common.delete")} variant="danger" onPress={() => Alert.alert(t("sh.delete_product"), t("sh.are_you_sure"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("common.delete"), style: "destructive", onPress: async () => { const r = await deleteProduct(supabase(), p.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { await removeClassifiedMedia(supabase(), p.media ?? []); await load(uid); } } }])} />
    </View>)}
    <View style={ui.card}>
      <Text style={ui.h2}>{editing ? t("sh.edit_product") : t("sh.new_product")}</Text>
      <Text style={ui.label}>{t("sh.name")}</Text><TextInput style={ui.input} value={form.name} onChangeText={set("name")} />
      <Text style={ui.label}>{t("sh.description")}</Text><TextInput style={[ui.input, ui.area]} multiline value={form.description} onChangeText={set("description")} />
      <Text style={ui.label}>{t("sh.price_kz")}</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={form.price} onChangeText={set("price")} />
      <Text style={ui.label}>{t("sh.stock_qty")}</Text><TextInput style={ui.input} keyboardType="number-pad" value={form.stock} onChangeText={set("stock")} />
      <Text style={ui.label}>{t("sh.category")}</Text><Chips options={categories.map(c => ({ value: c.id, label: c.name }))} value={form.categoryId} onChange={set("categoryId")} />
      <Text style={ui.label}>{t("sh.province")}</Text><Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); set("municipalityId")(""); }} />
      <Text style={ui.label}>{t("auth.municipality")}</Text><Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={form.municipalityId} onChange={set("municipalityId")} />
      <MarketPicker value={form.marketId} onChange={v => setForm({ ...form, marketId: v })} />
      <VideoField value={form.videoUrl} onChange={v => setForm(f => ({ ...f, videoUrl: v }))} />
      <Text style={ui.label}>{t("sh.photos_n", { n: photos.length, max: MAX_PRODUCT_PHOTOS })}</Text>
      <Button title={t("sh.select_photos")} variant="secondary" disabled={photos.length >= MAX_PRODUCT_PHOTOS} onPress={() => void pick()} />
      <View style={ui.row}>{photos.map((p, i) => <View key={p.key} style={{ width: 100, gap: 6 }}>
        <Image source={{ uri: p.uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
        <Pressable accessibilityRole="button" onPress={() => { if (p.remote) setRemoved(r => [...r, p.uri]); setPhotos(x => x.filter((_, j) => j !== i)); }} style={[ui.buttonSecondary, { minHeight: 40 }]}><Text style={ui.buttonSecondaryText}>{t("sh.remove")}</Text></Pressable>
      </View>)}</View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={ui.label}>{t("sh.visible_in_shop")}</Text><Switch value={form.active} onValueChange={v => setForm(f => ({ ...f, active: v }))} /></View>
      <ConformityCheck checked={conform} onChange={setConform} />
      <Button title={busy ? t("sh.saving") : editing ? t("common.save") : t("sh.publish_product")} disabled={busy} onPress={() => void submit()} />
      {editing && <Button title={t("common.cancel")} variant="secondary" onPress={reset} />}
    </View>
  </ScrollView>;
}
