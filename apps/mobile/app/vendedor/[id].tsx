import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { getPublicSeller, listSellerListings, listProducts, formatPrice, ratingLabel, friendlyError, PURPOSE_LABELS, type PublicSeller, listingPriceLabel,
  getUserStats, listUserReviews, userStatsRows, DEAL_ROLE_LABELS, type UserStats, type UserReview } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui, C } from "../../lib/ui";
import { StatsBlock, VerifiedTag, stars } from "../../components/Reputation";
import { ReportButton, TrustBadges, ReviewReply } from "../../components/Trust";
import { InspectedBadge, useInspected } from "../../components/Inspection";
import { currentUserId } from "../../lib/supabase";
import { LiteImage } from "../../components/LiteImage";
import { FollowButton } from "../../components/Engage";
import { PromoShelf } from "../../components/Promo";
import { getPublic } from "../../lib/public-api";
import { sellerPageCached } from "@huambo-online/core";

export default function Vendedor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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
    if (b.error && !b.seller) { setError(friendlyError(b.error)); return; }
    if (!b.seller) { setError("Perfil não encontrado."); return; }
    setS(b.seller);
    const [st, rv] = await Promise.all([getUserStats(c, id), listUserReviews(c, id)]);
    setStats(st.data); setReviews(rv.data); setMe(await currentUserId());
    setListings(b.listings); setProducts(b.products);
  })(); }, [id]);
  if (error) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.error}>{error}</Text></View>;
  if (!s) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/explorar" style={ui.link}>← Explorar</Link>
    <View style={[ui.row, { alignItems: "center", gap: 14 }]}>
      {s.avatar_url ? <Image source={{ uri: s.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} accessibilityLabel="Fotografia" /> : <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.placeholder }} />}
      <View style={{ flex: 1 }}><Text style={ui.h1}>{s.full_name || "Utilizador"}</Text>
        <Text style={ui.muted}>{[s.municipality, "membro desde " + new Date(s.member_since).toLocaleDateString("pt-AO")].filter(Boolean).join(" · ")}</Text></View>
    </View>
    {s.is_provider && <><Text style={ui.text}>{ratingLabel(s.rating, s.review_count)}</Text><Link href={("/profissionais/" + s.id) as any} style={ui.link}>Ver perfil profissional →</Link></>}
    <FollowButton kind="seller" id={s.id} mine={me === s.id} />
    <TrustBadges userId={s.id} />
    <InspectedBadge info={store[s.id]} big />
    <StatsBlock rows={userStatsRows(stats)} />
    <PromoShelf kind="store" id={s.id} />
    <Text style={ui.h2}>Anúncios ({listings.length})</Text>
    {listings.length === 0 && <Text style={ui.text}>Sem anúncios publicados.</Text>}
    {listings.map(x => <Pressable key={x.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/classificados/" + x.id) as any)}>
      {Array.isArray(x.media) && !!x.media[0] && <LiteImage source={{ uri: x.media[0] }} style={{ width: "100%", height: 160, borderRadius: 8 }} />}
      <Text style={ui.label}>{x.title}</Text><Text style={ui.price}>{listingPriceLabel(x)}</Text>
      <Text style={ui.muted}>{PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose}</Text>
    </Pressable>)}
    {products.length > 0 && <><Text style={ui.h2}>Produtos na loja ({products.length})</Text>
      {products.map(p => <Pressable key={p.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/loja/" + p.id) as any)}>
        {Array.isArray(p.media) && !!p.media[0] && <LiteImage placeholder="📦" source={{ uri: p.media[0] }} style={{ width: "100%", height: 160, borderRadius: 8 }} />}
        <Text style={ui.label}>{p.name}</Text><Text style={ui.price}>{formatPrice(p.price, p.currency)}</Text>
      </Pressable>)}</>}
    <Text style={ui.h2}>Avaliações de negócios ({reviews.length})</Text>
    <Text style={ui.muted}>Só quem fez negócio com esta pessoa (compra, venda ou arrendamento) a pode avaliar.</Text>
    {reviews.length === 0 && <Text style={ui.text}>Ainda sem avaliações.</Text>}
    {reviews.map(r => <View key={r.id} style={ui.card}><Text style={ui.label}>{stars(r.rating)} — {r.author_name}</Text><VerifiedTag text={"✔ Negócio concluído · como " + DEAL_ROLE_LABELS[r.role]} />{!!r.comment && <Text style={ui.text}>{r.comment}</Text>}<Text style={ui.muted}>{new Date(r.created_at).toLocaleDateString("pt-AO")}</Text>
      <ReviewReply kind="deal" reviewId={r.id} reply={r.reply} canReply={me === s.id} onDone={async () => setReviews((await listUserReviews(supabase(), s.id)).data)} /></View>)}
    {me !== s.id && <ReportButton type="user" id={s.id} label="Denunciar esta pessoa" />}
  </ScrollView>;
}
