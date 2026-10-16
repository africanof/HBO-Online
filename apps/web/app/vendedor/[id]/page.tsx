"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicSeller, listSellerListings, listProducts, formatPrice, ratingLabel, friendlyErrorIn, LANG_TAGS, PURPOSE_LABELS, type PublicSeller, listingPriceLabel,
  getUserStats, listUserReviews, userStatsRows, DEAL_ROLE_LABELS, type UserStats, type UserReview, isFeatured } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { useT, formatDateIn } from "../../../lib/i18n";
import { ItemCard, LISTING_ICON } from "../../../components/ItemCard";
import { StatsBlock, stars } from "../../../components/Reputation";
import { ReportButton, TrustBadges, ReviewReply } from "../../../components/Trust";
import { currentUserId } from "../../../lib/supabase";
import { FollowButton } from "../../../components/Engage";
import { PromoSection } from "../../../components/Promo";
import { InspectedBadge, useInspected } from "../../../components/Inspection";
import { getPublic } from "../../../lib/public-api";
import { sellerPageCached } from "@huambo-online/core";

export default function Vendedor() {
  const { id } = useParams<{ id: string }>();
  const { lang, t, tc } = useT();
  const [s, setS] = useState<PublicSeller | null>(null); const [listings, setListings] = useState<any[]>([]); const [products, setProducts] = useState<any[]>([]); const [error, setError] = useState("");
  const store = useInspected("store", [id]);
  const [stats, setStats] = useState<UserStats | null>(null); const [reviews, setReviews] = useState<UserReview[]>([]); const [me, setMe] = useState<string | null>(null);
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase();
    // Perfil, anúncios e produtos: pela cache do Site (ou direto ao Supabase se não responder).
    const b = await sellerPageCached(getPublic, id, async () => {
      const [r, l, p] = await Promise.all([getPublicSeller(c, id), listSellerListings(c, id), listProducts(c, { sellerId: id })]);
      return { seller: r.data ?? null, listings: l.data ?? [], products: (p.data as any[]) ?? [], error: r.error ?? l.error ?? p.error };
    });
    if (b.error && !b.seller) { setError(friendlyErrorIn(b.error, lang)); return; }
    if (!b.seller) { setError(t("ls.profile_not_found")); return; }
    setS(b.seller);
    const [st, rv] = await Promise.all([getUserStats(c, id), listUserReviews(c, id)]);
    setStats(st.data); setReviews(rv.data); setMe(await currentUserId());
    setListings(b.listings); setProducts(b.products);
  })(); }, [id]);
  if (error) return <main><a href="/">← Huambo Online</a><p className="error">{error}</p></main>;
  if (!s) return <main><p>{t("common.loading")}</p></main>;
  return <main className="stack">
    <a href="/explorar">← {t("nav.explore")}</a>
    <div className="row">
      {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover" }} /> : <div aria-hidden style={{ width: 88, height: 88, borderRadius: "50%", background: "var(--placeholder)" }} />}
      <div><h1 style={{ margin: 0 }}>{s.full_name || t("ls.user")}</h1><p style={{ margin: 0 }}>{[s.municipality, t("ls.member_since", { d: formatDateIn(s.member_since, lang) })].filter(Boolean).join(" · ")}</p></div>
    </div>
    {s.is_provider && <p>{tc(ratingLabel(s.rating, s.review_count))} · <a href={"/profissionais/" + s.id}>{t("ls.see_pro_profile")} →</a></p>}
    <div className="row"><FollowButton kind="seller" id={s.id} mine={me === s.id} /></div>
    <TrustBadges userId={s.id} />
    <InspectedBadge info={store[s.id]} big />
    <StatsBlock rows={userStatsRows(stats)} />
    <PromoSection kind="store" id={s.id} />
    <h2>{t("ls.listings_n", { n: listings.length })}</h2>
    {listings.length === 0 && <p>{t("ls.no_published")}</p>}
    <div className="results-grid">{listings.map(x => <ItemCard key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
      icon={LISTING_ICON[x.listing_type] ?? "🏷️"} meta={tc(PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose)} tag={x.purpose === "auction" ? t("purpose.auction") : undefined} tagRed />)}</div>
    {products.length > 0 && <><h2>{t("ls.shop_products_n", { n: products.length })}</h2>
      <div className="results-grid">{products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} meta={p.stock > 0 ? t("ls.in_stock", { n: p.stock }) : t("home.sold_out")} />)}</div></>}
    <section className="stack"><h2>{t("ls.deal_reviews_n", { n: reviews.length })}</h2>
      <p style={{ margin: 0 }}>{t("ls.deal_reviews_note")}</p>
      {reviews.length === 0 && <p>{t("ls.no_reviews_yet")}</p>}
      {reviews.map(r => <div key={r.id} className="card"><strong>{stars(r.rating)} — {r.author_name}</strong><span className="verified">✔ {t("ls.deal_done_as", { role: tc(DEAL_ROLE_LABELS[r.role]) })}</span>{r.comment && <span>{r.comment}</span>}<small>{formatDateIn(r.created_at, lang)}</small>
        <ReviewReply kind="deal" reviewId={r.id} reply={r.reply} canReply={me === s.id} onDone={async () => setReviews((await listUserReviews(supabase(), s.id)).data)} /></div>)}
    </section>
    {me !== s.id && <ReportButton type="user" id={s.id} label={t("ls.report_person")} />}
  </main>;
}
