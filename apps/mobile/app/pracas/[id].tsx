import { useEffect, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { getMarket, listMarketContents, formatPrice, friendlyError, timeAgo, PURPOSE_LABELS, listingPriceLabel } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui, C } from "../../lib/ui";
import { Button, Chips } from "../../components/Ui";
import { ItemCard, Grid, LISTING_ICON } from "../../components/ItemCard";

type Tab = "products" | "listings" | "businesses";

export default function Praca() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [m, setM] = useState<any>(null); const [c, setC] = useState<{ listings: any[]; products: any[]; businesses: any[] } | null>(null);
  const [tab, setTab] = useState<Tab>("products"); const [error, setError] = useState("");
  useEffect(() => { if (!id) return; void (async () => {
    const s = supabase();
    const r = await getMarket(s, id);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (!r.data) { setError("Praça não encontrada."); return; }
    setM(r.data);
    const x = await listMarketContents(s, id); setC(x);
    if (!x.products.length && x.listings.length) setTab("listings"); else if (!x.products.length && !x.listings.length && x.businesses.length) setTab("businesses");
  })(); }, [id]);
  if (error) return <View style={ui.screen}><Link href="/pracas" style={ui.link}>← Praças</Link><Text style={ui.error}>{error}</Text></View>;
  if (!m) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/pracas" style={ui.link}>← Praças</Link>
    <View style={{ height: 180, borderRadius: 16, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {m.photo_url ? <Image source={{ uri: m.photo_url }} style={{ width: "100%", height: "100%" }} accessibilityLabel={m.name} /> : <Text style={{ fontSize: 64 }}>🧺</Text>}
    </View>
    <Text style={ui.h1}>{m.name}</Text>
    <Text style={ui.text}>📍 {[m.address_text, m.municipalities?.name].filter(Boolean).join(", ") || "Huambo"}</Text>
    {!!m.opening_hours && <Text style={ui.text}>🕘 {m.opening_hours}</Text>}
    {!!m.description && <Text style={ui.text}>{m.description}</Text>}
    <View style={{ backgroundColor: "#e6f4ec", borderRadius: 16, padding: 14, gap: 8 }}>
      <Text style={ui.label}>Vende nesta praça?</Text>
      <Text style={ui.text}>Ao publicar, escolha «{m.name}» no campo «Praça».</Text>
      <Button title="Publicar anúncio" onPress={() => router.push("/classificados/publicar" as any)} />
      <Button title="Vender produtos" variant="secondary" onPress={() => router.push("/conta/produtos" as any)} />
    </View>
    <Chips options={[{ value: "products" as Tab, label: `Produtos (${c?.products.length ?? 0})` }, { value: "listings" as Tab, label: `Anúncios (${c?.listings.length ?? 0})` }, { value: "businesses" as Tab, label: `Lojas (${c?.businesses.length ?? 0})` }]} value={tab} onChange={setTab} />
    {c === null && <Text style={ui.muted}>A carregar…</Text>}
    {c && tab === "products" && (c.products.length ? <Grid>{c.products.map(p => <ItemCard key={p.id} video={!!p.video_url} width={cardW} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)} meta={p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} />)}</Grid> : <Text style={ui.text}>Ainda não há produtos desta praça.</Text>)}
    {c && tab === "listings" && (c.listings.length ? <Grid>{c.listings.map(x => <ItemCard key={x.id} video={!!x.video_url} width={cardW} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} meta={[PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS], timeAgo(x.created_at)].filter(Boolean).join(" · ")} />)}</Grid> : <Text style={ui.text}>Ainda não há anúncios desta praça.</Text>)}
    {c && tab === "businesses" && (c.businesses.length ? c.businesses.map(b => <Pressable key={b.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/empresas/" + b.id) as any)}>
      <Text style={ui.h2}>{b.name}{b.verified ? " ✔️" : ""}</Text>{!!b.description && <Text style={ui.muted}>{String(b.description).slice(0, 120)}</Text>}
    </Pressable>) : <Text style={ui.text}>Ainda não há lojas registadas nesta praça.</Text>)}
  </ScrollView>;
}
