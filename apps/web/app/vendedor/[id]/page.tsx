"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPublicSeller, listSellerListings, listProducts, formatPrice, ratingLabel, friendlyError, PURPOSE_LABELS, type PublicSeller, listingPriceLabel,
  getUserStats, listUserReviews, userStatsRows, DEAL_ROLE_LABELS, type UserStats, type UserReview } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { ItemCard, LISTING_ICON } from "../../../components/ItemCard";
import { StatsBlock, stars } from "../../../components/Reputation";
import { ReportButton, TrustBadges, ReviewReply } from "../../../components/Trust";
import { currentUserId } from "../../../lib/supabase";

export default function Vendedor() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<PublicSeller | null>(null); const [listings, setListings] = useState<any[]>([]); const [products, setProducts] = useState<any[]>([]); const [error, setError] = useState("");
  const [stats, setStats] = useState<UserStats | null>(null); const [reviews, setReviews] = useState<UserReview[]>([]); const [me, setMe] = useState<string | null>(null);
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase();
    const r = await getPublicSeller(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Perfil não encontrado."); return; }
    setS(r.data);
    const [l, p, st, rv] = await Promise.all([listSellerListings(c, id), listProducts(c, { sellerId: id }), getUserStats(c, id), listUserReviews(c, id)]);
    setStats(st.data); setReviews(rv.data); setMe(await currentUserId());
    setListings(l.data ?? []); setProducts((p.data as any[]) ?? []);
  })(); }, [id]);
  if (error) return <main><a href="/">← Huambo Online</a><p className="error">{error}</p></main>;
  if (!s) return <main><p>A carregar…</p></main>;
  return <main className="stack">
    <a href="/explorar">← Explorar</a>
    <div className="row">
      {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover" }} /> : <div aria-hidden style={{ width: 88, height: 88, borderRadius: "50%", background: "#ddd" }} />}
      <div><h1 style={{ margin: 0 }}>{s.full_name || "Utilizador"}</h1><p style={{ margin: 0 }}>{[s.municipality, "membro desde " + new Date(s.member_since).toLocaleDateString("pt-AO")].filter(Boolean).join(" · ")}</p></div>
    </div>
    {s.is_provider && <p>{ratingLabel(s.rating, s.review_count)} · <a href={"/profissionais/" + s.id}>Ver perfil profissional →</a></p>}
    <TrustBadges userId={s.id} />
    <StatsBlock rows={userStatsRows(stats)} />
    <h2>Anúncios ({listings.length})</h2>
    {listings.length === 0 && <p>Sem anúncios publicados.</p>}
    <div className="results-grid">{listings.map(x => <ItemCard key={x.id} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
      icon={LISTING_ICON[x.listing_type] ?? "🏷️"} meta={PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose} tag={x.purpose === "auction" ? "Leilão" : undefined} tagRed />)}</div>
    {products.length > 0 && <><h2>Produtos na loja ({products.length})</h2>
      <div className="results-grid">{products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} meta={p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} />)}</div></>}
    <section className="stack"><h2>Avaliações de negócios ({reviews.length})</h2>
      <p style={{ margin: 0 }}>Só quem fez negócio com esta pessoa (compra, venda ou arrendamento) a pode avaliar.</p>
      {reviews.length === 0 && <p>Ainda sem avaliações.</p>}
      {reviews.map(r => <div key={r.id} className="card"><strong>{stars(r.rating)} — {r.author_name}</strong><span className="verified">✔ Negócio concluído · como {DEAL_ROLE_LABELS[r.role]}</span>{r.comment && <span>{r.comment}</span>}<small>{new Date(r.created_at).toLocaleDateString("pt-AO")}</small>
        <ReviewReply kind="deal" reviewId={r.id} reply={r.reply} canReply={me === s.id} onDone={async () => setReviews((await listUserReviews(supabase(), s.id)).data)} /></div>)}
    </section>
    {me !== s.id && <ReportButton type="user" id={s.id} label="Denunciar esta pessoa" />}
  </main>;
}
