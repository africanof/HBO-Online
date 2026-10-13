import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Linking, ScrollView, Share, Text, TextInput, View } from "react-native";
import { getMyReferrals, claimReferral, referralLink, referralRewardText, referralInviteMessage, whatsappShareUrl, daysText, friendlyError,
  REFERRAL_STATUS_LABELS, type ReferralPanel } from "@huambo-online/core";
import { supabase, currentUserId, siteUrl } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";

export default function Convidar() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<ReferralPanel | null>(null); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await getMyReferrals(supabase()); if (r.error) setError(friendlyError(r.error)); else setP(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  async function claim() {
    setBusy(true); setError(""); setNotice("");
    const r = await claimReferral(supabase(), code); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice(`Pronto! Entrou com o convite de ${r.data ?? "um amigo"}.`); setCode(""); await load();
  }
  if (uid === undefined) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>🎁 Convide um amigo</Text><Text style={ui.text}>{referralRewardText(30)}</Text><Button title="Entrar para convidar" onPress={() => router.push("/login")} /></ScrollView>;
  const link = p ? referralLink(siteUrl, p.code) : "";
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>🎁 Convide um amigo</Text>
    <Text style={ui.text}>{referralRewardText(p?.reward_days)}</Text>
    <Message error={error} ok={notice} />
    {!!p && <>
      <View style={[ui.card, { alignItems: "center" }]}>
        <Text style={ui.text}>O seu código de convite</Text>
        <Text selectable style={{ ...ui.h1, fontSize: 40, letterSpacing: 4 }}>{p.code}</Text>
        <Text selectable style={[ui.muted, { textAlign: "center" }]}>{link}</Text>
      </View>
      <Button title="📲 Convidar no WhatsApp" onPress={() => void Linking.openURL(whatsappShareUrl(referralInviteMessage(siteUrl, p.code)))} />
      <Button title="🔗 Partilhar a ligação" variant="secondary" onPress={() => void Share.share({ message: referralInviteMessage(siteUrl, p.code) })} />
      <View style={ui.card}>
        <Text style={ui.text}>👥 Amigos que entraram: {p.invited}</Text>
        <Text style={ui.text}>💳 Já pagaram a mensalidade: {p.earned}</Text>
        <Text style={ui.text}>🎁 Grátis que ganhou: {daysText(p.days_earned)}</Text>
      </View>
      {p.waiting_days > 0 && <View style={{ backgroundColor: C.yellowSoft, borderRadius: 12, padding: 12 }}><Text style={{ color: C.yellowText, fontSize: 16, lineHeight: 22 }}>🎁 Tem {daysText(p.waiting_days)} grátis guardados: entram quando criar o seu perfil profissional, a sua empresa ou a sua loja.</Text></View>}
      {p.friends.length > 0 && <Text style={ui.h2}>Os seus convites</Text>}
      {p.friends.map((f, i) => <View key={i} style={ui.card}><Text style={ui.label}>{f.name}</Text><Text style={ui.muted}>{new Date(f.created_at).toLocaleDateString("pt-AO")} · {REFERRAL_STATUS_LABELS[f.status]}</Text></View>)}
      {!!p.invited_by && <Text style={ui.text}>Entrou no Huambo Online com o convite de {p.invited_by}.</Text>}
      {p.can_claim && <View style={ui.card}>
        <Text style={ui.label}>Alguém o convidou? Escreva o código</Text>
        <TextInput accessibilityLabel="Código de convite" value={code} onChangeText={setCode} maxLength={8} placeholder="Ex.: K7M2QX" autoCapitalize="characters" style={ui.input} />
        <Text style={ui.muted}>Pode usar um código nos primeiros 14 dias da sua conta.</Text>
        <Button title={busy ? "A confirmar…" : "Usar o código"} disabled={busy || !code.trim()} onPress={() => void claim()} />
      </View>}
      <View style={ui.card}>
        <Text style={ui.h2}>Como funciona?</Text>
        <Text style={ui.text}>1. Envie a sua ligação ou o seu código a um amigo, uma empresa ou um profissional.</Text>
        <Text style={ui.text}>2. O amigo cria a conta e escreve o código (ou usa a ligação).</Text>
        <Text style={ui.text}>3. Quando o amigo pagar a primeira mensalidade, ganha {daysText(p.reward_days)} grátis na sua mensalidade.</Text>
      </View>
    </>}
  </ScrollView>;
}
