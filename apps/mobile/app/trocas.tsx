import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { listTrades, listingPriceLabel, friendlyError, timeAgo, PUBLISH_TRADE_HREF } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { ItemCard, Grid, LISTING_ICON } from "../components/ItemCard";

/** Trocas: anúncios «Só troca» e anúncios que também aceitam troca. */
export default function Trocas() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? ""); const [only, setOnly] = useState<"all" | "trade">("all");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function search(query = q, o = only) {
    setError("");
    const r = await listTrades(supabase(), query, o === "trade");
    if (r.error) setError(friendlyError(r.error)); else setItems((r.data as any[]) ?? []);
  }
  useFocusEffect(useCallback(() => { void search(); }, []));
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <View style={{ backgroundColor: C.blueSoft, borderRadius: 20, padding: 18, gap: 8 }}>
      <Text style={ui.h1}>🔁 Trocas</Text>
      <Text style={ui.text}>Troque o que já não usa por algo de que precisa. Também aparecem anúncios à venda que aceitam troca.</Text>
      <Button title="+ Publicar uma troca" onPress={() => router.push(PUBLISH_TRADE_HREF as any)} />
    </View>
    <TextInput style={ui.input} value={q} onChangeText={setQ} placeholder="Ex.: telemóvel, geleira, motorizada…" returnKeyType="search" onSubmitEditing={() => void search()} accessibilityLabel="Procurar trocas" />
    <Chips<"all" | "trade"> options={[{ value: "all", label: "Todas" }, { value: "trade", label: "Só troca" }]} value={only} onChange={v => { setOnly(v); void search(q, v); }} />
    <Message error={error} />
    {items === null && !error && <Text style={ui.text}>A carregar…</Text>}
    {items?.length === 0 && <Text style={ui.text}>Ainda não há trocas{q ? ` com «${q}»` : ""}. Seja o primeiro a publicar uma troca.</Text>}
    {!!items?.length && <Grid>{items.map(x => <ItemCard key={x.id} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
      price={listingPriceLabel(x)} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.sale_mode === "trade" ? "Troca" : "Aceita troca"}
      meta={[x.trade_wants ? "Quer: " + x.trade_wants : "", timeAgo(x.published_at ?? x.created_at)].filter(Boolean).join(" · ")} />)}</Grid>}
  </ScrollView>;
}
