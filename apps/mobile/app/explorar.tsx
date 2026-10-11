import { useEffect, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { loadWithCache, isOfflineError, searchClassifiedListings, saveClassifiedSearch, listProvinces, listMunicipalities, formatPrice, friendlyError, parsePrice,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, readExploreParams, timeAgo, type ClassifiedSearchFilters, listingPriceLabel } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { SearchBar } from "../components/Brand";
import { ItemCard, Grid, LISTING_ICON } from "../components/ItemCard";
import { OfflineBanner } from "../components/Offline";
import { deviceStore } from "../components/Engage";

type Option = { id: string; name: string };

export default function Explorar() {
  const params = useLocalSearchParams<{ q?: string; tipo?: string; finalidade?: string }>();
  const initial = readExploreParams(k => (params as any)[k] ?? null);
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [q, setQ] = useState(initial.query); const [purpose, setPurpose] = useState(initial.purpose); const [type, setType] = useState(initial.listingType);
  const [categoryId, setCategoryId] = useState(""); const [provinceId, setProvinceId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [name, setName] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const [provinces, setProvinces] = useState<Option[]>([]); const [municipalities, setMunicipalities] = useState<Option[]>([]);
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = supabase();
    void c.from("categories").select("id,name").eq("active", true).order("name").then(({ data }) => setCategories(data ?? []));
    void listProvinces(c).then(({ data }) => setProvinces((data ?? []) as Option[]));
    void search();
  }, []);
  useEffect(() => {
    if (!provinceId) { setMunicipalities([]); return; }
    void listMunicipalities(supabase(), provinceId).then(({ data }) => setMunicipalities((data ?? []) as Option[]));
  }, [provinceId]);

  function filters(o: { q?: string; purpose?: string } = {}): ClassifiedSearchFilters {
    return { query: o.q ?? q, purpose: ((o.purpose ?? purpose) || undefined) as any, listingType: (type || undefined) as any, categoryId: categoryId || undefined,
      provinceId: provinceId || undefined, municipalityId: municipalityId || undefined, minPrice: parsePrice(min), maxPrice: parsePrice(max) };
  }
  async function search(o: { q?: string; purpose?: string } = {}) {
    setError(""); setNotice(""); setBusy(true);
    const f = filters(o);
    // Guarda a última pesquisa de cada filtro para a mostrar sem internet.
    const key = JSON.stringify(f);
    const r = await loadWithCache<{ key: string; items: any[] }>(deviceStore, "explorar", async () => { const x = await searchClassifiedListings(supabase(), f); return { data: x.data ? { key, items: x.data as any[] } : null, error: x.error }; });
    setBusy(false);
    const usable = r.data && r.data.key === key ? r.data.items : null; // só a mesma pesquisa
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: usable ? r.savedAt : null });
    if (r.error && !isOfflineError(r.error)) setError(friendlyError(r.error)); else setItems(usable ?? []);
  }
  async function save() {
    setError(""); setNotice("");
    const c = supabase(); const u = await c.auth.getUser();
    if (!u.data.user) { setError("Inicie sessão para guardar pesquisas."); return; }
    if (!name.trim()) { setError("Dê um nome à pesquisa."); return; }
    const r = await saveClassifiedSearch(c, name, filters());
    if (r.error) setError(friendlyError(r.error)); else { setName(""); setNotice("Pesquisa guardada. Vai receber alertas de novos anúncios."); }
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <SearchBar initial={q} onSearch={v => { setQ(v); void search({ q: v }); }} />
    <Text style={ui.h1}>{q ? `«${q}»` : type ? LISTING_TYPE_LABELS[type as keyof typeof LISTING_TYPE_LABELS] : purpose ? PURPOSE_LABELS[purpose as keyof typeof PURPOSE_LABELS] : "Classificados"}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}><Chips options={[{ value: "", label: "Tudo" }, ...Object.entries(PURPOSE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} value={purpose} onChange={v => { setPurpose(v); void search({ purpose: v }); }} /></ScrollView>
    <Button title={showFilters ? "Esconder filtros" : "⚙️ Filtros"} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Text style={ui.label}>Tipo</Text>
      <Chips options={[{ value: "", label: "Todos" }, ...Object.entries(LISTING_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))]} value={type} onChange={setType} />
      <Text style={ui.label}>Categoria</Text>
      <Chips options={[{ value: "", label: "Todas" }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
      <Text style={ui.label}>Província</Text>
      <Chips options={[{ value: "", label: "Todas" }, ...provinces.map(p => ({ value: p.id, label: p.name }))]} value={provinceId} onChange={v => { setProvinceId(v); setMunicipalityId(""); }} />
      {!!provinceId && <><Text style={ui.label}>Município</Text>
        <Chips options={[{ value: "", label: "Todos" }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId} onChange={setMunicipalityId} /></>}
      <TextInput value={min} onChangeText={setMin} placeholder="Preço mínimo (Kz)" keyboardType="numeric" style={ui.input} />
      <TextInput value={max} onChangeText={setMax} placeholder="Preço máximo (Kz)" keyboardType="numeric" style={ui.input} />
    </View>}
    {showFilters && <Button title={busy ? "A pesquisar…" : "Aplicar filtros"} onPress={() => void search()} disabled={busy} />}
    {showFilters && <><TextInput value={name} onChangeText={setName} placeholder="Nome para guardar esta pesquisa" style={ui.input} />
    <Button title="⭐ Guardar pesquisa e receber alertas" variant="secondary" onPress={() => void save()} /></>}
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    <Message error={error} ok={notice} />
    {items !== null && <Text style={ui.label}>{items.length} resultado(s)</Text>}
    {items?.length === 0 && <View style={ui.card}><Text style={ui.text}>Nenhum anúncio encontrado. Experimente outras palavras ou menos filtros.</Text><Link href="/classificados/publicar" style={ui.link}>Publique o primeiro →</Link></View>}
    <Grid>{items?.map(x => <ItemCard key={x.id} video={!!x.video_url} width={cardW} href={`/classificados/${x.id}`} media={x.media} title={x.title} price={listingPriceLabel(x)}
      icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.purpose === "auction" ? "Leilão" : x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] : undefined} tagRed={x.purpose === "auction"}
      meta={timeAgo(x.published_at ?? x.created_at)} />)}</Grid>
  </ScrollView>;
}
