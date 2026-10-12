"use client";
import { useEffect, useState } from "react";
import { listPortfolio, savePortfolioItem, deletePortfolioItem, reorderPortfolio, movePortfolio, validatePortfolioItem, portfolioDateLabel, uploadClassifiedMedia,
  removeClassifiedMedia, friendlyError, PORTFOLIO_MAX_ITEMS, PORTFOLIO_MAX_PHOTOS, type PortfolioItem, type PortfolioTarget } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { compressPhoto } from "../lib/image";
import { LiteImg } from "./LiteImg";

async function uploadAll(uid: string, files: File[]): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) {
    const small = await compressPhoto(f);
    const r = await uploadClassifiedMedia(supabase(), small, uid, small.name, small.type || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error("Não foi possível enviar a fotografia.");
    urls.push(r.data);
  }
  return urls;
}

/** Fotografia do perfil ou logótipo (uma imagem, reduzida antes de enviar). */
export function PhotoPicker({ uid, current, label, onSave }: { uid: string; current: string | null; label: string; onSave: (url: string | null) => PromiseLike<{ error: any }> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [url, setUrl] = useState(current);
  useEffect(() => setUrl(current), [current]);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setError("");
    try { const [u] = await uploadAll(uid, [f]); const r = await onSave(u); if (r.error) throw r.error; setUrl(u); }
    catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="row" style={{ alignItems: "center", gap: 14 }}>
    {url ? <img src={url} alt={label} width={88} height={88} style={{ objectFit: "cover", borderRadius: 16, border: "1px solid var(--line)" }} />
      : <span aria-hidden style={{ width: 88, height: 88, borderRadius: 16, display: "grid", placeItems: "center", fontSize: 40, background: "var(--surface)" }}>📷</span>}
    <label className="btn secondary" style={{ cursor: "pointer" }}>{busy ? "A enviar…" : url ? `Mudar ${label.toLowerCase()}` : `Pôr ${label.toLowerCase()}`}
      <input type="file" accept="image/*" hidden disabled={busy} onChange={e => void pick(e.target.files?.[0])} /></label>
    {url && <button type="button" className="secondary" disabled={busy} onClick={async () => { const r = await onSave(null); if (r.error) setError(friendlyError(r.error)); else setUrl(null); }}>Tirar</button>}
    {error && <p className="error" role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
  </div>;
}

const emptyForm = { title: "", description: "", doneOn: "", photos: [] as string[], files: [] as File[] };

/** Gerir o portfólio (dono): juntar, editar, ordenar e apagar trabalhos. */
export function PortfolioManager({ uid, target }: { uid: string; target: PortfolioTarget }) {
  const [items, setItems] = useState<PortfolioItem[]>([]); const [form, setForm] = useState(emptyForm); const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const key = "providerId" in target ? target.providerId : target.businessId;
  async function load() { const r = await listPortfolio(supabase(), target); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [key]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const all = [...form.photos, ...form.files.map(f => f.name)];
    const invalid = validatePortfolioItem({ title: form.title, description: form.description, photos: all, doneOn: form.doneOn || null }); if (invalid) { setError(invalid); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const uploaded = await uploadAll(uid, form.files);
      const r = await savePortfolioItem(supabase(), uid, target, { title: form.title, description: form.description, photos: [...form.photos, ...uploaded], doneOn: form.doneOn || null }, editing ?? undefined);
      if (r.error) throw r.error;
      setNotice(editing ? "Trabalho atualizado." : "Trabalho juntado ao portfólio."); setForm(emptyForm); setEditing(null); setOpen(false); await load();
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  async function remove(it: PortfolioItem) {
    if (!confirm(`Apagar «${it.title}» do portfólio?`)) return;
    const r = await deletePortfolioItem(supabase(), it.id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    void removeClassifiedMedia(supabase(), it.photos); setNotice("Trabalho apagado."); await load();
  }
  async function move(id: string, dir: -1 | 1) {
    const next = movePortfolio(items, id, dir); if (next === items) return;
    setItems(next); const r = await reorderPortfolio(supabase(), next.map(x => x.id)); if (r.error) setError(friendlyError(r.error));
  }
  const total = form.photos.length + form.files.length;
  return <section className="stack" aria-label="Portfólio">
    <h2 style={{ margin: 0 }}>📸 Portfólio ({items.length}/{PORTFOLIO_MAX_ITEMS})</h2>
    <p style={{ margin: 0 }}>Mostre trabalhos que já fez, com fotografias. Os clientes confiam mais quando veem o resultado.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!open && items.length < PORTFOLIO_MAX_ITEMS && <button type="button" onClick={() => { setOpen(true); setEditing(null); setForm(emptyForm); }} style={{ justifySelf: "start" }}>➕ Juntar trabalho</button>}
    {open && <form className="card stack" onSubmit={save}>
      <h3 style={{ margin: 0 }}>{editing ? "Editar trabalho" : "Novo trabalho"}</h3>
      <label>Título<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder="Ex.: Instalação elétrica de uma vivenda" /></label>
      <label>Descrição (opcional)<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="O que foi feito, materiais, prazo, bairro…" /></label>
      <label>Quando foi feito (opcional)<input type="month" value={form.doneOn} onChange={e => setForm({ ...form, doneOn: e.target.value })} /></label>
      <label>Fotografias ({total}/{PORTFOLIO_MAX_PHOTOS})<input type="file" accept="image/*" multiple disabled={total >= PORTFOLIO_MAX_PHOTOS} onChange={e => setForm({ ...form, files: [...form.files, ...Array.from(e.target.files ?? [])].slice(0, PORTFOLIO_MAX_PHOTOS - form.photos.length) })} /></label>
      {total > 0 && <div className="row" style={{ gap: 8 }}>
        {form.photos.map(u => <span key={u} className="stack" style={{ gap: 4 }}><img src={u} alt="" width={80} height={80} style={{ objectFit: "cover", borderRadius: 10 }} /><button type="button" className="secondary" onClick={() => setForm({ ...form, photos: form.photos.filter(x => x !== u) })}>Tirar</button></span>)}
        {form.files.map((f, i) => <span key={i} className="badge">📷 {f.name} <button type="button" className="secondary" aria-label={"Tirar " + f.name} onClick={() => setForm({ ...form, files: form.files.filter((_, j) => j !== i) })}>✖</button></span>)}
      </div>}
      <div className="row"><button disabled={busy}>{busy ? "A enviar…" : editing ? "Guardar" : "Juntar ao portfólio"}</button><button type="button" className="secondary" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button></div>
    </form>}
    {items.length === 0 && !open && <p className="muted">Ainda não tem trabalhos no portfólio.</p>}
    {items.map((it, i) => <article key={it.id} className="card" style={{ display: "grid", gridTemplateColumns: "80px minmax(0,1fr)", gap: 12 }}>
      <img src={it.photos[0]} alt="" width={80} height={80} style={{ objectFit: "cover", borderRadius: 10 }} />
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <strong style={{ overflowWrap: "anywhere" }}>{it.title}</strong>
        <small className="muted">{it.photos.length} fotografia(s){it.done_on ? " · " + portfolioDateLabel(it.done_on) : ""}</small>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="secondary" disabled={i === 0} aria-label={"Subir " + it.title} onClick={() => move(it.id, -1)}>↑</button>
          <button type="button" className="secondary" disabled={i === items.length - 1} aria-label={"Descer " + it.title} onClick={() => move(it.id, 1)}>↓</button>
          <button type="button" className="secondary" onClick={() => { setEditing(it.id); setOpen(true); setForm({ title: it.title, description: it.description ?? "", doneOn: it.done_on?.slice(0, 7) ?? "", photos: it.photos, files: [] }); }}>Editar</button>
          <button type="button" className="danger" onClick={() => remove(it)}>Apagar</button>
        </div>
      </div>
    </article>)}
  </section>;
}

/** Portfólio público: grelha de trabalhos; ao tocar abre as fotografias em grande. */
export function PortfolioGallery({ target }: { target: PortfolioTarget }) {
  const [items, setItems] = useState<PortfolioItem[]>([]); const [view, setView] = useState<{ item: PortfolioItem; i: number } | null>(null);
  const key = "providerId" in target ? target.providerId : target.businessId;
  useEffect(() => { void listPortfolio(supabase(), target).then(r => setItems(r.data)); }, [key]);
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setView(null); if (e.key === "ArrowRight") setView(v => v && { ...v, i: (v.i + 1) % v.item.photos.length }); if (e.key === "ArrowLeft") setView(v => v && { ...v, i: (v.i - 1 + v.item.photos.length) % v.item.photos.length }); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [view]);
  if (!items.length) return null;
  return <section className="stack" aria-label="Portfólio">
    <h2 style={{ margin: 0 }}>📸 Trabalhos realizados ({items.length})</h2>
    <div className="portfolio-grid">
      {items.map(it => <button key={it.id} type="button" className="portfolio-tile" onClick={() => setView({ item: it, i: 0 })} aria-label={`Ver «${it.title}» (${it.photos.length} fotografias)`}>
        <LiteImg src={it.photos[0]} alt="" loading="lazy" placeholder="🖼️" />
        <span className="portfolio-caption"><strong>{it.title}</strong>{it.done_on ? <small>{portfolioDateLabel(it.done_on)}</small> : null}</span>
        {it.photos.length > 1 && <span className="portfolio-count" aria-hidden>📷 {it.photos.length}</span>}
      </button>)}
    </div>
    {view && <div className="lightbox" role="dialog" aria-modal="true" aria-label={view.item.title} onClick={() => setView(null)}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={view.item.photos[view.i]} alt={`${view.item.title} — fotografia ${view.i + 1} de ${view.item.photos.length}`} />
        <div className="stack" style={{ gap: 6 }}>
          <strong>{view.item.title}{view.item.done_on ? " · " + portfolioDateLabel(view.item.done_on) : ""}</strong>
          {view.item.description && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{view.item.description}</p>}
          <div className="row">
            {view.item.photos.length > 1 && <>
              <button type="button" className="secondary" onClick={() => setView({ ...view, i: (view.i - 1 + view.item.photos.length) % view.item.photos.length })}>← Anterior</button>
              <span>{view.i + 1} / {view.item.photos.length}</span>
              <button type="button" className="secondary" onClick={() => setView({ ...view, i: (view.i + 1) % view.item.photos.length })}>Seguinte →</button>
            </>}
            <button type="button" autoFocus onClick={() => setView(null)}>Fechar</button>
          </div>
        </div>
      </div>
    </div>}
  </section>;
}
