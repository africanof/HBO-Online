import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { listProducts, listProductCategories, formatPrice, friendlyErrorIn } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { useTerritory } from "../../components/Directory";
import { SearchBar } from "../../components/Brand";
import { ItemCard, Grid } from "../../components/ItemCard";
import { useT } from "../../lib/i18n";

type Option = { id: string; name: string };

export default function Loja() {
  const router = useRouter(); const { t, lang } = useT();
  const params = useLocalSearchParams<{ q?: string }>();
  const { width } = useWindowDimensions(); const cardW = (width - 32 - 14) / 2;
  const [q, setQ] = useState(params.q ?? ""); const [categoryId, setCategoryId] = useState(""); const [municipalityId, setMunicipalityId] = useState(""); const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Option[]>([]); const { municipalities } = useTerritory();
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  useEffect(() => { void listProductCategories(supabase()).then(({ data }) => setCategories(data ?? [])); void search(); }, []);
  async function search(o: { q?: string; categoryId?: string } = {}) {
    setError("");
    const r = await listProducts(supabase(), { query: o.q ?? q, categoryId: o.categoryId ?? categoryId, municipalityId });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data as any[]) ?? []);
  }
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <SearchBar scope="loja" initial={q} onSearch={v => { setQ(v); void search({ q: v }); }} />
    <Text style={ui.h1}>{q ? t("sh.shop_q", { q }) : t("nav.shop")}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      <Button title={t("sh.cart_btn")} onPress={() => router.push("/carrinho" as any)} />
      <Button title={t("sh.orders_btn")} variant="secondary" onPress={() => router.push("/encomendas" as any)} />
      <Button title={t("sh.sell_products")} variant="secondary" onPress={() => router.push("/conta/produtos" as any)} />
    </ScrollView>
    {categories.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Chips options={[{ value: "", label: t("sh.all") }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={v => { setCategoryId(v); void search({ categoryId: v }); }} />
    </ScrollView>}
    <Button title={showFilters ? t("sh.hide_filters") : t("sh.municipality_btn")} variant="secondary" onPress={() => setShowFilters(!showFilters)} />
    {showFilters && <View style={{ gap: 10 }}>
      <Chips options={[{ value: "", label: t("sh.all_m") }, ...municipalities.map(m => ({ value: m.id, label: m.name }))]} value={municipalityId} onChange={setMunicipalityId} />
      <Button title={t("sh.apply")} onPress={() => void search()} />
    </View>}
    <Message error={error} />
    {items !== null && <Text style={ui.label}>{t("sh.n_products", { n: items.length })}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{t("sh.no_products")}</Text>}
    <Grid>{items?.map(p => <ItemCard key={p.id} width={cardW} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)}
      tag={p.stock > 0 ? undefined : t("sh.sold_out")} meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}</Grid>
  </ScrollView>;
}
