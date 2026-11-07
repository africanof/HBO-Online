"use client";
import { useEffect, useState } from "react";
import { listBusinessProducts, listProviders, listBusinesses, getProvider, getBusiness, listProviderServices, listReviewsFor, submitReview, contactDirectoryOwner,
  listDirectoryCategories, listProvinces, listMunicipalities, ratingLabel, whatsappLink, recordItemEvent, formatPrice, friendlyErrorIn, LANG_TAGS, type ReviewTarget, categoryLabel,
  listProviderReviews, getUserStats, getBusinessStats, userStatsRows, businessStatsRows, memberSince , categoryIdFromSlug, directoryHeading, FUEL_CATEGORY_SLUG, venueKindFromSlug, venueForBusiness, VENUE_KINDS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { SaveButton, ShareButton, FollowButton, useRecordView } from "./Engage";
import { StatsBlock, StarPicker, RequestServiceBox, stars } from "./Reputation";
import { ReportButton, TrustBadges, ReviewReply } from "./Trust";
import { PortfolioGallery } from "./Portfolio";
import { PromoSection } from "./Promo";
import { LiteImg } from "./LiteImg";
import { PlaceView } from "./Place";
import { InspectedBadge, useInspected } from "./Inspection";
import { inspectionKindFor } from "@huambo-online/core";
import { ProfileQr } from "./ProfileQr";
import { ResultsToolbar, FiltersToggle } from "./ResultsTools";
import { SkeletonCards } from "./Skeleton";

type Kind = "providers" | "businesses";
type Option = { id: string; name: string; slug?: string | null };
/** Textos de cada lista (chaves do dicionário «sv.»). */
const TEXT = {
  providers: { title: "sv.dir_pro_title", search: "sv.dir_pro_search", empty: "sv.dir_pro_empty", base: "/profissionais", cta: "sv.dir_pro_cta", ctaHref: "/conta/profissional" },
  businesses: { title: "sv.dir_biz_title", search: "sv.dir_biz_search", empty: "sv.dir_biz_empty", base: "/empresas", cta: "sv.ve_register_business", ctaHref: "/conta/empresas" }
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
  const { lang, t: tr, tc } = useT();
  const [slug, setSlug] = useState<string | null>(null);
  const T = TEXT[kind]; const h = kind === "businesses" ? directoryHeading(slug) : null;
  const t = { title: h ? tc(h.title) : tr(T.title), search: tr(T.search), empty: tr(T.empty), base: T.base, cta: h ? tc(h.cta) : tr(T.cta), ctaHref: T.ctaHref };
  const rating = (r: unknown, n: unknown) => { const l = ratingLabel(r as number, n as number); return l === "Sem avaliações" ? tr("rating.none") : tc(l); };
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  const [sort, setSort] = useState<"recent" | "rating" | "reviews" | "name">("recent"); const [filtersOpen, setFiltersOpen] = useState(false);
  const badges = useInspected(inspectionKindFor(kind), (items ?? []).map(x => kind === "providers" ? x.user_id : x.id));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const start = params.get("q") ?? ""; const wanted = params.get("categoria"); setQ(start); setSlug(wanted);
    void listDirectoryCategories(supabase(), kind).then(({ data }) => {
      const list = (data ?? []) as Option[]; setCategories(list);
      const cat = categoryIdFromSlug(list, wanted); setCategoryId(cat);
      void search(undefined, start, cat);
    });
  }, []);
  async function search(e?: React.FormEvent, query = q, category = categoryId) {
    e?.preventDefault(); setError("");
    const f = { query, categoryId: category, municipalityId };
    const r: any = kind === "providers" ? await listProviders(supabase(), f) : await listBusinesses(supabase(), f);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data ?? []);
  }

  const sorted = !items ? items : sort === "rating" ? [...items].sort((a, b) => (Number(b.rating ?? 0) - Number(a.rating ?? 0)) || (Number(b.review_count ?? 0) - Number(a.review_count ?? 0)))
    : sort === "reviews" ? [...items].sort((a, b) => Number(b.review_count ?? 0) - Number(a.review_count ?? 0))
    : sort === "name" ? [...items].sort((a, b) => String(kind === "providers" ? a.display_name : a.name).localeCompare(String(kind === "providers" ? b.display_name : b.name), lang)) : items;
  const banners = <>
    {kind === "businesses" && categories.find(c => c.id === categoryId)?.slug === FUEL_CATEGORY_SLUG && <a href="/combustivel" className="banner yellow" style={{ color: "inherit", textDecoration: "none", fontWeight: 400, padding: 18 }}>
      <strong>⛽ {tr("sv.dir_fuel_q")}</strong> {tr("sv.dir_fuel_text")}</a>}
    {kind === "businesses" && (() => { const vk = venueKindFromSlug(categories.find(c => c.id === categoryId)?.slug); if (!vk) return null; const V = VENUE_KINDS[vk];
      return <a href={"/reservas?tipo=" + V.slug} className="banner yellow" style={{ color: "inherit", textDecoration: "none", fontWeight: 400, padding: 18 }}>
        <span><strong>{V.icon} {vk === "hotel" ? tr("sv.dir_v_hotel") : vk === "restaurant" ? tr("sv.dir_v_rest") : tr("sv.dir_v_wh")}</strong> {vk === "hotel" ? tr("sv.dir_v_hotel_b") : tr("sv.dir_v_other_b")}</span>
        <span className="btn">🛎️ {tr("sv.fu_reserve")}</span></a>; })()}
  </>;

  return <main className="stack">
    <a href="/">← {tr("nav.home")}</a>
    <div className="results-bar"><h1 style={{ margin: 0 }}>{t.title}</h1><a className="btn secondary" href={t.ctaHref}>{t.cta}</a></div>
    {categories.length > 0 && <nav className="chips" aria-label={tr("sv.f_category")}>
      {[{ id: "", name: tr("sv.all_f") }, ...categories].map(c => <button key={c.id} type="button" className={"chip" + (categoryId === c.id ? " on" : "")} aria-pressed={categoryId === c.id}
        onClick={() => { setCategoryId(c.id); void search(undefined, q, c.id); }}>{c.id ? tc(c.name) : c.name}</button>)}
    </nav>}
    <div className="results">
      <FiltersToggle open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} active={[q, categoryId, municipalityId].filter(Boolean).length} />
      <form onSubmit={e => { setFiltersOpen(false); void search(e); }} className={"filters card" + (filtersOpen ? " open" : "")}>
        <h2>{tr("ls.filters")}</h2>
        <label>{tr("nav.search")}<input value={q} onChange={e => setQ(e.target.value)} placeholder={t.search} /></label>
        <label>{tr("sv.f_category")}<select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">{tr("sv.all_f")}</option>{categories.map(c => <option key={c.id} value={c.id}>{tc(c.name)}</option>)}</select></label>
        <label>{tr("sv.municipality")}<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">{tr("sv.all")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <button type="submit">{tr("nav.search")}</button>
      </form>
      <section className="stack" aria-label={t.title}>
        <ResultsToolbar count={items === null ? tr("common.loading") : tr("ls.n_results", { n: items.length })} sort={sort} onSort={setSort}
          sorts={[{ value: "recent", label: tr("ls.sort_relevant") }, { value: "rating", label: tr("ls.sort_rating") }, { value: "reviews", label: tr("ls.sort_reviews") }, { value: "name", label: tr("ls.sort_name") }]} />
        {error && <p className="error" role="alert">{error}</p>}
        {banners}
        {items?.length === 0 && <div className="card"><strong>{t.empty}</strong></div>}
        {items === null && <SkeletonCards n={6} className="dir-grid" />}
        <div className="dir-grid">
          {sorted?.map(x => {
            const id = kind === "providers" ? x.user_id : x.id;
            const name = kind === "providers" ? x.display_name : x.name;
            const pic = kind === "providers" ? x.avatar_url : x.logo_url;
            const about = kind === "providers" ? x.headline : x.description;
            return <a key={id} href={`${t.base}/${id}`} className="card dir-card">
              <div className="dir-card-top">
                {pic ? <LiteImg placeholder={kind === "providers" ? "👤" : "🏪"} src={pic} alt="" className={"dir-pic" + (kind === "providers" ? " round" : "")} />
                  : <span aria-hidden className={"dir-pic dir-pic-empty" + (kind === "providers" ? " round" : "")}>{kind === "providers" ? "👤" : "🏪"}</span>}
                <span className="dir-card-name"><strong>{name}</strong>{x.verified && <span className="verified" style={{ fontSize: 12 }}>✔ {tr("common.verified")}</span>}</span>
              </div>
              <InspectedBadge info={badges[id]} />
              {about && <span className="dir-about">{String(about).slice(0, 160)}</span>}
              <span className="item-meta">{[x.category_name ? tc(x.category_name) : null, x.municipality_name ? "📍 " + x.municipality_name : null].filter(Boolean).join(" · ")}</span>
              <span className="dir-rating">{rating(x.rating, x.review_count)}</span>
            </a>;
          })}
        </div>
        <a href="/classificados/publicar?finalidade=wanted" className="banner yellow" style={{ color: "inherit", textDecoration: "none", fontWeight: 400, padding: 18 }}>
          <span><strong>{tr("sv.dir_wanted_q")}</strong> {tr("sv.dir_wanted_text")}</span>
          <span className="btn">🔎 {tr("sv.dir_wanted_btn")}</span>
        </a>
      </section>
    </div>
  </main>;
}

/** Se a empresa é um hotel, restaurante ou armazém aprovado: botão grande para reservar. */
function VenueReserveButton({ businessId }: { businessId: string }) {
  const { t } = useT();
  const [venue, setVenue] = useState<{ id: string; kind: keyof typeof VENUE_KINDS } | null>(null);
  useEffect(() => { void venueForBusiness(supabase(), businessId).then(r => setVenue(r.data?.status === "approved" ? r.data : null)); }, [businessId]);
  if (!venue) return null;
  return <a className="btn" href={"/reservas/" + venue.id} style={{ justifySelf: "start", fontSize: 20, padding: "14px 22px" }}>🛎️ {t("sv.dir_reserve_avail")}</a>;
}

/** Produtos da empresa na Loja. */
function BusinessProducts({ ownerId, businessId }: { ownerId: string; businessId: string }) {
  const { t } = useT();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { void listBusinessProducts(supabase(), ownerId, businessId).then(r => setItems(r.data)); }, [businessId]);
  if (!items.length) return null;
  return <section className="stack"><h2 style={{ margin: 0 }}>🛍️ {t("sv.dir_shop_products", { n: items.length })}</h2>
    <div className="portfolio-grid">{items.slice(0, 12).map(p => <a key={p.id} className="portfolio-tile" href={"/loja/" + p.id} aria-label={`${p.name}, ${formatPrice(p.price, p.currency)}`}>
      {(p.media ?? [])[0] ? <LiteImg src={p.media[0]} alt="" loading="lazy" placeholder="📦" /> : <span aria-hidden style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 44 }}>📦</span>}
      <span className="portfolio-caption"><strong>{p.name}</strong><small>{formatPrice(p.price, p.currency)}</small></span>
    </a>)}</div>
  </section>;
}

export function DirectoryDetail({ kind, id }: { kind: Kind; id: string }) {
  const { lang, t, tc } = useT();
  const ratingText = (r: number, n: number) => { const l = ratingLabel(r, n); return l === "Sem avaliações" ? t("rating.none") : tc(l); };
  const target: ReviewTarget = kind === "providers" ? { providerId: id } : { businessId: id };
  const [item, setItem] = useState<any>(null); const [services, setServices] = useState<any[]>([]); const [reviews, setReviews] = useState<any[]>([]);
  const badge = useInspected(inspectionKindFor(kind), [id]);
  const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<{ rows: { label: string; value: string }[]; since: string }>({ rows: [], since: "" });
  const [message, setMessage] = useState(""); const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const c = supabase();
    const r: any = kind === "providers" ? await getProvider(c, id) : await getBusiness(c, id);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    if (!r.data) { setError(t("sv.not_found")); return; }
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
    if (!uid) { setError(t("sv.dir_login_msg")); return; }
    setBusy(true); setError("");
    const r = await contactDirectoryOwner(supabase(), target, message); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    window.location.href = "/mensagens?conversation=" + (r.data as any)?.id;
  }
  async function review() {
    if (!uid) { setError(t("sv.dir_login_review")); return; }
    setBusy(true); setError(""); setNotice("");
    const r = await submitReview(supabase(), target, rating, comment); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.dir_review_thanks")); setComment(""); await load(); }
  }

  if (error && !item) return <main><a href={TEXT[kind].base}>← {t("common.back")}</a><p className="error">{error}</p></main>;
  if (!item) return <main><p>{t("common.loading")}</p></main>;
  const ownerId = kind === "providers" ? item.user_id : item.owner_id;
  const mine = uid === ownerId;
  const name = kind === "providers" ? item.display_name : item.name;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const wa = whatsappLink(item.whatsapp, t("sv.dir_wa_hello"));

  return <main className="stack">
    <a href={TEXT[kind].base}>← {t("common.back")}</a>
    <div className="row" style={{ alignItems: "center", gap: 14, flexWrap: "nowrap" }}>
      {(item.avatar_url || item.logo_url) && <img className="profile-pic" src={item.avatar_url || item.logo_url} alt={kind === "providers" ? t("sv.photo_of", { name }) : t("sv.logo_of", { name })} />}
      <h1 style={{ margin: 0, overflowWrap: "anywhere" }}>{name}{item.verified ? " ✔️" : ""}</h1>
    </div>
    <InspectedBadge info={badge[id]} big />
    {kind === "providers" && item.headline && <p style={{ fontSize: 19 }}>{item.headline}</p>}
    <p>{[categoryLabel(item) ? tc(categoryLabel(item)) : null, item.municipalities?.name, item.address_text].filter(Boolean).join(" · ")}</p>
    {item.markets?.name && <p>🧺 {t("sv.dir_at_market")} <a href={"/pracas/" + item.markets.id}>{item.markets.name}</a></p>}
    <p><strong>{ratingText(avg, reviews.length)}</strong></p>
    <TrustBadges userId={kind === "providers" ? id : item.owner_id} />
    <StatsBlock rows={stats.rows.map(r => ({ ...r, label: tc(r.label) }))} footer={tc(stats.since)} />
    {(item.bio || item.description) && <p style={{ whiteSpace: "pre-wrap" }}>{item.bio || item.description}</p>}
    <PlaceView directions={item.directions} lat={item.geo_lat} lng={item.geo_lng} />
    {kind === "businesses" && <VenueReserveButton businessId={id} />}
    <div className="row">
      <FollowButton kind={kind === "providers" ? "provider" : "business"} id={id} mine={mine} />
      {item.phone && <a className="btn secondary" href={"tel:" + item.phone.replace(/\s/g, "")} onClick={() => void recordItemEvent(supabase(), viewKind, id, "call")}>📞 {t("common.call")}</a>}
      {wa && <a className="btn secondary" href={wa} target="_blank" rel="noopener" onClick={() => void recordItemEvent(supabase(), viewKind, id, "whatsapp")}>WhatsApp</a>}
      {mine && <a className="btn" href={kind === "providers" ? "/conta/profissional" : "/conta/empresas"}>{t("common.edit")}</a>}
      {!mine && <SaveButton kind={viewKind} id={id} />}
      <ShareButton kind={viewKind} id={id} title={name} />
      <ProfileQr kind={kind === "providers" ? "profissionais" : "empresas"} id={id} name={name ?? ""} />
    </div>
    {kind === "providers" && services.length > 0 && <section className="stack"><h2>{t("nav.services")}</h2>
      {services.map(s => <div key={s.id} className="card"><strong>{s.title}</strong>{s.description && <span>{s.description}</span>}<span>{s.price_from != null ? t("sv.dir_from_price", { price: formatPrice(s.price_from, s.currency) }) : t("sv.dir_price_on_request")}</span></div>)}
    </section>}
    <PromoSection kind={kind === "providers" ? "provider" : "business"} id={id} />
    <PortfolioGallery target={kind === "providers" ? { providerId: id } : { businessId: id }} />
    {kind === "businesses" && <BusinessProducts ownerId={item.owner_id} businessId={id} />}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!mine && <RequestServiceBox target={target} signedIn={!!uid} />}
    {!mine && <section className="card"><h2 style={{ margin: 0 }}>{t("sv.dir_send_msg")}</h2>
      <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder={t("sv.dir_msg_ph")} />
      <button disabled={busy || !message.trim()} onClick={contact}>{busy ? t("sv.sending") : t("sv.dir_send_msg")}</button>
    </section>}
    <section className="stack"><h2>{t("sv.reviews")}</h2>
      {!mine && <div className="card">
        <StarPicker value={rating} onChange={setRating} />
        <textarea rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder={t("sv.dir_review_ph")} />
        <button disabled={busy || !rating} onClick={review}>{t("sv.dir_post_review")}</button>
      </div>}
      {reviews.length === 0 && <p>{t("sv.dir_no_reviews")}</p>}
      {reviews.map(r => <div key={r.id} className="card"><strong>{stars(r.rating)} — {r.author_name}</strong>{r.confirmed && <span className="verified">✔ {t("sv.dir_service_confirmed")}</span>}{r.comment && <span>{r.comment}</span>}<small>{new Date(r.created_at).toLocaleDateString(LANG_TAGS[lang])}</small>
        <ReviewReply kind="service" reviewId={r.id} reply={r.owner_reply} canReply={mine} onDone={load} /></div>)}
      {!mine && <ReportButton type={kind === "providers" ? "provider" : "business"} id={id} label={kind === "providers" ? t("sv.dir_report_pro") : t("sv.dir_report_biz")} />}
    </section>
  </main>;
}
