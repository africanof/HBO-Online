import { Link } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { firstPhoto, isExampleName } from "@huambo-online/core";
import { C, themed } from "../lib/ui";
import { LiteImage } from "./LiteImage";
import { useT } from "../lib/i18n";

export const LISTING_ICON: Record<string, string> = { real_estate: "🏠", vehicle: "🚗", product: "📦", service: "🛠️", classified: "🏷️" };

/** Cartão de artigo ao estilo eBay: fotografia quadrada, título em duas linhas, preço forte. */
export function ItemCard({ href, media, title, price, meta, tag, tagRed, icon = "📦", width, video, featured }: {
  href: string; media?: unknown; title: string; price: string; meta?: string; tag?: string; tagRed?: boolean; icon?: string; width?: number | `${number}%`; video?: boolean; featured?: boolean;
}) {
  const photo = firstPhoto(media); const { t } = useT();
  return <Link href={href as any} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={`${featured ? t("card.featured_a11y") : ""}${title}, ${price}`} style={({ pressed }) => [s.card, width !== undefined && { width }, pressed && { opacity: 0.85 }]}>
      <View style={s.img}>
        {photo ? <LiteImage placeholder={icon} source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={{ fontSize: 44 }}>{icon}</Text>}
        {!!tag && <View style={[s.tag, tagRed && { backgroundColor: C.red }]}><Text style={[s.tagText, tagRed && { color: C.onAccent }]}>{tag}</Text></View>}
        {!!video && <View style={s.video}><Text style={s.videoText}>{t("card.video")}</Text></View>}
        {!!featured && <View style={s.feat}><Text style={s.featText}>{t("card.featured")}</Text></View>}
        {isExampleName(title) && <View style={s.example}><Text style={s.exampleText}>{t("pp.example_badge")}</Text></View>}
      </View>
      <Text style={s.title} numberOfLines={2}>{title}</Text>
      <Text style={s.price}>{price}</Text>
      {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
    </Pressable>
  </Link>;
}

/** Montra horizontal com título e "Ver tudo". */
export function Shelf({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  const { t } = useT();
  return <View style={{ gap: 10 }}>
    <View style={s.head}><Text style={s.headTitle}>{title}</Text>{!!href && <Link href={href as any} style={s.more}>{t("common.see_all")}</Link>}</View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>{children}</ScrollView>
  </View>;
}

/** Grelha de duas colunas para resultados. */
export function Grid({ children }: { children: React.ReactNode }) {
  return <View style={s.grid}>{children}</View>;
}

const s = themed(C => StyleSheet.create({
  example: { position: "absolute", top: 8, right: 8, backgroundColor: "#c62828", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  exampleText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: 1 },
  card: { width: 160, gap: 4 },
  img: { width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: C.surface, overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  tag: { position: "absolute", left: 8, top: 8, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  video: { position: "absolute", right: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  videoText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
  feat: { position: "absolute", left: 8, bottom: 8, backgroundColor: "#FFF4D6", borderColor: "#E0B100", borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  featText: { fontSize: 12, fontWeight: "800", color: "#4A3700" },
  tagText: { fontSize: 12, fontWeight: "800", color: C.ink },
  title: { fontSize: 15, color: C.ink, lineHeight: 20 },
  price: { fontSize: 19, fontWeight: "800", color: C.ink },
  meta: { fontSize: 13, color: C.muted },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  headTitle: { fontSize: 21, fontWeight: "800", color: C.ink, flexShrink: 1 },
  more: { color: C.blue, fontWeight: "800", fontSize: 16, textDecorationLine: "underline", padding: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 18 }
}));
