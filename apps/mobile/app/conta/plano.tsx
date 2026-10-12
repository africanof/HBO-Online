import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { listMyPlans, getPlatformSettings, planSummary, needsPayment, formatPrice, friendlyError, PLAN_KIND_LABELS, PLAN_STATE_LABELS, type MyPlan, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";
import { PayForm } from "../../components/Plans";

export default function Plano() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [plans, setPlans] = useState<MyPlan[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [p, s] = await Promise.all([listMyPlans(supabase()), getPlatformSettings(supabase())]);
    if (p.error) setError(friendlyError(p.error)); setPlans(p.data); setSettings(s.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <View style={ui.screen}><Text style={ui.h1}>O meu plano</Text><Button title="Entrar" onPress={() => router.push("/login")} /></View>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>💳 O meu plano</Text>
    <Text style={ui.text}>Profissionais e empresas têm {settings?.trial_days ?? 30} dias grátis. Depois: profissionais {formatPrice(settings?.provider_monthly_kz ?? 2000)} por mês, empresas e Lojas {formatPrice(settings?.business_monthly_kz ?? 5000)} por mês. Sem pagamento, o perfil deixa de aparecer aos clientes (não é apagado).</Text>
    <Message error={error} ok={notice} />
    {plans.length === 0 && <Text style={ui.text}>Ainda não tem perfil profissional, empresa nem Loja.</Text>}
    {plans.map(p => <View key={p.id} style={ui.card}>
      <Text style={ui.h2}>{PLAN_KIND_LABELS[p.kind]}: {p.name}</Text>
      <Text style={ui.label}>{PLAN_STATE_LABELS[p.state]}</Text>
      <Text style={p.state === "expired" ? ui.error : ui.text}>{planSummary(p)}</Text>
      {!!p.pending_payment_id && <Text style={ui.ok}>⏳ Pagamento de {formatPrice(p.pending_amount)} à espera de confirmação.</Text>}
      {!!p.last_rejected_note && !p.pending_payment_id && <Text style={ui.error}>Último pagamento não confirmado: {p.last_rejected_note}</Text>}
      {!p.pending_payment_id && (open === p.id
        ? <PayForm plan={p} uid={uid} settings={settings} onDone={msg => { setNotice(msg); setOpen(null); void load(); }} />
        : <Button title={needsPayment(p) ? "💳 Pagar agora" : "💳 Pagar adiantado"} variant={needsPayment(p) ? "primary" : "secondary"} onPress={() => { setOpen(p.id); setNotice(""); }} />)}
    </View>)}
  </ScrollView>;
}
