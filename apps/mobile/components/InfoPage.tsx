import { useState } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { InfoPage, FaqItem } from "@huambo-online/core";
import { HELP_FAQ } from "@huambo-online/core";
import { C, ui } from "../lib/ui";
import { useT } from "../lib/i18n";
import { INFO_PAGES_I18N, HELP_FAQ_I18N } from "../lib/i18n/services";

/** E-mail público de contacto (opcional): EXPO_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_EMAIL = (process.env.EXPO_PUBLIC_CONTACT_EMAIL ?? "").trim();

const Links = () => {
  const { t } = useT();
  return <View style={[ui.row, { marginTop: 8, flexWrap: "wrap" }]}>
    {[["/ajuda", "sv.link_help"], ["/seguranca", "sv.link_safety"], ["/termos", "sv.link_terms"], ["/privacidade", "sv.link_privacy"], ["/devolucoes", "sv.link_returns"], ["/apagar-conta", "sv.link_delete"]].map(([h, l]) => <Link key={h} href={h as any} style={ui.link}>{t(l)}</Link>)}
  </View>;
};

/** Linha de contacto na língua escolhida (igual a contactLine do core). */
export function useContactLine(email = CONTACT_EMAIL): string {
  const { t } = useT();
  const e = (email ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? t("sv.contact_email", { email: e }) : t("sv.contact_none");
}

/** Perguntas frequentes da Ajuda na língua escolhida. */
export function useHelpFaq(items: FaqItem[] = HELP_FAQ): FaqItem[] {
  const { lang, tc } = useT();
  if (lang === "pt") return items;
  const tr = HELP_FAQ_I18N[lang];
  return items.map(f => { const i = HELP_FAQ.indexOf(f); return i >= 0 && tr[i] ? tr[i] : { q: tc(f.q), a: tc(f.a) }; });
}

/** Página de informação (Termos, Privacidade, Apagar conta) — texto vindo do código partilhado. */
export function InfoPageView({ page: base }: { page: InfoPage }) {
  const { t, tc, lang } = useT(); const contact = useContactLine();
  const [y, m, d] = base.updated.split("-");
  const tr = lang === "pt" ? undefined : INFO_PAGES_I18N[base.slug]?.[lang];
  const page = tr
    ? { title: tr.title, intro: tr.intro, sections: tr.sections.map(s => ({ title: s.title, paragraphs: s.paragraphs.map(p => p === "{contact}" ? contact : p) })) }
    : { title: tc(base.title), intro: tc(base.intro), sections: base.sections.map(s => ({ title: tc(s.title), paragraphs: s.paragraphs.map(p => tc(p)) })) };
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/" style={ui.link}>{t("sv.home_back")}</Link>
    <Text style={ui.h1}>{page.title}</Text>
    <Text style={ui.text}>{page.intro}</Text>
    <Text style={ui.muted}>{t("sv.info_updated", { date: `${d}/${m}/${y}` })}</Text>
    {page.sections.map((s, si) => <View key={si} style={{ gap: 6 }}>
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
