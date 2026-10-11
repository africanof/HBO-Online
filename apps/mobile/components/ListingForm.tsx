import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { listMunicipalities, listProvinces, validateClassifiedDraft, parsePrice, uploadClassifiedMedia, removeClassifiedMedia,
  createAndPublishClassifiedListing, updateClassifiedListing, friendlyError, listingTerritory, base64ToArrayBuffer,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, CLASSIFIED_MAX_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES, validateBudget, budgetPrice,
  saleModesFor, canAlsoTrade, validateSaleMode, startListingAuction, SALE_MODE_INFO, type SaleMode } from "@huambo-online/core";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { MarketPicker } from "./MarketPicker";
import { VideoField } from "./Video";
import { Button, Chips, Message } from "./Ui";

type Option = { id: string; name: string };
type Photo = { key: string; uri: string; base64?: string | null; mimeType?: string; remote?: boolean };

const typeOptions = Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => ({ value: value as ClassifiedListingType, label }));
const purposeOptions = PUBLISHABLE_PURPOSES.map(value => ({ value, label: PURPOSE_LABELS[value] }));

export function ListingForm({ listing, initialPurpose }: { listing?: any; initialPurpose?: ClassifiedPurpose }) {
  const router = useRouter();
  const editing = Boolean(listing);
  const territory = listingTerritory(listing);
  const [listingType, setListingType] = useState<ClassifiedListingType>(listing?.listing_type ?? "classified");
  const [purpose, setPurpose] = useState<ClassifiedPurpose>(listing?.purpose ?? initialPurpose ?? "sale");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [budgetMin, setBudgetMin] = useState(listing?.budget_min != null ? String(listing.budget_min) : "");
  const [budgetMax, setBudgetMax] = useState(listing?.budget_max != null ? String(listing.budget_max) : "");
  const wanted = purpose === "wanted";
  // Como vende: preço fixo, negociável, propostas, leilão ou troca (escolhido ao publicar).
  const lockedAuction = listing?.purpose === "auction";
  const [saleMode, setSaleMode] = useState<SaleMode | "">(listing?.sale_mode ?? "");
  const [acceptsTrade, setAcceptsTrade] = useState<boolean>(!!listing?.accepts_trade);
  const [tradeWants, setTradeWants] = useState<string>(listing?.trade_wants ?? "");
  const [auctionDays, setAuctionDays] = useState("7");
  const modes = lockedAuction ? [] : saleModesFor(purpose, listingType);
  const [categoryId, setCategoryId] = useState<string>(listing?.category_id ?? "");
  const [provinceId, setProvinceId] = useState(territory.provinceId ?? "");
  const [municipalityId, setMunicipalityId] = useState(territory.municipalityId ?? "");
  const [marketId, setMarketId] = useState<string>(listing?.market_id ?? "");
  const [videoUrl, setVideoUrl] = useState<string>(listing?.video_url ?? "");
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
    const minValue = wanted ? parsePrice(budgetMin) : undefined, maxValue = wanted ? parsePrice(budgetMax) : undefined;
    const budgetError = wanted ? validateBudget(minValue, maxValue) : null;
    if (budgetError) { setError(budgetError); return; }
    const priceValue = wanted ? budgetPrice(minValue, maxValue) : parsePrice(price);
    const invalid = validateClassifiedDraft({ listingType, purpose, title, description, price: priceValue, provinceId, municipalityId, photoCount: photos.length })
      ?? (lockedAuction ? null : validateSaleMode({ purpose, listingType, saleMode, price: priceValue, auctionDays: Number(auctionDays), tradeWants, acceptsTrade }));
    if (invalid) { setError(invalid); return; }
    const mode = modes.length ? (saleMode || undefined) as SaleMode | undefined : undefined;
    const sale = lockedAuction ? { saleMode: "auction" as const, acceptsTrade: false } : { saleMode: mode, acceptsTrade: mode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade), tradeWants };
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
      const input = { listingType, purpose, title, description, price: priceValue, categoryId: categoryId || undefined, provinceId, municipalityId, marketId: marketId || undefined, videoUrl: videoUrl || undefined, budgetMin: minValue, budgetMax: maxValue, media, ...sale };
      // O leilão começa logo depois de publicar (ou de guardar, ao mudar para leilão).
      const startAuction = async (id: string) => {
        if (mode !== "auction" || lockedAuction) return null;
        setStatus("A abrir o leilão…");
        const a = await startListingAuction(c, id, { startingPrice: priceValue ?? 0, days: Number(auctionDays) });
        return a.error ?? null;
      };
      if (editing) {
        const r = await updateClassifiedListing(c, listing.id, input);
        if (r.error) throw r.error;
        if (removed.length) await removeClassifiedMedia(c, removed);
        const ae = await startAuction(listing.id); if (ae) throw ae;
        router.replace(("/classificados/" + listing.id) as any);
      } else {
        const r = await createAndPublishClassifiedListing(c, { ownerId: user.id, ...input });
        if (r.error) {
          if (r.draftId) { router.replace(("/meus-anuncios?erro=" + encodeURIComponent(friendlyError(r.error))) as any); return; }
          throw r.error;
        }
        const ae = await startAuction((r.data as any).id);
        if (ae) { router.replace(("/meus-anuncios?erro=" + encodeURIComponent("o anúncio foi publicado, mas o leilão não abriu: " + friendlyError(ae))) as any); return; }
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
    {wanted && <Text style={ui.ok}>🔎 Pedido de comprador: diga o que procura e quanto pode pagar. Os vendedores e profissionais com artigos ou serviços parecidos são avisados.</Text>}
    <Text style={ui.label}>{wanted ? "O que procura?" : "Título"}</Text>
    <TextInput style={ui.input} value={title} maxLength={140} onChangeText={setTitle} placeholder={wanted ? (listingType === "service" ? "Ex.: Procuro um eletricista para instalação" : "Ex.: Preciso de um Router 5G da Unitel") : "Ex.: Toyota Hilux 2018"} />
    <Text style={ui.label}>Descrição</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} placeholder={wanted ? "Pormenores: estado, marca, zona, quando precisa…" : "Estado, características, como entregar…"} />
    {wanted ? <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1, gap: 6 }}><Text style={ui.label}>Orçamento de (Kz)</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={budgetMin} onChangeText={setBudgetMin} placeholder="20 000" /></View>
      <View style={{ flex: 1, gap: 6 }}><Text style={ui.label}>até (Kz)</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={budgetMax} onChangeText={setBudgetMax} placeholder="25 000" /></View>
    </View> : <>
      {modes.length > 0 && <View style={{ gap: 8 }}>
        <Text style={ui.h2}>Como quer vender?</Text>
        {modes.map(m => <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: saleMode === m }} onPress={() => setSaleMode(m)}
          style={{ borderWidth: 2, borderColor: saleMode === m ? C.blue : C.line, backgroundColor: saleMode === m ? "#EEF3FF" : C.white, borderRadius: 14, padding: 12, gap: 2 }}>
          <Text style={ui.label}>{saleMode === m ? "◉ " : "○ "}{SALE_MODE_INFO[m].icon} {SALE_MODE_INFO[m].label}</Text>
          <Text style={ui.muted}>{SALE_MODE_INFO[m].help}</Text>
        </Pressable>)}
      </View>}
      {lockedAuction && <Text style={ui.label}>🔨 Este anúncio está em leilão.</Text>}
      <Text style={ui.label}>{saleMode === "auction" ? "Preço inicial do leilão (Kz)" : saleMode === "offers" || saleMode === "trade" ? "Preço de referência (Kz, opcional)" : "Preço (Kz)"}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder={saleMode === "fixed" || saleMode === "negotiable" || saleMode === "auction" ? "Ex.: 85 000" : "Vazio = «sob consulta»"} />
      {saleMode === "auction" && !lockedAuction && <><Text style={ui.label}>Duração do leilão</Text>
        <Chips options={["1", "3", "5", "7", "10", "14"].map(d => ({ value: d, label: d + (d === "1" ? " dia" : " dias") }))} value={auctionDays} onChange={setAuctionDays} /></>}
      {canAlsoTrade(purpose, saleMode) && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptsTrade }} onPress={() => setAcceptsTrade(!acceptsTrade)} style={[ui.row, { alignItems: "center" }]}>
        <Text style={{ fontSize: 26 }}>{acceptsTrade ? "☑" : "☐"}</Text><Text style={ui.label}>🔁 Também aceito troca</Text></Pressable>}
      {(saleMode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade)) && <>
        <Text style={ui.label}>O que aceita em troca?</Text>
        <TextInput style={ui.input} value={tradeWants} maxLength={300} onChangeText={setTradeWants} placeholder="Ex.: telemóvel Android, motorizada…" /></>}
    </>}
    <Text style={ui.label}>Categoria</Text>
    <Chips options={[{ value: "", label: "Sem categoria" }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
    <Text style={ui.label}>Província</Text>
    <Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); setMunicipalityId(""); }} />
    <Text style={ui.label}>Município</Text>
    {provinceId ? <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /> : <Text style={ui.muted}>Escolha primeiro a província.</Text>}
    <MarketPicker value={marketId} onChange={setMarketId} />
    <VideoField value={videoUrl} onChange={setVideoUrl} />
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
