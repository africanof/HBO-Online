import { useState } from "react";
import { Link, router } from "expo-router";
import { ScrollView, Text, TextInput } from "react-native";
import { signIn } from "@huambo-online/supabase";
import { requestPasswordReset, authErrorMessage } from "@huambo-online/core";
import { supabase, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";

export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false); const [forgot, setForgot] = useState(false);

  async function submit() {
    if (busy) return; setError(""); setOk("");
    if (!email.trim()) { setError("Indique o email."); return; }
    setBusy(true);
    try {
      if (forgot) {
        const r = await requestPasswordReset(supabase(), email, siteUrl ? siteUrl + "/conta/recuperar" : "huamboonline://login");
        if (r.error) throw r.error;
        setOk("Se o email existir, enviámos um link para definir uma nova palavra-passe.");
      } else {
        const { error } = await signIn(supabase(), email, password);
        if (error) throw error;
        router.replace("/");
      }
    } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{forgot ? "Recuperar palavra-passe" : "Entrar"}</Text>
    <Text style={ui.label}>Email</Text>
    <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={ui.input} />
    {!forgot && <><Text style={ui.label}>Palavra-passe</Text><TextInput secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} style={ui.input} /></>}
    <Button title={busy ? "Aguarde…" : forgot ? "Enviar link de recuperação" : "Entrar"} onPress={() => void submit()} disabled={busy} />
    <Message error={error} ok={ok} />
    <Button title={forgot ? "← Voltar a entrar" : "Esqueci-me da palavra-passe"} variant="secondary" onPress={() => { setForgot(!forgot); setError(""); setOk(""); }} />
    <Link href="/criar-conta" style={ui.link}>Criar uma conta</Link>
  </ScrollView>;
}
