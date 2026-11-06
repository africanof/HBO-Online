import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { listProducts, listProductCategories, formatPrice, friendlyErrorIn } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message, SortChips } from "../../components/Ui";
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
  const [sort, setSort] = useState<"recent" | "price_asc" | "price_desc" | "name">("recent");
  const sorted = useMemo(() => !items || sort === "recent" ? items : sort === "name" ? [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), lang)) : byPrice(items, sort === "price_asc" ? "asc" : "desc"), [items, sort, lang]);
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
    {!!items?.length && <SortChips label={t("ls.sort")} value={sort} onChange={setSort} options={[{ value: "recent", label: t("ls.sort_recent") }, { value: "price_asc", label: t("ls.sort_price_asc") }, { value: "price_desc", label: t("ls.sort_price_desc") }, { value: "name", label: t("ls.sort_name") }]} />}
    {items?.length === 0 && <Text style={ui.text}>{t("sh.no_products")}</Text>}
    <Grid>{sorted?.map(p => <ItemCard save={{ kind: "product", id: p.id }} key={p.id} width={cardW} href={"/loja/" + p.id} media={p.media} title={p.name} price={formatPrice(p.price, p.currency)}
      tag={p.stock > 0 ? undefined : t("sh.sold_out")} meta={[p.seller_name, p.municipality_name].filter(Boolean).join(" · ")} />)}</Grid>
  </ScrollView>;
}

/** Ordena por preço (sem preço fica no fim). */
function byPrice(list: any[], dir: "asc" | "desc") {
  const p = (x: any) => (typeof x.price === "number" && x.price > 0 ? x.price : null);
  return [...list].sort((a, b) => { const pa = p(a), pb = p(b); if (pa === null) return 1; if (pb === null) return -1; return dir === "asc" ? pa - pb : pb - pa; });
}
