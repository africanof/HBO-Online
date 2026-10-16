import { useEffect, useState } from "react";
import { Link, router } from "expo-router";
import { ScrollView, Text, TextInput } from "react-native";
import { signUp } from "@huambo-online/supabase";
import { authErrorMessage, validateNewPassword, validateProfileInput, isReferralCodeShape, storeReferralCode, pendingReferralCode, claimPendingReferral } from "@huambo-online/core";
import { deviceStore } from "../components/Engage";
import { supabase, supabaseConfigured, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { useT } from "../lib/i18n";

export default function CriarConta() {
  const [f, setF] = useState({ fullName: "", email: "", phone: "", municipality: "", password: "", confirm: "" });
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  const { t } = useT();
  useEffect(() => { void pendingReferralCode(deviceStore).then(setInvite); }, []);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function submit() {
    if (busy) return; setError(""); setOk("");
    if (!supabaseConfigured) { setError(t("signup.not_configured")); return; }
    const invalid = validateProfileInput(f) ?? (!/^\S+@\S+\.\S+$/.test(f.email.trim()) ? t("signup.bad_email") : null) ?? validateNewPassword(f.password, f.confirm);
    if (invalid) { setError(invalid); return; }
    if (invite.trim() && !isReferralCodeShape(invite)) { setError(t("signup.bad_invite")); return; }
    await storeReferralCode(deviceStore, invite);
    setBusy(true);
    try {
      const { data, error } = await signUp(supabase(), { ...f, emailRedirectTo: siteUrl ? siteUrl + "/conta/login" : undefined });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { setError(t("signup.exists")); return; }
      if (data.session) { setOk(t("signup.created")); await claimPendingReferral(supabase(), deviceStore); router.replace("/conta"); }
      else setOk(t("signup.confirm_email"));
    } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{t("auth.signup")}</Text>
    <Text style={ui.label}>{t("auth.full_name")}</Text><TextInput accessibilityLabel={t("auth.full_name")} autoComplete="name" value={f.fullName} onChangeText={set("fullName")} style={ui.input} />
    <Text style={ui.label}>{t("auth.email")}</Text><TextInput accessibilityLabel={t("auth.email")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={f.email} onChangeText={set("email")} style={ui.input} />
    <Text style={ui.label}>{t("signup.phone_opt")}</Text><TextInput accessibilityLabel={t("signup.phone_opt")} keyboardType="phone-pad" value={f.phone} onChangeText={set("phone")} placeholder="923 000 000" style={ui.input} />
    <Text style={ui.label}>{t("signup.muni_opt")}</Text><TextInput accessibilityLabel={t("signup.muni_opt")} value={f.municipality} onChangeText={set("municipality")} placeholder={t("signup.muni_ph")} style={ui.input} />
    <Text style={ui.label}>{t("auth.password_min")}</Text><TextInput accessibilityLabel={t("auth.password_min")} secureTextEntry autoComplete="new-password" value={f.password} onChangeText={set("password")} style={ui.input} />
    <Text style={ui.label}>{t("auth.password_confirm")}</Text><TextInput accessibilityLabel={t("auth.password_confirm")} secureTextEntry autoComplete="new-password" value={f.confirm} onChangeText={set("confirm")} style={ui.input} />
    <Text style={ui.label}>{t("signup.invite_opt")}</Text><TextInput accessibilityLabel={t("signup.invite")} autoCapitalize="characters" maxLength={8} value={invite} onChangeText={setInvite} placeholder={t("signup.invite_ph")} style={ui.input} />
    <Button title={busy ? t("auth.creating") : t("auth.signup")} onPress={() => void submit()} disabled={busy} />
    <Message error={error} ok={ok} />
    <Link href="/login" style={ui.link}>{t("signup.have_account")}</Link>
  </ScrollView>;
}
