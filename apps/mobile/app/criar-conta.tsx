import { useState } from "react";
import { Link, router } from "expo-router";
import { ScrollView, Text, TextInput } from "react-native";
import { signUp } from "@huambo-online/supabase";
import { authErrorMessage, validateNewPassword, validateProfileInput } from "@huambo-online/core";
import { supabase, supabaseConfigured, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Message } from "../components/Ui";

export default function CriarConta() {
  const [f, setF] = useState({ fullName: "", email: "", phone: "", municipality: "", password: "", confirm: "" });
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));

  async function submit() {
    if (busy) return; setError(""); setOk("");
    if (!supabaseConfigured) { setError("Serviço de autenticação não configurado."); return; }
    const invalid = validateProfileInput(f) ?? (!/^\S+@\S+\.\S+$/.test(f.email.trim()) ? "Email inválido." : null) ?? validateNewPassword(f.password, f.confirm);
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      const { data, error } = await signUp(supabase(), { ...f, emailRedirectTo: siteUrl ? siteUrl + "/conta/login" : undefined });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { setError("Já existe uma conta com este email. Use «Entrar»."); return; }
      if (data.session) { setOk("Conta criada com sucesso."); router.replace("/conta"); }
      else setOk("Conta criada. Abra o email que enviámos e clique no link para confirmar. Depois pode entrar.");
    } catch (e) { setError(authErrorMessage(e)); } finally { setBusy(false); }
  }

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>Criar conta</Text>
    <Text style={ui.label}>Nome completo</Text><TextInput autoComplete="name" value={f.fullName} onChangeText={set("fullName")} style={ui.input} />
    <Text style={ui.label}>Email</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={f.email} onChangeText={set("email")} style={ui.input} />
    <Text style={ui.label}>Telefone (opcional)</Text><TextInput keyboardType="phone-pad" value={f.phone} onChangeText={set("phone")} placeholder="923 000 000" style={ui.input} />
    <Text style={ui.label}>Município (opcional)</Text><TextInput value={f.municipality} onChangeText={set("municipality")} placeholder="Ex.: Huambo, Caála…" style={ui.input} />
    <Text style={ui.label}>Palavra-passe (mínimo 8 caracteres)</Text><TextInput secureTextEntry autoComplete="new-password" value={f.password} onChangeText={set("password")} style={ui.input} />
    <Text style={ui.label}>Confirmar palavra-passe</Text><TextInput secureTextEntry autoComplete="new-password" value={f.confirm} onChangeText={set("confirm")} style={ui.input} />
    <Button title={busy ? "A criar conta..." : "Criar conta"} onPress={() => void submit()} disabled={busy} />
    <Message error={error} ok={ok} />
    <Link href="/login" style={ui.link}>Já tenho conta</Link>
  </ScrollView>;
}
