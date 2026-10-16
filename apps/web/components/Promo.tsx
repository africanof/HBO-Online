"use client";
import { useEffect, useState } from "react";
import { promoFeed, getPromoPost, recordPromoView, savePromoPost, deletePromoPost, myPromoPosts, listMyPromoSubjects, submitPromoBoost, listPromoBoostsForAdmin,
  decidePromoBoost, listPromoPostsForAdmin, setPromoHidden, videoPlatform, embedUrl, embedHint, youtubeThumb, liveStateAt, liveStateText, viewsText, promoShareMessage, promoRef,
  promoSubjectHref, validatePromo, isoToLocalInput, formatPrice, friendlyErrorIn, whatsappShareUrl, uploadClassifiedMedia, uploadPaymentProof, validateDocument,
  paymentProofUrl, getPlatformSettings, updatePlatformSettings, PROMO_KIND_LABELS, PROMO_SUBJECT_LABELS, LIVE_DURATIONS, PLAN_METHOD_LABELS,
  type PromoPost, type PromoKind, type PromoSubject, type PromoSubjectKind, type MyPromoPost, type AdminPromoBoost, type AdminPromoPost, type PaymentMethodPlan,
  type PlatformSettings, LANG_TAGS as LANG_TAG_OF } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useDataSaver } from "../lib/dataSaver";
import { ItemCard } from "./ItemCard";
import { LiteImg } from "./LiteImg";
import { VideoField } from "./Video";
import { PaymentDetails } from "./Plans";
import { ReportButton } from "./Trust";
import { useT, eventDateIn, formatDateIn, type TFunction } from "../lib/i18n";
import type { Lang } from "@huambo-online/core";

const thumb = (p: Pick<PromoPost, "cover_url" | "external_url">) => p.cover_url || youtubeThumb(p.external_url);
/** Estado da live na língua escolhida. */
function liveTextIn(p: Pick<PromoPost, "kind" | "live_starts_at" | "live_ends_at">, lang: Lang, t: TFunction): string {
  if (lang === "pt") return liveStateText(p as PromoPost);
  const state = liveStateAt(p as PromoPost);
  return state === "live" ? "🔴 " + t("promo.live_now") : state === "upcoming" ? "⏰ " + eventDateIn(p.live_starts_at!, lang) : state === "ended" ? t("promo.live_ended") : "";
}
/** «12 visualizações» na língua escolhida. */
function viewsIn(n: number, lang: Lang, t: TFunction): string {
  return lang === "pt" ? viewsText(n) : t(n === 1 ? "promo.views_one" : "promo.views_many", { n: (n || 0).toLocaleString(LANG_TAG_OF[lang]) });
}

/** Cartão de vídeo/live (listas, página inicial, perfis). */
export function PromoCard({ p }: { p: PromoPost }) {
  const { lang, t } = useT();
  const state = liveStateAt(p);
  const img = thumb(p);
  const liveText = lang === "pt" ? liveStateText(p) : state === "live" ? "🔴 " + t("promo.live_now") : state === "upcoming" ? "⏰ " + eventDateIn(p.live_starts_at!, lang) : state === "ended" ? t("promo.live_ended") : "";
  const views = lang === "pt" ? viewsText(p.views) : t(p.views === 1 ? "promo.views_one" : "promo.views_many", { n: (p.views || 0).toLocaleString(LANG_TAG_OF[lang]) });
  return <ItemCard href={"/videos/" + p.id} media={img ? [img] : null} icon={p.kind === "live" ? "🔴" : "🎬"} title={p.title}
    price={p.kind === "live" ? liveText : "🎬 " + t("promo.video")} featured={p.featured} video={p.kind === "video"}
    tag={state === "live" ? "🔴 " + t("promo.live_badge") : state === "ended" ? t("promo.ended") : undefined} tagRed={state === "live"}
    meta={`${p.subject_name} · ${views}`} />;
}

/** Lista pública: lives em direto, destaques, próximas lives e vídeos. */
export function PromoList() {
  const { lang, t, tc } = useT();
  const [kind, setKind] = useState<PromoKind | "">(""); const [items, setItems] = useState<PromoPost[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { setItems(null); void promoFeed(supabase(), { kind, limit: 60 }).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setItems(r.data); } }); }, [kind]);
  const liveNow = items?.filter(p => liveStateAt(p) === "live") ?? [];
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>🎬 {t("sv.pr_title")}</h1>
      <a className="btn" href="/videos/meus">➕ {t("sv.pr_publish")}</a>
    </div>
    <p className="muted" style={{ margin: 0 }}>{t("sv.pr_intro")}</p>
    <div className="chips" role="group" aria-label={t("sv.show")}>
      {([["", t("sv.all")], ["live", "🔴 " + t("sv.pr_lives")], ["video", "🎬 " + t("sv.pr_videos")]] as const).map(([k, l]) =>
        <button key={k} type="button" className={"chip" + (kind === k ? " on" : "")} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
    </div>
    {liveNow.length > 0 && <p className="banner yellow" role="status" style={{ margin: 0 }}>🔴 {t(liveNow.length === 1 ? "sv.pr_live_now_one" : "sv.pr_live_now_many", { n: liveNow.length })}.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t(kind === "live" ? "sv.pr_none_lives" : kind === "video" ? "sv.pr_none_videos" : "sv.pr_none_any")} {t("sv.pr_are_you")} <a href="/videos/meus">{t("sv.pr_publish_first")}</a>.</p> :
      <div className="results-grid">{items.map(p => <PromoCard key={p.id} p={p} />)}</div>}
  </main>;
}

/** Secção «Vídeos e lives» nas páginas de profissional, empresa e loja. */
export function PromoSection({ kind, id }: { kind: PromoSubjectKind; id: string }) {
  const { t } = useT();
  const [items, setItems] = useState<PromoPost[]>([]);
  useEffect(() => { void promoFeed(supabase(), { subjectKind: kind, subjectId: id, limit: 12 }).then(r => setItems(r.data)); }, [kind, id]);
  if (!items.length) return null;
  return <section className="stack" aria-labelledby={"videos-" + id}>
    <h2 id={"videos-" + id} style={{ margin: 0 }}>🎬 {t("sv.pr_title")}</h2>
    <div className="shelf">{items.map(p => <PromoCard key={p.id} p={p} />)}</div>
  </section>;
}

/** Leitor: vídeo enviado (só descarrega ao carregar ▶), YouTube embutido a pedido, ou ligação para a rede social. */
function PromoPlayer({ p }: { p: PromoPost }) {
  const { t: tr } = useT();
  const lite = useDataSaver(); const [embed, setEmbed] = useState(false);
  const platform = videoPlatform(p.external_url); const src = embedUrl(p.external_url); const state = liveStateAt(p);
  if (p.video_url) return <video src={p.video_url} poster={p.cover_url ?? undefined} controls preload="none" playsInline aria-label={tr("sv.pr_video_of", { title: p.title })}
    style={{ width: "100%", maxHeight: 520, background: "#000", borderRadius: 16 }} />;
  const t = thumb(p);
  const watchLabel = p.kind === "live" ? (state === "live" ? "🔴 " + tr("sv.pr_watch_live_here") : state === "ended" ? "▶ " + tr("sv.pr_watch_rec_here") : "📅 " + tr("sv.pr_open_live_here")) : "▶ " + tr("sv.pr_watch_here");
  return <div className="stack" style={{ gap: 10 }}>
    {embed && src ? <iframe title={tr(p.kind === "live" ? "sv.pr_live_of" : "sv.pr_video_of", { title: p.title })} src={src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
      style={{ width: "100%", aspectRatio: "16/9", border: 0, borderRadius: 16, background: "#000" }} />
      : t ? <LiteImg src={t} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16 }} placeholder={p.kind === "live" ? "🔴" : "🎬"} /> : null}
    <div className="row">
      {src && !embed && <button type="button" className={state === "live" ? "danger" : ""} onClick={() => setEmbed(true)}>{watchLabel}{lite ? " " + tr("sv.pr_uses_data") : ""}</button>}
      {p.external_url && <a className={"btn" + (src ? " secondary" : state === "live" ? " danger" : "")} href={p.external_url} target="_blank" rel="noopener nofollow">
        {src ? tr("sv.pr_open_on", { platform: platform ?? "" }) : tr("sv.pr_action_on", { action: p.kind === "live" ? (state === "live" ? "🔴 " + tr("sv.pr_join_live") : state === "ended" ? "▶ " + tr("sv.pr_watch_rec") : "📅 " + tr("sv.pr_open_live_page")) : "▶ " + tr("sv.view"), platform: platform ?? tr("sv.pr_site") })}</a>}
    </div>
  </div>;
}

/** Página do vídeo/live. */
export function PromoDetail({ id }: { id: string }) {
  const { lang, t, tc } = useT();
  const [p, setP] = useState<PromoPost | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    void getPromoPost(supabase(), id).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); setP(r.data); });
    void currentUserId().then(setUid);
    void recordPromoView(supabase(), id);
  }, [id]);
  if (p === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!p) return <main className="stack"><h1>{t("sv.pr_not_found")}</h1><p>{error || t("sv.pr_unavailable")}</p><a href="/videos">← {t("sv.pr_see_all")}</a></main>;
  const mine = uid === p.owner_id; const state = liveStateAt(p);
  const share = tc(promoShareMessage(typeof window === "undefined" ? "" : window.location.origin, p));
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/videos">← {t("sv.pr_title")}</a>
    {p.status === "hidden" && <p className="banner yellow" role="alert" style={{ margin: 0 }}>{t("sv.pr_hidden_admin")}{p.hidden_reason ? ": " + p.hidden_reason : ""}. {t("sv.pr_owner_only")}</p>}
    <div className="row" style={{ alignItems: "center" }}>
      <span className="badge">{tc(PROMO_KIND_LABELS[p.kind])}</span>
      {p.featured && <span className="badge">⭐ {t("sv.featured")}</span>}
      {state === "live" && <span className="badge" style={{ background: "#b3261e", color: "#fff", borderColor: "#b3261e" }}>🔴 {t("promo.live_badge")}</span>}
      <small className="muted">{promoRef(p.ref_no)} · {viewsIn(p.views, lang, t)}</small>
    </div>
    <h1 style={{ margin: 0 }}>{p.title}</h1>
    {p.kind === "live" && <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{liveTextIn(p, lang, t)}</p>}
    <PromoPlayer p={p} />
    <a href={promoSubjectHref(p.subject_kind, p.subject_id)} className="card row" style={{ color: "inherit", textDecoration: "none", alignItems: "center" }}>
      {p.subject_picture ? <LiteImg src={p.subject_picture} alt="" style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover" }} placeholder="👤" /> : <span aria-hidden style={{ fontSize: 34 }}>👤</span>}
      <span><strong>{p.subject_name}</strong><br /><small className="muted">{tc(PROMO_SUBJECT_LABELS[p.subject_kind])} · {t("sv.pr_see_profile")} →</small></span>
    </a>
    {p.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.description}</p>}
    <div className="row">
      <a className="btn secondary" href={whatsappShareUrl(share)} target="_blank" rel="noopener">📲 {t("sv.share_wa")}</a>
      {mine && <a className="btn secondary" href={"/videos/publicar?editar=" + p.id}>✏️ {t("common.edit")}</a>}
      {mine && <a className="btn secondary" href="/videos/meus">⭐ {t("sv.pr_boost_mine")}</a>}
    </div>
    {!mine && <ReportButton type="promo_post" id={p.id} label={t("sv.pr_report")} />}
  </main>;
}

function EmbedHint({ url }: { url: string }) {
  const { tc } = useT();
  const h = embedHint(url);
  return h ? <small role="status" className={h.ok ? "ok" : ""} style={{ marginTop: -6 }}>{tc(h.text)}</small> : null;
}

/** Formulário: publicar ou editar vídeo/live. */
export function PromoForm() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [subjects, setSubjects] = useState<PromoSubject[] | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [subject, setSubject] = useState(""); const [kind, setKind] = useState<PromoKind>("video"); const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState(""); const [externalUrl, setExternalUrl] = useState(""); const [cover, setCover] = useState<string | null>(null); const [file, setFile] = useState<File | null>(null);
  const [startsAt, setStartsAt] = useState(""); const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    const u = await currentUserId(); setUid(u); if (!u) return;
    const s = await listMyPromoSubjects(supabase()); setSubjects(s.data); if (s.data.length === 1) setSubject(s.data[0].kind + ":" + s.data[0].id);
    const q = new URLSearchParams(window.location.search);
    if (q.get("tipo") === "live") setKind("live");
    const e = q.get("editar");
    if (e) {
      const r = await getPromoPost(supabase(), e); const p = r.data; if (!p) { setError(t("sv.pr_not_found") + "."); return; }
      setEditId(p.id); setSubject(p.subject_kind + ":" + p.subject_id); setKind(p.kind); setTitle(p.title); setDescription(p.description ?? ""); setVideoUrl(p.video_url ?? "");
      setExternalUrl(p.external_url ?? ""); setCover(p.cover_url); setStartsAt(isoToLocalInput(p.live_starts_at));
      if (p.live_starts_at && p.live_ends_at) setMinutes(Math.round((Date.parse(p.live_ends_at) - Date.parse(p.live_starts_at)) / 60000));
    }
  })(); }, []);
  if (uid === undefined || (uid && subjects === null)) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🎬 {t("sv.pr_publish")}</h1><a className="btn" href="/conta/login?voltar=/videos/publicar">{t("sv.ev_login_publish")}</a></main>;
  if (!subjects!.length) return <main className="stack" style={{ maxWidth: 760 }}><h1>🎬 {t("sv.pr_publish")}</h1>
    <p>{t("sv.pr_need_profile")}</p>
    <div className="row"><a className="btn" href="/conta/profissional">🧰 {t("sv.pro_profile")}</a><a className="btn secondary" href="/conta/empresas">🏪 {t("sv.biz_register")}</a><a className="btn secondary" href="/conta/produtos">🛍️ {t("sv.pr_open_shop")}</a></div></main>;
  const [subjectKind, subjectId] = subject.split(":") as [PromoSubjectKind | "", string];
  const input = { subjectKind: subjectKind ?? "", subjectId: subjectId ?? "", kind, title, description, videoUrl: videoUrl || null, externalUrl, coverUrl: cover, liveStartsAt: startsAt, liveMinutes: minutes };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bad = validatePromo(input, editId ? 0 : Date.now()); if (bad) { setError(tc(bad)); return; }
    if (file) { const b = validateDocument({ size: file.size, type: file.type }); if (b || !file.type.startsWith("image/")) { setError(b ? tc(b) : t("sv.pr_cover_photo")); return; } }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (file) { const up = await uploadClassifiedMedia(supabase(), file, uid!, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.pr_cover_fail")); coverUrl = up.data; }
      const r = await savePromoPost(supabase(), { ...input, coverUrl }, editId ?? undefined);
      if (r.error || !r.data) throw r.error ?? new Error(t("sv.publish_fail"));
      window.location.href = "/videos/" + r.data.id;
    } catch (err) { setError(friendlyErrorIn(err, lang)); } finally { setBusy(false); }
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/videos/meus">← {t("sv.pr_mine")}</a>
    <h1 style={{ margin: 0 }}>{editId ? "✏️ " + t("common.edit") : "🎬 " + t("sv.pr_publish")}</h1>
    <form className="stack" onSubmit={save}>
      <label>{t("sv.pr_on_behalf")}<select value={subject} onChange={e => setSubject(e.target.value)} disabled={!!editId}>
        <option value="">— {t("sv.f_choose")} —</option>
        {subjects!.map(s => <option key={s.kind + s.id} value={s.kind + ":" + s.id}>{tc(PROMO_SUBJECT_LABELS[s.kind])}: {s.name}</option>)}
      </select></label>
      {!editId && <div className="row" role="radiogroup" aria-label={t("sv.pr_what_publish")}>
        {(["video", "live"] as PromoKind[]).map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "" : "secondary"} onClick={() => setKind(k)}>
          {k === "video" ? "🎬 " + t("sv.pr_ad_video") : "🔴 " + t("sv.pr_announce_live")}</button>)}
      </div>}
      <label>{t("sv.title")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={kind === "live" ? t("sv.pr_title_ph_live") : t("sv.pr_title_ph_video")} /></label>
      <label>{t("sv.desc_opt")}<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} /></label>
      {kind === "video" ? <>
        <VideoField value={videoUrl} onChange={setVideoUrl} />
        <label>{t("sv.pr_paste_link")}<input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} inputMode="url" placeholder="https://youtu.be/…" /></label>
        <EmbedHint url={externalUrl} />
      </> : <>
        <p className="card" style={{ margin: 0 }}>{t("sv.pr_live_hint")}</p>
        <label>{t("sv.pr_live_link")}<input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} inputMode="url" placeholder="https://www.youtube.com/live/…" /></label>
        <EmbedHint url={externalUrl} />
        <div className="row">
          <label style={{ flex: 1, minWidth: 220 }}>{t("sv.ev_starts")}<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
          <label style={{ flex: 1, minWidth: 180 }}>{t("sv.pr_lasts")}<select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
            {[...LIVE_DURATIONS.map(d => d.minutes), ...(LIVE_DURATIONS.some(d => d.minutes === minutes) ? [] : [minutes])].map(m => <option key={m} value={m}>{(() => { const l = LIVE_DURATIONS.find(d => d.minutes === m)?.label; return l ? tc(l) : t("sv.pr_minutes", { n: m }); })()}</option>)}
          </select></label>
        </div>
      </>}
      <fieldset className="card stack" style={{ gap: 8 }}>
        <legend style={{ fontWeight: 700 }}>🖼️ {t("sv.pr_cover_opt")}</legend>
        <small>{t("sv.pr_cover_hint")}</small>
        {cover && !file && <div className="row" style={{ alignItems: "center" }}><LiteImg src={cover} alt={t("sv.pr_cover_current")} style={{ width: 120, borderRadius: 8 }} /><button type="button" className="secondary" onClick={() => setCover(null)}>{t("sv.pr_cover_remove")}</button></div>}
        <input type="file" aria-label={t("sv.pr_cover_choose")} accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </fieldset>
      <small>{t("sv.pr_rules")}</small>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? t("sv.publishing") : editId ? t("sv.save_changes") : "✅ " + t("sv.publish")}</button>
    </form>
  </main>;
}

/** Destacar um vídeo/live (paga à plataforma). */
function PromoBoostBox({ post, uid, settings, onDone }: { post: MyPromoPost; uid: string; settings: PlatformSettings | null; onDone: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const featured = !!post.featured_until && Date.parse(post.featured_until) > Date.now();
  const ended = post.kind === "live" && !!post.live_ends_at && Date.parse(post.live_ends_at) < Date.now();
  async function send() {
    if (!reference.trim() && !file) { setError(t("sv.need_ref_or_proof")); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail")); proof = up.data; }
      const r = await submitPromoBoost(supabase(), post.id, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      setOpen(false); onDone(t("sv.ev_boost_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  const price = Number(settings?.promo_boost_price_kz ?? 1000); const days = Number(settings?.promo_boost_days ?? 7);
  return <div className="stack" style={{ gap: 8 }}>
    {featured && <span className="ok">⭐ {t("sv.featured_until_on", { date: formatDateIn(post.featured_until!, lang) })}</span>}
    {post.boost_status === "pending" && <span>⏳ {t("sv.pr_boost_pending")}</span>}
    {post.boost_status === "rejected" && !featured && <span className="error">{t("sv.pr_boost_rejected")}{post.boost_note ? ": " + post.boost_note : ""}</span>}
    {post.status === "published" && !ended && post.boost_status !== "pending" && (open ? <div className="card stack" style={{ gap: 10 }}>
      <strong>⭐ {t("sv.pr_boost_price", { price: formatPrice(price), days })}</strong>
      <span>{t("sv.pr_boost_text")}</span>
      <strong>1. {t("sv.pay_ho_details")}</strong>
      <PaymentDetails s={settings} />
      <strong>2. {t("sv.tell_how_paid")}</strong>
      <div className="row" role="radiogroup" aria-label={t("sv.how_paid")}>{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
      <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder={t("sv.ref_ph")} /></label>
      <label>{t("sv.proof_opt")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={send}>{busy ? t("sv.sending") : t("sv.send_payment")}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>{t("common.cancel")}</button></div>
    </div> : <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{featured ? "⭐ " + t("sv.pr_more_days") : "⭐ " + t("sv.pr_boost_btn", { price: formatPrice(price), days })}</button>)}
  </div>;
}

/** Os meus vídeos e lives. */
export function MyPromos() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyPromoPost[] | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, s] = await Promise.all([myPromoPosts(supabase()), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); setItems(a.data); setSettings(s.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🎬 {t("sv.pr_mine")}</h1><a className="btn" href="/conta/login?voltar=/videos/meus">{t("auth.login")}</a></main>;
  async function remove(p: MyPromoPost) {
    if (!confirm(t("sv.delete_named_final_q", { name: p.title }))) return;
    const r = await deletePromoPost(supabase(), p.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.deleted")); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/videos">← {t("sv.pr_title")}</a>
    <h1 style={{ margin: 0 }}>🎬 {t("sv.pr_mine")}</h1>
    <div className="row"><a className="btn" href="/videos/publicar">🎬 {t("sv.pr_publish_video")}</a><a className="btn secondary" href="/videos/publicar?tipo=live">🔴 {t("sv.pr_announce_live_short")}</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.pr_none_mine")}</p> :
      items.map(p => <article key={p.id} className="card stack" style={{ gap: 6 }}>
        <a href={"/videos/" + p.id} style={{ fontWeight: 800, fontSize: 18 }}>{p.title}</a>
        <small>{promoRef(p.ref_no)} · {tc(PROMO_KIND_LABELS[p.kind])} · {p.subject_name} · {viewsIn(p.views, lang, t)}{p.kind === "live" ? " · " + liveTextIn(p, lang, t) : ""}</small>
        {p.status === "hidden" && <span className="error">{t("sv.pr_hidden_admin")}{p.hidden_reason ? ": " + p.hidden_reason : ""}</span>}
        <PromoBoostBox post={p} uid={uid} settings={settings} onDone={m => { setNotice(m); void load(); }} />
        <div className="row"><a className="btn secondary" href={"/videos/publicar?editar=" + p.id}>✏️ {t("common.edit")}</a><button type="button" className="secondary" onClick={() => void remove(p)}>🗑️ {t("common.delete")}</button></div>
      </article>)}
  </main>;
}

/** Administração: destaques por confirmar, moderação e preço do destaque. */
export function AdminPromos() {
  const { lang, t, tc } = useT();
  const [s, setS] = useState<PlatformSettings | null>(null); const [boosts, setBoosts] = useState<AdminPromoBoost[]>([]); const [posts, setPosts] = useState<AdminPromoPost[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c] = await Promise.all([getPlatformSettings(supabase()), listPromoBoostsForAdmin(supabase(), "pending"), listPromoPostsForAdmin(supabase())]);
    setS(a.data); if (b.error || c.error) setError(friendlyErrorIn(b.error ?? c.error, lang)); setBoosts(b.data); setPosts(c.data);
  }
  useEffect(() => { void load(); }, []);
  async function decide(b: AdminPromoBoost, ok: boolean) {
    const note = ok ? "" : prompt(t("sv.why_not_confirm_owner")) ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(t("sv.confirm_amount_from", { amount: formatPrice(b.amount), name: b.owner_name }))) return;
    const r = await decidePromoBoost(supabase(), b.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("sv.pr_adm_boost_ok") : t("sv.pr_adm_boost_no")); await load(); }
  }
  async function hide(p: AdminPromoPost, hidden: boolean) {
    const reason = hidden ? prompt(t("sv.why_hide")) ?? "" : "";
    if (hidden && !reason.trim()) return;
    const r = await setPromoHidden(supabase(), p.id, hidden, reason);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(hidden ? t("sv.hidden_done") : t("sv.shown_again")); await load(); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const price = Number(s.promo_boost_price_kz), days = Number(s.promo_boost_days);
    if (!(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60) { setError(t("sv.pr_adm_check")); return; }
    const r = await updatePlatformSettings(supabase(), { promo_boost_price_kz: price, promo_boost_days: days });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(t("sv.pr_adm_saved")); }
  }
  async function openProof(path: string) { const { data } = await paymentProofUrl(supabase(), path); if (data) window.open(data, "_blank", "noopener"); else setError(t("sv.proof_open_fail")); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🎬 {t("sv.pr_title")}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card row" style={{ alignItems: "end" }} onSubmit={save}>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.ev_adm_boost_price")}<input value={String(s.promo_boost_price_kz ?? "")} onChange={e => setS({ ...s, promo_boost_price_kz: e.target.value })} inputMode="numeric" /></label>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.ev_adm_boost_days")}<input value={String(s.promo_boost_days ?? "")} onChange={e => setS({ ...s, promo_boost_days: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      <button type="submit">{t("common.save")}</button>
    </form>}
    <h3 style={{ margin: 0 }}>⭐ {t("sv.pr_adm_boosts", { n: boosts.length })}</h3>
    {boosts.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("sv.none")}</p>}
    {boosts.map(b => <article key={b.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(b.amount)} · {t("sv.n_days", { n: b.days })} · {b.owner_name}</strong>
      <small>{t("sv.request_no", { n: b.ref_no })} · <a href={"/videos/" + b.post_id}>{promoRef(b.post_ref)} {b.post_title}</a> · {tc(PLAN_METHOD_LABELS[b.method])}{b.reference ? ` · ${t("sv.ref_short")}: ${b.reference}` : ""}</small>
      <div className="row">
        {b.proof_path && <button type="button" className="secondary" onClick={() => void openProof(b.proof_path!)}>📄 {t("sv.see_proof")}</button>}
        <button type="button" onClick={() => void decide(b, true)}>✅ {t("common.confirm")}</button><button type="button" className="secondary" onClick={() => void decide(b, false)}>❌ {t("sv.refuse")}</button>
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>{t("sv.pr_adm_posts")}</h3>
    {posts.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("sv.pr_adm_no_posts")}</p>}
    {posts.map(p => <article key={p.id} className="card" style={{ gap: 6 }}>
      <a href={"/videos/" + p.id}><strong>{tc(PROMO_KIND_LABELS[p.kind])} · {p.title}</strong></a>
      <small>{promoRef(p.ref_no)} · {tc(PROMO_SUBJECT_LABELS[p.subject_kind])}: {p.subject_name} · {viewsIn(p.views, lang, t)}{p.reports > 0 ? " · 🚩 " + t("sv.n_reports", { n: p.reports }) : ""}{p.status === "hidden" ? ` · ${t("sv.hidden")}: ${p.hidden_reason ?? ""}` : ""}</small>
      <div className="row">{p.status === "published" ? <button type="button" className="secondary" onClick={() => void hide(p, true)}>🙈 {t("sv.hide")}</button>
        : <button type="button" className="secondary" onClick={() => void hide(p, false)}>👁️ {t("sv.show_again")}</button>}</div>
    </article>)}
  </section>;
}
