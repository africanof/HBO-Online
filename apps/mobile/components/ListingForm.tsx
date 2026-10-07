import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { listMunicipalities, listProvinces, validateClassifiedDraft, parsePrice, uploadClassifiedMedia, removeClassifiedMedia,
  createAndPublishClassifiedListing, updateClassifiedListing, friendlyError, listingTerritory, base64ToArrayBuffer,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, CLASSIFIED_MAX_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES } from "@huambo-online/core";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

type Option = { id: string; name: string };
type Photo = { key: string; uri: string; base64?: string | null; mimeType?: string; remote?: boolean };

const typeOptions = Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => ({ value: value as ClassifiedListingType, label }));
const purposeOptions = PUBLISHABLE_PURPOSES.map(value => ({ value, label: PURPOSE_LABELS[value] }));

export function ListingForm({ listing }: { listing?: any }) {
  const router = useRouter();
  const editing = Boolean(listing);
  const territory = listingTerritory(listing);
  const [listingType, setListingType] = useState<ClassifiedListingType>(listing?.listing_type ?? "classified");
  const [purpose, setPurpose] = useState<ClassifiedPurpose>(listing?.purpose ?? "sale");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [categoryId, setCategoryId] = useState<string>(listing?.category_id ?? "");
  const [provinceId, setProvinceId] = useState(territory.provinceId ?? "");
  const [municipalityId, setMunicipalityId] = useState(territory.municipalityId ?? "");
  const [photos, setPhotos] = useState<Photo[]>(() => (Array.isArray(listing?.media) ? listing.media : []).map((u: string) => ({ key: u, uri: u, remote: true })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const c = supabase();
    void c.from("categories").select("id,name").eq("active", true).order("name").then(({ data }) => setCategories(data ?? []));
    void listProvinces(c).then(({ data }) => {
      const list = (data ?? []) as Option[];
      setProvinces(list);
      if (!provinceId && list.length === 1) setProvinceId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!provinceId) { setMunicipalities([]); return; }
    void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[]));
  }, [provinceId]);

  async function pickPhotos() {
    setError("");
    const room = CLASSIFIED_MAX_PHOTOS - photos.length;
    if (room <= 0) { setError(`Pode juntar no máximo ${CLASSIFIED_MAX_PHOTOS} fotografias.`); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Autorize o acesso às fotografias para as juntar ao anúncio."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 0.7, base64: true });
    if (result.canceled) return;
    const ok = result.assets.filter(a => !a.fileSize || a.fileSize <= CLASSIFIED_MAX_PHOTO_BYTES);
    if (ok.length < result.assets.length) setError("Algumas fotografias têm mais de 5 MB e foram ignoradas.");
    setPhotos(p => [...p, ...ok.slice(0, room).map(a => ({ key: a.assetId ?? a.uri, uri: a.uri, base64: a.base64, mimeType: a.mimeType ?? "image/jpeg" }))]);
  }

  function removePhoto(i: number) {
    const photo = photos[i];
    if (photo.remote) setRemoved(r => [...r, photo.uri]);
    setPhotos(p => p.filter((_, j) => j !== i));
  }

  async function submit() {
    if (busy) return;
    setError("");
    const priceValue = parsePrice(price);
    const invalid = validateClassifiedDraft({ listingType, purpose, title, description, price: priceValue, provinceId, municipalityId, photoCount: photos.length });
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      const c = supabase();
      const { data: { user } } = await c.auth.getUser();
      if (!user) { setError("Inicie sessão para publicar."); return; }
      const media: string[] = [];
      let n = 0;
      for (const photo of photos) {
        if (photo.remote) { media.push(photo.uri); continue; }
        n++; setStatus(`A enviar fotografia ${n}…`);
        const body = photo.base64 ? base64ToArrayBuffer(photo.base64) : await (await fetch(photo.uri)).arrayBuffer();
        const ext = (photo.mimeType ?? "image/jpeg").split("/")[1] ?? "jpg";
        const up = await uploadClassifiedMedia(c, body, user.id, "foto." + ext, photo.mimeType ?? "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("Falha no envio da fotografia.");
        media.push(up.data);
      }
      setStatus(editing ? "A guardar…" : "A publicar…");
      const input = { listingType, purpose, title, description, price: priceValue, categoryId: categoryId || undefined, provinceId, municipalityId, media };
      if (editing) {
        const r = await updateClassifiedListing(c, listing.id, input);
        if (r.error) throw r.error;
        if (removed.length) await removeClassifiedMedia(c, removed);
        router.replace(("/classificados/" + listing.id) as any);
      } else {
        const r = await createAndPublishClassifiedListing(c, { ownerId: user.id, ...input });
        if (r.error) {
          if (r.draftId) { router.replace(("/meus-anuncios?erro=" + encodeURIComponent(friendlyError(r.error))) as any); return; }
          throw r.error;
        }
        router.replace(("/classificados/" + (r.data as any).id) as any);
      }
    } catch (err) {
      setError(friendlyError(err, "Não foi possível publicar o anúncio."));
    } finally { setBusy(false); setStatus(""); }
  }

  return <View style={{ gap: 14 }}>
    <Text style={ui.label}>Tipo</Text>
    <Chips options={typeOptions} value={listingType} onChange={setListingType} />
    <Text style={ui.label}>Finalidade</Text>
    <Chips options={purposeOptions} value={purpose} onChange={setPurpose} />
    <Text style={ui.label}>Título</Text>
    <TextInput style={ui.input} value={title} maxLength={140} onChangeText={setTitle} placeholder="Ex.: Toyota Hilux 2018" />
    <Text style={ui.label}>Descrição</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} placeholder="Estado, características, como entregar…" />
    <Text style={ui.label}>Preço (Kz)</Text>
    <TextInput style={ui.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder="Vazio = «sob consulta»" />
    <Text style={ui.label}>Categoria</Text>
    <Chips options={[{ value: "", label: "Sem categoria" }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
    <Text style={ui.label}>Província</Text>
    <Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); setMunicipalityId(""); }} />
    <Text style={ui.label}>Município</Text>
    {provinceId ? <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /> : <Text style={ui.muted}>Escolha primeiro a província.</Text>}
    <Text style={ui.label}>Fotografias ({photos.length}/{CLASSIFIED_MAX_PHOTOS})</Text>
    <Button title="📷 Selecionar fotografias" variant="secondary" onPress={() => void pickPhotos()} disabled={busy || photos.length >= CLASSIFIED_MAX_PHOTOS} />
    <View style={ui.row}>
      {photos.map((p, i) => <View key={p.key} style={{ width: 104, gap: 6 }}>
        <Image source={{ uri: p.uri }} style={{ width: 104, height: 104, borderRadius: 8, backgroundColor: "#eee" }} accessibilityLabel={`Fotografia ${i + 1}`} />
        <Pressable accessibilityRole="button" onPress={() => removePhoto(i)} style={[ui.buttonSecondary, { minHeight: 40 }]}><Text style={ui.buttonSecondaryText}>Remover</Text></Pressable>
      </View>)}
    </View>
    <Message error={error} ok={status} />
    <Button title={busy ? (status || "Aguarde…") : editing ? "Guardar alterações" : "Publicar anúncio"} onPress={() => void submit()} disabled={busy} />
  </View>;
}
