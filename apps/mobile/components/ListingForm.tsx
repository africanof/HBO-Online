import { useEffect, useRef, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { listMunicipalities, listProvinces, validateClassifiedDraft, parsePrice, uploadClassifiedMedia, removeClassifiedMedia,
  createAndPublishClassifiedListing, updateClassifiedListing, setListingAgent, normalizeAgentCode, pointFrom, type GeoPoint, friendlyErrorIn, listingTerritory, categoryLabelIn, base64ToArrayBuffer,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, CLASSIFIED_MAX_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES, validateBudget, budgetPrice,
  saleModesFor, saleModeFromParam, canAlsoTrade, validateSaleMode, startListingAuction, SALE_MODE_INFO, type SaleMode, readAgro, validateAgro, agroAttributes, agroUnitInfo, AGRO_CATEGORIES, AGRO_UNITS,
  loadListingDraft, saveListingDraft, clearListingDraft, draftAgeText, isOfflineError, OFFLINE_PUBLISH_MESSAGE, type ListingDraftFields, type ListingDraftPhoto } from "@huambo-online/core";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { MarketPicker } from "./MarketPicker";
import { PlaceFields } from "./Place";
import { ConformityCheck } from "./Conformity";
import { VideoField } from "./Video";
import { AgentCodeField } from "./Agents";
import { Button, Chips, Message } from "./Ui";
import { shrinkAsset } from "../lib/image";
import { deviceStore } from "./Engage";
import { useT } from "../lib/i18n";

/** Pasta da APP onde ficam as fotografias do rascunho (não é apagada pelo telemóvel como a cache). */
const DRAFT_DIR = (FileSystem.documentDirectory ?? "") + "rascunho-anuncio/";
async function dropDraftFiles() { try { await FileSystem.deleteAsync(DRAFT_DIR, { idempotent: true }); } catch { /* nada */ } }

type Option = { id: string; name: string };
type Photo = { key: string; uri: string; base64?: string | null; mimeType?: string; remote?: boolean };


export function ListingForm({ listing, initialPurpose, initialSaleMode, initialAgro, initialAgent }: { listing?: any; initialPurpose?: ClassifiedPurpose; initialSaleMode?: string; initialAgro?: boolean; initialAgent?: string }) {
  const router = useRouter(); const { t, tc, lang } = useT();
  const typeOptions = Object.entries(LISTING_TYPE_LABELS).map(([value, label]) => ({ value: value as ClassifiedListingType, label: tc(label) }));
  const purposeOptions = PUBLISHABLE_PURPOSES.map(value => ({ value, label: tc(PURPOSE_LABELS[value]) }));
  const editing = Boolean(listing);
  const territory = listingTerritory(listing);
  const [listingType, setListingType] = useState<ClassifiedListingType>(listing?.listing_type ?? (initialAgro ? "product" : "classified"));
  // Produto do campo (agricultura, gado, insumos): unidade, quantidade e «disponível a partir de».
  const agro0 = readAgro(listing?.attributes);
  const [isAgro, setIsAgro] = useState<boolean>(!!agro0 || (!listing && !!initialAgro));
  const [agroCat, setAgroCat] = useState<string>(agro0?.category ?? "");
  const [agroUnit, setAgroUnit] = useState<string>(agro0?.unit ?? "kg");
  const [agroQty, setAgroQty] = useState<string>(agro0?.quantity ? String(agro0.quantity) : "");
  const [agroFrom, setAgroFrom] = useState<string>(agro0?.availableFrom ?? "");
  const agroAllowed = listingType !== "real_estate";
  const useAgro = isAgro && agroAllowed;
  const [purpose, setPurpose] = useState<ClassifiedPurpose>(listing?.purpose ?? initialPurpose ?? "sale");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [budgetMin, setBudgetMin] = useState(listing?.budget_min != null ? String(listing.budget_min) : "");
  const [budgetMax, setBudgetMax] = useState(listing?.budget_max != null ? String(listing.budget_max) : "");
  const wanted = purpose === "wanted";
  // Como vende: preço fixo, negociável, propostas, leilão ou troca (escolhido ao publicar).
  const lockedAuction = listing?.purpose === "auction";
  const [saleMode, setSaleMode] = useState<SaleMode | "">(listing?.sale_mode ?? saleModeFromParam(initialSaleMode));
  const [acceptsTrade, setAcceptsTrade] = useState<boolean>(!!listing?.accepts_trade);
  const [tradeWants, setTradeWants] = useState<string>(listing?.trade_wants ?? "");
  const [auctionDays, setAuctionDays] = useState("7");
  const modes = lockedAuction ? [] : saleModesFor(purpose, listingType);
  const [categoryId, setCategoryId] = useState<string>(listing?.category_id ?? "");
  const [provinceId, setProvinceId] = useState(territory.provinceId ?? "");
  const [municipalityId, setMunicipalityId] = useState(territory.municipalityId ?? "");
  const [marketId, setMarketId] = useState<string>(listing?.market_id ?? "");
  const [videoUrl, setVideoUrl] = useState<string>(listing?.video_url ?? "");
  const [agentCode, setAgentCode] = useState(listing ? "" : normalizeAgentCode(initialAgent));
  const [directions, setDirections] = useState<string>(listing?.directions ?? "");
  const [conform, setConform] = useState<boolean>(!!listing?.conformity_accepted_at);
  const [point, setPoint] = useState<GeoPoint | null>(pointFrom(listing?.geo_lat, listing?.geo_lng));
  const [photos, setPhotos] = useState<Photo[]>(() => (Array.isArray(listing?.media) ? listing.media : []).map((u: string) => ({ key: u, uri: u, remote: true })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // Rascunho guardado no telemóvel (só ao criar um anúncio novo).
  const [draftNote, setDraftNote] = useState("");
  const [draftReady, setDraftReady] = useState(editing);
  const copied = useRef(new Map<string, string>());
  useEffect(() => { if (editing) return; void (async () => {
    const d = await loadListingDraft(deviceStore).catch(() => null);
    if (d) {
      const f = d.fields;
      setListingType(f.listingType as ClassifiedListingType); setIsAgro(f.isAgro); setAgroCat(f.agroCat); setAgroUnit(f.agroUnit); setAgroQty(f.agroQty); setAgroFrom(f.agroFrom);
      setPurpose(f.purpose as ClassifiedPurpose); setTitle(f.title); setDescription(f.description); setPrice(f.price); setBudgetMin(f.budgetMin); setBudgetMax(f.budgetMax);
      setSaleMode(f.saleMode as SaleMode | ""); setAcceptsTrade(f.acceptsTrade); setTradeWants(f.tradeWants); setAuctionDays(f.auctionDays); setCategoryId(f.categoryId);
      if (f.provinceId) setProvinceId(f.provinceId); if (f.municipalityId) setMunicipalityId(f.municipalityId); setMarketId(f.marketId); setVideoUrl(f.videoUrl);
      if (f.agentCode) setAgentCode(f.agentCode); setDirections(f.directions); setPoint(f.point);
      const ok: Photo[] = [];
      for (const ph of d.photos) { try { if ((await FileSystem.getInfoAsync(ph.uri)).exists) { ok.push({ key: ph.key, uri: ph.uri, mimeType: ph.mimeType }); copied.current.set(ph.uri, ph.uri); } } catch { /* fotografia perdida */ } }
      setPhotos(ok);
      setDraftNote(t("ls.form.draft_restored", { age: tc(draftAgeText(d.savedAt)) }) + (ok.length < d.photos.length ? " " + t("ls.form.draft_lost_photos") : ""));
    }
    setDraftReady(true);
  })(); }, []);
  const draftFields: ListingDraftFields = { listingType, isAgro, agroCat, agroUnit, agroQty, agroFrom, purpose, title, description, price, budgetMin, budgetMax, saleMode,
    acceptsTrade, tradeWants, auctionDays, categoryId, provinceId, municipalityId, marketId, videoUrl, agentCode, directions, point };
  const draftSnapshot = JSON.stringify([draftFields, photos.map(p => p.uri)]);
  async function persistDraft() {
    const out: ListingDraftPhoto[] = [];
    for (const ph of photos) {
      if (ph.remote) continue;
      let u = copied.current.get(ph.uri);
      if (!u) {
        try {
          await FileSystem.makeDirectoryAsync(DRAFT_DIR, { intermediates: true }).catch(() => {});
          u = DRAFT_DIR + Date.now() + "-" + out.length + ".jpg";
          await FileSystem.copyAsync({ from: ph.uri, to: u });
          copied.current.set(ph.uri, u); copied.current.set(u, u);
        } catch { continue; }
      }
      out.push({ key: ph.key, uri: u, mimeType: ph.mimeType });
    }
    await saveListingDraft(deviceStore, draftFields, out).catch(() => {});
  }
  useEffect(() => { if (editing || !draftReady) return; const t = setTimeout(() => void persistDraft(), 700); return () => clearTimeout(t); }, [draftSnapshot, draftReady]);
  async function discardDraft() {
    await clearListingDraft(deviceStore).catch(() => {}); await dropDraftFiles(); copied.current.clear();
    setTitle(""); setDescription(""); setPrice(""); setBudgetMin(""); setBudgetMax(""); setTradeWants(""); setDirections(""); setVideoUrl(""); setPoint(null); setPhotos([]);
    setDraftNote("");
  }
  async function draftDone() { await clearListingDraft(deviceStore).catch(() => {}); await dropDraftFiles(); }

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
    if (room <= 0) { setError(t("ls.form.max_photos", { n: CLASSIFIED_MAX_PHOTOS })); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(t("ls.form.perm_photos")); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 0.9 });
    if (result.canceled) return;
    // Fotografias mais leves: reduzidas no telemóvel antes de enviar (poupa dados).
    setStatus(t("ls.form.preparing"));
    const ready = await Promise.all(result.assets.slice(0, room).map(async a => ({ key: a.assetId ?? a.uri, ...(await shrinkAsset(a)) })));
    setStatus("");
    setPhotos(p => [...p, ...ready]);
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
    if (budgetError) { setError(tc(budgetError)); return; }
    const priceValue = wanted ? budgetPrice(minValue, maxValue) : parsePrice(price);
    if (purpose !== "wanted" && !conform) { setError(t("ls.form.confirm_truth")); return; }
    const invalid = validateClassifiedDraft({ listingType, purpose, title, description, price: priceValue, provinceId, municipalityId, photoCount: photos.length })
      ?? (lockedAuction ? null : validateSaleMode({ purpose, listingType, saleMode, price: priceValue, auctionDays: Number(auctionDays), tradeWants, acceptsTrade }));
    if (invalid) { setError(tc(invalid)); return; }
    const agroInvalid = useAgro ? validateAgro({ category: agroCat, unit: agroUnit, quantity: agroQty, availableFrom: agroFrom.trim() || null }) : null;
    if (agroInvalid) { setError(tc(agroInvalid)); return; }
    const mode = modes.length ? (saleMode || undefined) as SaleMode | undefined : undefined;
    const sale = lockedAuction ? { saleMode: "auction" as const, acceptsTrade: false } : { saleMode: mode, acceptsTrade: mode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade), tradeWants };
    setBusy(true);
    try {
      const c = supabase();
      const { data: { user } } = await c.auth.getUser();
      if (!user) { setError(t("ls.form.sign_in")); return; }
      const media: string[] = [];
      let n = 0;
      for (const photo of photos) {
        if (photo.remote) { media.push(photo.uri); continue; }
        n++; setStatus(t("ls.form.uploading", { n }));
        const body = photo.base64 ? base64ToArrayBuffer(photo.base64) : await (await fetch(photo.uri)).arrayBuffer();
        const ext = (photo.mimeType ?? "image/jpeg").split("/")[1] ?? "jpg";
        const up = await uploadClassifiedMedia(c, body, user.id, "foto." + ext, photo.mimeType ?? "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("Falha no envio da fotografia.");
        media.push(up.data);
      }
      setStatus(editing ? t("recover.saving") : t("ls.form.publishing"));
      const keep = Object.fromEntries(Object.entries((listing?.attributes ?? {}) as Record<string, unknown>).filter(([k]) => !["agro", "agroCategory", "unit", "quantity", "availableFrom", "provinceId", "municipalityId"].includes(k)));
      const attributes = { ...keep, ...(useAgro ? agroAttributes({ category: agroCat, unit: agroUnit, quantity: agroQty, availableFrom: agroFrom.trim() || null }) : {}) };
      const input = { attributes, listingType, purpose, title, description, price: priceValue, categoryId: categoryId || undefined, provinceId, municipalityId, marketId: marketId || undefined, videoUrl: videoUrl || undefined, budgetMin: minValue, budgetMax: maxValue, media, ...sale, directions, point, conformity: purpose !== "wanted" && conform };
      // O leilão começa logo depois de publicar (ou de guardar, ao mudar para leilão).
      const startAuction = async (id: string) => {
        if (mode !== "auction" || lockedAuction) return null;
        setStatus(t("ls.form.opening_auction"));
        const a = await startListingAuction(c, id, { startingPrice: priceValue ?? 0, days: Number(auctionDays) });
        return a.error ?? null;
      };
      if (editing) {
        const r = await updateClassifiedListing(c, listing.id, input);
        if (r.error) throw r.error;
        if (agentCode.trim()) { const ag = await setListingAgent(c, listing.id, agentCode); if (ag.error) throw ag.error; }
        if (removed.length) await removeClassifiedMedia(c, removed);
        const ae = await startAuction(listing.id); if (ae) throw ae;
        router.replace(("/classificados/" + listing.id) as any);
      } else {
        const r = await createAndPublishClassifiedListing(c, { ownerId: user.id, ...input, agentCode });
        if (r.error) {
          if (r.draftId) { await draftDone(); router.replace(("/meus-anuncios?erro=" + encodeURIComponent(friendlyErrorIn(r.error, lang))) as any); return; }
          throw r.error;
        }
        await draftDone();
        const ae = await startAuction((r.data as any).id);
        if (ae) { router.replace(("/meus-anuncios?erro=" + encodeURIComponent(t("ls.form.auction_failed", { error: friendlyErrorIn(ae, lang) }))) as any); return; }
        router.replace(("/classificados/" + (r.data as any).id) as any);
      }
    } catch (err) {
      if (!editing && isOfflineError(err)) { await persistDraft(); setError(tc(OFFLINE_PUBLISH_MESSAGE)); }
      else setError(friendlyErrorIn(err, lang, t("ls.form.publish_failed")));
    } finally { setBusy(false); setStatus(""); }
  }

  return <View style={{ gap: 14 }}>
    {!!draftNote && <View style={[ui.card, { gap: 8 }]}><Text style={ui.text}>{draftNote}</Text><Button title={t("ls.form.discard_draft")} variant="secondary" onPress={() => void discardDraft()} /></View>}
    {!editing && <Text style={ui.muted}>{t("ls.form.autosave")}</Text>}
    <Text style={ui.label}>{t("ls.explore.type")}</Text>
    <Chips options={typeOptions} value={listingType} onChange={setListingType} />
    <Text style={ui.label}>{t("ls.form.purpose")}</Text>
    <Chips options={purposeOptions} value={purpose} onChange={setPurpose} />
    {wanted && <Text style={ui.ok}>{t("ls.form.wanted_hint")}</Text>}
    <Text style={ui.label}>{wanted ? t("ls.form.what_wanted") : t("ls.form.title")}</Text>
    <TextInput style={ui.input} value={title} maxLength={140} onChangeText={setTitle} placeholder={wanted ? (listingType === "service" ? t("ls.form.ph_wanted_service") : t("ls.form.ph_wanted")) : t("ls.form.ph_title")} />
    <Text style={ui.label}>{t("ls.form.description")}</Text>
    <TextInput style={[ui.input, ui.area]} multiline value={description} onChangeText={setDescription} placeholder={wanted ? t("ls.form.ph_desc_wanted") : t("ls.form.ph_desc")} />
    {agroAllowed && <View style={[ui.card, { gap: 8 }]}>
      <Text style={ui.h2}>🌾 {t("more.agri")}</Text>
      <Chips options={[{ value: "yes" as const, label: t("ls.form.is_agro") }, { value: "no" as const, label: t("ls.no") }]} value={isAgro ? "yes" : "no"} onChange={v => setIsAgro(v === "yes")} />
      <Text style={ui.muted}>{t("ls.form.agro_hint")}</Text>
      {isAgro && <>
        <Text style={ui.label}>{t("ls.explore.type")}</Text>
        <Chips options={AGRO_CATEGORIES.map(c => ({ value: c.value as string, label: c.icon + " " + tc(c.label).replace(/ \(.*\)$/, "") }))} value={agroCat} onChange={setAgroCat} />
        <Text style={ui.label}>{t("ls.form.sold_by")}</Text>
        <Chips options={AGRO_UNITS.map(u => ({ value: u.value as string, label: tc(u.label) }))} value={agroUnit} onChange={setAgroUnit} />
        <Text style={ui.label}>{t("ls.form.qty_opt")}</Text>
        <TextInput style={ui.input} keyboardType="decimal-pad" value={agroQty} onChangeText={setAgroQty} placeholder={t("ls.form.ph_qty", { unit: tc(agroUnitInfo(agroUnit)?.plural ?? "") })} placeholderTextColor={C.muted} accessibilityLabel={t("ls.form.qty")} />
        <Text style={ui.label}>{t("ls.form.from_opt")}</Text>
        <TextInput style={ui.input} value={agroFrom} onChangeText={setAgroFrom} placeholder={t("ls.form.ph_date")} placeholderTextColor={C.muted} accessibilityLabel={t("ls.form.from")} />
      </>}
    </View>}
    {wanted ? <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1, gap: 6 }}><Text style={ui.label}>{t("ls.form.budget_from")}</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={budgetMin} onChangeText={setBudgetMin} placeholder="20 000" /></View>
      <View style={{ flex: 1, gap: 6 }}><Text style={ui.label}>{t("ls.form.budget_to")}</Text><TextInput style={ui.input} keyboardType="decimal-pad" value={budgetMax} onChangeText={setBudgetMax} placeholder="25 000" /></View>
    </View> : <>
      {modes.length > 0 && <View style={{ gap: 8 }}>
        <Text style={ui.h2}>{t("ls.form.how_sell")}</Text>
        {modes.map(m => <Pressable key={m} accessibilityRole="radio" accessibilityState={{ checked: saleMode === m }} onPress={() => setSaleMode(m)}
          style={{ borderWidth: 2, borderColor: saleMode === m ? C.blue : C.line, backgroundColor: saleMode === m ? C.blueSoft : C.white, borderRadius: 14, padding: 12, gap: 2 }}>
          <Text style={ui.label}>{saleMode === m ? "◉ " : "○ "}{SALE_MODE_INFO[m].icon} {tc(SALE_MODE_INFO[m].label)}</Text>
          <Text style={ui.muted}>{tc(SALE_MODE_INFO[m].help)}</Text>
        </Pressable>)}
      </View>}
      {lockedAuction && <Text style={ui.label}>{t("ls.form.in_auction")}</Text>}
      <Text style={ui.label}>{saleMode === "auction" ? t("ls.form.price_auction") : saleMode === "offers" || saleMode === "trade" ? t("ls.form.price_ref") : useAgro ? t("ls.form.price_per", { unit: agroUnitInfo(agroUnit)?.short ? tc(agroUnitInfo(agroUnit)!.short) : t("ls.form.unit") }) : t("ls.form.price")}</Text>
      <TextInput style={ui.input} keyboardType="decimal-pad" value={price} onChangeText={setPrice} placeholder={saleMode === "fixed" || saleMode === "negotiable" || saleMode === "auction" ? t("ls.form.ph_price") : t("ls.form.ph_price_empty")} />
      {saleMode === "auction" && !lockedAuction && <><Text style={ui.label}>{t("ls.form.auction_length")}</Text>
        <Chips options={["1", "3", "5", "7", "10", "14"].map(d => ({ value: d, label: d === "1" ? t("ls.form.day") : t("ls.form.days", { n: d }) }))} value={auctionDays} onChange={setAuctionDays} /></>}
      {canAlsoTrade(purpose, saleMode) && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptsTrade }} onPress={() => setAcceptsTrade(!acceptsTrade)} style={[ui.row, { alignItems: "center" }]}>
        <Text style={{ fontSize: 26 }}>{acceptsTrade ? "☑" : "☐"}</Text><Text style={ui.label}>{t("ls.form.also_trade")}</Text></Pressable>}
      {(saleMode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade)) && <>
        <Text style={ui.label}>{t("ls.form.trade_what")}</Text>
        <TextInput style={ui.input} value={tradeWants} maxLength={300} onChangeText={setTradeWants} placeholder={t("ls.form.ph_trade")} /></>}
    </>}
    <Text style={ui.label}>{t("ls.explore.category")}</Text>
    <Chips options={[{ value: "", label: t("ls.form.no_category") }, ...categories.map(c => ({ value: c.id, label: categoryLabelIn(c.name, lang) }))]} value={categoryId} onChange={setCategoryId} />
    <Text style={ui.label}>{t("ls.explore.province")}</Text>
    <Chips options={provinces.map(p => ({ value: p.id, label: p.name }))} value={provinceId} onChange={v => { setProvinceId(v); setMunicipalityId(""); }} />
    <Text style={ui.label}>{t("auth.municipality")}</Text>
    {provinceId ? <Chips options={municipalities.map(m => ({ value: m.id, label: m.name }))} value={municipalityId} onChange={setMunicipalityId} /> : <Text style={ui.muted}>{t("ls.form.province_first")}</Text>}
    <MarketPicker value={marketId} onChange={setMarketId} />
    {purpose !== "wanted" && <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} approximate />}
    <VideoField value={videoUrl} onChange={setVideoUrl} />
    {purpose !== "wanted" && <AgentCodeField value={agentCode} onChange={setAgentCode} />}
    {purpose !== "wanted" && <ConformityCheck checked={conform} onChange={setConform} />}
    <Text style={ui.label}>{t("ls.form.photos", { n: photos.length, max: CLASSIFIED_MAX_PHOTOS })}</Text>
    <Button title={t("ls.form.pick_photos")} variant="secondary" onPress={() => void pickPhotos()} disabled={busy || photos.length >= CLASSIFIED_MAX_PHOTOS} />
    <View style={ui.row}>
      {photos.map((p, i) => <View key={p.key} style={{ width: 104, gap: 6 }}>
        <Image source={{ uri: p.uri }} style={{ width: 104, height: 104, borderRadius: 8, backgroundColor: C.surface }} accessibilityLabel={t("ls.form.photo_n", { n: i + 1 })} />
        <Pressable accessibilityRole="button" onPress={() => removePhoto(i)} style={[ui.buttonSecondary, { minHeight: 40 }]}><Text style={ui.buttonSecondaryText}>{t("ls.remove")}</Text></Pressable>
      </View>)}
    </View>
    <Message error={error} ok={status} />
    <Button title={busy ? (status || t("login.wait")) : editing ? t("account.save_changes") : t("ls.publish.title")} onPress={() => void submit()} disabled={busy} />
  </View>;
}
