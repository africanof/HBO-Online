import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { listMyPlans, getPlatformSettings, planSummary, needsPayment, formatPrice, friendlyErrorIn, PLAN_KIND_LABELS, PLAN_STATE_LABELS, type MyPlan, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";
import { PayForm } from "../../components/Plans";
import { useT } from "../../lib/i18n";

export default function Plano() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [plans, setPlans] = useState<MyPlan[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [p, s] = await Promise.all([listMyPlans(supabase()), getPlatformSettings(supabase())]);
    if (p.error) setError(friendlyErrorIn(p.error, lang)); setPlans(p.data); setSettings(s.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>{t("sh.my_plan")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{"← " + t("nav.account")}</Link>
    <Text style={ui.h1}>{"💳 " + t("sh.my_plan")}</Text>
    <Text style={ui.text}>{t("sh.plan_intro", { days: settings?.trial_days ?? 30, provider: formatPrice(settings?.provider_monthly_kz ?? 2000), business: formatPrice(settings?.business_monthly_kz ?? 5000) })}</Text>
    <Message error={error} ok={notice} />
    {plans.length === 0 && <Text style={ui.text}>{t("sh.no_plans")}</Text>}
    {plans.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{tc(PLAN_KIND_LABELS[p.kind])}: {p.name}</Text>
      <Text style={ui.label}>{tc(PLAN_STATE_LABELS[p.state])}</Text>
      <Text style={p.state === "expired" ? ui.error : ui.text}>{tc(planSummary(p))}</Text>
      {!!p.pending_payment_id && <Text style={ui.ok}>{t("sh.payment_pending", { price: formatPrice(p.pending_amount) })}</Text>}
      {!!p.last_rejected_note && !p.pending_payment_id && <Text style={ui.error}>{t("sh.last_payment_rejected", { note: p.last_rejected_note })}</Text>}
      {!p.pending_payment_id && (open === p.id
        ? <PayForm plan={p} uid={uid} settings={settings} onDone={msg => { setNotice(msg); setOpen(null); void load(); }} />
        : <Button title={needsPayment(p) ? t("sh.pay_now") : t("sh.pay_ahead")} variant={needsPayment(p) ? "primary" : "secondary"} onPress={() => { setOpen(p.id); setNotice(""); }} />)}
    </View>)}
  </ScrollView>;
}
