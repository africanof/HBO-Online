"use client";
import { useEffect, useState } from "react";
import { promoFeed, getPromoPost, recordPromoView, savePromoPost, deletePromoPost, myPromoPosts, listMyPromoSubjects, submitPromoBoost, listPromoBoostsForAdmin,
  decidePromoBoost, listPromoPostsForAdmin, setPromoHidden, videoPlatform, embedUrl, embedHint, youtubeThumb, liveStateAt, liveStateText, viewsText, promoShareMessage, promoRef,
  promoSubjectHref, validatePromo, isoToLocalInput, formatDate, formatPrice, friendlyError, whatsappShareUrl, uploadClassifiedMedia, uploadPaymentProof, validateDocument,
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
import { useT, eventDateIn } from "../lib/i18n";

const thumb = (p: Pick<PromoPost, "cover_url" | "external_url">) => p.cover_url || youtubeThumb(p.external_url);

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
  const [kind, setKind] = useState<PromoKind | "">(""); const [items, setItems] = useState<PromoPost[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { setItems(null); void promoFeed(supabase(), { kind, limit: 60 }).then(r => { if (r.error) setError(friendlyError(r.error)); else { setError(""); setItems(r.data); } }); }, [kind]);
  const liveNow = items?.filter(p => liveStateAt(p) === "live") ?? [];
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>🎬 Vídeos e lives</h1>
      <a className="btn" href="/videos/meus">➕ Publicar vídeo ou live</a>
    </div>
    <p className="muted" style={{ margin: 0 }}>Publicidade em vídeo e transmissões em direto de profissionais, lojas e empresas do Huambo.</p>
    <div className="chips" role="group" aria-label="Mostrar">
      {([["", "Todos"], ["live", "🔴 Lives"], ["video", "🎬 Vídeos"]] as const).map(([k, l]) =>
        <button key={k} type="button" className={"chip" + (kind === k ? " on" : "")} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
    </div>
    {liveNow.length > 0 && <p className="banner yellow" role="status" style={{ margin: 0 }}>🔴 {liveNow.length === 1 ? "Há 1 live em direto agora" : `Há ${liveNow.length} lives em direto agora`}.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não há {kind === "live" ? "lives" : kind === "video" ? "vídeos" : "vídeos nem lives"}. É profissional, loja ou empresa? <a href="/videos/meus">Publique o primeiro</a>.</p> :
      <div className="results-grid">{items.map(p => <PromoCard key={p.id} p={p} />)}</div>}
  </main>;
}

/** Secção «Vídeos e lives» nas páginas de profissional, empresa e loja. */
export function PromoSection({ kind, id }: { kind: PromoSubjectKind; id: string }) {
  const [items, setItems] = useState<PromoPost[]>([]);
  useEffect(() => { void promoFeed(supabase(), { subjectKind: kind, subjectId: id, limit: 12 }).then(r => setItems(r.data)); }, [kind, id]);
  if (!items.length) return null;
  return <section className="stack" aria-labelledby={"videos-" + id}>
    <h2 id={"videos-" + id} style={{ margin: 0 }}>🎬 Vídeos e lives</h2>
    <div className="shelf">{items.map(p => <PromoCard key={p.id} p={p} />)}</div>
  </section>;
}

/** Leitor: vídeo enviado (só descarrega ao carregar ▶), YouTube embutido a pedido, ou ligação para a rede social. */
function PromoPlayer({ p }: { p: PromoPost }) {
  const lite = useDataSaver(); const [embed, setEmbed] = useState(false);
  const platform = videoPlatform(p.external_url); const src = embedUrl(p.external_url); const state = liveStateAt(p);
  if (p.video_url) return <video src={p.video_url} poster={p.cover_url ?? undefined} controls preload="none" playsInline aria-label={"Vídeo: " + p.title}
    style={{ width: "100%", maxHeight: 520, background: "#000", borderRadius: 16 }} />;
  const t = thumb(p);
  const watchLabel = p.kind === "live" ? (state === "live" ? "🔴 Ver a live aqui" : state === "ended" ? "▶ Ver a gravação aqui" : "📅 Abrir a live aqui") : "▶ Ver aqui";
  return <div className="stack" style={{ gap: 10 }}>
    {embed && src ? <iframe title={(p.kind === "live" ? "Live: " : "Vídeo: ") + p.title} src={src} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
      style={{ width: "100%", aspectRatio: "16/9", border: 0, borderRadius: 16, background: "#000" }} />
      : t ? <LiteImg src={t} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16 }} placeholder={p.kind === "live" ? "🔴" : "🎬"} /> : null}
    <div className="row">
      {src && !embed && <button type="button" className={state === "live" ? "danger" : ""} onClick={() => setEmbed(true)}>{watchLabel}{lite ? " (gasta dados)" : ""}</button>}
      {p.external_url && <a className={"btn" + (src ? " secondary" : state === "live" ? " danger" : "")} href={p.external_url} target="_blank" rel="noopener nofollow">
        {src ? `Abrir no ${platform}` : `${p.kind === "live" ? (state === "live" ? "🔴 Entrar na live" : state === "ended" ? "▶ Ver a gravação" : "📅 Abrir a página da live") : "▶ Ver"} no ${platform ?? "site"}`}</a>}
    </div>
  </div>;
}

/** Página do vídeo/live. */
export function PromoDetail({ id }: { id: string }) {
  const [p, setP] = useState<PromoPost | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    void getPromoPost(supabase(), id).then(r => { if (r.error) setError(friendlyError(r.error)); setP(r.data); });
    void currentUserId().then(setUid);
    void recordPromoView(supabase(), id);
  }, [id]);
  if (p === undefined) return <main><p>A carregar…</p></main>;
  if (!p) return <main className="stack"><h1>Vídeo não encontrado</h1><p>{error || "Este vídeo já não está disponível."}</p><a href="/videos">← Ver vídeos e lives</a></main>;
  const mine = uid === p.owner_id; const state = liveStateAt(p);
  const share = promoShareMessage(typeof window === "undefined" ? "" : window.location.origin, p);
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/videos">← Vídeos e lives</a>
    {p.status === "hidden" && <p className="banner yellow" role="alert" style={{ margin: 0 }}>Escondido pela administração{p.hidden_reason ? ": " + p.hidden_reason : ""}. Só o dono vê esta página.</p>}
    <div className="row" style={{ alignItems: "center" }}>
      <span className="badge">{PROMO_KIND_LABELS[p.kind]}</span>
      {p.featured && <span className="badge">⭐ Destaque</span>}
      {state === "live" && <span className="badge" style={{ background: "#b3261e", color: "#fff", borderColor: "#b3261e" }}>🔴 EM DIRETO</span>}
      <small className="muted">{promoRef(p.ref_no)} · {viewsText(p.views)}</small>
    </div>
    <h1 style={{ margin: 0 }}>{p.title}</h1>
    {p.kind === "live" && <p style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{liveStateText(p)}</p>}
    <PromoPlayer p={p} />
    <a href={promoSubjectHref(p.subject_kind, p.subject_id)} className="card row" style={{ color: "inherit", textDecoration: "none", alignItems: "center" }}>
      {p.subject_picture ? <LiteImg src={p.subject_picture} alt="" style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover" }} placeholder="👤" /> : <span aria-hidden style={{ fontSize: 34 }}>👤</span>}
      <span><strong>{p.subject_name}</strong><br /><small className="muted">{PROMO_SUBJECT_LABELS[p.subject_kind]} · Ver perfil e contactos →</small></span>
    </a>
    {p.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{p.description}</p>}
    <div className="row">
      <a className="btn secondary" href={whatsappShareUrl(share)} target="_blank" rel="noopener">📲 Partilhar no WhatsApp</a>
      {mine && <a className="btn secondary" href={"/videos/publicar?editar=" + p.id}>✏️ Editar</a>}
      {mine && <a className="btn secondary" href="/videos/meus">⭐ Destacar / os meus vídeos</a>}
    </div>
    {!mine && <ReportButton type="promo_post" id={p.id} label="Denunciar este vídeo" />}
  </main>;
}

function EmbedHint({ url }: { url: string }) {
  const h = embedHint(url);
  return h ? <small role="status" className={h.ok ? "ok" : ""} style={{ marginTop: -6 }}>{h.text}</small> : null;
}

/** Formulário: publicar ou editar vídeo/live. */
export function PromoForm() {
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
      const r = await getPromoPost(supabase(), e); const p = r.data; if (!p) { setError("Vídeo não encontrado."); return; }
      setEditId(p.id); setSubject(p.subject_kind + ":" + p.subject_id); setKind(p.kind); setTitle(p.title); setDescription(p.description ?? ""); setVideoUrl(p.video_url ?? "");
      setExternalUrl(p.external_url ?? ""); setCover(p.cover_url); setStartsAt(isoToLocalInput(p.live_starts_at));
      if (p.live_starts_at && p.live_ends_at) setMinutes(Math.round((Date.parse(p.live_ends_at) - Date.parse(p.live_starts_at)) / 60000));
    }
  })(); }, []);
  if (uid === undefined || (uid && subjects === null)) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🎬 Publicar vídeo ou live</h1><a className="btn" href="/conta/login?voltar=/videos/publicar">Entrar para publicar</a></main>;
  if (!subjects!.length) return <main className="stack" style={{ maxWidth: 760 }}><h1>🎬 Publicar vídeo ou live</h1>
    <p>Os vídeos e as lives são para profissionais, lojas e empresas. Primeiro crie o seu perfil:</p>
    <div className="row"><a className="btn" href="/conta/profissional">🧰 Perfil profissional</a><a className="btn secondary" href="/conta/empresas">🏪 Registar empresa</a><a className="btn secondary" href="/conta/produtos">🛍️ Abrir a loja</a></div></main>;
  const [subjectKind, subjectId] = subject.split(":") as [PromoSubjectKind | "", string];
  const input = { subjectKind: subjectKind ?? "", subjectId: subjectId ?? "", kind, title, description, videoUrl: videoUrl || null, externalUrl, coverUrl: cover, liveStartsAt: startsAt, liveMinutes: minutes };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bad = validatePromo(input, editId ? 0 : Date.now()); if (bad) { setError(bad); return; }
    if (file) { const b = validateDocument({ size: file.size, type: file.type }); if (b || !file.type.startsWith("image/")) { setError(b ?? "A capa tem de ser uma fotografia."); return; } }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (file) { const up = await uploadClassifiedMedia(supabase(), file, uid!, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar a capa."); coverUrl = up.data; }
      const r = await savePromoPost(supabase(), { ...input, coverUrl }, editId ?? undefined);
      if (r.error || !r.data) throw r.error ?? new Error("Não foi possível publicar.");
      window.location.href = "/videos/" + r.data.id;
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/videos/meus">← Os meus vídeos e lives</a>
    <h1 style={{ margin: 0 }}>{editId ? "✏️ Editar" : "🎬 Publicar vídeo ou live"}</h1>
    <form className="stack" onSubmit={save}>
      <label>Em nome de<select value={subject} onChange={e => setSubject(e.target.value)} disabled={!!editId}>
        <option value="">— Escolha —</option>
        {subjects!.map(s => <option key={s.kind + s.id} value={s.kind + ":" + s.id}>{PROMO_SUBJECT_LABELS[s.kind]}: {s.name}</option>)}
      </select></label>
      {!editId && <div className="row" role="radiogroup" aria-label="O que quer publicar">
        {(["video", "live"] as PromoKind[]).map(k => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "" : "secondary"} onClick={() => setKind(k)}>
          {k === "video" ? "🎬 Vídeo de publicidade" : "🔴 Anunciar uma live"}</button>)}
      </div>}
      <label>Título<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={kind === "live" ? "Ex.: Tiramos dúvidas sobre painéis solares" : "Ex.: Promoção de pneus esta semana"} /></label>
      <label>Descrição (opcional)<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} /></label>
      {kind === "video" ? <>
        <VideoField value={videoUrl} onChange={setVideoUrl} />
        <label>…ou cole a ligação do vídeo (YouTube, Facebook, TikTok ou Instagram)<input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} inputMode="url" placeholder="https://youtu.be/…" /></label>
        <EmbedHint url={externalUrl} />
      </> : <>
        <p className="card" style={{ margin: 0 }}>Faça a live no YouTube ou no Facebook e as pessoas veem-na aqui dentro do Huambo Online (no TikTok e no Instagram abrem a rede social). Os seus seguidores recebem um aviso quando publicar e quando a live começar.</p>
        <label>Ligação da live<input value={externalUrl} onChange={e => setExternalUrl(e.target.value)} inputMode="url" placeholder="https://www.youtube.com/live/…" /></label>
        <EmbedHint url={externalUrl} />
        <div className="row">
          <label style={{ flex: 1, minWidth: 220 }}>Começa (dia e hora)<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
          <label style={{ flex: 1, minWidth: 180 }}>Dura<select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
            {[...LIVE_DURATIONS.map(d => d.minutes), ...(LIVE_DURATIONS.some(d => d.minutes === minutes) ? [] : [minutes])].map(m => <option key={m} value={m}>{LIVE_DURATIONS.find(d => d.minutes === m)?.label ?? m + " minutos"}</option>)}
          </select></label>
        </div>
      </>}
      <fieldset className="card stack" style={{ gap: 8 }}>
        <legend style={{ fontWeight: 700 }}>🖼️ Capa (opcional)</legend>
        <small>A imagem que aparece na lista. Sem capa, usamos a do YouTube ou um ícone.</small>
        {cover && !file && <div className="row" style={{ alignItems: "center" }}><LiteImg src={cover} alt="Capa atual" style={{ width: 120, borderRadius: 8 }} /><button type="button" className="secondary" onClick={() => setCover(null)}>Tirar a capa</button></div>}
        <input type="file" aria-label="Escolher a capa" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </fieldset>
      <small>Só publicidade verdadeira e legal. Vídeos enganosos ou ofensivos são escondidos pela administração.</small>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "A publicar…" : editId ? "Guardar alterações" : "✅ Publicar"}</button>
    </form>
  </main>;
}

/** Destacar um vídeo/live (paga à plataforma). */
function PromoBoostBox({ post, uid, settings, onDone }: { post: MyPromoPost; uid: string; settings: PlatformSettings | null; onDone: (m: string) => void }) {
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const featured = !!post.featured_until && Date.parse(post.featured_until) > Date.now();
  const ended = post.kind === "live" && !!post.live_ends_at && Date.parse(post.live_ends_at) < Date.now();
  async function send() {
    if (!reference.trim() && !file) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitPromoBoost(supabase(), post.id, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      setOpen(false); onDone("Pedido de destaque enviado. Fica ativo quando a administração confirmar o pagamento.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  const price = Number(settings?.promo_boost_price_kz ?? 1000); const days = Number(settings?.promo_boost_days ?? 7);
  return <div className="stack" style={{ gap: 8 }}>
    {featured && <span className="ok">⭐ Em destaque até {formatDate(post.featured_until!)}</span>}
    {post.boost_status === "pending" && <span>⏳ Destaque: pagamento à espera de confirmação.</span>}
    {post.boost_status === "rejected" && !featured && <span className="error">Destaque não confirmado{post.boost_note ? ": " + post.boost_note : ""}</span>}
    {post.status === "published" && !ended && post.boost_status !== "pending" && (open ? <div className="card stack" style={{ gap: 10 }}>
      <strong>⭐ Destaque: {formatPrice(price)} por {days} dias</strong>
      <span>Aparece primeiro em «Vídeos e lives» e na página inicial, com o selo «⭐ Destaque».</span>
      <strong>1. Pague ao Huambo Online para estes dados</strong>
      <PaymentDetails s={settings} />
      <strong>2. Diga-nos como pagou</strong>
      <div className="row" role="radiogroup" aria-label="Como pagou">{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PLAN_METHOD_LABELS[m]}</button>)}</div>
      <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="Ex.: 1234 5678" /></label>
      <label>Comprovativo (opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button type="button" disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar pagamento"}</button><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
    </div> : <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{featured ? "⭐ Juntar mais dias de destaque" : `⭐ Destacar (${formatPrice(price)} / ${days} dias)`}</button>)}
  </div>;
}

/** Os meus vídeos e lives. */
export function MyPromos() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyPromoPost[] | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, s] = await Promise.all([myPromoPosts(supabase()), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyError(a.error)); setItems(a.data); setSettings(s.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🎬 Os meus vídeos e lives</h1><a className="btn" href="/conta/login?voltar=/videos/meus">Entrar</a></main>;
  async function remove(p: MyPromoPost) {
    if (!confirm(`Apagar «${p.title}»? Não dá para voltar atrás.`)) return;
    const r = await deletePromoPost(supabase(), p.id);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Apagado."); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/videos">← Vídeos e lives</a>
    <h1 style={{ margin: 0 }}>🎬 Os meus vídeos e lives</h1>
    <div className="row"><a className="btn" href="/videos/publicar">🎬 Publicar vídeo</a><a className="btn secondary" href="/videos/publicar?tipo=live">🔴 Anunciar live</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não publicou vídeos nem lives. Mostre o seu trabalho, os seus produtos e as suas promoções!</p> :
      items.map(p => <article key={p.id} className="card stack" style={{ gap: 6 }}>
        <a href={"/videos/" + p.id} style={{ fontWeight: 800, fontSize: 18 }}>{p.title}</a>
        <small>{promoRef(p.ref_no)} · {PROMO_KIND_LABELS[p.kind]} · {p.subject_name} · {viewsText(p.views)}{p.kind === "live" ? " · " + liveStateText(p) : ""}</small>
        {p.status === "hidden" && <span className="error">Escondido pela administração{p.hidden_reason ? ": " + p.hidden_reason : ""}</span>}
        <PromoBoostBox post={p} uid={uid} settings={settings} onDone={m => { setNotice(m); void load(); }} />
        <div className="row"><a className="btn secondary" href={"/videos/publicar?editar=" + p.id}>✏️ Editar</a><button type="button" className="secondary" onClick={() => void remove(p)}>🗑️ Apagar</button></div>
      </article>)}
  </main>;
}

/** Administração: destaques por confirmar, moderação e preço do destaque. */
export function AdminPromos() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [boosts, setBoosts] = useState<AdminPromoBoost[]>([]); const [posts, setPosts] = useState<AdminPromoPost[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c] = await Promise.all([getPlatformSettings(supabase()), listPromoBoostsForAdmin(supabase(), "pending"), listPromoPostsForAdmin(supabase())]);
    setS(a.data); if (b.error || c.error) setError(friendlyError(b.error ?? c.error)); setBoosts(b.data); setPosts(c.data);
  }
  useEffect(() => { void load(); }, []);
  async function decide(b: AdminPromoBoost, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (o dono vai ler)") ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirmar ${formatPrice(b.amount)} de ${b.owner_name}?`)) return;
    const r = await decidePromoBoost(supabase(), b.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Confirmado: fica em destaque." : "Destaque recusado."); await load(); }
  }
  async function hide(p: AdminPromoPost, hidden: boolean) {
    const reason = hidden ? prompt("Porque esconde? (o dono vai ler)") ?? "" : "";
    if (hidden && !reason.trim()) return;
    const r = await setPromoHidden(supabase(), p.id, hidden, reason);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(hidden ? "Escondido." : "Voltou a aparecer."); await load(); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const price = Number(s.promo_boost_price_kz), days = Number(s.promo_boost_days);
    if (!(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60) { setError("Verifique o preço e os dias."); return; }
    const r = await updatePlatformSettings(supabase(), { promo_boost_price_kz: price, promo_boost_days: days });
    if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Preço do destaque guardado."); }
  }
  async function openProof(path: string) { const { data } = await paymentProofUrl(supabase(), path); if (data) window.open(data, "_blank", "noopener"); else setError("Não foi possível abrir o comprovativo."); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🎬 Vídeos e lives</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card row" style={{ alignItems: "end" }} onSubmit={save}>
      <label style={{ flex: 1, minWidth: 160 }}>Preço do destaque (Kz)<input value={String(s.promo_boost_price_kz ?? "")} onChange={e => setS({ ...s, promo_boost_price_kz: e.target.value })} inputMode="numeric" /></label>
      <label style={{ flex: 1, minWidth: 160 }}>Dias de destaque<input value={String(s.promo_boost_days ?? "")} onChange={e => setS({ ...s, promo_boost_days: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      <button type="submit">Guardar</button>
    </form>}
    <h3 style={{ margin: 0 }}>⭐ Destaques por confirmar ({boosts.length})</h3>
    {boosts.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum.</p>}
    {boosts.map(b => <article key={b.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(b.amount)} · {b.days} dias · {b.owner_name}</strong>
      <small>Pedido n.º {b.ref_no} · <a href={"/videos/" + b.post_id}>{promoRef(b.post_ref)} {b.post_title}</a> · {PLAN_METHOD_LABELS[b.method]}{b.reference ? ` · Ref.: ${b.reference}` : ""}</small>
      <div className="row">
        {b.proof_path && <button type="button" className="secondary" onClick={() => void openProof(b.proof_path!)}>📄 Ver comprovativo</button>}
        <button type="button" onClick={() => void decide(b, true)}>✅ Confirmar</button><button type="button" className="secondary" onClick={() => void decide(b, false)}>❌ Recusar</button>
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>Publicações (as mais denunciadas primeiro)</h3>
    {posts.length === 0 && <p className="muted" style={{ margin: 0 }}>Ainda não há publicações.</p>}
    {posts.map(p => <article key={p.id} className="card" style={{ gap: 6 }}>
      <a href={"/videos/" + p.id}><strong>{PROMO_KIND_LABELS[p.kind]} · {p.title}</strong></a>
      <small>{promoRef(p.ref_no)} · {PROMO_SUBJECT_LABELS[p.subject_kind]}: {p.subject_name} · {viewsText(p.views)}{p.reports > 0 ? ` · 🚩 ${p.reports} denúncia(s)` : ""}{p.status === "hidden" ? ` · Escondido: ${p.hidden_reason ?? ""}` : ""}</small>
      <div className="row">{p.status === "published" ? <button type="button" className="secondary" onClick={() => void hide(p, true)}>🙈 Esconder</button>
        : <button type="button" className="secondary" onClick={() => void hide(p, false)}>👁️ Voltar a mostrar</button>}</div>
    </article>)}
  </section>;
}
