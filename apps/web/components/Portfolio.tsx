"use client";
import { useEffect, useState } from "react";
import { listPortfolio, savePortfolioItem, deletePortfolioItem, reorderPortfolio, movePortfolio, validatePortfolioItem, portfolioDateLabel, uploadClassifiedMedia,
  removeClassifiedMedia, friendlyErrorIn, LANG_TAGS, PORTFOLIO_MAX_ITEMS, PORTFOLIO_MAX_PHOTOS, type PortfolioItem, type PortfolioTarget } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { compressPhoto } from "../lib/image";
import { LiteImg } from "./LiteImg";
import { useT } from "../lib/i18n";
import type { Lang } from "@huambo-online/core";

/** «março de 2026» / «March 2026» / «2026年3月». */
function doneOnIn(d: string, lang: Lang): string {
  if (lang === "pt") return portfolioDateLabel(d);
  const x = new Date(d.length === 7 ? d + "-01" : d);
  return Number.isFinite(x.getTime()) ? x.toLocaleDateString(LANG_TAGS[lang], { month: "long", year: "numeric", timeZone: "UTC" }) : d;
}

async function uploadAll(uid: string, files: File[], failMsg = "Não foi possível enviar a fotografia."): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) {
    const small = await compressPhoto(f);
    const r = await uploadClassifiedMedia(supabase(), small, uid, small.name, small.type || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error(failMsg);
    urls.push(r.data);
  }
  return urls;
}

/** Fotografia do perfil ou logótipo (uma imagem, reduzida antes de enviar). */
export function PhotoPicker({ uid, current, label, onSave }: { uid: string; current: string | null; label: string; onSave: (url: string | null) => PromiseLike<{ error: any }> }) {
  const { lang, t } = useT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [url, setUrl] = useState(current);
  useEffect(() => setUrl(current), [current]);
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setError("");
    try { const [u] = await uploadAll(uid, [f], t("sv.photo_fail")); const r = await onSave(u); if (r.error) throw r.error; setUrl(u); }
    catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="row" style={{ alignItems: "center", gap: 14 }}>
    {url ? <img src={url} alt={label} width={88} height={88} style={{ objectFit: "cover", borderRadius: 16, border: "1px solid var(--line)" }} />
      : <span aria-hidden style={{ width: 88, height: 88, borderRadius: 16, display: "grid", placeItems: "center", fontSize: 40, background: "var(--surface)" }}>📷</span>}
    <label className="btn secondary" style={{ cursor: "pointer" }}>{busy ? t("sv.sending") : url ? t("sv.pf_change", { label: label.toLowerCase() }) : t("sv.pf_put", { label: label.toLowerCase() })}
      <input type="file" accept="image/*" hidden disabled={busy} onChange={e => void pick(e.target.files?.[0])} /></label>
    {url && <button type="button" className="secondary" disabled={busy} onClick={async () => { const r = await onSave(null); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setUrl(null); }}>{t("sv.remove")}</button>}
    {error && <p className="error" role="alert" style={{ flexBasis: "100%" }}>{error}</p>}
  </div>;
}

const emptyForm = { title: "", description: "", doneOn: "", photos: [] as string[], files: [] as File[] };

/** Gerir o portfólio (dono): juntar, editar, ordenar e apagar trabalhos. */
export function PortfolioManager({ uid, target }: { uid: string; target: PortfolioTarget }) {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<PortfolioItem[]>([]); const [form, setForm] = useState(emptyForm); const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const key = "providerId" in target ? target.providerId : target.businessId;
  async function load() { const r = await listPortfolio(supabase(), target); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [key]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const all = [...form.photos, ...form.files.map(f => f.name)];
    const invalid = validatePortfolioItem({ title: form.title, description: form.description, photos: all, doneOn: form.doneOn || null }); if (invalid) { setError(tc(invalid)); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const uploaded = await uploadAll(uid, form.files, t("sv.photo_fail"));
      const r = await savePortfolioItem(supabase(), uid, target, { title: form.title, description: form.description, photos: [...form.photos, ...uploaded], doneOn: form.doneOn || null }, editing ?? undefined);
      if (r.error) throw r.error;
      setNotice(editing ? t("sv.pf_updated") : t("sv.pf_added")); setForm(emptyForm); setEditing(null); setOpen(false); await load();
    } catch (err) { setError(friendlyErrorIn(err, lang)); } finally { setBusy(false); }
  }
  async function remove(it: PortfolioItem) {
    if (!confirm(t("sv.pf_delete_q", { title: it.title }))) return;
    const r = await deletePortfolioItem(supabase(), it.id);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    void removeClassifiedMedia(supabase(), it.photos); setNotice(t("sv.pf_deleted")); await load();
  }
  async function move(id: string, dir: -1 | 1) {
    const next = movePortfolio(items, id, dir); if (next === items) return;
    setItems(next); const r = await reorderPortfolio(supabase(), next.map(x => x.id)); if (r.error) setError(friendlyErrorIn(r.error, lang));
  }
  const total = form.photos.length + form.files.length;
  return <section className="stack" aria-label={t("sv.pf_portfolio")}>
    <h2 style={{ margin: 0 }}>📸 {t("sv.pf_portfolio")} ({items.length}/{PORTFOLIO_MAX_ITEMS})</h2>
    <p style={{ margin: 0 }}>{t("sv.pf_intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!open && items.length < PORTFOLIO_MAX_ITEMS && <button type="button" onClick={() => { setOpen(true); setEditing(null); setForm(emptyForm); }} style={{ justifySelf: "start" }}>➕ {t("sv.pf_add")}</button>}
    {open && <form className="card stack" onSubmit={save}>
      <h3 style={{ margin: 0 }}>{editing ? t("sv.pf_edit") : t("sv.pf_new")}</h3>
      <label>{t("sv.title")}<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} maxLength={120} placeholder={t("sv.pf_title_ph")} /></label>
      <label>{t("sv.desc_opt")}<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t("sv.pf_desc_ph")} /></label>
      <label>{t("sv.pf_when")}<input type="month" value={form.doneOn} onChange={e => setForm({ ...form, doneOn: e.target.value })} /></label>
      <label>{t("sv.photos_n", { n: total, max: PORTFOLIO_MAX_PHOTOS })}<input type="file" accept="image/*" multiple disabled={total >= PORTFOLIO_MAX_PHOTOS} onChange={e => setForm({ ...form, files: [...form.files, ...Array.from(e.target.files ?? [])].slice(0, PORTFOLIO_MAX_PHOTOS - form.photos.length) })} /></label>
      {total > 0 && <div className="row" style={{ gap: 8 }}>
        {form.photos.map(u => <span key={u} className="stack" style={{ gap: 4 }}><img src={u} alt="" width={80} height={80} style={{ objectFit: "cover", borderRadius: 10 }} /><button type="button" className="secondary" onClick={() => setForm({ ...form, photos: form.photos.filter(x => x !== u) })}>{t("sv.remove")}</button></span>)}
        {form.files.map((f, i) => <span key={i} className="badge">📷 {f.name} <button type="button" className="secondary" aria-label={t("sv.remove_named", { name: f.name })} onClick={() => setForm({ ...form, files: form.files.filter((_, j) => j !== i) })}>✖</button></span>)}
      </div>}
      <div className="row"><button disabled={busy}>{busy ? t("sv.sending") : editing ? t("common.save") : t("sv.pf_add_to")}</button><button type="button" className="secondary" onClick={() => { setOpen(false); setEditing(null); }}>{t("common.cancel")}</button></div>
    </form>}
    {items.length === 0 && !open && <p className="muted">{t("sv.pf_none")}</p>}
    {items.map((it, i) => <article key={it.id} className="card" style={{ display: "grid", gridTemplateColumns: "80px minmax(0,1fr)", gap: 12 }}>
      <img src={it.photos[0]} alt="" width={80} height={80} style={{ objectFit: "cover", borderRadius: 10 }} />
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        <strong style={{ overflowWrap: "anywhere" }}>{it.title}</strong>
        <small className="muted">{t("sv.pf_n_photos", { n: it.photos.length })}{it.done_on ? " · " + doneOnIn(it.done_on, lang) : ""}</small>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="secondary" disabled={i === 0} aria-label={t("sv.pf_up", { title: it.title })} onClick={() => move(it.id, -1)}>↑</button>
          <button type="button" className="secondary" disabled={i === items.length - 1} aria-label={t("sv.pf_down", { title: it.title })} onClick={() => move(it.id, 1)}>↓</button>
          <button type="button" className="secondary" onClick={() => { setEditing(it.id); setOpen(true); setForm({ title: it.title, description: it.description ?? "", doneOn: it.done_on?.slice(0, 7) ?? "", photos: it.photos, files: [] }); }}>{t("common.edit")}</button>
          <button type="button" className="danger" onClick={() => remove(it)}>{t("common.delete")}</button>
        </div>
      </div>
    </article>)}
  </section>;
}

/** Portfólio público: grelha de trabalhos; ao tocar abre as fotografias em grande. */
export function PortfolioGallery({ target }: { target: PortfolioTarget }) {
  const { lang, t } = useT();
  const [items, setItems] = useState<PortfolioItem[]>([]); const [view, setView] = useState<{ item: PortfolioItem; i: number } | null>(null);
  const key = "providerId" in target ? target.providerId : target.businessId;
  useEffect(() => { void listPortfolio(supabase(), target).then(r => setItems(r.data)); }, [key]);
  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setView(null); if (e.key === "ArrowRight") setView(v => v && { ...v, i: (v.i + 1) % v.item.photos.length }); if (e.key === "ArrowLeft") setView(v => v && { ...v, i: (v.i - 1 + v.item.photos.length) % v.item.photos.length }); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [view]);
  if (!items.length) return null;
  return <section className="stack" aria-label={t("sv.pf_portfolio")}>
    <h2 style={{ margin: 0 }}>📸 {t("sv.pf_done_works", { n: items.length })}</h2>
    <div className="portfolio-grid">
      {items.map(it => <button key={it.id} type="button" className="portfolio-tile" onClick={() => setView({ item: it, i: 0 })} aria-label={t("sv.pf_see", { title: it.title, n: it.photos.length })}>
        <LiteImg src={it.photos[0]} alt="" loading="lazy" placeholder="🖼️" />
        <span className="portfolio-caption"><strong>{it.title}</strong>{it.done_on ? <small>{doneOnIn(it.done_on, lang)}</small> : null}</span>
        {it.photos.length > 1 && <span className="portfolio-count" aria-hidden>📷 {it.photos.length}</span>}
      </button>)}
    </div>
    {view && <div className="lightbox" role="dialog" aria-modal="true" aria-label={view.item.title} onClick={() => setView(null)}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={view.item.photos[view.i]} alt={t("sv.vd_photo_alt", { title: view.item.title, n: view.i + 1, total: view.item.photos.length })} />
        <div className="stack" style={{ gap: 6 }}>
          <strong>{view.item.title}{view.item.done_on ? " · " + doneOnIn(view.item.done_on, lang) : ""}</strong>
          {view.item.description && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{view.item.description}</p>}
          <div className="row">
            {view.item.photos.length > 1 && <>
              <button type="button" className="secondary" onClick={() => setView({ ...view, i: (view.i - 1 + view.item.photos.length) % view.item.photos.length })}>← {t("sv.previous")}</button>
              <span>{view.i + 1} / {view.item.photos.length}</span>
              <button type="button" className="secondary" onClick={() => setView({ ...view, i: (view.i + 1) % view.item.photos.length })}>{t("sv.next")} →</button>
            </>}
            <button type="button" autoFocus onClick={() => setView(null)}>{t("common.close")}</button>
          </div>
        </div>
      </div>
    </div>}
  </section>;
}
