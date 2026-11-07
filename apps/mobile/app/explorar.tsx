import { useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SkeletonGrid } from "../components/Skeleton";
import { C } from "../lib/ui";
import { SALE_MODE_FILTERS, cardSaleTag, loadWithCache, isOfflineError, searchClassifiedListings, saveClassifiedSearch, listProvinces, listMunicipalities, formatPrice, friendlyErrorIn, parsePrice,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, readExploreParams, filterFieldsFor, attributeFilters, trackSearch, type ClassifiedSearchFilters, listingPriceLabel, isFeatured, categoryLabelIn } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message, SortChips } from "../components/Ui";
import { SearchBar } from "../components/Brand";
import { ItemCard, LISTING_ICON } from "../components/ItemCard";
import { OfflineBanner } from "../components/Offline";
import { SmartSearchButton } from "../components/AiTools";
import { deviceStore } from "../components/Engage";
import { getPublic } from "../lib/public-api";
import { classifiedsCached } from "@huambo-online/core";
import { useT, coreText, timeAgoIn } from "../lib/i18n";

type Option = { id: string; name: string };
const PAGE = 30;

export default function Explorar() {
  const params = useLocalSearchParams<{ q?: string; tipo?: string; finalidade?: string; modo?: string; categoria?: string }>();
  const initial = readExploreParams(k => (params as any)[k] ?? null);
  const { t, tc, lang } = useT();
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [q, setQ] = useState(initial.query); const [purpose, setPurpose] = useState(initial.purpose); const [type, setType] = useState(initial.listingType); const [mode, setMode] = useState(initial.saleMode);
  const [categoryId, setCategoryId] = useState(""); const [provinceId, setProvinceId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [name, setName] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<(Option & { slug?: string })[]>([]); const [attrs, setAttrs] = useState<Record<string, string>>({}); const [provinces, setProvinces] = useState<Option[]>([]); const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [items, setItems] = useState<any[] | null>(null);
  const [sort, setSort] = useState<"recent" | "price_asc" | "price_desc">("recent");
  const sorted = useMemo(() => !items || sort === "recent" ? items : byPrice(items, sort === "price_asc" ? "asc" : "desc"), [items, sort]); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(PAGE); const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const c = supabase();
    void listProvinces(c).then(({ data }) => setProvinces((data ?? []) as Option[]));
    // «?categoria=emprego» escolhe logo essa categoria (as categorias carregam primeiro).
    void c.from("categories").select("id,name,slug").eq("type", "classified").eq("active", true).order("name").then(({ data }) => {
      const list = (data ?? []) as (Option & { slug?: string })[]; setCategories(list);
      const fromUrl = initial.categorySlug ? list.find(x => x.slug === initial.categorySlug)?.id ?? "" : "";
      if (fromUrl) { setCategoryId(fromUrl); void search({ categoryId: fromUrl }); } else void search();
    });
  }, []);
  useEffect(() => {
    if (!provinceId) { setMunicipalities([]); return; }
    void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[]));
  }, [provinceId]);

  function filters(o: { q?: string; purpose?: string; mode?: string; categoryId?: string; type?: string; min?: string; max?: string; attrs?: Record<string, string>; limit?: number } = {}): ClassifiedSearchFilters {
    return { limit: o.limit ?? PAGE, query: o.q ?? q, purpose: ((o.purpose ?? purpose) || undefined) as any, listingType: ((o.type ?? type) || undefined) as any, categoryId: (o.categoryId ?? categoryId) || undefined, attributes: attributeFilters(o.type ?? type, categories.find(c => c.id === (o.categoryId ?? categoryId))?.slug, o.attrs ?? attrs),
      provinceId: provinceId || undefined, municipalityId: municipalityId || undefined, minPrice: parsePrice(o.min ?? min), maxPrice: parsePrice(o.max ?? max), saleMode: ((o.mode ?? mode) || undefined) as ClassifiedSearchFilters["saleMode"] };
  }
  async function search(o: { q?: string; purpose?: string; mode?: string; categoryId?: string; type?: string; min?: string; max?: string; attrs?: Record<string, string>; limit?: number } = {}) {
    setError(""); setNotice(""); setBusy(true); setLimit(o.limit ?? PAGE);
    const f = filters(o);
    void trackSearch(supabase(), { query: f.query, categoryId: f.categoryId, listingType: f.listingType });
    // Guarda a última pesquisa de cada filtro para a mostrar sem internet.
    const key = JSON.stringify(f);
    const r = await loadWithCache<{ key: string; items: any[] }>(deviceStore, "explorar", async () => { const x = await classifiedsCached(getPublic, () => searchClassifiedListings(supabase(), f), f as Record<string, unknown>); return { data: x.data ? { key, items: x.data as any[] } : null, error: x.error }; });
    setBusy(false);
    const usable = r.data && r.data.key === key ? r.data.items : null; // só a mesma pesquisa
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: usable ? r.savedAt : null });
    if (r.error && !isOfflineError(r.error)) setError(friendlyErrorIn(r.error, lang)); else setItems(usable ?? []);
  }
  async function save() {
    setError(""); setNotice("");
    const c = supabase(); const u = await c.auth.getUser();
    if (!u.data.user) { setError(t("ls.explore.sign_in_save")); return; }
    if (!name.trim()) { setError(t("ls.explore.name_needed")); return; }
    const r = await saveClassifiedSearch(c, name, filters());
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setName(""); setNotice(t("ls.explore.saved")); }
  }

  // Lista leve: só desenha os cartões que estão no ecrã e carrega mais ao chegar ao fim.
  function more() { if (!busy && items && items.length >= limit && limit < 300) void search({ limit: limit + PAGE }); }
  async function refresh() { setRefreshing(true); await search({ limit }); setRefreshing(false); }
  const header = <View style={{ gap: 14 }}>
    <SearchBar initial={q} onSearch={v => { setQ(v); void search({ q: v }); }} />
    <SmartSearchButton categories={categories.map(c => ({ slug: c.slug, name: c.name }))} onApply={x => {
      const cat = x.categorySlug ? categories.find(c => c.slug === x.categorySlug)?.id ?? "" : "";
      setQ(x.query); setType(x.listingType); setPurpose(x.purpose); setMode(""); setCategoryId(cat); setMin(x.minPrice); setMax(x.maxPrice); setAttrs(x.attributes);
      void search({ q: x.query, type: x.listingType, purpose: x.purpose, mode: "", categoryId: cat, min: x.minPrice, max: x.maxPrice, attrs: x.attributes });
    }} />
    <Text style={ui.h1}>{q ? `«${q}»` : type ? tc(LISTING_TYPE_LABELS[type as keyof typeof LISTING_TYPE_LABELS]) : purpose ? tc(PURPOSE_LABELS[purpose as keyof typeof PURPOSE_LABELS]) : t("ls.explore.title")}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}><Chips options={[{ value: "", label: t("ls.explore.everything") }, ...Object.entries(PURPOSE_LABELS).map(([v, l]) => ({ value: v, label: tc(l) }))]} value={purpose} onChange={v => { setPurpose(v); void search({ purpose: v }); }} /></ScrollView>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}><Chips options={[{ value: "", label: t("ls.explore.mode_all") }, ...SALE_MODE_FILTERS.map(o => ({ ...o, label: tc(o.label) }))]} value={mode} onChange={v => { setMode(v); void search({ mode: v }); }} /></ScrollView>
    <Button title={showFilters ? t("ls.explore.hide_filters") : t("ls.explore.filters")} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Text style={ui.label}>{t("ls.explore.type")}</Text>
      <Chips options={[{ value: "", label: t("ls.all_m") }, ...Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => ({ value: v, label: tc(l) }))]} value={type} onChange={v => { setType(v); setAttrs({}); }} />
      <Text style={ui.label}>{t("ls.explore.category")}</Text>
      <Chips options={[{ value: "", label: t("ls.all_f") }, ...categories.map(c => ({ value: c.id, label: categoryLabelIn(c.name, lang) }))]} value={categoryId} onChange={v => { setCategoryId(v); setAttrs({}); }} />
      {filterFieldsFor(type, categories.find(c => c.id === categoryId)?.slug).map(fd => <View key={fd.key} style={{ gap: 6 }}>
        <Text style={ui.label}>{t("attr." + fd.key)}</Text>
        <Chips options={[{ value: "", label: t("ls.all_m") }, ...fd.options!.map(o => ({ value: o, label: t(`attr.${fd.key}.${o}`) }))]} value={attrs[fd.key] ?? ""} onChange={v => setAttrs(a => ({ ...a, [fd.key]: v }))} />
      </View>)}
      <Text style={ui.label}>{t("ls.explore.province")}</Text>
      <Chips options={[{ value: "", label: t("ls.all_f") }, ...provinces.map(p => ({ value: p.id, label: p.name }))]} value={provinceId} onChange={v => { setProvinceId(v); setMunicipalityId(""); }} />
      {!!provinceId && <><Text style={ui.label}>{t("auth.municipality")}</Text>
        <Chips options={[{ value: "", label: t("ls.all_m") }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId} onChange={setMunicipalityId} /></>}
      <TextInput value={min} onChangeText={setMin} placeholder={t("ls.explore.min_price")} keyboardType="numeric" style={ui.input} />
      <TextInput value={max} onChangeText={setMax} placeholder={t("ls.explore.max_price")} keyboardType="numeric" style={ui.input} />
    </View>}
    {showFilters && <Button title={busy ? t("ls.explore.searching") : t("ls.explore.apply")} onPress={() => void search()} disabled={busy} />}
    {showFilters && <><TextInput value={name} onChangeText={setName} placeholder={t("ls.explore.save_name")} style={ui.input} />
    <Button title={t("ls.explore.save_alerts")} variant="secondary" onPress={() => void save()} /></>}
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    <Message error={error} ok={notice} />
    {items !== null && <Text style={ui.label}>{t("ls.explore.results", { n: items.length })}</Text>}
    {!!items?.length && <SortChips label={t("ls.sort")} value={sort} onChange={setSort} options={[{ value: "recent", label: t("ls.sort_recent") }, { value: "price_asc", label: t("ls.sort_price_asc") }, { value: "price_desc", label: t("ls.sort_price_desc") }]} />}
    {items?.length === 0 && <View style={ui.card}><Text style={ui.text}>{t("ls.explore.none")}</Text><Link href="/classificados/publicar" style={ui.link}>{t("ls.explore.post_first")}</Link></View>}
  </View>;
  return <FlatList data={sorted ?? []} keyExtractor={x => x.id} numColumns={2} columnWrapperStyle={{ justifyContent: "space-between" }}
    contentContainerStyle={[ui.screen, { gap: 18 }]} keyboardShouldPersistTaps="handled" ListHeaderComponent={header}
    ListEmptyComponent={items === null ? <SkeletonGrid /> : null} ListFooterComponent={busy && !!items?.length ? <SkeletonGrid n={2} /> : null}
    initialNumToRender={6} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews onEndReachedThreshold={0.6} onEndReached={more}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[C.blue]} tintColor={C.blue} />}
    renderItem={({ item: x }) => <ItemCard save={{ kind: "listing", id: x.id }} featured={isFeatured(x)} video={!!x.video_url} width={cardW} href={`/classificados/${x.id}`} media={x.media} title={x.title} price={tc(coreText(listingPriceLabel(x), t) ?? "")}
      icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? t("tag.auction") : coreText(x.purpose !== "sale" ? tc(PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS]) : cardSaleTag(x), t)} tagRed={x.purpose === "auction"}
      meta={timeAgoIn(x.published_at ?? x.created_at, t, lang)} />} />;
}
/** Ordena por preço (sem preço fica no fim). */
function byPrice(list: any[], dir: "asc" | "desc") {
  const p = (x: any) => (typeof x.price === "number" && x.price > 0 ? x.price : null);
  return [...list].sort((a, b) => { const pa = p(a), pb = p(b); if (pa === null) return 1; if (pb === null) return -1; return dir === "asc" ? pa - pb : pb - pa; });
}
