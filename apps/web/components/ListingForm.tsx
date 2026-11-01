"use client";
import { useEffect, useState } from "react";
import { MarketPicker } from "./MarketPicker";
import { DetailFields } from "./ListingDetails";
import { AiImprove } from "./AiImprove";
import { PhotoFillButton, PriceHintNote } from "./AiTools";
import { PlaceFields } from "./Place";
import { ConformityCheck } from "./Conformity";
import { VideoField } from "./Video";
import { AgentCodeField, agentCodeFromUrl } from "./Agents";
import { listMunicipalities, listProvinces, validateClassifiedDraft, parsePrice, uploadClassifiedMedia, removeClassifiedMedia,
  createAndPublishClassifiedListing, updateClassifiedListing, isJobCategorySlug, detailValuesFrom, validateDetails, buildDetailAttributes, withoutDetailKeys, setListingAgent, pointFrom, type GeoPoint, friendlyErrorIn, categoryLabelIn, listingTerritory,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, CLASSIFIED_MAX_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES, PHOTO_RAW_MAX_BYTES, validateBudget, budgetPrice,
  saleModesFor, saleModeFromParam, canAlsoTrade, validateSaleMode, startListingAuction, SALE_MODE_INFO, type SaleMode, readAgro, validateAgro, agroAttributes, agroUnitInfo, AGRO_CATEGORIES, AGRO_UNITS,
  loadListingDraft, saveListingDraft, clearListingDraft, draftAgeText, isOfflineError, OFFLINE_PUBLISH_MESSAGE, type ListingDraftFields } from "@huambo-online/core";
import { browserStore } from "./Engage";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
import { supabase } from "../lib/supabase";
import { compressPhoto } from "../lib/image";
import { useT } from "../lib/i18n";

type Option = { id: string; name: string; slug?: string };
type Photo = { key: string; src: string; file?: File };

export function ListingForm({ listing, initialPurpose, initialSaleMode, initialCategorySlug, initialListingType }: { listing?: any; initialPurpose?: ClassifiedPurpose; initialSaleMode?: string; initialCategorySlug?: string; initialListingType?: ClassifiedListingType }) {
  const { lang, t, tc } = useT();
  const editing = Boolean(listing);
  const territory = listingTerritory(listing);
  const [listingType, setListingType] = useState<ClassifiedListingType>(listing?.listing_type ?? initialListingType ?? "classified");
  const [purpose, setPurpose] = useState<ClassifiedPurpose>(listing?.purpose ?? initialPurpose ?? "sale");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [budgetMin, setBudgetMin] = useState(listing?.budget_min != null ? String(listing.budget_min) : "");
  const [budgetMax, setBudgetMax] = useState(listing?.budget_max != null ? String(listing.budget_max) : "");
  const wanted = purpose === "wanted";
  // Produto do campo (agricultura, gado, insumos): unidade, quantidade e «disponível a partir de».
  const agro0 = readAgro(listing?.attributes);
  const [isAgro, setIsAgro] = useState<boolean>(!!agro0);
  const [agroCat, setAgroCat] = useState<string>(agro0?.category ?? "");
  const [agroUnit, setAgroUnit] = useState<string>(agro0?.unit ?? "kg");
  const [agroQty, setAgroQty] = useState<string>(agro0?.quantity ? String(agro0.quantity) : "");
  const [agroFrom, setAgroFrom] = useState<string>(agro0?.availableFrom ?? "");
  useEffect(() => { if (!listing && new URLSearchParams(window.location.search).has("campo")) { setIsAgro(true); setListingType("product"); } }, []);
  const agroAllowed = listingType !== "real_estate";
  const useAgro = isAgro && agroAllowed;
  // Como vende: preço fixo, negociável, propostas, leilão ou troca (escolhido ao publicar).
  const lockedAuction = listing?.purpose === "auction";
  const [saleMode, setSaleMode] = useState<SaleMode | "">(listing?.sale_mode ?? saleModeFromParam(initialSaleMode));
  const [acceptsTrade, setAcceptsTrade] = useState<boolean>(!!listing?.accepts_trade);
  const [tradeWants, setTradeWants] = useState<string>(listing?.trade_wants ?? "");
  const [auctionDays, setAuctionDays] = useState("7");
  const modes = lockedAuction ? [] : saleModesFor(purpose, listingType);
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [provinceId, setProvinceId] = useState(territory.provinceId ?? "");
  const [municipalityId, setMunicipalityId] = useState(territory.municipalityId ?? "");
  const [marketId, setMarketId] = useState<string>(listing?.market_id ?? "");
  const [videoUrl, setVideoUrl] = useState<string>(listing?.video_url ?? "");
  const [agentCode, setAgentCode] = useState("");
  const [directions, setDirections] = useState<string>(listing?.directions ?? "");
  const [conform, setConform] = useState<boolean>(!!listing?.conformity_accepted_at);
  const [point, setPoint] = useState<GeoPoint | null>(pointFrom(listing?.geo_lat, listing?.geo_lng));
  useEffect(() => { if (!listing) { const c = agentCodeFromUrl(); if (c) setAgentCode(c); } }, []);
  const [photos, setPhotos] = useState<Photo[]>(() => (Array.isArray(listing?.media) ? listing.media : []).map((u: string) => ({ key: u, src: u })));
  const [removed, setRemoved] = useState<string[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  /** Viaturas e imóveis: marca, modelo, ano… / tipo, área, quartos… */
  const [details, setDetails] = useState<Record<string, string>>(detailValuesFrom(listing?.attributes));
  /** Vaga de emprego ou estágio: o preço é o salário e não há «como vende». */
  const catSlug = categories.find(c => c.id === categoryId)?.slug;
  const isJob = isJobCategorySlug(catSlug);
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // Rascunho guardado no navegador (só o texto; as fotografias não ficam guardadas aqui).
  const [draftNote, setDraftNote] = useState(""); const [draftReady, setDraftReady] = useState(editing);
  useEffect(() => { if (editing) return; void (async () => {
    const d = await loadListingDraft(browserStore).catch(() => null);
    if (d) {
      const f = d.fields;
      setListingType(f.listingType as ClassifiedListingType); setIsAgro(f.isAgro); setAgroCat(f.agroCat); setAgroUnit(f.agroUnit); setAgroQty(f.agroQty); setAgroFrom(f.agroFrom);
      setPurpose(f.purpose as ClassifiedPurpose); setTitle(f.title); setDescription(f.description); setPrice(f.price); setBudgetMin(f.budgetMin); setBudgetMax(f.budgetMax);
      setSaleMode(f.saleMode as SaleMode | ""); setAcceptsTrade(f.acceptsTrade); setTradeWants(f.tradeWants); setAuctionDays(f.auctionDays); setCategoryId(f.categoryId);
      if (f.provinceId) setProvinceId(f.provinceId); if (f.municipalityId) setMunicipalityId(f.municipalityId); setMarketId(f.marketId); setVideoUrl(f.videoUrl);
      if (f.agentCode) setAgentCode(f.agentCode); setDirections(f.directions); setPoint(f.point);
      setDraftNote("📝 " + t("ls.draft_recovered", { age: tc(draftAgeText(d.savedAt)) }));
    }
    setDraftReady(true);
  })(); }, []);
  const draftFields: ListingDraftFields = { listingType, isAgro, agroCat, agroUnit, agroQty, agroFrom, purpose, title, description, price, budgetMin, budgetMax, saleMode,
    acceptsTrade, tradeWants, auctionDays, categoryId, provinceId, municipalityId, marketId, videoUrl, agentCode, directions, point };
  const draftSnapshot = JSON.stringify(draftFields);
  useEffect(() => { if (editing || !draftReady) return; const tm = setTimeout(() => void saveListingDraft(browserStore, draftFields).catch(() => {}), 700); return () => clearTimeout(tm); }, [draftSnapshot, draftReady]);
  async function discardDraft() {
    await clearListingDraft(browserStore).catch(() => {});
    setTitle(""); setDescription(""); setPrice(""); setBudgetMin(""); setBudgetMax(""); setTradeWants(""); setDirections(""); setVideoUrl(""); setPoint(null); setDraftNote("");
  }

  useEffect(() => {
    const c = supabase();
    void c.from("categories").select("id,name,slug").eq("type", "classified").eq("active", true).order("name").then(({ data }) => {
      const list = (data ?? []) as Option[]; setCategories(list);
      // «?categoria=emprego»: a categoria vem escolhida; nas vagas de emprego o anúncio é um «Serviço».
      const pre = !listing && initialCategorySlug ? list.find(x => x.slug === initialCategorySlug) : undefined;
      if (pre) { setCategoryId(pre.id); if (isJobCategorySlug(pre.slug)) { setListingType("classified"); setPurpose("service"); } }
    });
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

  async function addFiles(files: FileList | null) {
    setError("");
    const chosen = Array.from(files ?? []);
    const images = chosen.filter(f => f.type.startsWith("image/"));
    const room = CLASSIFIED_MAX_PHOTOS - photos.length;
    const usable = images.filter(f => f.size <= PHOTO_RAW_MAX_BYTES).slice(0, Math.max(0, room));
    // Fotografias mais leves: reduzidas aqui antes de enviar (poupa dados a quem publica e a quem vê).
    setStatus(t("ls.photos_preparing"));
    const ready = await Promise.all(usable.map(f => compressPhoto(f)));
    setStatus("");
    const ok = ready.filter(f => f.size <= CLASSIFIED_MAX_PHOTO_BYTES);
    if (images.length < chosen.length) setError(t("ls.only_images"));
    else if (images.length > room) setError(t("ls.max_photos", { n: CLASSIFIED_MAX_PHOTOS }));
    else if (ok.length < images.length) setError(t("ls.photos_too_big"));
    setPhotos(p => [...p, ...ok.map(f => ({ key: crypto.randomUUID(), src: URL.createObjectURL(f), file: f }))]);
  }

  function removePhoto(i: number) {
    setPhotos(p => {
      const photo = p[i];
      if (photo.file) URL.revokeObjectURL(photo.src); else setRemoved(r => [...r, photo.src]);
      return p.filter((_, j) => j !== i);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    const minValue = wanted ? parsePrice(budgetMin) : undefined, maxValue = wanted ? parsePrice(budgetMax) : undefined;
    const budgetError = wanted ? validateBudget(minValue, maxValue) : null;
    if (budgetError) { setError(tc(budgetError)); return; }
    const priceValue = wanted ? budgetPrice(minValue, maxValue) : parsePrice(price);
    if (purpose !== "wanted" && !conform) { setError(t("ls.need_conformity")); return; }
    const invalid = validateClassifiedDraft({ listingType, purpose, title, description, price: priceValue, provinceId, municipalityId, photoCount: photos.length })
      ?? (lockedAuction ? null : validateSaleMode({ purpose, listingType, saleMode, price: priceValue, auctionDays: Number(auctionDays), tradeWants, acceptsTrade }));
    if (invalid) { setError(tc(invalid)); return; }
    const agroInvalid = useAgro ? validateAgro({ category: agroCat, unit: agroUnit, quantity: agroQty, availableFrom: agroFrom }) : null;
    if (agroInvalid) { setError(tc(agroInvalid)); return; }
    const detailsInvalid = !wanted ? validateDetails(listingType, details, catSlug) : null;
    if (detailsInvalid) { setError(t(detailsInvalid)); return; }
    const mode = modes.length ? (saleMode || undefined) as SaleMode | undefined : undefined;
    const sale = lockedAuction ? { saleMode: "auction" as const, acceptsTrade: false } : { saleMode: mode, acceptsTrade: mode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade), tradeWants };
    setBusy(true);
    try {
      const c = supabase();
      const { data: { user } } = await c.auth.getUser();
      if (!user) { setError(t("ls.login_to_publish")); return; }
      const media: string[] = [];
      let n = 0;
      for (const photo of photos) {
        if (!photo.file) { media.push(photo.src); continue; }
        n++; setStatus(t("ls.uploading_photo", { n }));
        const up = await uploadClassifiedMedia(c, photo.file, user.id, photo.file.name, photo.file.type);
        if (up.error || !up.data) throw up.error ?? new Error(t("ls.photo_upload_failed"));
        media.push(up.data);
      }
      setStatus(editing ? t("recover.saving") : t("ls.publishing"));
      // Mantém outros atributos já guardados; os do campo só ficam se «Produto do campo» estiver ligado.
      const keep = Object.fromEntries(Object.entries((listing?.attributes ?? {}) as Record<string, unknown>).filter(([k]) => !["agro", "agroCategory", "unit", "quantity", "availableFrom", "provinceId", "municipalityId"].includes(k)));
      const attributes = { ...withoutDetailKeys(keep), ...(!wanted ? buildDetailAttributes(listingType, details, catSlug) : {}), ...(useAgro ? agroAttributes({ category: agroCat, unit: agroUnit, quantity: agroQty, availableFrom: agroFrom }) : {}) };
      const input = { attributes, listingType, purpose, title, description, price: priceValue, categoryId: categoryId || undefined, provinceId, municipalityId, marketId: marketId || undefined, videoUrl: videoUrl || undefined, budgetMin: minValue, budgetMax: maxValue, media, ...sale, directions, point, conformity: purpose !== "wanted" && conform };
      // O leilão começa logo depois de publicar (ou de guardar, ao mudar para leilão).
      const startAuction = async (id: string) => {
        if (mode !== "auction" || lockedAuction) return null;
        setStatus(t("ls.opening_auction"));
        const a = await startListingAuction(c, id, { startingPrice: priceValue ?? 0, days: Number(auctionDays) });
        return a.error ?? null;
      };
      if (editing) {
        const r = await updateClassifiedListing(c, listing.id, input);
        if (r.error) throw r.error;
        if (agentCode.trim()) { const ag = await setListingAgent(c, listing.id, agentCode); if (ag.error) throw ag.error; }
        if (removed.length) await removeClassifiedMedia(c, removed);
        const ae = await startAuction(listing.id); if (ae) throw ae;
        window.location.href = "/classificados/" + listing.id;
      } else {
        const r = await createAndPublishClassifiedListing(c, { ownerId: user.id, ...input, agentCode });
        if (r.error) {
          if (r.draftId) { await clearListingDraft(browserStore).catch(() => {}); window.location.href = "/meus-anuncios?erro=" + encodeURIComponent(friendlyErrorIn(r.error, lang)); return; }
          throw r.error;
        }
        await clearListingDraft(browserStore).catch(() => {});
        const ae = await startAuction((r.data as any).id);
        if (ae) { window.location.href = "/meus-anuncios?erro=" + encodeURIComponent(t("ls.published_no_auction") + " " + friendlyErrorIn(ae, lang)); return; }
        window.location.href = "/classificados/" + (r.data as any).id;
      }
    } catch (err) {
      if (!editing && isOfflineError(err)) { await saveListingDraft(browserStore, draftFields).catch(() => {}); setError(tc(OFFLINE_PUBLISH_MESSAGE)); }
      else setError(friendlyErrorIn(err, lang, t("ls.publish_failed")));
    } finally { setBusy(false); setStatus(""); }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      {draftNote && <div className="card stack" role="status" style={{ gap: 8 }}><span>{draftNote}</span><button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void discardDraft()}>🗑️ {t("ls.draft_discard")}</button></div>}
      {!editing && <small className="muted">💾 {t("ls.draft_note")}</small>}
      <label>{t("ls.type")}
        <select value={listingType} onChange={e => setListingType(e.target.value as ClassifiedListingType)}>
          {Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}
        </select>
      </label>
      <label>{t("ls.purpose")}
        <select value={purpose} onChange={e => setPurpose(e.target.value as ClassifiedPurpose)}>
          {PUBLISHABLE_PURPOSES.map(v => <option key={v} value={v}>{tc(PURPOSE_LABELS[v])}</option>)}
        </select>
      </label>
      {wanted && <p className="ok" style={{ margin: 0 }}>🔎 {t("ls.wanted_intro")}</p>}
      <label>{wanted ? t("ls.what_looking") : t("ls.title")}<input value={title} maxLength={140} onChange={e => setTitle(e.target.value)} placeholder={wanted ? (listingType === "service" ? t("ls.ph_wanted_service") : t("ls.ph_wanted_item")) : t("ls.ph_title")} /></label>
      <label>{t("ls.description")}<textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} placeholder={wanted ? t("ls.ph_wanted_desc") : t("ls.ph_desc")} /></label>
      {!wanted && <AiImprove input={{ title, description, listingType, purpose, category: categories.find(c => c.id === categoryId)?.name, categorySlug: catSlug, details }} onApply={(nt, nd) => { setTitle(nt); setDescription(nd); }} />}
      {listingType === "real_estate" && (purpose === "rent" || purpose === "lease") && <p className="ok" style={{ margin: 0 }}>{t("ls.rent_free_badge")}</p>}
      {!wanted && <DetailFields listingType={listingType} categorySlug={catSlug} values={details} onChange={setDetails} />}
      {agroAllowed && <fieldset className="stack" style={{ border: "2px solid var(--line)", borderRadius: 12, padding: 14 }}>
        <legend style={{ fontWeight: 700 }}>🌾 {t("ft.farming")}</legend>
        <label className="check"><input type="checkbox" checked={isAgro} onChange={e => setIsAgro(e.target.checked)} /> {t("ls.is_agro")}</label>
        {isAgro && <>
          <label>{t("ls.type")}<select value={agroCat} onChange={e => setAgroCat(e.target.value)}><option value="">{t("ls.choose")}</option>{AGRO_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {tc(c.label)}</option>)}</select></label>
          <label>{t("ls.sells_by")}<select value={agroUnit} onChange={e => setAgroUnit(e.target.value)}>{AGRO_UNITS.map(u => <option key={u.value} value={u.value}>{tc(u.label)}</option>)}</select></label>
          <label>{t("ls.qty_available")}<input value={agroQty} onChange={e => setAgroQty(e.target.value)} inputMode="decimal" placeholder={t("ls.ph_qty", { unit: tc(agroUnitInfo(agroUnit)?.plural ?? "") })} /></label>
          <label>{t("ls.available_from")}<input type="date" value={agroFrom} onChange={e => setAgroFrom(e.target.value)} /></label>
        </>}
      </fieldset>}
      {wanted ? <div className="row" style={{ flexWrap: "nowrap" }}>
        <label style={{ flex: 1 }}>{t("ls.budget_from")}<input value={budgetMin} onChange={e => setBudgetMin(e.target.value)} inputMode="decimal" placeholder={t("ls.ex_20000")} /></label>
        <label style={{ flex: 1 }}>{t("ls.budget_to")}<input value={budgetMax} onChange={e => setBudgetMax(e.target.value)} inputMode="decimal" placeholder={t("ls.ex_25000")} /></label>
      </div> : <>
        {modes.length > 0 && !isJob && <fieldset className="stack sale-modes">
          <legend>{t("ls.how_sell")}</legend>
          {modes.map(m => <label key={m} className={"mode" + (saleMode === m ? " on" : "")}>
            <input type="radio" name="sale_mode" value={m} checked={saleMode === m} onChange={() => setSaleMode(m)} />
            <span><strong>{SALE_MODE_INFO[m].icon} {tc(SALE_MODE_INFO[m].label)}</strong><small>{tc(SALE_MODE_INFO[m].help)}</small></span>
          </label>)}
        </fieldset>}
        {lockedAuction && <p className="badge">🔨 {t("ls.in_auction")}</p>}
        <label>{isJob ? t("job.salary_field") : saleMode === "auction" ? t("ls.price_auction_start") : saleMode === "offers" || saleMode === "trade" ? t("ls.price_reference") : useAgro ? t("ls.price_per", { unit: agroUnitInfo(agroUnit)?.short ? tc(agroUnitInfo(agroUnit)!.short) : t("ls.unit") }) : t("ls.price_kz")}
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder={saleMode === "fixed" || saleMode === "negotiable" || saleMode === "auction" ? t("ls.ex_85000") : t("ls.ph_price_empty")} /></label>
        {!isJob && !useAgro && <PriceHintNote categoryId={categoryId} listingType={listingType} purpose={purpose} />}
        {saleMode === "auction" && !lockedAuction && <label>{t("ls.auction_duration")}
          <select value={auctionDays} onChange={e => setAuctionDays(e.target.value)}>{[1, 3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{t("ls.n_days_s", { n: d })}</option>)}</select></label>}
        {canAlsoTrade(purpose, saleMode) && <label className="check"><input type="checkbox" checked={acceptsTrade} onChange={e => setAcceptsTrade(e.target.checked)} /> 🔁 {t("ls.also_trade")}</label>}
        {(saleMode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade)) && <label>{t("ls.trade_wants")}<input value={tradeWants} maxLength={300} onChange={e => setTradeWants(e.target.value)} placeholder={t("ls.ph_trade_wants")} /></label>}
      </>}
      <label>{t("ls.category")}
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">{t("ls.no_category")}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{categoryLabelIn(c.name, lang)}</option>)}
        </select>
      </label>
      <label>{t("ls.province")}
        <select value={provinceId} onChange={e => { setProvinceId(e.target.value); setMunicipalityId(""); }}>
          <option value="">{t("ls.choose_province")}</option>
          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>{t("auth.municipality")}
        <select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)} disabled={!provinceId}>
          <option value="">{t("ls.choose_municipality")}</option>
          {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <MarketPicker value={marketId} onChange={setMarketId} />
      {purpose !== "wanted" && <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} approximate />}
      <fieldset className="stack" style={{ border: "2px solid #ddd", borderRadius: 12, padding: 14 }}>
        <legend style={{ fontWeight: 700 }}>{t("ls.photos_count", { n: photos.length, max: CLASSIFIED_MAX_PHOTOS })}</legend>
        <input type="file" accept="image/*" multiple disabled={photos.length >= CLASSIFIED_MAX_PHOTOS} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} aria-label={t("ls.select_photos")} />
        {!wanted && photos.length > 0 && <PhotoFillButton categories={categories.map(c => ({ slug: (c as any).slug, name: c.name }))}
          getImage={async () => { const p0 = photos[0]; if (!p0) return null; return p0.file ?? await fetch(p0.src).then(r => r.blob()); }}
          onApply={f => {
            if (!title.trim()) setTitle(f.title);
            if (!description.trim()) setDescription(f.description);
            if (f.listingType && !editing) setListingType(f.listingType as ClassifiedListingType);
            const cat = f.categorySlug ? categories.find(c => (c as any).slug === f.categorySlug) : null;
            if (cat && !categoryId) setCategoryId(cat.id);
            setDetails(d => ({ ...f.details, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) }));
          }} />}
        <div className="row">
          {photos.map((p, i) => (
            <div key={p.key} style={{ display: "grid", gap: 6, width: 120 }}>
              <img src={p.src} alt={t("ls.photo_n", { n: i + 1 })} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }} />
              <button type="button" className="secondary" onClick={() => removePhoto(i)}>{t("ls.remove")}</button>
            </div>
          ))}
        </div>
      </fieldset>
      <VideoField value={videoUrl} onChange={setVideoUrl} />
      {purpose !== "wanted" && <AgentCodeField value={agentCode} onChange={setAgentCode} />}
      {purpose !== "wanted" && <ConformityCheck checked={conform} onChange={setConform} />}
      {error && <p className="error" role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <button type="submit" disabled={busy}>{busy ? (status || t("login.wait")) : editing ? t("acct.save_changes") : t("ls.publish_listing")}</button>
    </form>
  );
}
