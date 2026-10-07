import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { searchClassifiedListings, saveClassifiedSearch, listProvinces, listMunicipalities, formatPrice, friendlyError, parsePrice,
  LISTING_TYPE_LABELS, PURPOSE_LABELS, PUBLISHABLE_PURPOSES, type ClassifiedSearchFilters } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

type Option = { id: string; name: string };

export default function Explorar() {
  const [q, setQ] = useState(""); const [purpose, setPurpose] = useState(""); const [type, setType] = useState("");
  const [categoryId, setCategoryId] = useState(""); const [provinceId, setProvinceId] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [min, setMin] = useState(""); const [max, setMax] = useState(""); const [name, setName] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const [provinces, setProvinces] = useState<Option[]>([]); const [municipalities, setMunicipalities] = useState<Option[]>([]);
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

  function filters(): ClassifiedSearchFilters {
    return { query: q, purpose: (purpose || undefined) as any, listingType: (type || undefined) as any, categoryId: categoryId || undefined,
      provinceId: provinceId || undefined, municipalityId: municipalityId || undefined, minPrice: parsePrice(min), maxPrice: parsePrice(max) };
  }
  async function search() {
    setError(""); setNotice(""); setBusy(true);
    const r = await searchClassifiedListings(supabase(), filters());
    setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data ?? []) as any[]);
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
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>Explorar classificados</Text>
    <TextInput value={q} onChangeText={setQ} placeholder="Pesquisar (ex.: casa, Hilux…)" style={ui.input} returnKeyType="search" onSubmitEditing={() => void search()} />
    <Button title={showFilters ? "Esconder filtros" : "Mais filtros"} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Text style={ui.label}>Finalidade</Text>
      <Chips options={[{ value: "", label: "Todas" }, ...PUBLISHABLE_PURPOSES.map(p => ({ value: p, label: PURPOSE_LABELS[p] }))]} value={purpose} onChange={setPurpose} />
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
    <Button title={busy ? "A pesquisar…" : "Pesquisar"} onPress={() => void search()} disabled={busy} />
    <TextInput value={name} onChangeText={setName} placeholder="Nome para guardar esta pesquisa" style={ui.input} />
    <Button title="⭐ Guardar pesquisa" variant="secondary" onPress={() => void save()} />
    <Message error={error} ok={notice} />
    {items?.length === 0 && <Text style={ui.text}>Nenhum anúncio encontrado.</Text>}
    {items?.map(x => <Link key={x.id} href={`/classificados/${x.id}` as any} asChild>
      <Pressable style={ui.card} accessibilityRole="link">
        {Array.isArray(x.media) && x.media[0] ? <Image source={{ uri: x.media[0] }} style={{ width: "100%", height: 180, borderRadius: 10 }} /> : null}
        <Text style={ui.h2}>{x.title}</Text>
        <Text style={ui.price}>{formatPrice(x.price, x.currency)}</Text>
        <Text style={ui.text}>{LISTING_TYPE_LABELS[x.listing_type as keyof typeof LISTING_TYPE_LABELS] ?? x.listing_type} · {PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? x.purpose}</Text>
      </Pressable>
    </Link>)}
  </ScrollView>;
}
