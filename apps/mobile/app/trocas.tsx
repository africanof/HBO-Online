import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, TextInput, View } from "react-native";
import { listTrades, listingPriceLabel, friendlyErrorIn, PUBLISH_TRADE_HREF, isFeatured } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { ItemCard, Grid, LISTING_ICON } from "../components/ItemCard";
import { useT, coreText, timeAgoIn } from "../lib/i18n";

/** Trocas: anúncios «Só troca» e anúncios que também aceitam troca. */
export default function Trocas() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = useState(params.q ?? ""); const [only, setOnly] = useState<"all" | "trade">("all");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function search(query = q, o = only) {
    setError("");
    const r = await listTrades(supabase(), query, o === "trade");
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []);
  }
  useFocusEffect(useCallback(() => { void search(); }, []));
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <View style={{ backgroundColor: C.blueSoft, borderRadius: 20, padding: 18, gap: 8 }}>
      <Text style={ui.h1}>{t("ls.trades.title")}</Text>
      <Text style={ui.text}>{t("ls.trades.intro")}</Text>
      <Button title={t("ls.trades.post")} onPress={() => router.push(PUBLISH_TRADE_HREF as any)} />
    </View>
    <TextInput style={ui.input} value={q} onChangeText={setQ} placeholder={t("ls.trades.ph")} returnKeyType="search" onSubmitEditing={() => void search()} accessibilityLabel={t("ls.trades.search")} />
    <Chips<"all" | "trade"> options={[{ value: "all", label: t("ls.all_f") }, { value: "trade", label: t("ls.trades.only") }]} value={only} onChange={v => { setOnly(v); void search(q, v); }} />
    <Message error={error} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{q ? t("ls.trades.none_q", { q }) : t("ls.trades.none")}</Text>}
    {!!items?.length && <Grid>{items.map(x => <ItemCard save={{ kind: "listing", id: x.id }} key={x.id} featured={isFeatured(x)} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
      price={tc(coreText(listingPriceLabel(x), t) ?? "")} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} tag={x.sale_mode === "trade" ? t("tag.trade") : t("tag.accepts_trade")}
      meta={[x.trade_wants ? t("ls.trades.wants", { what: x.trade_wants }) : "", timeAgoIn(x.published_at ?? x.created_at, t, lang)].filter(Boolean).join(" · ")} />)}</Grid>}
  </ScrollView>;
}
