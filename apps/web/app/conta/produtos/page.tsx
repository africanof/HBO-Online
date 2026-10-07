"use client";
import { useEffect, useState } from "react";
import { listMyProducts, saveProduct, deleteProduct, listProductCategories, uploadClassifiedMedia, removeClassifiedMedia, parsePrice, formatPrice, friendlyError,
  MAX_PRODUCT_PHOTOS, CLASSIFIED_MAX_PHOTO_BYTES } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useTerritory } from "../../../components/Directory";

type Option = { id: string; name: string };
type Photo = { key: string; src: string; file?: File };
const empty = { name: "", description: "", price: "", stock: "1", categoryId: "", municipalityId: "", active: true };

export default function MeusProdutos() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState(empty); const [photos, setPhotos] = useState<Photo[]>([]); const [removed, setRemoved] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [categories, setCategories] = useState<Option[]>([]); const { provinces, municipalities, provinceId, setProvinceId } = useTerritory();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  async function load(id: string) { const r = await listMyProducts(supabase(), id); setItems(r.data ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? [])); }, []);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function addFiles(files: FileList | null) {
    const ok = Array.from(files ?? []).filter(f => f.type.startsWith("image/") && f.size <= CLASSIFIED_MAX_PHOTO_BYTES);
    if (ok.length < (files?.length ?? 0)) setError("Algumas fotografias foram ignoradas (só imagens até 5 MB).");
    setPhotos(p => [...p, ...ok.slice(0, MAX_PRODUCT_PHOTOS - p.length).map(f => ({ key: crypto.randomUUID(), src: URL.createObjectURL(f), file: f }))]);
  }
  function edit(p: any) {
    setEditing(p.id); setRemoved([]);
    setForm({ name: p.name, description: p.description ?? "", price: String(p.price), stock: String(p.stock), categoryId: p.category_id ?? "", municipalityId: p.municipality_id ?? "", active: p.active });
    setPhotos((Array.isArray(p.media) ? p.media : []).map((u: string) => ({ key: u, src: u })));
    window.scrollTo(0, document.body.scrollHeight);
  }
  function reset() { setEditing(null); setForm(empty); setPhotos([]); setRemoved([]); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!uid || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const media: string[] = [];
      for (const p of photos) {
        if (!p.file) { media.push(p.src); continue; }
        const up = await uploadClassifiedMedia(supabase(), p.file, uid, p.file.name, p.file.type);
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

  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/loja">← Loja</a><h1>Os meus produtos</h1><p><a href="/conta/login?voltar=/conta/produtos">Inicie sessão</a> para vender.</p></main>;

  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← Conta</a>
    <h1>Os meus produtos</h1>
    <a className="btn secondary" href="/encomendas?vendas=1" style={{ justifySelf: "start" }}>📦 As minhas vendas</a>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.map(p => <div key={p.id} className="card">
      <strong>{p.name}{p.active ? "" : " (oculto)"}</strong>
      <span>{formatPrice(p.price, p.currency)} · {p.stock} em stock</span>
      <div className="row">
        <a className="btn secondary" href={"/loja/" + p.id}>Ver</a>
        <button className="secondary" onClick={() => edit(p)}>Editar</button>
        <button className="danger" onClick={async () => { if (!confirm("Apagar este produto?")) return; const r = await deleteProduct(supabase(), p.id); if (r.error) setError(friendlyError(r.error)); else { await removeClassifiedMedia(supabase(), p.media ?? []); await load(uid); } }}>Apagar</button>
      </div>
    </div>)}
    <form className="stack card" onSubmit={submit} noValidate>
      <h2 style={{ margin: 0 }}>{editing ? "Editar produto" : "Novo produto"}</h2>
      <label>Nome<input value={form.name} onChange={set("name")} /></label>
      <label>Descrição<textarea rows={4} value={form.description} onChange={set("description")} /></label>
      <label>Preço (Kz)<input inputMode="decimal" value={form.price} onChange={set("price")} /></label>
      <label>Quantidade em stock<input type="number" min={0} value={form.stock} onChange={set("stock")} /></label>
      <label>Categoria<select value={form.categoryId} onChange={set("categoryId")}><option value="">Escolha</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Província<select value={provinceId} onChange={e => { setProvinceId(e.target.value); setForm({ ...form, municipalityId: "" }); }}><option value="">Escolha</option>{provinces.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Município<select value={form.municipalityId} onChange={set("municipalityId")}><option value="">Escolha</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Fotografias ({photos.length}/{MAX_PRODUCT_PHOTOS})<input type="file" accept="image/*" multiple disabled={photos.length >= MAX_PRODUCT_PHOTOS} onChange={e => { addFiles(e.target.files); e.target.value = ""; }} /></label>
      <div className="row">{photos.map((p, i) => <div key={p.key} style={{ display: "grid", gap: 6, width: 110 }}><img src={p.src} alt="" style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8 }} /><button type="button" className="secondary" onClick={() => { if (!p.file) setRemoved(r => [...r, p.src]); setPhotos(x => x.filter((_, j) => j !== i)); }}>Remover</button></div>)}</div>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 24, height: 24 }} /> Visível na loja</label>
      <div className="row"><button disabled={busy}>{busy ? "A guardar…" : editing ? "Guardar" : "Publicar produto"}</button>{editing && <button type="button" className="secondary" onClick={reset}>Cancelar</button>}</div>
    </form>
  </main>;
}
