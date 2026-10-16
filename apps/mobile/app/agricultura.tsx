import { useEffect, useState } from "react";
import { useWindowDimensions, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { listAgroListings, listingPriceLabel, readAgro, agroSummary, friendlyErrorIn, isFeatured, AGRO_CATEGORIES, type AgroCategory } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { ItemCard, Grid } from "../components/ItemCard";
import { useT, coreText } from "../lib/i18n";

/** Agricultura e campo: colheitas, gado, insumos e serviços agrícolas do Huambo. */
export default function Agricultura() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const { width } = useWindowDimensions(); const cardW = (width - 44) / 2;
  const [cat, setCat] = useState<AgroCategory | "all">("all"); const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(c = cat, query = q) {
    setError("");
    const r = await listAgroListings(supabase(), { category: c === "all" ? "" : c, query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
  }
  useEffect(() => { void load(); }, []);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← {t("nav.home")}</Link>
    <Text style={ui.h1}>🌾 {t("more.agri")}</Text>
    <Text style={ui.text}>{t("ls.agro.intro")}</Text>
    <Button title={t("ls.agro.sell")} onPress={() => router.push("/classificados/publicar?campo=1" as any)} />
    <View style={[ui.row, { flexWrap: "nowrap" }]}>
      <TextInput style={[ui.input, { flex: 1 }]} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} placeholder={t("ls.agro.ph")} placeholderTextColor={C.muted} accessibilityLabel={t("ls.agro.search")} returnKeyType="search" />
      <Button title={t("ls.search")} onPress={() => void load()} />
    </View>
    <Chips options={[{ value: "all" as const, label: t("ls.explore.everything") }, ...AGRO_CATEGORIES.map(c => ({ value: c.value, label: c.icon + " " + tc(c.label).replace(/ \(.*\)$/, "") }))]} value={cat} onChange={v => { setCat(v); void load(v); }} />
    <Message error={error} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{cat !== "all" ? t("ls.agro.none_type") : t("ls.agro.none")}</Text>}
    {!!items?.length && <Grid>{items.map(x => { const a = readAgro(x.attributes); const c = AGRO_CATEGORIES.find(k => k.value === a?.category);
      return <ItemCard key={x.id} featured={isFeatured(x)} width={cardW} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
        price={tc(coreText(listingPriceLabel(x), t) ?? "")} icon={c?.icon ?? "🌾"} tag={x.purpose === "wanted" ? t("ls.agro.wanted") : undefined} meta={a ? agroSummary(a).split(" · ").slice(1).map(p => tc(p)).join(" · ") : undefined} />; })}</Grid>}
  </ScrollView>;
}
