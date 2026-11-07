import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { listMapPoints, mapHtml, MAP_CENTER, MAP_KINDS, type MapKind, type MapPoint } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Chips, Message, SmallButton } from "../components/Ui";
import { devicePosition } from "../components/Place";
import { useT } from "../lib/i18n";

/** Mapa do Huambo (OpenStreetMap): anúncios, empresas, profissionais, combustível e eventos. */
export default function Mapa() {
  const router = useRouter(); const { t, tc } = useT();
  const [kind, setKind] = useState<MapKind | "">(""); const [points, setPoints] = useState<MapPoint[] | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null); const [error, setError] = useState("");
  useEffect(() => { setPoints(null); void listMapPoints(supabase(), kind).then(r => setPoints(r.data)); }, [kind]);
  async function where() { setError(""); const r = await devicePosition(); if (r.point) setMe(r.point); else setError(tc(r.error)); }
  const html = useMemo(() => mapHtml(points ?? [], me ? { ...me, zoom: 15 } : MAP_CENTER, me), [points, me]);
  return <View style={{ flex: 1, backgroundColor: C.white }}>
    <View style={{ paddingTop: 54, paddingHorizontal: 16, gap: 10, paddingBottom: 10 }}>
      <Text style={ui.h1}>🗺️ {t("map.title")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chips options={[{ value: "", label: t("map.all") }, ...MAP_KINDS.map(k => ({ value: k.value, label: k.icon + " " + t("map." + k.value) }))]} value={kind} onChange={v => setKind(v as MapKind | "")} />
      </ScrollView>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={ui.muted}>{points ? t("map.count", { n: points.length }) : t("common.loading")}</Text>
        <SmallButton title={t("map.me")} onPress={() => void where()} />
      </View>
      <Message error={error} />
      {points?.length === 0 && <Text style={ui.muted}>{t("map.empty")}</Text>}
    </View>
    <WebView style={{ flex: 1, marginBottom: 70 }} originWhitelist={["*"]} source={{ html }} javaScriptEnabled setSupportMultipleWindows={false}
      onMessage={e => { const h = e.nativeEvent.data; if (/^\/[a-z]+\/[0-9a-f-]{36}$/.test(h)) router.push(h as any); }}
      onShouldStartLoadWithRequest={r => r.url === "about:blank" || r.url.startsWith("data:") || r.url.includes("openstreetmap") || r.url.includes("unpkg.com")} />
    <Text style={[ui.muted, { position: "absolute", bottom: 74, left: 12, right: 12, fontSize: 11, backgroundColor: "rgba(255,255,255,0.85)", padding: 4, borderRadius: 6 }]}>{t("map.approx")}</Text>
  </View>;
}
