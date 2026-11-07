import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SkeletonShelf } from "../components/Skeleton";
import { recommendedListings, searchClassifiedListings, listProducts, listProviders, listMarkets, formatPrice, ratingLabel, HOME_CATEGORIES, PURPOSE_LABELS, listingPriceLabel, listWanted, listTrades, cardSaleTag, loadWithCache, isOfflineError, isFeatured, listEvents, priceFromText, categoryLabelIn } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { ui, C, themed } from "../lib/ui";
import { Button } from "../components/Ui";
import { NotificationBell } from "../components/NotificationBell";
import { ThemeToggle } from "../components/ThemePicker";
import { DataSaverToggle } from "../components/DataSaver";
import { Logo, SearchBar } from "../components/Brand";
import { ItemCard, Shelf, LISTING_ICON } from "../components/ItemCard";
import { PromoShelf } from "../components/Promo";
import { OfflineBanner } from "../components/Offline";
import { deviceStore } from "../components/Engage";
import { LiteImage } from "../components/LiteImage";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT, coreText, timeAgoIn, formatDateTimeIn, marketSummaryIn } from "../lib/i18n";

type Shelves = { listings: any[]; auctions: any[]; rentals: any[]; products: any[]; providers: any[]; markets: any[]; wanted: any[]; trades?: any[]; events?: any[] };

/** Atalhos: [ícone, chave do texto, endereço]. */
const MORE: [string, string, string][] = [
  ["🌾", "more.agri", "/agricultura"], ["⛽", "cat.Combustível e gás", "/combustivel"], ["🎟️", "cat.Eventos", "/eventos"], ["✈️", "cat.Importação", "/importacao"], ["🎬", "more.videos", "/videos"], ["👥", "more.following", "/seguindo"], ["🛡️", "more.safety", "/seguranca"], ["🆘", "sp.short", "/suporte"], ["🤝", "more.agent", "/agente"], ["🎁", "more.invite", "/convidar"], ["📋", "more.my_listings", "/meus-anuncios"], ["📦", "more.orders", "/encomendas"], ["🔍", "ii.see_mine", "/inspecoes"], ["♥", "nav.saved", "/guardados"],
  ["🗺️", "map.title", "/mapa"], ["🕘", "more.recent", "/historico"], ["⭐", "more.saved_searches", "/pesquisas-guardadas"], ["🔔", "nav.notifications", "/notificacoes"]
];

export default function Home() {
  const router = useRouter(); const { t, lang } = useT();
  const [s, setS] = useState<Shelves | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null); const [recs, setRecs] = useState<any[]>([]);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [near, setNear] = useState<{ name: string; items: any[] } | null>(null); const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!supabaseConfigured) { setS({ listings: [], auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] }); return; }
    const c = supabase();
    // «Para si»: só com sessão iniciada (com base no que a pessoa viu, pesquisou e guardou).
    void c.auth.getUser().then(({ data }) => {
      setSignedIn(!!data.user);
      if (data.user) { void recommendedListings(c, 12).then(r => setRecs(r.data)); void nearMe(c, data.user.id).then(setNear); } else { setRecs([]); setNear(null); }
    });
    // Guarda a página inicial para a mostrar quando não houver internet.
    await loadWithCache<Shelves>(deviceStore, "inicio", async () => {
      const all = await Promise.all([
        searchClassifiedListings(c, { limit: 12 }), searchClassifiedListings(c, { purpose: "auction", limit: 12 }),
        searchClassifiedListings(c, { purpose: "rent", limit: 12 }), listProducts(c, { limit: 12 }), listProviders(c, { limit: 12 }), listMarkets(c), listWanted(c, "", 12), listTrades(c, "", false, 12), listEvents(c, { limit: 12 })
      ]);
      const netError = all.map(r => r.error).find(e => isOfflineError(e));
      if (netError) return { data: null, error: netError };
      const [l, a, r, p, v, mk, w, t, ev] = all;
      return { data: {
        listings: (l.data as any[]) ?? [], auctions: (a.data as any[]) ?? [], rentals: (r.data as any[]) ?? [],
        products: (p.data as any[]) ?? [], providers: (v.data as any[]) ?? [], markets: (mk.data as any[]) ?? [], wanted: (w.data as any[]) ?? [], trades: (t.data as any[]) ?? [], events: (ev.data as any[]) ?? []
      } };
    }).then(res => {
      setOffline({ on: res.fromCache || isOfflineError(res.error), at: res.savedAt });
      setS(res.data ?? { listings: [], auctions: [], rentals: [], products: [], providers: [], markets: [], wanted: [] });
    });
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }

  const listing = (x: any) => <ItemCard save={{ kind: "listing", id: x.id }} key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title} price={coreText(listingPriceLabel(x), t) ?? ""}
    icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? t("tag.auction") : coreText(x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : cardSaleTag(x), t)}
    tagRed={x.purpose === "auction"} meta={timeAgoIn(x.published_at ?? x.created_at, t, lang)} />;

  return <ScrollView contentContainerStyle={[ui.screen, { gap: 22 }]} keyboardShouldPersistTaps="handled"
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[C.blue]} tintColor={C.blue} />}>
    <View style={st.top}><Logo /><NotificationBell /></View>
    <View style={{ flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: -14 }}><DataSaverToggle /><ThemeToggle /></View>
    <LanguagePicker compact />
    <SearchBar />
    <OfflineBanner show={offline.on} savedAt={offline.at} />

    {signedIn === false && <View style={st.welcome}>
      <Text style={ui.text}>{t("home.welcome")}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>
        <View style={{ flex: 1 }}><Button title={t("auth.signup")} variant="secondary" onPress={() => router.push("/criar-conta" as any)} /></View>
      </View>
    </View>}

    <View style={st.hero}>
      <Text style={st.heroTitle}>{t("home.hero_title")}</Text>
      <Text style={st.heroText}>{t("home.hero_text")}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/classificados/publicar" as any)} style={st.heroBtn}><Text style={st.heroBtnText}>{t("home.sell_now")}</Text></Pressable>
    </View>

    {/* Todas as categorias à vista (grelha de 4 colunas), por ordem alfabética na língua escolhida. */}
    <View style={st.catGrid}>
      {HOME_CATEGORIES.map(c => ({ ...c, name: categoryLabelIn(c.label, lang) })).sort((a, b) => a.name.localeCompare(b.name, lang)).map(c => <Link key={c.href} href={c.href as any} asChild>
        <Pressable accessibilityRole="link" accessibilityLabel={c.name} style={st.cat}>
          <View style={st.catCircle}><Text style={{ fontSize: 28 }}>{c.icon}</Text></View>
          <Text style={st.catLabel} numberOfLines={2}>{c.name}</Text>
        </Pressable>
      </Link>)}
    </View>

    {s === null && <><SkeletonShelf /><SkeletonShelf /></>}
    {!!recs.length && <Shelf title={"✨ " + t("home.for_you")} href="/explorar">{recs.map(listing)}</Shelf>}
    {!!near?.items.length && <Shelf title={"📍 " + t("home.near", { place: near.name })} href="/mapa">{near.items.map(listing)}</Shelf>}
    <PromoShelf title={t("home.videos")} />
    {!!s?.events?.length && <Shelf title={"🎟️ " + t("home.events")} href="/eventos">{s.events.map(e => <ItemCard key={e.id} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon="🎟️"
      title={e.title} price={coreText(priceFromText(e.price_from), t) ?? ""} featured={e.featured} meta={`📅 ${formatDateTimeIn(e.starts_at, lang)}`} />)}</Shelf>}
    {!!s?.auctions.length && <Shelf title={t("home.auctions")} href="/explorar?finalidade=auction">{s.auctions.map(listing)}</Shelf>}
    {!!s?.markets.length && <Shelf title={t("home.markets")} href="/pracas">{s.markets.map(m => <Link key={m.id} href={("/pracas/" + m.id) as any} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={m.name} style={{ width: 160, gap: 4 }}>
        <View style={st.marketImg}>{m.photo_url ? <LiteImage placeholder="🧺" source={{ uri: m.photo_url }} style={{ width: "100%", height: "100%" }} /> : <Text style={{ fontSize: 44 }}>🧺</Text>}</View>
        <Text style={ui.label} numberOfLines={2}>{m.name}</Text>
        <Text style={ui.muted} numberOfLines={2}>{marketSummaryIn(m, t)}</Text>
      </Pressable>
    </Link>)}</Shelf>}
    {!!s?.listings.length && <Shelf title={t("home.new")} href="/explorar">{s.listings.map(listing)}</Shelf>}

    {!!s?.wanted.length && <Shelf title={"🔎 " + t("home.wanted")} href="/procura-se">{s.wanted.map(x => <Link key={x.id} href={("/classificados/" + x.id) as any} asChild>
      <Pressable accessibilityRole="link" style={[ui.card, { width: 200, borderLeftWidth: 6, borderLeftColor: C.yellow }]}>
        <Text style={ui.muted}>{t("home.wanted_badge")}</Text>
        <Text style={ui.label} numberOfLines={3}>{x.title}</Text>
        <Text style={ui.muted}>{t("home.budget")}</Text><Text style={ui.label}>{coreText(listingPriceLabel(x), t)}</Text>
      </Pressable>
    </Link>)}</Shelf>}

    <View style={[st.banner, { backgroundColor: C.yellowSoft }]}>
      <Text style={ui.h2}>{t("home.sell_title")}</Text>
      <Text style={ui.text}>{t("home.sell_text")}</Text>
      <Button title={t("home.post_listing")} onPress={() => router.push("/classificados/publicar" as any)} />
      <Button title={t("home.post_wanted")} variant="secondary" onPress={() => router.push("/classificados/publicar?finalidade=wanted" as any)} />
    </View>

    {!!s?.products.length && <Shelf title={t("home.in_shop")} href="/loja">{s.products.map(p => <ItemCard save={{ kind: "product", id: p.id }} key={p.id} href={"/loja/" + p.id} media={p.media} title={p.name}
      price={coreText(formatPrice(p.price, p.currency), t) ?? ""} tag={p.stock > 0 ? undefined : t("tag.sold_out")} meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}</Shelf>}
    {!!s?.rentals.length && <Shelf title={t("home.for_rent")} href="/explorar?finalidade=rent">{s.rentals.map(listing)}</Shelf>}
    {!!s?.trades?.length && <Shelf title={"🔁 " + t("home.trades")} href="/trocas">{s.trades.map(listing)}</Shelf>}
    {!!s?.providers.length && <Shelf title={"👷 " + t("home.providers")} href="/profissionais">{s.providers.map(p => <Link key={p.user_id} href={("/profissionais/" + p.user_id) as any} asChild>
      <Pressable accessibilityRole="link" style={[ui.card, { width: 180 }]}>
        {p.avatar_url ? <LiteImage placeholder="👤" source={{ uri: p.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28 }} /> : <Text style={{ fontSize: 36 }}>👷</Text>}
        <Text style={ui.label} numberOfLines={2}>{p.display_name}{p.verified ? " ✔️" : ""}</Text>
        <Text style={ui.muted} numberOfLines={1}>{[p.category_name, p.municipality_name].filter(Boolean).join(" · ")}</Text>
        <Text style={ui.muted}>{coreText(ratingLabel(p.rating, p.review_count), t)}</Text>
      </Pressable>
    </Link>)}</Shelf>}

    {s && !s.listings.length && !s.products.length && <View style={ui.card}>
      <Text style={ui.h2}>{t("home.first_title")}</Text>
      <Text style={ui.text}>{t("home.first_text")}</Text>
    </View>}

    <View style={{ gap: 4 }}>
      <Text style={ui.h2}>{t("home.shortcuts")}</Text>
      {MORE.map(([icon, key, href]) => <Link key={href} href={href as any} asChild>
        <Pressable accessibilityRole="link" style={st.rowLink}><Text style={{ fontSize: 22, width: 32 }}>{icon}</Text><Text style={[ui.text, { flex: 1 }]}>{t(key)}</Text><Text style={ui.muted}>›</Text></Pressable>
      </Link>)}
    </View>

    <View style={[st.banner, { backgroundColor: C.greenSoft }]}>
      <Text style={ui.h2}>{t("home.pro_title")}</Text>
      <Text style={ui.text}>{t("home.pro_text")}</Text>
      <Button title={t("home.i_am_pro")} variant="secondary" onPress={() => router.push("/conta/profissional" as any)} />
      <Button title={t("home.i_have_business")} variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />
      <Button title={t("home.be_courier")} variant="secondary" onPress={() => router.push("/entregas" as any)} />
      <Button title={t("home.be_agent")} variant="secondary" onPress={() => router.push("/agente" as any)} />
    </View>
  </ScrollView>;
}

/** «Perto de si»: anúncios do município da conta. */
async function nearMe(c: ReturnType<typeof supabase>, uid: string): Promise<{ name: string; items: any[] } | null> {
  const p = await c.from("profiles").select("municipality").eq("id", uid).maybeSingle();
  const name = String((p.data as any)?.municipality ?? "").trim(); if (!name) return null;
  const m = await c.from("municipalities").select("id,name").ilike("name", name).limit(1).maybeSingle();
  if (!m.data) return null;
  const r = await searchClassifiedListings(c, { municipalityId: (m.data as any).id, limit: 12 });
  return { name: (m.data as any).name, items: (r.data as any[]) ?? [] };
}

const st = themed(C => StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  welcome: { gap: 10, backgroundColor: C.blueSoft, borderRadius: 16, padding: 14 },
  hero: { backgroundColor: "#3665F3", borderRadius: 20, padding: 20, gap: 8 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontWeight: "800", lineHeight: 31 },
  heroText: { color: "#FFFFFF", fontSize: 16 },
  heroBtn: { alignSelf: "flex-start", maxWidth: "100%", backgroundColor: "#FFFFFF", borderRadius: 999, paddingHorizontal: 20, minHeight: 46, justifyContent: "center", marginTop: 6 },
  heroBtnText: { color: "#191919", fontWeight: "800", fontSize: 16, textAlign: "center" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  cat: { alignItems: "center", gap: 6, width: "25%", paddingHorizontal: 2 },
  catCircle: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  catLabel: { fontSize: 12, fontWeight: "700", color: C.ink, textAlign: "center" },
  banner: { borderRadius: 20, padding: 18, gap: 10 },
  marketImg: { width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  rowLink: { flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.line }
}));
