"use client";
import { useEffect, useState } from "react";
import { listMunicipalities, listProvinces, validateClassifiedDraft, parsePrice, uploadClassifiedMedia, removeClassifiedMedia,
  createAndPublishClassifiedListing, updateClassifiedListing, friendlyError, listingTerritory,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, CLASSIFIED_MAX_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES } from "@huambo-online/core";
import type { ClassifiedListingType, ClassifiedPurpose } from "@huambo-online/types";
import { supabase } from "../lib/supabase";

type Option = { id: string; name: string };
type Photo = { key: string; src: string; file?: File };

export function ListingForm({ listing }: { listing?: any }) {
  const editing = Boolean(listing);
  const territory = listingTerritory(listing);
  const [listingType, setListingType] = useState<ClassifiedListingType>(listing?.listing_type ?? "classified");
  const [purpose, setPurpose] = useState<ClassifiedPurpose>(listing?.purpose ?? "sale");
  const [title, setTitle] = useState(listing?.title ?? "");
  const [description, setDescription] = useState(listing?.description ?? "");
  const [price, setPrice] = useState(listing?.price != null ? String(listing.price) : "");
  const [categoryId, setCategoryId] = useState(listing?.category_id ?? "");
  const [provinceId, setProvinceId] = useState(territory.provinceId ?? "");
  const [municipalityId, setMunicipalityId] = useState(territory.municipalityId ?? "");
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
        if (!photo.file) { media.push(photo.src); continue; }
        n++; setStatus(`A enviar fotografia ${n}…`);
        const up = await uploadClassifiedMedia(c, photo.file, user.id, photo.file.name, photo.file.type);
        if (up.error || !up.data) throw up.error ?? new Error("Falha no envio da fotografia.");
        media.push(up.data);
      }
      setStatus(editing ? "A guardar…" : "A publicar…");
      const input = { listingType, purpose, title, description, price: priceValue, categoryId: categoryId || undefined, provinceId, municipalityId, media };
      if (editing) {
        const r = await updateClassifiedListing(c, listing.id, input);
        if (r.error) throw r.error;
        if (removed.length) await removeClassifiedMedia(c, removed);
        window.location.href = "/classificados/" + listing.id;
      } else {
        const r = await createAndPublishClassifiedListing(c, { ownerId: user.id, ...input });
        if (r.error) {
          if (r.draftId) { window.location.href = "/meus-anuncios?erro=" + encodeURIComponent(friendlyError(r.error)); return; }
          throw r.error;
        }
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
      <label>Título<input value={title} maxLength={140} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Toyota Hilux 2018" /></label>
      <label>Descrição<textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} placeholder="Estado, características, como entregar…" /></label>
      <label>Preço (Kz)<input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" placeholder="Deixe vazio para «sob consulta»" /></label>
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
      {error && <p className="error" role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      <button type="submit" disabled={busy}>{busy ? (status || "Aguarde…") : editing ? "Guardar alterações" : "Publicar anúncio"}</button>
    </form>
  );
}
