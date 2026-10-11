import { usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../lib/ui";

const TABS: { label: string; icon: string; href: string; match: (p: string) => boolean }[] = [
  { label: "Início", icon: "🏠", href: "/", match: p => p === "/" },
  { label: "Pesquisar", icon: "🔍", href: "/explorar", match: p => p.startsWith("/explorar") || p.startsWith("/loja") },
  { label: "Vender", icon: "➕", href: "/classificados/publicar", match: p => p.startsWith("/classificados/publicar") },
  { label: "Mensagens", icon: "💬", href: "/mensagens", match: p => p.startsWith("/mensagens") },
  { label: "Conta", icon: "👤", href: "/conta", match: p => p.startsWith("/conta") || p === "/login" }
];

/** Barra de baixo, como na APP do eBay: Início, Pesquisar, Vender, Mensagens, Conta. */
export function BottomNav() {
  const path = usePathname(); const router = useRouter(); const insets = useSafeAreaInsets();
  return <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
    {TABS.map(t => {
      const on = t.match(path);
      return <Pressable key={t.href} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
        onPress={() => { if (!on) router.navigate(t.href as any); }} style={s.tab}>
        <Text style={[s.icon, !on && { opacity: 0.6 }]}>{t.icon}</Text>
        <Text style={[s.label, on && s.labelOn]}>{t.label}</Text>
      </Pressable>;
    })}
  </View>;
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white, paddingTop: 6 },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 52, justifyContent: "center" },
  icon: { fontSize: 22 },
  label: { fontSize: 12, color: C.muted, fontWeight: "600" },
  labelOn: { color: C.blue, fontWeight: "800" }
});
