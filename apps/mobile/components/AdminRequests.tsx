import { useEffect, useState } from "react";
import { Alert, Linking, Switch, Text, TextInput, View } from "react-native";
import { listTeamRequests, forwardTeamRequest, declineTeamRequest, teamRequestState, formatPrice, friendlyErrorIn, mapsUrl, type TeamRequest } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { ui, C } from "../lib/ui";
import { Button, Message } from "./Ui";

/**
 * Pedidos mediados: encomendas, reservas, bilhetes, pedidos de serviço, propostas e alugueres
 * chegam primeiro à equipa, que os reencaminha a quem os trata ou os recusa com um motivo.
 */
export function AdminRequests() {
  const { lang, t } = useT();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [list, setList] = useState<TeamRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({}); const [share, setShare] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const r = await listTeamRequests(supabase(), pendingOnly);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data);
  }
  useEffect(() => { void load(); }, [pendingOnly]);
  async function run(fn: () => PromiseLike<{ error: any }>, message: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(message); await load();
  }

  return <View style={{ gap: 12 }}>
    <Text style={ui.text}>{t("ad.req.intro")}</Text>
    <View style={[ui.row, { alignItems: "center" }]}>
      <Switch value={pendingOnly} onValueChange={setPendingOnly} accessibilityLabel={t("ad.req.pending_only")} />
      <Text style={[ui.text, { flex: 1 }]}>{t("ad.req.pending_only")}</Text>
    </View>
    <Message error={err} ok={ok} />
    {!list.length && <Text style={ui.muted}>{t("ad.req.none")}</Text>}
    {list.map(r => {
      const key = r.kind + ":" + r.id; const state = teamRequestState(r);
      const hasContact = !!(r.phone || r.delivery_text || r.delivery_lat != null);
      return <View key={key} style={[ui.card, state === "pending" ? { borderLeftWidth: 4, borderLeftColor: "#E5A800" } : null]}>
        <Text style={ui.muted}>{t("ad.req.kind." + r.kind)}{r.ref_no ? ` · #${r.ref_no}` : ""} · {formatDateTimeIn(r.created_at, lang)} · {t("ad.req.state." + state)}</Text>
        <Text style={ui.h2}>{r.title}</Text>
        {r.amount != null && <Text style={ui.text}>{formatPrice(r.amount)}</Text>}
        {!!r.details && <Text style={ui.text}>{r.details}</Text>}
        <Text style={ui.text}>👤 {t("ad.req.from")}: {r.requester_name} → {t("ad.req.to")}: {r.counterpart_name}</Text>
        {hasContact && <Text style={ui.text}>🔒 {t("ad.req.private")}:{r.phone ? " 📞 " + r.phone : ""}{r.delivery_text ? " · 📍 " + r.delivery_text : ""}</Text>}
        {r.delivery_lat != null && r.delivery_lng != null && <Button title={t("ad.req.map")} variant="secondary" onPress={() => void Linking.openURL(mapsUrl({ lat: r.delivery_lat!, lng: r.delivery_lng! }))} />}
        {!!r.team_note && <Text style={ui.muted}>🛡️ {r.team_note}</Text>}
        {state === "pending" && <View style={{ gap: 6 }}>
          <TextInput style={ui.input} multiline value={notes[key] ?? ""} onChangeText={v => setNotes(n => ({ ...n, [key]: v }))}
            placeholder={t("ad.req.note")} placeholderTextColor={C.muted} accessibilityLabel={t("ad.req.note")} />
          {hasContact && <View style={[ui.row, { alignItems: "center" }]}>
            <Switch value={!!share[key]} onValueChange={v => setShare(s => ({ ...s, [key]: v }))} accessibilityLabel={t("ad.req.share")} />
            <Text style={[ui.text, { flex: 1 }]}>{t("ad.req.share")}</Text>
          </View>}
          <Button title={"➡️ " + t("ad.req.forward", { name: r.counterpart_name })} disabled={busy}
            onPress={() => void run(() => forwardTeamRequest(supabase(), r.kind, r.id, notes[key] ?? "", !!share[key]), t("ad.req.ok_forwarded"))} />
          <Button title={t("ad.req.decline")} variant="danger" disabled={busy} onPress={() => {
            const reason = (notes[key] ?? "").trim();
            if (!reason) { setErr(t("ad.req.reason_needed")); return; }
            Alert.alert(t("ad.req.decline"), t("ad.req.confirm_decline"), [{ text: t("common.cancel"), style: "cancel" },
              { text: t("ad.req.decline"), style: "destructive", onPress: () => void run(() => declineTeamRequest(supabase(), r.kind, r.id, reason), t("ad.req.ok_declined")) }]);
          }} />
        </View>}
      </View>;
    })}
  </View>;
}
