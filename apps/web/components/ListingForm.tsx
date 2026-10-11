"use client";
import { useEffect, useState } from "react";
import { MarketPicker } from "./MarketPicker";
import { VideoField } from "./Video";
import { listMunicipalities, listProvinces, validateClassifiedDraft, parsePrice, uploadClassifiedMedia, removeClassifiedMedia,
  createAndPublishClassifiedListing, updateClassifiedListing, friendlyError, listingTerritory,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, CLASSIFIED_MAX_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES, validateBudget, budgetPrice,
  saleModesFor, saleModeFromParam, canAlsoTrade, validateSaleMode, startListingAuction, SALE_MODE_INFO, type SaleMode } from "@huambo-online/core";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
import { supabase } from "../lib/supabase";

type Option = { id: string; name: string };
type Photo = { key: string; src: string; file?: File };

export function ListingForm({ listing, initialPurpose, initialSaleMode }: { listing?: any; initialPurpose?: ClassifiedPurpose; initialSaleMode?: string }) {
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
  const [photos, setPhotos] = useState<Photo[]>(() => (Array.isArray(listing?.media) ? listing.media : []).map((u: string) => ({ key: u, src: u })));
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

  function addFiles(files: FileList | null) {
    setError("");
    const chosen = Array.from(files ?? []);
    const images = chosen.filter(f => f.type.startsWith("image/"));
    const tooBig = images.filter(f => f.size > CLASSIFIED_MAX_PHOTO_BYTES);
    const ok = images.filter(f => f.size <= CLASSIFIED_MAX_PHOTO_BYTES);
    const room = CLASSIFIED_MAX_PHOTOS - photos.length;
    if (tooBig.length) setError(`${tooBig.length} fotografia(s) com mais de 5 MB foram ignoradas.`);
    else if (images.length < chosen.length) setError("Só são aceites imagens.");
    if (ok.length > room) setError(`Pode juntar no máximo ${CLASSIFIED_MAX_PHOTOS} fotografias.`);
    setPhotos(p => [...p, ...ok.slice(0, Math.max(0, room)).map(f => ({ key: crypto.randomUUID(), src: URL.createObjectURL(f), file: f }))]);
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
        if (!photo.file) { media.push(photo.src); continue; }
        n++; setStatus(`A enviar fotografia ${n}…`);
        const up = await uploadClassifiedMedia(c, photo.file, user.id, photo.file.name, photo.file.type);
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
        window.location.href = "/classificados/" + listing.id;
      } else {
        const r = await createAndPublishClassifiedListing(c, { ownerId: user.id, ...input });
        if (r.error) {
          if (r.draftId) { window.location.href = "/meus-anuncios?erro=" + encodeURIComponent(friendlyError(r.error)); return; }
          throw r.error;
        }
        const ae = await startAuction((r.data as any).id);
        if (ae) { window.location.href = "/meus-anuncios?erro=" + encodeURIComponent("o anúncio foi publicado, mas o leilão não abriu: " + friendlyError(ae)); return; }
        window.location.href = "/classificados/" + (r.data as any).id;
      }
    } catch (err) {
      setError(friendlyError(err, "Não foi possível publicar o anúncio."));
    } finally { setBusy(false); setStatus(""); }
  }

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <label>Tipo
        <select value={listingType} onChange={e => setListingType(e.target.value as ClassifiedListingType)}>
          {Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Finalidade
        <select value={purpose} onChange={e => setPurpose(e.target.value as ClassifiedPurpose)}>
          {PUBLISHABLE_PURPOSES.map(v => <option key={v} value={v}>{PURPOSE_LABELS[v]}</option>)}
        </select>
      </label>
      {wanted && <p className="ok" style={{ margin: 0 }}>🔎 Pedido de comprador: diga o que procura e quanto pode pagar. Os vendedores e profissionais com artigos ou serviços parecidos são avisados.</p>}
      <label>{wanted ? "O que procura?" : "Título"}<input value={title} maxLength={140} onChange={e => setTitle(e.target.value)} placeholder={wanted ? (listingType === "service" ? "Ex.: Procuro um eletricista para instalação" : "Ex.: Preciso de um Router 5G da Unitel") : "Ex.: Toyota Hilux 2018"} /></label>
      <label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} placeholder={wanted ? "Pormenores: estado, marca, zona, quando precisa…" : "Estado, características, como entregar…"} /></label>
      {wanted ? <div className="row" style={{ flexWrap: "nowrap" }}>
        <label style={{ flex: 1 }}>Orçamento de (Kz)<input value={budgetMin} onChange={e => setBudgetMin(e.target.value)} inputMode="decimal" placeholder="Ex.: 20 000" /></label>
        <label style={{ flex: 1 }}>até (Kz)<input value={budgetMax} onChange={e => setBudgetMax(e.target.value)} inputMode="decimal" placeholder="Ex.: 25 000" /></label>
      </div> : <>
        {modes.length > 0 && <fieldset className="stack sale-modes">
          <legend>Como quer vender?</legend>
          {modes.map(m => <label key={m} className={"mode" + (saleMode === m ? " on" : "")}>
            <input type="radio" name="sale_mode" value={m} checked={saleMode === m} onChange={() => setSaleMode(m)} />
            <span><strong>{SALE_MODE_INFO[m].icon} {SALE_MODE_INFO[m].label}</strong><small>{SALE_MODE_INFO[m].help}</small></span>
          </label>)}
        </fieldset>}
        {lockedAuction && <p className="badge">🔨 Este anúncio está em leilão.</p>}
        <label>{saleMode === "auction" ? "Preço inicial do leilão (Kz)" : saleMode === "offers" || saleMode === "trade" ? "Preço de referência (Kz, opcional)" : "Preço (Kz)"}
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder={saleMode === "fixed" || saleMode === "negotiable" || saleMode === "auction" ? "Ex.: 85 000" : "Deixe vazio para «sob consulta»"} /></label>
        {saleMode === "auction" && !lockedAuction && <label>Duração do leilão
          <select value={auctionDays} onChange={e => setAuctionDays(e.target.value)}>{[1, 3, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d} dia{d > 1 ? "s" : ""}</option>)}</select></label>}
        {canAlsoTrade(purpose, saleMode) && <label className="check"><input type="checkbox" checked={acceptsTrade} onChange={e => setAcceptsTrade(e.target.checked)} /> 🔁 Também aceito troca</label>}
        {(saleMode === "trade" || (canAlsoTrade(purpose, saleMode) && acceptsTrade)) && <label>O que aceita em troca?<input value={tradeWants} maxLength={300} onChange={e => setTradeWants(e.target.value)} placeholder="Ex.: telemóvel Android, motorizada, ou diga «estou aberto a ofertas»" /></label>}
      </>}
      <label>Categoria
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>Província
        <select value={provinceId} onChange={e => { setProvinceId(e.target.value); setMunicipalityId(""); }}>
          <option value="">Escolha a província</option>
          {provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label>Município
        <select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)} disabled={!provinceId}>
          <option value="">Escolha o município</option>
          {municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <MarketPicker value={marketId} onChange={setMarketId} />
      <fieldset className="stack" style={{ border: "2px solid #ddd", borderRadius: 12, padding: 14 }}>
        <legend style={{ fontWeight: 700 }}>Fotografias ({photos.length}/{CLASSIFIED_MAX_PHOTOS})</legend>
        <input type="file" accept="image/*" multiple disabled={photos.length >= CLASSIFIED_MAX_PHOTOS} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} aria-label="Selecionar fotografias" />
        <div className="row">
          {photos.map((p, i) => (
            <div key={p.key} style={{ display: "grid", gap: 6, width: 120 }}>
              <img src={p.src} alt={`Fotografia ${i + 1}`} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8 }} />
              <button type="button" className="secondary" onClick={() => removePhoto(i)}>Remover</button>
            </div>
          ))}
        </div>
      </fieldset>
      <VideoField value={videoUrl} onChange={setVideoUrl} />
      {error && <p className="error" role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <button type="submit" disabled={busy}>{busy ? (status || "Aguarde…") : editing ? "Guardar alterações" : "Publicar anúncio"}</button>
    </form>
  );
}
