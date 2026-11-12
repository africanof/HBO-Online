"use client";
import { useEffect, useState } from "react";
import { listLostFound, getLostFound, myLostFound, createLostFound, resolveLostFound, removeLostFound, lostFoundContact, lostFoundMessage, lostFoundRef,
  uploadClassifiedMedia, validateDocument, whatsappLink, formatPrice, friendlyErrorIn, isModerator, todayIso, HUAMBO_MUNICIPALITIES,
  LOST_FOUND_CATEGORIES, LOST_FOUND_ICONS, type LostFoundCategory, type LostFoundKind, type LostFoundPost } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT, formatDateIn, timeAgoIn } from "../lib/i18n";

/** Página «Perdidos e achados»: avisos abertos, filtros, publicar e os meus avisos. */
export function LostFoundPage() {
  const { t, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [staff, setStaff] = useState(false);
  const [kind, setKind] = useState<LostFoundKind | "">(""); const [category, setCategory] = useState<LostFoundCategory | "">("");
  const [q, setQ] = useState(""); const [items, setItems] = useState<LostFoundPost[] | null>(null); const [error, setError] = useState("");
  const [focus, setFocus] = useState<LostFoundPost | null>(null);
  const [form, setForm] = useState<LostFoundKind | null>(null);
  const [mine, setMine] = useState<LostFoundPost[]>([]);

  async function load(k = kind, c = category, query = q) {
    setError("");
    const r = await listLostFound(supabase(), { kind: k, category: c, query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
  }
  async function loadMine(u: string) { setMine((await myLostFound(supabase(), u)).data); }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("aviso");
    if (id) void getLostFound(supabase(), id).then(r => setFocus(r.data));
    const tipo = params.get("tipo");
    const start: LostFoundKind | "" = tipo === "perdidos" ? "lost" : tipo === "achados" ? "found" : "";
    setKind(start); void load(start, "", "");
    void currentUserId().then(u => { setUid(u); if (u) { void loadMine(u); void isModerator(supabase()).then(setStaff); } });
  }, []);
  function pickKind(k: LostFoundKind | "") { setKind(k); void load(k, category, q); }
  function pickCategory(c: LostFoundCategory | "") { setCategory(c); void load(kind, c, q); }
  function changed() { void load(); if (uid) void loadMine(uid); }

  return <main className="stack" style={{ maxWidth: 960 }}>
    <a href="/">← {t("nav.home")}</a>
    <section className="banner yellow">
      <div><h1 style={{ margin: 0 }}>{t("lf.title")}</h1><p>{t("lf.intro")}</p></div>
      <div className="row">
        <button type="button" onClick={() => setForm("lost")}>😟 {t("lf.post_lost")}</button>
        <button type="button" className="secondary" onClick={() => setForm("found")}>🙌 {t("lf.post_found")}</button>
      </div>
    </section>

    {form && (uid === null
      ? <p className="card">{t("lf.login_post")} <a className="btn" href="/conta/login?voltar=/perdidos-achados">{t("auth.login")}</a></p>
      : uid ? <LostFoundForm key={form} uid={uid} kind={form} onCancel={() => setForm(null)} onSent={() => { setForm(null); changed(); }} /> : null)}

    {focus && <section className="stack" style={{ gap: 8 }}>
      <LostFoundCard p={focus} uid={uid} staff={staff} onChange={changed} open />
    </section>}

    <div className="row" role="tablist" aria-label={t("lf.title")}>
      {(["", "lost", "found"] as const).map(k => <button key={k || "all"} type="button" role="tab" aria-selected={kind === k}
        className={kind === k ? "" : "secondary"} onClick={() => pickKind(k)}>{k ? t("lf.k." + k) : t("lf.all")}</button>)}
    </div>
    <form className="row" onSubmit={e => { e.preventDefault(); void load(); }}>
      <select value={category} onChange={e => pickCategory(e.target.value as LostFoundCategory | "")} aria-label={t("lf.f_category")} style={{ maxWidth: 260 }}>
        <option value="">{t("lf.all")}</option>
        {LOST_FOUND_CATEGORIES.map(c => <option key={c} value={c}>{LOST_FOUND_ICONS[c]} {t("lf.c." + c)}</option>)}
      </select>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder={t("lf.search_ph")} aria-label={t("lf.search")} style={{ maxWidth: 380 }} />
      <button type="submit">{t("lf.search")}</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {items?.length === 0 && <p className="card">{t("lf.empty")}</p>}
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
      {items?.filter(p => p.id !== focus?.id).map(p => <LostFoundCard key={p.id} p={p} uid={uid} staff={staff} onChange={changed} />)}
    </section>
    <p className="card muted" style={{ margin: 0 }}>{t("lf.safety")}</p>

    {uid && mine.length > 0 && <section className="stack" style={{ gap: 10 }}>
      <h2 style={{ margin: 0 }}>{t("lf.mine")}</h2>
      {mine.map(p => <LostFoundCard key={p.id} p={p} uid={uid} staff={staff} onChange={changed} />)}
    </section>}
  </main>;
}

function LostFoundCard({ p, uid, staff, onChange, open = false }: { p: LostFoundPost; uid: string | null | undefined; staff: boolean; onChange: () => void; open?: boolean }) {
  const { t, lang } = useT();
  const [phone, setPhone] = useState<string | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const mineToo = uid === p.user_id;
  const date = formatDateIn(p.happened_on, lang);
  async function contact() {
    setError("");
    if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent("/perdidos-achados?aviso=" + p.id); return; }
    const r = await lostFoundContact(supabase(), p.id);
    if (r.error || !r.data) setError(friendlyErrorIn(r.error, lang)); else setPhone(r.data);
  }
  async function act(fn: () => PromiseLike<{ error: any }>, ask?: string) {
    if (ask && !window.confirm(ask)) return;
    setBusy(true); setError("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onChange();
  }
  function share() {
    const url = window.location.origin + "/perdidos-achados?aviso=" + p.id;
    const text = (p.kind === "lost" ? "😟 " : "🙌 ") + p.title + " · " + p.place;
    if (navigator.share) void navigator.share({ title: t("lf.title"), text, url }).catch(() => undefined);
    else void navigator.clipboard?.writeText(text + " " + url);
  }
  const wa = phone ? whatsappLink(phone, lostFoundMessage(p, t)) : null;
  return <article className="card stack" style={{ gap: 8, outline: open ? "2px solid var(--yellow-line)" : undefined }} id={"aviso-" + p.id}>
    <span className="badge" style={{ justifySelf: "start", background: p.kind === "lost" ? "var(--yellow-soft)" : undefined }}>
      {p.kind === "lost" ? "😟" : "🙌"} {t("lf.k." + p.kind)} · {LOST_FOUND_ICONS[p.category]} {t("lf.c." + p.category)}
    </span>
    {p.photos.length > 0 && <div className="row" style={{ gap: 6, overflowX: "auto" }}>
      {p.photos.map(src => <img key={src} src={src} alt={p.title} loading="lazy" style={{ width: p.photos.length === 1 ? "100%" : 120, height: 120, objectFit: "cover", borderRadius: 8 }} />)}
    </div>}
    <strong style={{ fontSize: 18 }}>{p.title}</strong>
    <span className="muted">{t(p.kind === "lost" ? "lf.lost_on" : "lf.found_on", { date, place: p.place })}</span>
    {p.description && <span>{p.description}</span>}
    {p.reward != null && <strong>🎁 {t("lf.reward", { value: formatPrice(p.reward) })}</strong>}
    <small className="muted">{lostFoundRef(p.ref_no)} · {timeAgoIn(p.created_at, lang)}{p.status !== "open" ? " · " + t("lf.s." + p.status) : ""}</small>
    {p.status === "open" && !mineToo && (phone
      ? <div className="row"><a className="btn" href={"tel:" + phone.replace(/[^\d+]/g, "")}>📞 {t("lf.call")} {phone}</a>{wa && <a className="btn secondary" href={wa} target="_blank" rel="noopener noreferrer">💬 {t("lf.whatsapp")}</a>}</div>
      : <button type="button" onClick={() => void contact()} style={{ justifySelf: "start" }}>{t("lf.contact")}</button>)}
    {!uid && p.status === "open" && <small className="muted">{t("lf.login_contact")}</small>}
    <div className="row">
      {p.status === "open" && <button type="button" className="secondary" onClick={share}>🔗 {t("lf.share")}</button>}
      {mineToo && p.status === "open" && <button type="button" disabled={busy} onClick={() => void act(() => resolveLostFound(supabase(), p.id))}>✅ {t(p.kind === "lost" ? "lf.resolve_lost" : "lf.resolve_found")}</button>}
      {(mineToo || staff) && p.status !== "removed" && <button type="button" className="secondary" disabled={busy} onClick={() => void act(() => removeLostFound(supabase(), p.id), t("lf.confirm_remove"))}>{t("lf.remove")}</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
  </article>;
}

function LostFoundForm({ uid, kind, onCancel, onSent }: { uid: string; kind: LostFoundKind; onCancel: () => void; onSent: () => void }) {
  const { t, tc, lang } = useT();
  const [category, setCategory] = useState<LostFoundCategory>("documentos");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [place, setPlace] = useState("");
  const [municipality, setMunicipality] = useState("huambo"); const [happenedOn, setHappenedOn] = useState(todayIso());
  const [reward, setReward] = useState(""); const [phone, setPhone] = useState(""); const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function send() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of photos.slice(0, 4)) {
        const bad = validateDocument({ size: f.size, type: f.type }); if (bad) { setError(tc(bad)); return; }
        const up = await uploadClassifiedMedia(supabase(), f, uid, f.name, f.type); if (up.error || !up.data) throw up.error ?? new Error("UPLOAD");
        urls.push(up.data);
      }
      const r = await createLostFound(supabase(), { kind, category, title, description, place, municipality, happenedOn, photos: urls,
        reward: reward.trim() ? Number(reward.replace(/\D/g, "")) : null, phone });
      if (r.error) throw r.error;
      setNotice(t("lf.published")); onSent();
    } catch (e: any) { setError(String(e?.message ?? "").startsWith("lf.") ? t(e.message) : friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <section className="card stack" style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>{kind === "lost" ? "😟 " + t("lf.form_title_lost") : "🙌 " + t("lf.form_title_found")}</h2>
    <label>{t("lf.f_category")}<select value={category} onChange={e => setCategory(e.target.value as LostFoundCategory)}>
      {LOST_FOUND_CATEGORIES.map(c => <option key={c} value={c}>{LOST_FOUND_ICONS[c]} {t("lf.c." + c)}</option>)}</select></label>
    {category === "documentos" && <small className="muted">⚠️ {t("lf.doc_tip")}</small>}
    <label>{t("lf.f_title")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={t("lf.f_title_ph")} /></label>
    <label>{t("lf.f_description")}<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1500} rows={3} /></label>
    <div className="row">
      <label style={{ flex: 2 }}>{t("lf.f_place")}<input value={place} onChange={e => setPlace(e.target.value)} maxLength={200} placeholder={t("lf.f_place_ph")} /></label>
      <label style={{ flex: 1 }}>&nbsp;<select value={municipality} onChange={e => setMunicipality(e.target.value)} aria-label={t("lf.f_place")}>
        {HUAMBO_MUNICIPALITIES.map(m => <option key={m.slug} value={m.slug}>{m.name}</option>)}</select></label>
    </div>
    <div className="row">
      <label style={{ flex: 1 }}>{t("lf.f_date")}<input type="date" value={happenedOn} max={todayIso()} onChange={e => setHappenedOn(e.target.value)} /></label>
      {kind === "lost" && <label style={{ flex: 1 }}>{t("lf.f_reward")}<input value={reward} onChange={e => setReward(e.target.value)} inputMode="numeric" /></label>}
    </div>
    <label>{t("lf.f_photos")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => setPhotos(Array.from(e.target.files ?? []).slice(0, 4))} /></label>
    <label>{t("lf.f_phone")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={30} /></label>
    <small className="muted">{t("lf.f_phone_note")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="row">
      <button type="button" disabled={busy} onClick={() => void send()}>{busy ? t("common.loading") : t("lf.publish")}</button>
      <button type="button" className="secondary" onClick={onCancel}>{t("lf.cancel")}</button>
    </div>
  </section>;
}
