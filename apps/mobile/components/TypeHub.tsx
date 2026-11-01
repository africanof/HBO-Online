import { useEffect, useState } from "react";
import { useWindowDimensions, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { searchClassifiedListings, filterFieldsFor, attributeFilters, detailFacts, listingPriceLabel, isFeatured, friendlyErrorIn, PURPOSE_LABELS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { ItemCard, Grid } from "./ItemCard";
import { useT, coreText } from "../lib/i18n";

type Kind = "vehicle" | "real_estate";
const CONF: Record<Kind, { icon: string; purposes: ("sale" | "lease" | "rent")[] }> = {
  vehicle: { icon: "🚗", purposes: ["sale", "lease"] },
  real_estate: { icon: "🏠", purposes: ["sale", "rent"] }
};

/** Ecrã próprio de Viaturas ou Imóveis: separadores (venda/aluguer), filtros do tipo e «Publicar» com o tipo escolhido. */
export function TypeHub({ kind }: { kind: Kind }) {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ finalidade?: string }>();
  const { width } = useWindowDimensions(); const cardW = (width - 44) / 2;
  const c = CONF[kind];
  const [purpose, setPurpose] = useState<string>(c.purposes.includes(params.finalidade as any) ? params.finalidade! : "all");
  const [q, setQ] = useState(""); const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(p = purpose, a = attrs, query = q) {
    setError(""); setItems(null);
    const attributes = attributeFilters(kind, null, a);
    const r = await searchClassifiedListings(supabase(), { listingType: kind, purpose: (p === "all" ? undefined : p) as any, query, ...(Object.keys(attributes).length ? { attributes } : {}), limit: 60 });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems((r.data ?? []) as any[]);
  }
  useEffect(() => { void load(); }, []);
  const publish = `/classificados/publicar?tipo=${kind}`;
  const facts = (x: any) => detailFacts(kind, x.attributes).filter(f => f.key !== "brand" && f.key !== "model").slice(0, 2)
    .map(f => f.option ? t(`attr.${f.key}.${f.value}`) : f.unit ? `${Number(f.value).toLocaleString("pt-PT")} ${t("attr.unit." + f.unit)}` : f.value).join(" · ");
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← {t("nav.home")}</Link>
    <Text style={ui.h1}>{c.icon} {t(`hub.${kind}.title`)}</Text>
    <Text style={ui.text}>{t(`hub.${kind}.intro`)}</Text>
    {kind === "real_estate" && <Text style={ui.label}>{t("ls.rent_free_badge")}</Text>}
    <Button title={"+ " + t(`hub.${kind}.publish`)} onPress={() => router.push(publish as any)} />
    <View style={[ui.row, { flexWrap: "nowrap" }]}>
      <TextInput style={[ui.input, { flex: 1 }]} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} placeholder={t(`hub.${kind}.search_ph`)} placeholderTextColor={C.muted} returnKeyType="search" />
      <Button title={t("ls.search")} onPress={() => void load()} />
    </View>
    <Chips options={[{ value: "all", label: t("job.all") }, ...c.purposes.map(p => ({ value: p, label: tc(PURPOSE_LABELS[p]) }))]} value={purpose} onChange={v => { setPurpose(v); void load(v); }} />
    {filterFieldsFor(kind).map(fd => <View key={fd.key} style={{ gap: 6 }}>
      <Text style={ui.label}>{t("attr." + fd.key)}</Text>
      <Chips options={[{ value: "", label: t("ls.all_m") }, ...fd.options!.map(o => ({ value: o, label: t(`attr.${fd.key}.${o}`) }))]} value={attrs[fd.key] ?? ""}
        onChange={v => { const a = { ...attrs, [fd.key]: v }; setAttrs(a); void load(purpose, a); }} />
    </View>)}
    <Message error={error} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{t(`hub.${kind}.none`)}</Text>}
    {!!items?.length && <Grid>{items.map(x => <ItemCard key={x.id} featured={isFeatured(x)} width={cardW} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media}
      title={x.title} price={tc(coreText(listingPriceLabel(x), t) ?? "")} icon={c.icon} meta={facts(x) || undefined} />)}</Grid>}
  </ScrollView>;
}
