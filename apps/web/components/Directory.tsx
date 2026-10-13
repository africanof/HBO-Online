"use client";
import { useEffect, useState } from "react";
import { listBusinessProducts, listProviders, listBusinesses, getProvider, getBusiness, listProviderServices, listReviewsFor, submitReview, contactDirectoryOwner,
  listDirectoryCategories, listProvinces, listMunicipalities, ratingLabel, whatsappLink, recordItemEvent, formatPrice, friendlyError, type ReviewTarget, categoryLabel,
  listProviderReviews, getUserStats, getBusinessStats, userStatsRows, businessStatsRows, memberSince } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { SaveButton, ShareButton, FollowButton, useRecordView } from "./Engage";
import { StatsBlock, StarPicker, RequestServiceBox, stars } from "./Reputation";
import { ReportButton, TrustBadges, ReviewReply } from "./Trust";
import { PortfolioGallery } from "./Portfolio";
import { LiteImg } from "./LiteImg";

type Kind = "providers" | "businesses";
type Option = { id: string; name: string };
const TEXT = {
  providers: { title: "Profissionais e serviços", search: "Ex.: eletricista, advogado, explicações…", empty: "Ainda não há profissionais registados nesta pesquisa.", base: "/profissionais", cta: "Sou profissional — criar perfil", ctaHref: "/conta/profissional" },
  businesses: { title: "Empresas e lojas", search: "Ex.: farmácia, oficina, restaurante…", empty: "Ainda não há empresas registadas nesta pesquisa.", base: "/empresas", cta: "Registar a minha empresa", ctaHref: "/conta/empresas" }
};

export function useTerritory() {
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [provinceId, setProvinceId] = useState("");
  useEffect(() => { void listProvinces(supabase()).then(({ data }) => { const l = (data ?? []) as Option[]; setProvinces(l); if (l.length === 1) setProvinceId(l[0].id); }); }, []);
  useEffect(() => { if (!provinceId) { setMunicipalities([]); return; } void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[])); }, [provinceId]);
  return { provinces, municipalities, provinceId, setProvinceId };
}

export function DirectoryList({ kind }: { kind: Kind }) {
  const t = TEXT[kind];
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");

  useEffect(() => {
    void listDirectoryCategories(supabase(), kind).then(({ data }) => setCategories(data ?? []));
    const start = new URLSearchParams(window.location.search).get("q") ?? "";
    setQ(start); void search(undefined, start);
  }, []);
  async function search(e?: React.FormEvent, query = q) {
    e?.preventDefault(); setError("");
    const f = { query, categoryId, municipalityId };
    const r: any = kind === "providers" ? await listProviders(supabase(), f) : await listBusinesses(supabase(), f);
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data ?? []);
  }

  return <main className="stack">
    <a href="/">← Início</a>
    <h1>{t.title}</h1>
    <a className="btn secondary" href={t.ctaHref} style={{ justifySelf: "start" }}>{t.cta}</a>
    <form onSubmit={search} className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
      <label>Pesquisar<input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} /></label>
      <label>Categoria<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Todas</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button type="submit" style={{ alignSelf: "end" }}>Pesquisar</button>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {items?.length === 0 && <p>{t.empty}</p>}
    <a href="/classificados/publicar?finalidade=wanted" className="banner yellow" style={{ color: "inherit", textDecoration: "none", fontWeight: 400, padding: 18 }}>
      <span><strong>Não encontrou quem procura?</strong> Publique «Procuro um eletricista, canalizador, doméstica…» e os profissionais da área são avisados.</span>
      <span className="btn">🔎 Publicar o que procuro</span>
    </a>
    <section className="grid">
      {items?.map(x => {
        const id = kind === "providers" ? x.user_id : x.id;
        const name = kind === "providers" ? x.display_name : x.name;
        const pic = kind === "providers" ? x.avatar_url : x.logo_url;
        return <a key={id} href={`${t.base}/${id}`} className="card" style={{ color: "inherit", textDecoration: "none", fontWeight: 400 }}>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            {pic ? <LiteImg placeholder={kind === "providers" ? "👤" : "🏪"} src={pic} alt="" style={{ width: 56, height: 56, borderRadius: kind === "providers" ? "50%" : 12, objectFit: "cover" }} /> : <span aria-hidden style={{ width: 56, height: 56, borderRadius: kind === "providers" ? "50%" : 12, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 28 }}>{kind === "providers" ? "👷" : "🏢"}</span>}
            <strong style={{ fontSize: 19 }}>{name}{x.verified ? " ✔️" : ""}</strong>
          </div>
          {kind === "providers" ? x.headline && <span>{x.headline}</span> : x.description && <span>{String(x.description).slice(0, 120)}</span>}
          <span className="item-meta">{[x.category_name, x.municipality_name].filter(Boolean).join(" · ")}</span>
          <span><strong>{ratingLabel(x.rating, x.review_count)}</strong></span>
        </a>;
      })}
    </section>
  </main>;
}

/** Produtos da empresa na Loja. */
function BusinessProducts({ ownerId, businessId }: { ownerId: string; businessId: string }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { void listBusinessProducts(supabase(), ownerId, businessId).then(r => setItems(r.data)); }, [businessId]);
  if (!items.length) return null;
  return <section className="stack"><h2 style={{ margin: 0 }}>🛍️ Produtos na Loja ({items.length})</h2>
    <div className="portfolio-grid">{items.slice(0, 12).map(p => <a key={p.id} className="portfolio-tile" href={"/loja/" + p.id} aria-label={`${p.name}, ${formatPrice(p.price, p.currency)}`}>
      {(p.media ?? [])[0] ? <LiteImg src={p.media[0]} alt="" loading="lazy" placeholder="📦" /> : <span aria-hidden style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 44 }}>📦</span>}
      <span className="portfolio-caption"><strong>{p.name}</strong><small>{formatPrice(p.price, p.currency)}</small></span>
    </a>)}</div>
  </section>;
}

export function DirectoryDetail({ kind, id }: { kind: Kind; id: string }) {
  const target: ReviewTarget = kind === "providers" ? { providerId: id } : { businessId: id };
  const [item, setItem] = useState<any>(null); const [services, setServices] = useState<any[]>([]); const [reviews, setReviews] = useState<any[]>([]);
  const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<{ rows: { label: string; value: string }[]; since: string }>({ rows: [], since: "" });
  const [message, setMessage] = useState(""); const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const c = supabase();
    const r: any = kind === "providers" ? await getProvider(c, id) : await getBusiness(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Não encontrado."); return; }
    setItem(r.data);
    if (kind === "providers") { const s = await listProviderServices(c, id); setServices(s.data ?? []); }
    const rv = await listProviderReviews(c, target);
    if (rv.error) { const old = await listReviewsFor(c, target); setReviews((old.data as any[]) ?? []); } else setReviews(rv.data);
    if (kind === "providers") { const st = await getUserStats(c, id); const rows = userStatsRows(st.data).filter(r => /serviço|Serviços|vendedor/.test(r.label));
      setStats({ rows: rows.length ? rows : [{ label: "Serviços prestados", value: "0" }], since: memberSince(st.data?.member_since) }); }
    else { const st = await getBusinessStats(c, id); setStats({ rows: businessStatsRows(st.data), since: memberSince(st.data?.member_since).replace("Membro", "No Huambo Online") }); }
    const u = await c.auth.getUser(); setUid(u.data.user?.id ?? null);
  }
  useEffect(() => { if (id) void load(); }, [id]);

  const viewKind = kind === "providers" ? "provider" : "business";
  useRecordView(viewKind, item ? id : undefined, item ? (kind === "providers" ? item.display_name : item.name) : undefined, item?.avatar_url ?? item?.logo_url ?? null);

  async function contact() {
    if (!uid) { setError("Inicie sessão para enviar mensagem."); return; }
    setBusy(true); setError("");
    const r = await contactDirectoryOwner(supabase(), target, message); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    window.location.href = "/mensagens?conversation=" + (r.data as any)?.id;
  }
  async function review() {
    if (!uid) { setError("Inicie sessão para avaliar."); return; }
    setBusy(true); setError(""); setNotice("");
    const r = await submitReview(supabase(), target, rating, comment); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Obrigado pela sua avaliação."); setComment(""); await load(); }
  }

  if (error && !item) return <main><a href={TEXT[kind].base}>← Voltar</a><p className="error">{error}</p></main>;
  if (!item) return <main><p>A carregar…</p></main>;
  const ownerId = kind === "providers" ? item.user_id : item.owner_id;
  const mine = uid === ownerId;
  const name = kind === "providers" ? item.display_name : item.name;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const wa = whatsappLink(item.whatsapp, "Olá, vi o seu perfil no Huambo Online.");

  return <main className="stack">
    <a href={TEXT[kind].base}>← Voltar</a>
    <div className="row" style={{ alignItems: "center", gap: 14, flexWrap: "nowrap" }}>
      {(item.avatar_url || item.logo_url) && <img className="profile-pic" src={item.avatar_url || item.logo_url} alt={kind === "providers" ? "Fotografia de " + name : "Logótipo de " + name} />}
      <h1 style={{ margin: 0, overflowWrap: "anywhere" }}>{name}{item.verified ? " ✔️" : ""}</h1>
    </div>
    {kind === "providers" && item.headline && <p style={{ fontSize: 19 }}>{item.headline}</p>}
    <p>{[categoryLabel(item), item.municipalities?.name, item.address_text].filter(Boolean).join(" · ")}</p>
    {item.markets?.name && <p>🧺 Na <a href={"/pracas/" + item.markets.id}>{item.markets.name}</a></p>}
    <p><strong>{ratingLabel(avg, reviews.length)}</strong></p>
    <TrustBadges userId={kind === "providers" ? id : item.owner_id} />
    <StatsBlock rows={stats.rows} footer={stats.since} />
    {(item.bio || item.description) && <p style={{ whiteSpace: "pre-wrap" }}>{item.bio || item.description}</p>}
    <div className="row">
      <FollowButton kind={kind === "providers" ? "provider" : "business"} id={id} mine={mine} />
      {item.phone && <a className="btn secondary" href={"tel:" + item.phone.replace(/\s/g, "")} onClick={() => void recordItemEvent(supabase(), viewKind, id, "call")}>📞 Ligar</a>}
      {wa && <a className="btn secondary" href={wa} target="_blank" rel="noopener" onClick={() => void recordItemEvent(supabase(), viewKind, id, "whatsapp")}>WhatsApp</a>}
      {mine && <a className="btn" href={kind === "providers" ? "/conta/profissional" : "/conta/empresas"}>Editar</a>}
      {!mine && <SaveButton kind={viewKind} id={id} />}
      <ShareButton kind={viewKind} id={id} title={name} />
    </div>
    {kind === "providers" && services.length > 0 && <section className="stack"><h2>Serviços</h2>
      {services.map(s => <div key={s.id} className="card"><strong>{s.title}</strong>{s.description && <span>{s.description}</span>}<span>{s.price_from != null ? "Desde " + formatPrice(s.price_from, s.currency) : "Preço sob consulta"}</span></div>)}
    </section>}
    <PortfolioGallery target={kind === "providers" ? { providerId: id } : { businessId: id }} />
    {kind === "businesses" && <BusinessProducts ownerId={item.owner_id} businessId={id} />}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!mine && <RequestServiceBox target={target} signedIn={!!uid} />}
    {!mine && <section className="card"><h2 style={{ margin: 0 }}>Enviar mensagem</h2>
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Olá, gostaria de pedir um orçamento…" />
      <button disabled={busy || !message.trim()} onClick={contact}>{busy ? "A enviar…" : "Enviar mensagem"}</button>
    </section>}
    <section className="stack"><h2>Avaliações</h2>
      {!mine && <div className="card">
        <StarPicker value={rating} onChange={setRating} />
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Como foi a sua experiência?" />
        <button disabled={busy || !rating} onClick={review}>Publicar avaliação</button>
      </div>}
      {reviews.length === 0 && <p>Ainda sem avaliações.</p>}
      {reviews.map(r => <div key={r.id} className="card"><strong>{stars(r.rating)} — {r.author_name}</strong>{r.confirmed && <span className="verified">✔ Serviço confirmado</span>}{r.comment && <span>{r.comment}</span>}<small>{new Date(r.created_at).toLocaleDateString("pt-AO")}</small>
        <ReviewReply kind="service" reviewId={r.id} reply={r.owner_reply} canReply={mine} onDone={load} /></div>)}
      {!mine && <ReportButton type={kind === "providers" ? "provider" : "business"} id={id} label={kind === "providers" ? "Denunciar este profissional" : "Denunciar esta empresa"} />}
    </section>
  </main>;
}
