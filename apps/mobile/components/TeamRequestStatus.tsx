import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { listMyTeamRequestStates, teamRequestTarget, formatPrice, type MyTeamRequestState } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { ui } from "../lib/ui";
import { RequestWhatsApp } from "./Engage";

/** Pedidos do cliente e a equipa do Huambo Online: à espera, aprovados ou recusados. */
export function TeamRequestStatus() {
  const { lang, t } = useT();
  const [items, setItems] = useState<MyTeamRequestState[]>([]);
  useEffect(() => { void listMyTeamRequestStates(supabase()).then(r => setItems(r.data)); }, []);
  if (!items.length) return null;
  return <View style={ui.card} accessibilityLabel={t("trs.title")}>
    <Text style={ui.h2}>🛡️ {t("trs.title")}</Text>
    <Text style={ui.text}>{t("trs.intro")}</Text>
    {items.map(r => <View key={r.kind + r.id} style={{ gap: 2 }}>
      <Text style={ui.label}>{t("ad.req.kind." + r.kind)}{teamRequestTarget(r.title) ? " · " + teamRequestTarget(r.title) : ""}{r.ref_no ? ` · #${r.ref_no}` : ""}{r.amount != null ? " · " + formatPrice(r.amount) : ""}</Text>
      <Text style={ui.muted}>{formatDateTimeIn(r.created_at, lang)} · {r.state === "pending" ? "⏳ " + t("trs.pending") : r.state === "approved" ? "✅ " + t("trs.approved") : "❌ " + t("trs.declined")}</Text>
      {r.state === "declined" && !!r.team_note && <Text style={ui.muted}>{t("trs.reason")}: {r.team_note}</Text>}
      <RequestWhatsApp what={t("ad.req.kind." + r.kind) + (teamRequestTarget(r.title) ? " · " + teamRequestTarget(r.title) : "")} refNo={r.ref_no} path={r.link} />
    </View>)}
  </View>;
}
