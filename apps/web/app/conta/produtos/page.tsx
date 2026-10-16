"use client";
import { ConformityCheck } from "../../../components/Conformity";
import { MarketPicker } from "../../../components/MarketPicker";
import { VideoField } from "../../../components/Video";
import { useEffect, useState } from "react";
import { listMyProducts, saveProduct, deleteProduct, listProductCategories, uploadClassifiedMedia, removeClassifiedMedia, parsePrice, formatPrice, friendlyErrorIn,
  MAX_PRODUCT_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES, PHOTO_RAW_MAX_BYTES, formatRef } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useTerritory } from "../../../components/Directory";
import { compressPhoto } from "../../../lib/image";
import { PlanBanner } from "../../../components/Plans";
import { useT } from "../../../lib/i18n";

type Option = { id: string; name: string };
type Photo = { key: string; src: string; file?: File };
const empty = { name: "", description: "", price: "", stock: "1", categoryId: "", municipalityId: "", marketId: "", videoUrl: "", active: true };

export default function MeusProdutos() {
  const { lang, t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [photos, setPhotos] = useState<Photo[]>([]); const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyProducts(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  async function addFiles(files: FileList | null) {
    const chosen = Array.from(files ?? []);
    // Fotografias mais leves: reduzidas antes de enviar (poupa dados).
    const ready = await Promise.all(chosen.filter(f => f.type.startsWith("image/") && f.size <= PHOTO_RAW_MAX_BYTES).slice(0, MAX_PRODUCT_PHOTOS - photos.length).map(f => compressPhoto(f)));
    const ok = ready.filter(f => f.size <= CLASSIFIED_MAX_PHOTO_BYTES);
    if (ok.length < chosen.length) setError(t("sh.my.photos_ignored", { n: MAX_PRODUCT_PHOTOS }));
    setPhotos(p => [...p, ...ok.slice(0, MAX_PRODUCT_PHOTOS - p.length).map(f => ({ key: crypto.randomUUID(), src: URL.createObjectURL(f), file: f }))]);
  }
  function edit(p: any) {
    setEditing(p.id); setRemoved([]);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), stock: String(p.stock), categoryId: p.category_id ?? "", municipalityId: p.municipality_id ?? "", marketId: p.market_id ?? "", videoUrl: p.video_url ?? "", active: p.active }); setConform(!!p.conformity_accepted_at);
    setPhotos((Array.isArray(p.media) ? p.media : []).map((u: string) => ({ key: u, src: u })));
    window.scrollTo(0, document.body.scrollHeight);
  }
  const [conform, setConform] = useState(false);
  function reset() { setEditing(null); setForm(empty); setPhotos([]); setRemoved([]); setConform(false); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!uid || busy) return;
    if (form.active && !conform) { setError(t("sh.my.conform_needed")); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const media: string[] = [];
      for (const p of photos) {
        if (!p.file) { media.push(p.src); continue; }
        const up = await uploadClassifiedMedia(supabase(), p.file, uid, p.file.name, p.file.type);
        if (up.error || !up.data) throw up.error ?? new Error(t("sh.my.photo_fail"));
        media.push(up.data);
      }
      const r = await saveProduct(supabase(), uid, { name: form.name, description: form.description, price: parsePrice(form.price) ?? NaN, stock: Number(form.stock),
        categoryId: form.categoryId, municipalityId: form.municipalityId, marketId: form.marketId, videoUrl: form.videoUrl, media, active: form.active, conformity: conform }, editing ?? undefined);
      if (r.error) throw r.error;
      if (removed.length) await removeClassifiedMedia(supabase(), removed);
      setNotice(editing ? t("sh.my.updated") : t("sh.my.published")); reset(); await load(uid);
    } catch (err) { setError(friendlyErrorIn(err, lang)); } finally { setBusy(false); }
  }

  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/loja">← {t("nav.shop")}</a><h1>{t("sh.my.title")}</h1><p><a href="/conta/login?voltar=/conta/produtos">{t("sh.sign_in")}</a> {t("sh.my.to_sell")}</p></main>;

  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("nav.account_short")}</a>
    <h1>{t("sh.my.title")}</h1>
    <a className="btn secondary" href="/conta/estatisticas" style={{ justifySelf: "start" }}>📊 {t("sh.my.stats")}</a>
    <PlanBanner kind="store" subjectId={uid} />
    <a className="btn secondary" href="/encomendas?vendas=1" style={{ justifySelf: "start" }}>📦 {t("sh.my_sales")}</a>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.map(p => <div key={p.id} className="card">
      <strong>{p.name}{p.active ? "" : " (" + t("sh.my.hidden") + ")"}</strong>{p.ref_no && <small className="muted">{t("sh.no")} {formatRef("product", p.ref_no)}</small>}
      <span>{formatPrice(p.price, p.currency)} · {t("sh.in_stock", { n: p.stock })}</span>
      <div className="row">
        <a className="btn secondary" href={"/loja/" + p.id}>{t("sh.view")}</a>
        <button className="secondary" onClick={() => edit(p)}>{t("common.edit")}</button>
        <button className="danger" onClick={async () => { if (!confirm(t("sh.my.delete_q"))) return; const r = await deleteProduct(supabase(), p.id); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { await removeClassifiedMedia(supabase(), p.media ?? []); await load(uid); } }}>{t("common.delete")}</button>
      </div>
    </div>)}
    <form className="stack card" onSubmit={submit} noValidate>
      <h2 style={{ margin: 0 }}>{editing ? t("sh.my.edit") : t("sh.my.new")}</h2>
      <label>{t("sh.name")}<input value={form.name} onChange={set("name")} /></label>
      <label>{t("sh.description")}<textarea rows={4} value={form.description} onChange={set("description")} /></label>
      <label>{t("sh.my.price")}<input inputMode="decimal" value={form.price} onChange={set("price")} /></label>
      <label>{t("sh.my.stock")}<input type="number" min={0} value={form.stock} onChange={set("stock")} /></label>
      <label>{t("sh.category")}<select value={form.categoryId} onChange={set("categoryId")}><option value="">{t("sh.choose")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>{t("sh.province")}<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setForm({ ...form, municipalityId: "" }); }}><option value="">{t("sh.choose")}</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>{t("auth.municipality")}<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">{t("sh.choose")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <MarketPicker value={form.marketId} onChange={v => setForm({ ...form, marketId: v })} />
      <label>{t("sh.my.photos", { n: photos.length, max: MAX_PRODUCT_PHOTOS })}<input type="file" accept="image/*" multiple disabled={photos.length >= MAX_PRODUCT_PHOTOS} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} /></label>
      <VideoField value={form.videoUrl} onChange={v => setForm({ ...form, videoUrl: v })} />
      <div className="row">{photos.map((p, i) => <div key={p.key} style={{ display: "grid", gap: 6, width: 110 }}><img src={p.src} alt="" style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8 }} /><button type="button" className="secondary" onClick={() => { if (!p.file) setRemoved(r => [...r, p.src]); setPhotos(x => x.filter((_, j) => j !== i)); }}>{t("sh.remove")}</button></div>)}</div>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 24, height: 24 }} /> {t("sh.my.visible")}</label>
      <ConformityCheck checked={conform} onChange={setConform} />
      <div className="row"><button disabled={busy}>{busy ? t("sh.saving") : editing ? t("common.save") : t("sh.my.publish")}</button>{editing && <button type="button" className="secondary" onClick={reset}>{t("common.cancel")}</button>}</div>
    </form>
  </main>;
}
