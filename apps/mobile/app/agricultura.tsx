import { useEffect, useState } from "react";
import { useWindowDimensions, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { listAgroListings, listingPriceLabel, readAgro, agroSummary, friendlyError, isFeatured, AGRO_CATEGORIES, type AgroCategory } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { ItemCard, Grid } from "../components/ItemCard";

/** Agricultura e campo: colheitas, gado, insumos e serviços agrícolas do Huambo. */
export default function Agricultura() {
  const router = useRouter();
  const { width } = useWindowDimensions(); const cardW = (width - 44) / 2;
  const [cat, setCat] = useState<AgroCategory | "all">("all"); const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(c = cat, query = q) {
    setError("");
    const r = await listAgroListings(supabase(), { category: c === "all" ? "" : c, query });
    if (r.error) setError(friendlyError(r.error)); else setItems(r.data);
  }
  useEffect(() => { void load(); }, []);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Início</Link>
    <Text style={ui.h1}>🌾 Agricultura e campo</Text>
    <Text style={ui.text}>Milho, batata, feijão, hortícolas, gado, sementes e adubos, direto de quem produz no Huambo. Venda a granel por saco, quilo, tonelada ou cabeça.</Text>
    <Button title="+ Vender produtos do campo" onPress={() => router.push("/classificados/publicar?campo=1" as any)} />
    <View style={[ui.row, { flexWrap: "nowrap" }]}>
      <TextInput style={[ui.input, { flex: 1 }]} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} placeholder="Ex.: batata, milho, cabritos…" placeholderTextColor={C.muted} accessibilityLabel="Procurar no campo" returnKeyType="search" />
      <Button title="Procurar" onPress={() => void load()} />
    </View>
    <Chips options={[{ value: "all" as const, label: "Tudo" }, ...AGRO_CATEGORIES.map(c => ({ value: c.value, label: c.icon + " " + c.label.replace(/ \(.*\)$/, "") }))]} value={cat} onChange={v => { setCat(v); void load(v); }} />
    <Message error={error} />
    {items === null && !error && <Text style={ui.text}>A carregar…</Text>}
    {items?.length === 0 && <Text style={ui.text}>Ainda não há anúncios{cat !== "all" ? " deste tipo" : ""}. Seja o primeiro a anunciar!</Text>}
    {!!items?.length && <Grid>{items.map(x => { const a = readAgro(x.attributes); const c = AGRO_CATEGORIES.find(k => k.value === a?.category);
      return <ItemCard key={x.id} featured={isFeatured(x)} width={cardW} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
        price={listingPriceLabel(x)} icon={c?.icon ?? "🌾"} tag={x.purpose === "wanted" ? "Procura" : undefined} meta={a ? agroSummary(a).split(" · ").slice(1).join(" · ") : undefined} />; })}</Grid>}
  </ScrollView>;
}
