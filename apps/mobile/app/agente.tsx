import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Linking, ScrollView, Text, TextInput, View } from "react-native";
import { getMyAgentPanel, applyAsAgent, listMarketOptions, agentOfferText, agentInviteMessage, agentTotals, agentCommissionLine, whatsappShareUrl, formatPrice, friendlyErrorIn,
  AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, LANG_TAGS, type AgentPanel } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { useT } from "../lib/i18n";

export default function Agente() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<AgentPanel | null>(null); const [markets, setMarkets] = useState<{ id: string; name: string }[]>([]);
  const [marketId, setMarketId] = useState(""); const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const r = await getMyAgentPanel(supabase());
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setP(r.data);
    const a = r.data?.agent;
    if (a) { setMarketId(a.market_id ?? ""); setFullName(a.full_name); setPhone(a.phone); setNote(a.note ?? ""); }
  }
  useFocusEffect(useCallback(() => {
    void currentUserId().then(id => { setUid(id); if (id) void load(); });
    void listMarketOptions(supabase()).then(r => setMarkets((r.data ?? []) as { id: string; name: string }[]));
  }, []));
  async function apply() {
    setBusy(true); setError(""); setNotice("");
    const r = await applyAsAgent(supabase(), { marketId, fullName, phone, note });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setEditing(false); setNotice(p?.agent?.status === "active" ? t("sv.saved") : t("sv.ag_sent"));
    await load();
  }
  const intro = <>
    <Text style={ui.h1}>{t("sv.ag_title")}</Text>
    <Text style={ui.text}>{t("sv.ag_intro")}</Text>
    {!!p && <Text style={ui.ok}>{tc(agentOfferText(p.sale_pct))}</Text>}
    <Text style={ui.text}>{t("sv.ag_step1")}</Text>
    <Text style={ui.text}>{t("sv.ag_step2")}</Text>
    <Text style={ui.text}>{t("sv.ag_step3")}</Text>
    <Text style={ui.text}>{t("sv.ag_step4")}</Text>
    <Text style={ui.text}>{t("sv.ag_step5")}</Text>
  </>;
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}>{intro}<Button title={t("sv.ag_login")} onPress={() => router.push("/login")} /></ScrollView>;
  const a = p?.agent, tt = agentTotals(p);
  const form = <View style={ui.card}>
    <Text style={ui.h2}>{a ? t("sv.ag_my_data") : t("sv.ag_apply")}</Text>
    <Text style={ui.label}>{t("sv.ag_market")}</Text>
    {markets.length ? <Chips options={markets.map(m => ({ value: m.id, label: m.name }))} value={marketId} onChange={setMarketId} /> : <Text style={ui.muted}>{t("sv.ag_loading_markets")}</Text>}
    <Text style={ui.label}>{t("sv.full_name")}</Text>
    <TextInput accessibilityLabel={t("sv.full_name")} value={fullName} onChangeText={setFullName} maxLength={120} autoComplete="name" style={ui.input} />
    <Text style={ui.label}>{t("sv.phone")}</Text>
    <TextInput accessibilityLabel={t("sv.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} placeholder="923 000 000" style={ui.input} />
    <Text style={ui.label}>{t("sv.ag_note")}</Text>
    <TextInput accessibilityLabel={t("sv.note")} value={note} onChangeText={setNote} maxLength={500} multiline placeholder={t("sv.ag_note_ph")} style={[ui.input, ui.area]} />
    <Button title={busy ? t("sv.sending") : a ? t("common.save") : t("sv.send_request")} disabled={busy} onPress={() => void apply()} />
    {!!a && <Button title={t("common.cancel")} variant="secondary" onPress={() => setEditing(false)} />}
  </View>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back")}</Link>
    {intro}
    <Message error={error} ok={notice} />
    {!a && form}
    {!!a && <>
      <View style={ui.card}>
        <Text style={ui.label}>{tc(AGENT_STATUS_LABELS[a.status])}</Text>
        <Text style={ui.text}>{a.full_name} · 📍 {a.market_name ?? "—"} · 📞 {a.phone}</Text>
        {a.status === "pending" && <Text style={ui.text}>{t("sv.ag_pending")}</Text>}
        {(a.status === "rejected" || a.status === "suspended") && !!a.admin_note && <Text style={ui.error}>{t("sv.reason", { note: a.admin_note })}</Text>}
        {a.status !== "suspended" && !editing && <Button title={a.status === "rejected" ? t("sv.ag_again") : t("sv.ag_change")} variant="secondary" onPress={() => setEditing(true)} />}
      </View>
      {editing && form}
      {a.status === "active" && <>
        <View style={[ui.card, { alignItems: "center" }]}>
          <Text style={ui.text}>{t("sv.ag_your_code")}</Text>
          <Text style={{ ...ui.h1, fontSize: 40, letterSpacing: 2 }}>{a.code}</Text>
          <Text style={[ui.text, { textAlign: "center" }]}>{t("sv.ag_code_hint")}</Text>
        </View>
        <Button title={t("sv.ag_invite")} onPress={() => void Linking.openURL(whatsappShareUrl(tc(agentInviteMessage(a.code, a.full_name.split(" ")[0], siteUrl))))} />
        <Button title={t("sv.ag_publish")} variant="secondary" onPress={() => router.push(("/classificados/publicar?agente=" + a.code) as any)} />
        <View style={ui.card}>
          <Text style={ui.text}>{t("sv.ag_listings", { n: tt.listings })}</Text>
          <Text style={ui.text}>{t("sv.ag_sold", { n: tt.sold })}</Text>
          <Text style={ui.text}>{t("sv.ag_waiting", { v: formatPrice(tt.pending) })}</Text>
          <Text style={ui.text}>{t("sv.ag_in_balance", { v: formatPrice(tt.approved) })}</Text>
        </View>
        <Button title={t("sv.ag_balance")} variant="secondary" onPress={() => router.push("/conta/saldo" as any)} />
      </>}
      {(p?.helped ?? []).length > 0 && <Text style={ui.h2}>{t("sv.ag_helped")}</Text>}
      {(p?.helped ?? []).map(h => <View key={h.id} style={ui.card}>
        <Link href={("/classificados/" + h.id) as any} style={ui.link}>{h.title}</Link>
        <Text style={ui.muted}>{h.price != null ? formatPrice(h.price, h.currency ?? undefined) + " · " : ""}{h.status === "sold" ? t("sv.ag_sold_tag") : h.status === "published" ? t("sv.ag_for_sale") : t("sv.ag_offline")}</Text>
      </View>)}
      {(p?.commissions ?? []).length > 0 && <Text style={ui.h2}>{t("sv.commissions")}</Text>}
      {(p?.commissions ?? []).map(c => <View key={c.id} style={ui.card}>
        <Text style={ui.label}>{c.listing_title}</Text>
        <Text style={ui.text}>{tc(agentCommissionLine(c))}</Text>
        <Text style={ui.muted}>{new Date(c.created_at).toLocaleDateString(LANG_TAGS[lang])} · {tc(AGENT_COMMISSION_STATUS_LABELS[c.status])}{c.admin_note ? " · " + c.admin_note : ""}</Text>
      </View>)}
    </>}
  </ScrollView>;
}
