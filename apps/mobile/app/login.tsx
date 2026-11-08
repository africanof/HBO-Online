import { useState } from "react";
import { Link, router } from "expo-router";
import { ScrollView, Text, TextInput } from "react-native";
import { signIn } from "@huambo-online/supabase";
import { requestPasswordReset, authErrorMessage, mfaRequired } from "@huambo-online/core";
import { supabase, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { MfaPrompt } from "../components/Mfa";
import { useT } from "../lib/i18n";
import { SocialLogin } from "../components/SocialLogin";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false); const [forgot, setForgot] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const { t } = useT();

  async function submit() {
    if (busy) return; setError(""); setOk("");
    if (!email.trim()) { setError(t("login.need_email")); return; }
    setBusy(true);
    try {
      if (forgot) {
        const r = await requestPasswordReset(supabase(), email, siteUrl ? siteUrl + "/conta/recuperar" : "huamboonline://login");
        if (r.error) throw r.error;
        setOk(t("login.reset_sent"));
      } else {
        const { error } = await signIn(supabase(), email, password);
        if (error) throw error;
        // Conta com APP autenticadora: falta o segundo passo (código de 6 algarismos).
        if (await mfaRequired(supabase())) { setNeedCode(true); return; }
        router.replace("/");
      }
    } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); }
  }

  async function cancelCode() {
    try { await supabase().auth.signOut(); } catch { /* sem rede: a sessão fica em aal1 e volta a pedir o código */ }
    setNeedCode(false); setPassword("");
  }

  if (needCode) return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Text style={ui.h1}>{t("login.step2_title")}</Text>
    <Text style={ui.text}>{t("login.step2_text")}</Text>
    <MfaPrompt onDone={() => router.replace("/")} onCancel={() => void cancelCode()} cancelLabel={t("login.cancel_exit")} />
  </ScrollView>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{forgot ? t("login.recover_title") : t("auth.login")}</Text>
    {!forgot && <SocialLogin onDone={() => router.replace("/")} onNeedCode={() => setNeedCode(true)} />}
    <Text style={ui.label}>{t("auth.email")}</Text>
    <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel={t("auth.email")} style={ui.input} />
    {!forgot && <><Text style={ui.label}>{t("auth.password")}</Text><TextInput secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} accessibilityLabel={t("auth.password")} style={ui.input} /></>}
    <Button title={busy ? t("login.wait") : forgot ? t("login.send_link") : t("auth.login")} onPress={() => void submit()} disabled={busy} />
    <Message error={error} ok={ok} />
    <Button title={forgot ? t("login.back") : t("auth.forgot")} variant="secondary" onPress={() => { setForgot(!forgot); setError(""); setOk(""); }} />
    <Link href="/criar-conta" style={ui.link}>{t("login.create")}</Link>
  </ScrollView>;
}
