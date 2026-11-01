import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { clearMyInterests, friendlyErrorIn } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { ui } from "../lib/ui";
import { Button, Message } from "./Ui";

/** «A sua conta»: explica as recomendações e deixa apagar o histórico. */
export function RecommendationPrivacy() {
  const { lang, t } = useT();
  const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function clear() {
    setBusy(true); setMsg(""); setErr("");
    const u = await supabase().auth.getUser(); if (!u.data.user) { setBusy(false); return; }
    const r = await clearMyInterests(supabase(), u.data.user.id); setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setMsg(t("rec.cleared"));
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>✨ {t("rec.title")}</Text>
    <Text style={ui.text}>{t("rec.text")}</Text>
    <Message error={err} ok={msg} />
    <Button title={t("rec.clear")} variant="secondary" disabled={busy}
      onPress={() => Alert.alert(t("rec.clear"), t("rec.clear_q"), [{ text: t("common.cancel"), style: "cancel" }, { text: t("rec.clear"), style: "destructive", onPress: () => void clear() }])} />
  </View>;
}
