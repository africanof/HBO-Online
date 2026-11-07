import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { adminAppHealth, friendlyErrorIn, type AppHealth } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Chips, Message } from "./Ui";
import { useT, formatDateTimeIn } from "../lib/i18n";

/** Equipa: erros da APP (agrupados) e ecrãs mais usados. */
export function AdminAppHealth() {
  const { t, lang } = useT();
  const [days, setDays] = useState<"1" | "7" | "30">("7"); const [h, setH] = useState<AppHealth | null>(null); const [error, setError] = useState("");
  useEffect(() => { setH(null); void adminAppHealth(supabase(), Number(days)).then(r => { if (r.error) setError(friendlyErrorIn(r.error, lang)); else setH(r.data); }); }, [days]);
  const maxViews = Math.max(1, ...(h?.days ?? []).map(d => d.views));
  return <View style={{ gap: 12 }}>
    <Chips options={(["1", "7", "30"] as const).map(v => ({ value: v, label: t("health.days", { n: v }) }))} value={days} onChange={setDays} />
    <Message error={error} />
    {!h && !error && <Text style={ui.muted}>{t("common.loading")}</Text>}
    {!!h && <>
      <Text style={ui.h2}>{t("health.per_day")}</Text>
      <View style={[ui.card, { gap: 6 }]}>{h.days.map(d => <View key={d.day} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[ui.muted, { width: 48 }]}>{d.day.slice(5).split("-").reverse().join("/")}</Text>
        <View style={{ flex: 1, height: 12, backgroundColor: C.surface, borderRadius: 6, overflow: "hidden" }}><View style={{ width: `${Math.round(d.views / maxViews * 100)}%`, height: 12, backgroundColor: C.blue }} /></View>
        <Text style={[ui.muted, { width: 90, textAlign: "right" }]}>{d.views} · {d.errors > 0 ? "⚠️ " + d.errors : "✓"}</Text>
      </View>)}</View>
      <Text style={ui.h2}>{t("health.errors")}</Text>
      {!h.errors.length && <Text style={ui.text}>{t("health.no_errors")}</Text>}
      {h.errors.map(e => <View key={e.fingerprint} style={[ui.card, e.fatal && { borderColor: "#c62828", borderWidth: 2 }]}>
        <Text style={ui.label} selectable>{e.message}</Text>
        <Text style={ui.muted}>{t("health.times", { n: e.total, u: e.users })}{e.fatal ? " · " + t("health.fatal") : ""} · {e.screen ?? "?"} · v{e.app_version ?? "?"}</Text>
        <Text style={ui.muted}>{formatDateTimeIn(e.last_at, lang)}</Text>
        {!!e.stack && <Text style={[ui.muted, { fontSize: 11, fontFamily: "monospace" }]} numberOfLines={6} selectable>{e.stack}</Text>}
      </View>)}
      <Text style={ui.h2}>{t("health.screens")}</Text>
      <View style={[ui.card, { gap: 4 }]}>{h.screens.map(s => <View key={s.screen} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={[ui.text, { flex: 1 }]} numberOfLines={1}>{s.screen}</Text><Text style={ui.label}>{s.views}</Text>
      </View>)}</View>
    </>}
  </View>;
}
