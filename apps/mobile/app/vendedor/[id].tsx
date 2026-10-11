import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { getPublicSeller, listSellerListings, listProducts, formatPrice, ratingLabel, friendlyError, PURPOSE_LABELS, type PublicSeller, listingPriceLabel } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";

export default function Vendedor() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [s, setS] = useState<PublicSeller | null>(null); const [listings, setListings] = useState<any[]>([]); const [products, setProducts] = useState<any[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!id) return; void (async () => {
    const c = supabase();
    const r = await getPublicSeller(c, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Perfil não encontrado."); return; }
    setS(r.data);
    const [l, p] = await Promise.all([listSellerListings(c, id), listProducts(c, { sellerId: id })]);
    setListings(l.data ?? []); setProducts((p.data as any[]) ?? []);
  })(); }, [id]);
  if (error) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.error}>{error}</Text></View>;
  if (!s) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/explorar" style={ui.link}>← Explorar</Link>
    <View style={[ui.row, { alignItems: "center", gap: 14 }]}>
      {s.avatar_url ? <Image source={{ uri: s.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40 }} accessibilityLabel="Fotografia" /> : <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "#ddd" }} />}
      <View style={{ flex: 1 }}><Text style={ui.h1}>{s.full_name || "Utilizador"}</Text>
        <Text style={ui.muted}>{[s.municipality, "membro desde " + new Date(s.member_since).toLocaleDateString("pt-AO")].filter(Boolean).join(" · ")}</Text></View>
    </View>
    {s.is_provider && <><Text style={ui.text}>{ratingLabel(s.rating, s.review_count)}</Text><Link href={("/profissionais/" + s.id) as any} style={ui.link}>Ver perfil profissional →</Link></>}
    <Text style={ui.h2}>Anúncios ({listings.length})</Text>
    {listings.length === 0 && <Text style={ui.text}>Sem anúncios publicados.</Text>}
    {listings.map(x => <Pressable key={x.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/classificados/" + x.id) as any)}>
      {Array.isArray(x.media) && !!x.media[0] && <Image source={{ uri: x.media[0] }} style={{ width: "100%", height: 160, borderRadius: 8 }} />}
      <Text style={ui.label}>{x.title}</Text><Text style={ui.price}>{listingPriceLabel(x)}</Text>
      <Text style={ui.muted}>{PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose}</Text>
    </Pressable>)}
    {products.length > 0 && <><Text style={ui.h2}>Produtos na loja ({products.length})</Text>
      {products.map(p => <Pressable key={p.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/loja/" + p.id) as any)}>
        {Array.isArray(p.media) && !!p.media[0] && <Image source={{ uri: p.media[0] }} style={{ width: "100%", height: 160, borderRadius: 8 }} />}
        <Text style={ui.label}>{p.name}</Text><Text style={ui.price}>{formatPrice(p.price, p.currency)}</Text>
      </Pressable>)}</>}
  </ScrollView>;
}
