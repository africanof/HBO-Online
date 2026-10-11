import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { searchClassifiedListings, listProducts, listProviders, listMarkets, marketSummary, formatPrice, ratingLabel, timeAgo, HOME_CATEGORIES, PURPOSE_LABELS, listingPriceLabel, listWanted, listTrades, loadWithCache, isOfflineError } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button } from "../components/Ui";
import { NotificationBell } from "../components/NotificationBell";
import { Logo, SearchBar } from "../components/Brand";
import { ItemCard, Shelf, LISTING_ICON } from "../components/ItemCard";
import { OfflineBanner } from "../components/Offline";
import { deviceStore } from "../components/Engage";

type Shelves = { listings: any[]; auctions: any[]; rentals: any[]; products: any[]; providers: any[]; markets: any[]; wanted: any[]; trades?: any[] };

const MORE: [string, string, string][] = [
  ["📋", "Os meus anúncios", "/meus-anuncios"], ["📦", "Encomendas", "/encomendas"], ["♥", "Guardados", "/guardados"],
  ["🕘", "Vistos recentemente", "/historico"], ["⭐", "Pesquisas guardadas", "/pesquisas-guardadas"], ["🔔", "Notificações", "/notificacoes"]
];

export default function Home() {
  const router = useRouter();
  const [s, setS] = useState<Shelves | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  useFocusEffect(useCallback(() => {
    if (!supabaseConfigured) { setS({ listings: [], auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] }); return; }
    const c = supabase();
    void c.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    // Guarda a página inicial para a mostrar quando não houver internet.
    void loadWithCache<Shelves>(deviceStore, "inicio", async () => {
      const all = await Promise.all([
        searchClassifiedListings(c, { limit: 12 }), searchClassifiedListings(c, { purpose: "auction", limit: 12 }),
        searchClassifiedListings(c, { purpose: "rent", limit: 12 }), listProducts(c, { limit: 12 }), listProviders(c, { limit: 12 }), listMarkets(c), listWanted(c, "", 12), listTrades(c, "", false, 12)
      ]);
      const netError = all.map(r => r.error).find(e => isOfflineError(e));
      if (netError) return { data: null, error: netError };
      const [l, a, r, p, v, mk, w, t] = all;
      return { data: {
        listings: (l.data as any[]) ?? [], auctions: (a.data as any[]) ?? [], rentals: (r.data as any[]) ?? [],
        products: (p.data as any[]) ?? [], providers: (v.data as any[]) ?? [], markets: (mk.data as any[]) ?? [], wanted: (w.data as any[]) ?? [], trades: (t.data as any[]) ?? []
      } };
    }).then(res => {
      setOffline({ on: res.fromCache || isOfflineError(res.error), at: res.savedAt });
      setS(res.data ?? { listings: [], auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] });
    });
  }, []));

  const listing = (x: any) => <ItemCard key={x.id} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={listingPriceLabel(x)}
    icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? "Leilão" : x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : undefined}
    tagRed={x.purpose === "auction"} meta={timeAgo(x.published_at ?? x.created_at)} />;

  return <ScrollView contentContainerStyle={[ui.screen, { gap: 22 }]} keyboardShouldPersistTaps="handled">
    <View style={st.top}><Logo /><NotificationBell /></View>
    <SearchBar />
    <OfflineBanner show={offline.on} savedAt={offline.at} />

    {signedIn === false && <View style={st.welcome}>
      <Text style={ui.text}>Entre para comprar, vender e guardar favoritos.</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title="Entrar" onPress={() => router.push("/login")} /></View>
        <View style={{ flex: 1 }}><Button title="Criar conta" variant="secondary" onPress={() => router.push("/criar-conta" as any)} /></View>
      </View>
    </View>}

    <View style={st.hero}>
      <Text style={st.heroTitle}>Compre, venda e encontre tudo no Huambo.</Text>
      <Text style={st.heroText}>Classificados, loja, leilões, profissionais e empresas.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/classificados/publicar" as any)} style={st.heroBtn}><Text style={st.heroBtnText}>Vender agora</Text></Pressable>
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 16 }}>
      {HOME_CATEGORIES.map(c => <Link key={c.href} href={c.href as any} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={c.label} style={st.cat}>
          <View style={st.catCircle}><Text style={{ fontSize: 34 }}>{c.icon}</Text></View>
          <Text style={st.catLabel}>{c.label}</Text>
        </Pressable>
      </Link>)}
    </ScrollView>

    {s === null && <Text style={ui.muted}>A carregar novidades…</Text>}
    {!!s?.auctions.length && <Shelf title="🔨 Leilões a decorrer" href="/explorar?finalidade=auction">{s.auctions.map(listing)}</Shelf>}
    {!!s?.markets.length && <Shelf title="🧺 Praças do Huambo" href="/pracas">{s.markets.map(m => <Link key={m.id} href={("/pracas/" + m.id) as any} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={m.name} style={{ width: 160, gap: 4 }}>
        <View style={st.marketImg}>{m.photo_url ? <Image source={{ uri: m.photo_url }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontSize: 44 }}>🧺</Text>}</View>
        <Text style={ui.label} numberOfLines={2}>{m.name}</Text>
        <Text style={ui.muted} numberOfLines={2}>{marketSummary(m)}</Text>
      </Pressable>
    </Link>)}</Shelf>}
    {!!s?.listings.length && <Shelf title="Novidades" href="/explorar">{s.listings.map(listing)}</Shelf>}

    {!!s?.wanted.length && <Shelf title="🔎 Procura-se" href="/procura-se">{s.wanted.map(x => <Link key={x.id} href={("/classificados/" + x.id) as any} asChild>
      <Pressable accessibilityRole="link" style={[ui.card, { width: 200, borderLeftWidth: 6, borderLeftColor: C.yellow }]}>
        <Text style={ui.muted}>🔎 PROCURA-SE</Text>
        <Text style={ui.label} numberOfLines={3}>{x.title}</Text>
        <Text style={ui.muted}>Orçamento:</Text><Text style={ui.label}>{listingPriceLabel(x)}</Text>
      </Pressable>
    </Link>)}</Shelf>}

    <View style={[st.banner, { backgroundColor: "#fff4d6" }]}>
      <Text style={ui.h2}>Tem algo para vender?</Text>
      <Text style={ui.text}>Publique grátis com fotografias e receba mensagens de compradores.</Text>
      <Button title="+ Publicar anúncio" onPress={() => router.push("/classificados/publicar" as any)} />
      <Button title="🔎 Publicar o que procuro" variant="secondary" onPress={() => router.push("/classificados/publicar?finalidade=wanted" as any)} />
    </View>

    {!!s?.products.length && <Shelf title="🛍️ Na loja" href="/loja">{s.products.map(p => <ItemCard key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name}
      price={formatPrice(p.price, p.currency)} tag={p.stock > 0 ? undefined : "Esgotado"} meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}</Shelf>}
    {!!s?.rentals.length && <Shelf title="🔑 Para arrendar" href="/explorar?finalidade=rent">{s.rentals.map(listing)}</Shelf>}
    {!!s?.trades?.length && <Shelf title="🔁 Trocas" href="/trocas">{s.trades.map(listing)}</Shelf>}
    {!!s?.providers.length && <Shelf title="🛠️ Profissionais" href="/profissionais">{s.providers.map(p => <Link key={p.user_id} href={("/profissionais/" + p.user_id) as any} asChild>
      <Pressable accessibilityRole="link" style={[ui.card, { width: 180 }]}>
        {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} /> : <Text style={{ fontSize: 36 }}>👷</Text>}
        <Text style={ui.label} numberOfLines={2}>{p.display_name}{p.verified ? " ✔️" : ""}</Text>
        <Text style={ui.muted} numberOfLines={1}>{[p.category_name, p.municipality_name].filter(Boolean).join(" · ")}</Text>
        <Text style={ui.muted}>{ratingLabel(p.rating, p.review_count)}</Text>
      </Pressable>
    </Link>)}</Shelf>}

    {s && !s.listings.length && !s.products.length && <View style={ui.card}>
      <Text style={ui.h2}>Seja o primeiro a anunciar!</Text>
      <Text style={ui.text}>Ainda há poucos artigos. Publique o seu e ajude o Huambo Online a crescer.</Text>
    </View>}

    <View style={{ gap: 4 }}>
      <Text style={ui.h2}>Atalhos</Text>
      {MORE.map(([icon, label, href]) => <Link key={href} href={href as any} asChild>
        <Pressable accessibilityRole="link" style={st.rowLink}><Text style={{ fontSize: 22, width: 32 }}>{icon}</Text><Text style={[ui.text, { flex: 1 }]}>{label}</Text><Text style={ui.muted}>›</Text></Pressable>
      </Link>)}
    </View>

    <View style={[st.banner, { backgroundColor: "#e6f4ec" }]}>
      <Text style={ui.h2}>Profissional, empresa ou estafeta?</Text>
      <Text style={ui.text}>Crie o seu perfil e receba clientes de todo o Huambo.</Text>
      <Button title="Sou profissional" variant="secondary" onPress={() => router.push("/conta/profissional" as any)} />
      <Button title="Tenho uma empresa" variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />
      <Button title="Quero ser estafeta" variant="secondary" onPress={() => router.push("/entregas" as any)} />
    </View>
  </ScrollView>;
}

const st = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  welcome: { gap: 10, backgroundColor: C.blueSoft, borderRadius: 16, padding: 14 },
  hero: { backgroundColor: C.blue, borderRadius: 20, padding: 20, gap: 8 },
  heroTitle: { color: C.white, fontSize: 26, fontWeight: "800", lineHeight: 31 },
  heroText: { color: C.white, fontSize: 16 },
  heroBtn: { alignSelf: "flex-start", backgroundColor: C.white, borderRadius: 999, paddingHorizontal: 20, minHeight: 46, justifyContent: "center", marginTop: 6 },
  heroBtnText: { color: C.ink, fontWeight: "800", fontSize: 16 },
  cat: { alignItems: "center", gap: 6, width: 84 },
  catCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  catLabel: { fontSize: 13, fontWeight: "700", color: C.ink, textAlign: "center" },
  banner: { borderRadius: 20, padding: 18, gap: 10 },
  marketImg: { width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rowLink: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }
});
