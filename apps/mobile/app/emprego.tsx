import { useEffect, useState } from "react";
import { useWindowDimensions, ScrollView, Text, TextInput, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { listJobCategories, listJobListings, salaryLabel, isFeatured, friendlyErrorIn, categoryLabelIn, isJobCategorySlug,
  type JobCategory, type JobCategorySlug } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { ItemCard, Grid } from "../components/ItemCard";
import { useT } from "../lib/i18n";

/** Emprego e estágios: vagas das três categorias de emprego, com o CV enviado pelas Mensagens. */
export default function Emprego() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ tipo?: string }>();
  const { width } = useWindowDimensions(); const cardW = (width - 44) / 2;
  const [cats, setCats] = useState<JobCategory[]>([]);
  const [slug, setSlug] = useState<JobCategorySlug | "all">(isJobCategorySlug(params.tipo) ? params.tipo : "all"); const [q, setQ] = useState("");
  const [items, setItems] = useState<any[] | null>(null); const [error, setError] = useState("");
  async function load(list = cats, s = slug, query = q) {
    setError("");
    const r = await listJobListings(supabase(), list, { slug: s === "all" ? "" : s, query });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data);
  }
  useEffect(() => { void listJobCategories(supabase()).then(r => { setCats(r.data); void load(r.data); }); }, []);
  const publish = "/classificados/publicar?categoria=" + (slug === "all" ? "emprego" : slug);
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← {t("nav.home")}</Link>
    <Text style={ui.h1}>💼 {t("job.title")}</Text>
    <Text style={ui.text}>{t("job.intro")}</Text>
    <Button title={"+ " + t("job.publish")} onPress={() => router.push(publish as any)} />
    <View style={[ui.row, { flexWrap: "nowrap" }]}>
      <TextInput style={[ui.input, { flex: 1 }]} value={q} onChangeText={setQ} onSubmitEditing={() => void load()} placeholder={t("job.search_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("job.search")} returnKeyType="search" />
      <Button title={t("ls.search")} onPress={() => void load()} />
    </View>
    <Chips options={[{ value: "all" as const, label: t("job.all") }, ...cats.map(c => ({ value: c.slug, label: categoryLabelIn(c.name, lang) }))]} value={slug} onChange={v => { setSlug(v); void load(cats, v); }} />
    <Text style={ui.muted}>📄 {t("job.cv_hint")}</Text>
    <Message error={error} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{q ? t("job.none_q", { q }) : t("job.none")}</Text>}
    {!!items?.length && <Grid>{items.map(x => { const c = cats.find(k => k.id === x.category_id);
      return <ItemCard key={x.id} featured={isFeatured(x)} width={cardW} video={!!x.video_url} href={"/classificados/" + x.id} media={x.media} title={x.title}
        price={tc(salaryLabel(x.price, c?.slug, x.currency))} icon="💼" tag={c ? categoryLabelIn(c.name, lang) : undefined} />; })}</Grid>}
  </ScrollView>;
}
