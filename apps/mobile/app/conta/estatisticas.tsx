import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { getMyStats, statsTotals, contactsBreakdown, sortStats, barHeights, statsTips, contactsOf, contactRateText, statsItemHref, periodLabel, shortDay, friendlyError,
  STATS_PERIODS, STATS_KIND_LABELS, type ItemStats, type DayStats } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { C, ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";

export default function Estatisticas() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [days, setDays] = useState<string>("30");
  const [items, setItems] = useState<ItemStats[]>([]); const [daily, setDaily] = useState<DayStats[]>([]); const [followers, setFollowers] = useState(0);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    void getMyStats(supabase(), Number(days)).then(r => {
      setLoading(false); setError(r.error ? friendlyError(r.error) : "");
      setItems(r.items); setDaily(r.daily); setFollowers(r.followers);
    });
  }, [uid, days]);
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>Estatísticas</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  const t = statsTotals(items), heights = barHeights(daily), rate = contactRateText(t.views, t.contacts);
  const followersAll = followers + items.reduce((n, s) => n + s.followers, 0);
  const box = { flexGrow: 1, flexBasis: "45%" as const, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, backgroundColor: C.surface };
  return <ScrollView contentContainerStyle={ui.screen}>
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>📊 Estatísticas</Text>
    <Text style={ui.text}>Quantas pessoas viram, guardaram e contactaram os seus anúncios, produtos, empresas e perfil profissional. Só contamos números: nunca mostramos quem viu.</Text>
    <Chips options={STATS_PERIODS.map(d => ({ value: String(d), label: periodLabel(d) }))} value={days} onChange={setDays} />
    <Message error={error} />
    {loading ? <Text style={ui.text}>A carregar…</Text> : <>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[[t.views, "👁 Vistas"], [t.saves, "♥ Guardados (total)"], [t.contacts, "💬 Contactos"], [followersAll, "👥 Seguidores"]].map(([n, l]) =>
          <View key={String(l)} style={box}><Text style={ui.price}>{n}</Text><Text style={ui.muted}>{l}</Text></View>)}
      </View>
      <Text style={ui.muted}>Contactos e partilhas: {contactsBreakdown(t)}</Text>
      {!!rate && <Text style={ui.ok}>{rate}</Text>}
      {daily.length > 0 && <View style={ui.card} accessible accessibilityLabel={`Gráfico das vistas por dia: no total ${t.views} vistas e ${t.contacts} contactos.`}>
        <Text style={ui.h2}>Vistas por dia</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 2, borderBottomWidth: 2, borderColor: C.line }}>
          {daily.map((d, i) => <View key={d.day} style={{ flex: 1, height: `${Math.max(heights[i], d.views ? 4 : 1)}%`, backgroundColor: C.blue, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />)}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={ui.muted}>{shortDay(daily[0].day)}</Text><Text style={ui.muted}>Hoje</Text></View>
      </View>}
      {statsTips(items, Number(days)).map(tip => <View key={tip} style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>💡 {tip}</Text></View>)}
      <Text style={ui.h2}>Por anúncio, produto e perfil</Text>
      {items.length === 0 && <Text style={ui.text}>Ainda não tem anúncios, produtos, empresas nem perfil profissional.</Text>}
      {sortStats(items).map(s => <View key={s.kind + s.item_id} style={ui.card}>
        <Link href={statsItemHref(s.kind, s.item_id) as any} style={ui.link}>{s.title}</Link>
        <Text style={ui.muted}>{STATS_KIND_LABELS[s.kind]}</Text>
        <Text style={ui.text}>👁 {s.views} vistas · ♥ {s.saves} · 💬 {contactsOf(s)} contactos{s.whatsapp ? ` · 📲 ${s.whatsapp} WhatsApp` : ""}{s.calls ? ` · 📞 ${s.calls}` : ""}{s.followers ? ` · 👥 ${s.followers}` : ""}</Text>
        <Text style={ui.muted}>Desde sempre: {s.views_total} vistas</Text>
      </View>)}
    </>}
  </ScrollView>;
}
