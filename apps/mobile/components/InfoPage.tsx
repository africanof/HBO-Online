import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { InfoPage, FaqItem } from "@huambo-online/core";
import { C, ui } from "../lib/ui";

/** E-mail público de contacto (opcional): EXPO_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_EMAIL = (process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? "").trim();

const Links = () => <View style={[ui.row, { marginTop: 8 }]}>
  {[["/ajuda", "Ajuda"], ["/termos", "Termos"], ["/privacidade", "Privacidade"], ["/apagar-conta", "Apagar conta"]].map(([h, l]) => <Link key={h} href={h as any} style={ui.link}>{l}</Link>)}
</View>;

/** Página de informação (Termos, Privacidade, Apagar conta) — texto vindo do código partilhado. */
export function InfoPageView({ page }: { page: InfoPage }) {
  const [y, m, d] = page.updated.split("-");
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>← Início</Link>
    <Text style={ui.h1}>{page.title}</Text>
    <Text style={ui.text}>{page.intro}</Text>
    <Text style={ui.muted}>Última atualização: {d}/{m}/{y}</Text>
    {page.sections.map(s => <View key={s.title} style={{ gap: 6 }}>
      <Text style={ui.h2}>{s.title}</Text>
      {s.paragraphs.map((p, i) => <Text key={i} style={ui.text}>{p}</Text>)}
    </View>)}
    <Links />
  </ScrollView>;
}

/** Perguntas frequentes que abrem e fecham com um toque. */
export function FaqList({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return <View style={{ gap: 8 }}>{items.map(f => <Pressable key={f.q} accessibilityRole="button" accessibilityState={{ expanded: open === f.q }} onPress={() => setOpen(open === f.q ? null : f.q)} style={ui.card}>
    <Text style={ui.label}>{open === f.q ? "▾ " : "▸ "}{f.q}</Text>
    {open === f.q && <Text style={[ui.text, { color: C.ink }]}>{f.a}</Text>}
  </Pressable>)}</View>;
}
export { Links as InfoLinks };
