import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { logoParts, searchHref, type SearchScope } from "@huambo-online/core";
import { C, themed, getThemeMode } from "../lib/ui";
import { useT } from "../lib/i18n";

export function Logo({ size = 30 }: { size?: number }) {
  return <Text accessibilityRole="header" accessibilityLabel="Huambo Online" style={{ fontSize: size, fontWeight: "800", letterSpacing: -1 }}>
    {logoParts(getThemeMode()).map(([t, color], i) => <Text key={t} style={{ color }}>{i === 1 ? " " : ""}{t}</Text>)}
  </Text>;
}

/** Barra de pesquisa grande em pílula (como a do eBay). */
export function SearchBar({ scope = "classificados", initial = "", onSearch }: { scope?: SearchScope; initial?: string; onSearch?: (q: string) => void }) {
  const router = useRouter(); const [q, setQ] = useState(initial); const { t } = useT();
  const go = () => onSearch ? onSearch(q) : router.push(searchHref(scope, q) as any);
  return <View style={s.bar}>
    <Text style={{ fontSize: 18 }}>🔍</Text>
    <TextInput value={q} onChangeText={setQ} placeholder={t("common.search_placeholder")} placeholderTextColor={C.muted} style={s.input}
      returnKeyType="search" onSubmitEditing={go} accessibilityLabel={t("nav.search")} />
    <Pressable onPress={() => router.push("/pesquisar-foto" as any)} accessibilityRole="button" accessibilityLabel={t("search.photo")} style={{ padding: 6 }}><Text style={{ fontSize: 22 }}>📷</Text></Pressable>
    <Pressable onPress={go} accessibilityRole="button" accessibilityLabel={t("nav.search")} style={s.go}><Text style={s.goText} numberOfLines={1}>{t("nav.search")}</Text></Pressable>
  </View>;
}

const s = themed(C => StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 2, borderColor: C.ink, borderRadius: 999, paddingLeft: 14, paddingRight: 4, minHeight: 52, backgroundColor: C.white },
  input: { flex: 1, minWidth: 0, fontSize: 17, color: C.ink, paddingVertical: 10 },
  go: { backgroundColor: C.blue, borderRadius: 999, paddingHorizontal: 14, flexShrink: 0, minHeight: 42, justifyContent: "center" },
  goText: { color: C.onAccent, fontWeight: "800", fontSize: 15 }
}));
