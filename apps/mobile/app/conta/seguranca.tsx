import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { listTotpFactors, startTotpEnrollment, verifyTotp, disableTotp, mfaRequired, mfaErrorIn, formatTotpSecret,
  MFA_STEPS, LANG_TAGS, type MfaEnrollment, type MfaFactor } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { C, ui } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";
import { MfaPrompt, QrView, TotpCodeInput } from "../../components/Mfa";
import { useT } from "../../lib/i18n";

/** Entrar em dois passos: palavra-passe + código de 6 algarismos de uma APP autenticadora. */
export default function SegurancaConta() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [factor, setFactor] = useState<MfaFactor | null>(null); const [needCode, setNeedCode] = useState(false);
  const [enroll, setEnroll] = useState<MfaEnrollment | null>(null); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  async function load() {
    const c = supabase();
    const [f, need] = await Promise.all([listTotpFactors(c), mfaRequired(c)]);
    if (f.error) setError(mfaErrorIn(f.error, lang));
    setFactor(f.data.find(x => x.status === "verified") ?? null); setNeedCode(need);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));

  async function start() {
    setBusy(true); setError(""); setNotice(""); setCode("");
    try {
      const r = await startTotpEnrollment(supabase());
      if (r.error || !r.data) throw r.error ?? new Error(t("sv.mfa_start_fail"));
      setEnroll(r.data);
    } catch (e) { setError(mfaErrorIn(e, lang)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!enroll || busy) return;
    setBusy(true); setError("");
    try {
      const r = await verifyTotp(supabase(), enroll.factorId, code);
      if (r.error) throw r.error;
      setEnroll(null); setCode(""); setNotice(t("sv.mfa_on_ok")); await load();
    } catch (e) { setError(mfaErrorIn(e, lang)); setCode(""); } finally { setBusy(false); }
  }
  async function cancelEnroll() {
    const id = enroll?.factorId; setEnroll(null); setCode(""); setError("");
    if (id) { try { await disableTotp(supabase(), id); } catch { /* fica por acabar; é apagado ao voltar a ligar */ } }
  }
  async function openApp() {
    if (!enroll) return;
    try { await Linking.openURL(enroll.uri); }
    catch { setError(t("sv.mfa_no_app")); }
  }
  async function disable() {
    if (!factor) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const c = supabase();
      if (await mfaRequired(c)) { setNeedCode(true); return; }
      const r = await disableTotp(c, factor.id);
      if (r.error) throw r.error;
      setNotice(t("sv.mfa_off_ok")); await load();
    } catch (e) { setError(mfaErrorIn(e, lang)); } finally { setBusy(false); }
  }
  function askDisable() {
    Alert.alert(t("sv.mfa_off_q"), t("sv.mfa_off_warn"), [
      { text: t("sv.no"), style: "cancel" }, { text: t("sv.turn_off"), style: "destructive", onPress: () => void disable() }]);
  }

  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.mfa_title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back")}</Link>
    <Text style={ui.h1}>{t("sv.mfa_title")}</Text>
    <Text style={ui.text}>{t("sv.mfa_intro")}</Text>
    <Message error={error} ok={notice} />

    {needCode ? <MfaPrompt text={t("sv.mfa_need_code")}
      onDone={() => { setNeedCode(false); void load(); }} onCancel={() => router.replace("/conta")} cancelLabel={t("common.back")} />

    : factor ? <View style={ui.card}>
      <Text style={[ui.h2, { color: C.green }]}>{t("sv.mfa_on")}</Text>
      <Text style={ui.text}>{t("sv.mfa_on_text")}</Text>
      <Text style={ui.muted}>{t("sv.mfa_since", { date: new Date(factor.created_at).toLocaleDateString(LANG_TAGS[lang]) })}</Text>
      <Text style={ui.muted}>{t("sv.mfa_phone_warn")}</Text>
      <Button title={busy ? t("sv.wait") : t("sv.turn_off")} variant="danger" disabled={busy} onPress={askDisable} />
    </View>

    : enroll ? <View style={ui.card}>
      <Text style={ui.h2}>{t("sv.mfa_link")}</Text>
      <Text style={ui.label}>{t("sv.mfa_this_phone")}</Text>
      <Text style={ui.text}>{t("sv.mfa_this_phone_text")}</Text>
      <Button title={t("sv.mfa_open")} onPress={() => void openApp()} />
      <Text style={ui.label}>{t("sv.mfa_key")}</Text>
      <Text selectable style={[ui.h2, { letterSpacing: 2, fontFamily: "monospace" }]}>{formatTotpSecret(enroll.secret)}</Text>
      <Text style={ui.muted}>{t("sv.mfa_key_hint")}</Text>
      <Text style={ui.label}>{t("sv.mfa_other_phone")}</Text>
      <Text style={ui.text}>{t("sv.mfa_other_phone_text")}</Text>
      <QrView text={enroll.uri} label={t("sv.mfa_qr")} />
      <Text style={ui.label}>{t("sv.mfa_enter")}</Text>
      <TotpCodeInput value={code} onChangeText={setCode} onSubmit={() => void confirm()} />
      <Button title={busy ? t("sv.confirming") : t("sv.mfa_confirm_on")} disabled={busy || code.length !== 6} onPress={() => void confirm()} />
      <Button title={t("common.cancel")} variant="secondary" disabled={busy} onPress={() => void cancelEnroll()} />
    </View>

    : <View style={ui.card}>
      <Text style={ui.h2}>{t("sv.mfa_off")}</Text>
      <Text style={ui.label}>{t("sv.how_it_works_plain")}</Text>
      {MFA_STEPS.map((s, i) => <Text key={i} style={ui.text}>{i + 1}. {tc(s)}</Text>)}
      <Button title={busy ? t("sv.wait") : t("sv.turn_on")} disabled={busy} onPress={() => void start()} />
    </View>}
  </ScrollView>;
}
