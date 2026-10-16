import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { listTotpFactors, startTotpEnrollment, verifyTotp, disableTotp, mfaRequired, mfaErrorMessage, formatTotpSecret,
  MFA_STEPS, type MfaEnrollment, type MfaFactor } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { C, ui } from "../../lib/ui";
import { Button, Message } from "../../components/Ui";
import { MfaPrompt, QrView, TotpCodeInput } from "../../components/Mfa";

/** Entrar em dois passos: palavra-passe + código de 6 algarismos de uma APP autenticadora. */
export default function SegurancaConta() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [factor, setFactor] = useState<MfaFactor | null>(null); const [needCode, setNeedCode] = useState(false);
  const [enroll, setEnroll] = useState<MfaEnrollment | null>(null); const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  async function load() {
    const c = supabase();
    const [f, need] = await Promise.all([listTotpFactors(c), mfaRequired(c)]);
    if (f.error) setError(mfaErrorMessage(f.error));
    setFactor(f.data.find(x => x.status === "verified") ?? null); setNeedCode(need);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));

  async function start() {
    setBusy(true); setError(""); setNotice(""); setCode("");
    try {
      const r = await startTotpEnrollment(supabase());
      if (r.error || !r.data) throw r.error ?? new Error("Não foi possível começar.");
      setEnroll(r.data);
    } catch (e) { setError(mfaErrorMessage(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!enroll || busy) return;
    setBusy(true); setError("");
    try {
      const r = await verifyTotp(supabase(), enroll.factorId, code);
      if (r.error) throw r.error;
      setEnroll(null); setCode(""); setNotice("Pronto! A partir de agora, ao entrar, pedimos também o código da APP autenticadora."); await load();
    } catch (e) { setError(mfaErrorMessage(e)); setCode(""); } finally { setBusy(false); }
  }
  async function cancelEnroll() {
    const id = enroll?.factorId; setEnroll(null); setCode(""); setError("");
    if (id) { try { await disableTotp(supabase(), id); } catch { /* fica por acabar; é apagado ao voltar a ligar */ } }
  }
  async function openApp() {
    if (!enroll) return;
    try { await Linking.openURL(enroll.uri); }
    catch { setError("Não encontrámos uma APP autenticadora neste telemóvel. Instale uma (por exemplo Google Authenticator) ou escreva a chave à mão."); }
  }
  async function disable() {
    if (!factor) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const c = supabase();
      if (await mfaRequired(c)) { setNeedCode(true); return; }
      const r = await disableTotp(c, factor.id);
      if (r.error) throw r.error;
      setNotice("A entrada em dois passos foi desligada. Agora basta a palavra-passe para entrar."); await load();
    } catch (e) { setError(mfaErrorMessage(e)); } finally { setBusy(false); }
  }
  function askDisable() {
    Alert.alert("Desligar a entrada em dois passos?", "A sua conta fica menos protegida: quem souber a palavra-passe consegue entrar.", [
      { text: "Não", style: "cancel" }, { text: "Desligar", style: "destructive", onPress: () => void disable() }]);
  }

  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>A carregar…</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>🔐 Entrar em dois passos</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>🔐 Entrar em dois passos</Text>
    <Text style={ui.text}>Além da palavra-passe, ao entrar pedimos um código de 6 algarismos que muda a cada 30 segundos numa APP autenticadora. Assim, mesmo que alguém descubra a sua palavra-passe, não consegue entrar.</Text>
    <Message error={error} ok={notice} />

    {needCode ? <MfaPrompt text="Esta conta já tem a entrada em dois passos ligada. Para mudar, escreva primeiro o código que a APP autenticadora mostra agora."
      onDone={() => { setNeedCode(false); void load(); }} onCancel={() => router.replace("/conta")} cancelLabel="Voltar" />

    : factor ? <View style={ui.card}>
      <Text style={[ui.h2, { color: C.green }]}>✔ Ligada</Text>
      <Text style={ui.text}>Ao entrar, depois da palavra-passe, pedimos o código da APP autenticadora.</Text>
      <Text style={ui.muted}>Ligada desde {new Date(factor.created_at).toLocaleDateString("pt-AO")}</Text>
      <Text style={ui.muted}>⚠️ Se mudar de telemóvel, ligue a APP autenticadora no novo telemóvel antes de apagar a do antigo.</Text>
      <Button title={busy ? "Aguarde…" : "Desligar"} variant="danger" disabled={busy} onPress={askDisable} />
    </View>

    : enroll ? <View style={ui.card}>
      <Text style={ui.h2}>Ligar a APP autenticadora</Text>
      <Text style={ui.label}>Neste telemóvel</Text>
      <Text style={ui.text}>Se a APP autenticadora está neste telemóvel, carregue no botão. Se não abrir, escreva a chave à mão na APP.</Text>
      <Button title="📲 Abrir na APP autenticadora" onPress={() => void openApp()} />
      <Text style={ui.label}>Chave para escrever à mão</Text>
      <Text selectable style={[ui.h2, { letterSpacing: 2, fontFamily: "monospace" }]}>{formatTotpSecret(enroll.secret)}</Text>
      <Text style={ui.muted}>Toque sem largar na chave para a copiar. Na APP escolha «Chave baseada no tempo».</Text>
      <Text style={ui.label}>Noutro telemóvel</Text>
      <Text style={ui.text}>Leia este código QR com a APP autenticadora do outro telemóvel.</Text>
      <QrView text={enroll.uri} label="Código QR para a APP autenticadora" />
      <Text style={ui.label}>Escreva os 6 algarismos que a APP mostra</Text>
      <TotpCodeInput value={code} onChangeText={setCode} onSubmit={() => void confirm()} />
      <Button title={busy ? "A confirmar…" : "Confirmar e ligar"} disabled={busy || code.length !== 6} onPress={() => void confirm()} />
      <Button title="Cancelar" variant="secondary" disabled={busy} onPress={() => void cancelEnroll()} />
    </View>

    : <View style={ui.card}>
      <Text style={ui.h2}>Desligada</Text>
      <Text style={ui.label}>Como funciona</Text>
      {MFA_STEPS.map((s, i) => <Text key={i} style={ui.text}>{i + 1}. {s}</Text>)}
      <Button title={busy ? "Aguarde…" : "Ligar"} disabled={busy} onPress={() => void start()} />
    </View>}
  </ScrollView>;
}
