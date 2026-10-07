import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { listProducts, listProductCategories, formatPrice, friendlyError } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";

type Option = { id: string; name: string };

export default function Loja() {
  const router = useRouter();
  const [q, setQ] = useState(""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? [])); void search(); }, []);
  async function search() {
    setError("");
    const r = await listProducts(supabase(), { query: q, categoryId, municipalityId });
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>Loja</Text>
    <View style={ui.row}>
      <Button title="🛒 Carrinho" onPress={() => router.push("/carrinho" as any)} />
      <Button title="📦 Encomendas" variant="secondary" onPress={() => router.push("/encomendas" as any)} />
      <Button title="Vender" variant="secondary" onPress={() => router.push("/conta/produtos" as any)} />
    </View>
    <TextInput value={q} onChangeText={setQ} placeholder="Ex.: arroz, telemóvel, cimento…" style={ui.input} returnKeyType="search" onSubmitEditing={() => void search()} />
    <Button title={showFilters ? "Esconder filtros" : "Filtros"} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Text style={ui.label}>Categoria</Text>
      <Chips options={[{ value: "", label: "Todas" }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
      <Text style={ui.label}>Município</Text>
      <Chips options={[{ value: "", label: "Todos" }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId} onChange={setMunicipalityId} />
    </View>}
    <Button title="Pesquisar" onPress={() => void search()} />
    <Message error={error} />
    {items?.length === 0 && <Text style={ui.text}>Ainda não há produtos nesta pesquisa.</Text>}
    {items?.map(p => <Pressable key={p.id} style={ui.card} accessibilityRole="link" onPress={() => router.push(("/loja/" + p.id) as any)}>
      {Array.isArray(p.media) && p.media[0] ? <Image source={{ uri: p.media[0] }} style={{ width: "100%", height: 180, borderRadius: 10 }} /> : null}
      <Text style={ui.h2}>{p.name}</Text>
      <Text style={ui.price}>{formatPrice(p.price, p.currency)}</Text>
      <Text style={ui.muted}>{p.stock > 0 ? `${p.stock} em stock` : "Esgotado"} · {[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")}</Text>
    </Pressable>)}
  </ScrollView>;
}
