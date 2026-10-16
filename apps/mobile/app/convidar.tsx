import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Linking, ScrollView, Share, Text, TextInput, View } from "react-native";
import { getMyReferrals, claimReferral, referralLink, referralRewardText, referralInviteMessage, whatsappShareUrl, daysText, friendlyErrorIn,
  REFERRAL_STATUS_LABELS, LANG_TAGS, type ReferralPanel } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { useT } from "../lib/i18n";

export default function Convidar() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<ReferralPanel | null>(null); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await getMyReferrals(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setP(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function claim() {
    setBusy(true); setError(""); setNotice("");
    const r = await claimReferral(supabase(), code); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(t("sv.ref_ok", { name: r.data ?? t("sv.ref_a_friend") })); setCode(""); await load();
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.ref_title")}</Text><Text style={ui.text}>{tc(referralRewardText(30))}</Text><Button title={t("sv.ref_login")} onPress={() => router.push("/login")} /></ScrollView>;
  const link = p ? referralLink(siteUrl, p.code) : "";
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back")}</Link>
    <Text style={ui.h1}>{t("sv.ref_title")}</Text>
    <Text style={ui.text}>{tc(referralRewardText(p?.reward_days))}</Text>
    <Message error={error} ok={notice} />
    {!!p && <>
      <View style={[ui.card, { alignItems: "center" }]}>
        <Text style={ui.text}>{t("sv.ref_code")}</Text>
        <Text selectable style={{ ...ui.h1, fontSize: 40, letterSpacing: 4 }}>{p.code}</Text>
        <Text selectable style={[ui.muted, { textAlign: "center" }]}>{link}</Text>
      </View>
      <Button title={t("sv.ref_whatsapp")} onPress={() => void Linking.openURL(whatsappShareUrl(tc(referralInviteMessage(siteUrl, p.code))))} />
      <Button title={t("sv.ref_share")} variant="secondary" onPress={() => void Share.share({ message: tc(referralInviteMessage(siteUrl, p.code)) })} />
      <View style={ui.card}>
        <Text style={ui.text}>{t("sv.ref_invited", { n: p.invited })}</Text>
        <Text style={ui.text}>{t("sv.ref_paid", { n: p.earned })}</Text>
        <Text style={ui.text}>{t("sv.ref_earned", { days: tc(daysText(p.days_earned)) })}</Text>
      </View>
      {p.waiting_days > 0 && <View style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>{t("sv.ref_waiting", { days: tc(daysText(p.waiting_days)) })}</Text></View>}
      {p.friends.length > 0 && <Text style={ui.h2}>{t("sv.ref_yours")}</Text>}
      {p.friends.map((f, i) => <View key={i} style={ui.card}><Text style={ui.label}>{f.name}</Text><Text style={ui.muted}>{new Date(f.created_at).toLocaleDateString(LANG_TAGS[lang])} · {tc(REFERRAL_STATUS_LABELS[f.status])}</Text></View>)}
      {!!p.invited_by && <Text style={ui.text}>{t("sv.ref_by", { name: p.invited_by })}</Text>}
      {p.can_claim && <View style={ui.card}>
        <Text style={ui.label}>{t("sv.ref_claim")}</Text>
        <TextInput accessibilityLabel={t("sv.ref_code_a11y")} value={code} onChangeText={setCode} maxLength={8} placeholder={t("sv.ref_code_ph")} autoCapitalize="characters" style={ui.input} />
        <Text style={ui.muted}>{t("sv.ref_claim_hint")}</Text>
        <Button title={busy ? t("sv.confirming") : t("sv.ref_use")} disabled={busy || !code.trim()} onPress={() => void claim()} />
      </View>}
      <View style={ui.card}>
        <Text style={ui.h2}>{t("sv.how_it_works")}</Text>
        <Text style={ui.text}>{t("sv.ref_step1")}</Text>
        <Text style={ui.text}>{t("sv.ref_step2")}</Text>
        <Text style={ui.text}>{t("sv.ref_step3", { days: tc(daysText(p.reward_days)) })}</Text>
      </View>
    </>}
  </ScrollView>;
}
