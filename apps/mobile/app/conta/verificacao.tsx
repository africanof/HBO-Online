import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScrollView, Text, TextInput, View } from "react-native";
import { listMyVerifications, requestVerification, uploadVerificationDocument, validateDocument, listMyBusinesses, getProvider, friendlyError,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type MyVerification, type VerificationKind } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { VerifiedTag } from "../../components/Reputation";

export default function Verificacao() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyVerification[]>([]); const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]); const [isProvider, setIsProvider] = useState(false);
  const [kind, setKind] = useState<VerificationKind>("identity"); const [businessId, setBusinessId] = useState("");
  const [doc, setDoc] = useState<{ uri: string; name: string; type: string; size?: number | null } | null>(null); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  async function load(id: string) {
    const c = supabase();
    const [v, b, p] = await Promise.all([listMyVerifications(c), listMyBusinesses(c, id), getProvider(c, id)]);
    setItems(v.data); setBusinesses(((b.data as any[]) ?? []).map(x => ({ id: x.id, name: x.name }))); setIsProvider(!!p.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []));

  async function pick(camera: boolean) {
    setError("");
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? "Autorize a câmara para fotografar o documento." : "Autorize o acesso à galeria."); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const type = a.mimeType || "image/jpeg";
    const invalid = validateDocument({ size: a.fileSize ?? null, type }); if (invalid) { setError(invalid); return; }
    setDoc({ uri: a.uri, name: a.fileName || "documento.jpg", type, size: a.fileSize });
  }
  async function send() {
    if (!uid) return;
    if (!doc) { setError("Fotografe ou escolha o documento."); return; }
    if (kind === "business" && !businessId) { setError("Escolha a empresa."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const c = supabase();
      const body = await (await fetch(doc.uri)).arrayBuffer();
      const up = await uploadVerificationDocument(c, uid, body, doc.name, doc.type);
      if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o documento.");
      const r = await requestVerification(c, kind, up.data, { businessId: kind === "business" ? businessId : undefined, note });
      if (r.error) throw r.error;
      setNotice("Pedido enviado. A administração vai analisar e recebe uma notificação com a resposta."); setDoc(null); setNote(""); await load(uid);
    } catch (e) { setError(friendlyError(e, "Não foi possível enviar o pedido.")); }
    finally { setBusy(false); }
  }

  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>A carregar…</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Verificar perfil</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  const kinds: VerificationKind[] = ["identity", ...(isProvider ? ["provider" as const] : []), ...(businesses.length ? ["business" as const] : [])];
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>✔ Verificar perfil</Text>
    <Text style={ui.text}>Envie um documento para a administração confirmar quem é. Depois de aprovado, o seu perfil mostra o selo de verificado e os clientes confiam mais.</Text>
    <Text style={ui.muted}>🔒 O documento fica guardado em privado: só a administração o pode ver.</Text>
    <View style={ui.card}>
      <Text style={ui.label}>O que quer verificar?</Text>
      <Chips options={kinds.map(k => ({ value: k, label: VERIFICATION_KIND_LABELS[k] }))} value={kind} onChange={setKind} />
      {kind === "business" && <><Text style={ui.label}>Empresa</Text><Chips options={businesses.map(b => ({ value: b.id, label: b.name }))} value={businessId} onChange={setBusinessId} /></>}
      <Text style={ui.label}>{kind === "business" ? "Alvará, NIF ou certidão comercial" : "Bilhete de Identidade (frente)"}</Text>
      <Button title="📷 Fotografar documento" variant="secondary" onPress={() => void pick(true)} />
      <Button title="🖼️ Escolher da galeria" variant="secondary" onPress={() => void pick(false)} />
      {!!doc && <Text style={ui.ok}>Documento escolhido ✔</Text>}
      <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Nota para a administração (opcional)" />
      <Message error={error} ok={notice} />
      <Button title={busy ? "A enviar…" : "Enviar para verificação"} disabled={busy} onPress={() => void send()} />
    </View>
    <Text style={ui.h2}>Os meus pedidos</Text>
    {items.length === 0 && <Text style={ui.text}>Ainda não pediu nenhuma verificação.</Text>}
    {items.map(v => <View key={v.id} style={ui.card}>
      <Text style={ui.label}>{VERIFICATION_KIND_LABELS[v.kind]}{v.business_name ? " — " + v.business_name : ""}</Text>
      {v.status === "approved" ? <VerifiedTag text={VERIFICATION_STATUS_LABELS[v.status]} /> : <Text style={ui.text}>{VERIFICATION_STATUS_LABELS[v.status]}</Text>}
      {!!v.admin_note && <Text style={ui.text}>Nota da administração: {v.admin_note}</Text>}
      <Text style={ui.muted}>{new Date(v.created_at).toLocaleDateString("pt-AO")}</Text>
    </View>)}
  </ScrollView>;
}
