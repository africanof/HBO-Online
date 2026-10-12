import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Image, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { getCurrentUserProfile, updateCurrentUserProfile, signOutCurrentUser, changeCurrentUserPassword, deleteCurrentUserAccount, friendlyError, getMyAdminRole, canModerate, uploadAvatar, base64ToArrayBuffer, AVATAR_MAX_BYTES, AVATAR_MAX_SIDE } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui, C } from "../lib/ui";
import { Button, Message } from "../components/Ui";
import { shrinkAsset } from "../lib/image";
import { ThemePicker } from "../components/ThemePicker";
import { WhatsAppSettings } from "../components/Engage";

export default function Conta() {
  const router = useRouter();
  const [email, setEmail] = useState(""); const [loaded, setLoaded] = useState(false); const [isStaff, setIsStaff] = useState(false); const [uid, setUid] = useState(""); const [avatar, setAvatar] = useState<string | null>(null);
  const [form, setForm] = useState<{ fullName: string; phone: string; municipality: string } | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [del, setDel] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => {
    const c = supabase();
    const u = await c.auth.getUser();
    setEmail(u.data.user?.email ?? ""); setUid(u.data.user?.id ?? "");
    const r = await getCurrentUserProfile(c);
    if (r.error && u.data.user) setErr(friendlyError(r.error));
    if (u.data.user) setIsStaff(canModerate(await getMyAdminRole(c)));
    if (r.data) setAvatar(r.data.avatarUrl ?? null);
    if (r.data) setForm({ fullName: r.data.fullName, phone: r.data.phone ?? "", municipality: r.data.municipality });
    setLoaded(true);
  })(); }, []);

  async function run(fn: () => Promise<{ error: any }>, okMsg: string) {
    setBusy(true); setMsg(""); setErr("");
    const r = await fn(); setBusy(false);
    if (r.error) setErr(friendlyError(r.error)); else setMsg(okMsg);
    return !r.error;
  }

  if (!loaded) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!email) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.h1}>A sua conta</Text><Text style={ui.text}>Inicie sessão para gerir a sua conta.</Text><Button title="Entrar" onPress={() => router.push("/login")} /><Button title="Criar conta" variant="secondary" onPress={() => router.push("/criar-conta")} /><ThemePicker /></View>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>A sua conta</Text>
    {avatar ? <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} accessibilityLabel="Fotografia de perfil" /> : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.placeholder }} />}
    <Button title="📷 Mudar fotografia de perfil" variant="secondary" disabled={busy} onPress={async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setErr("Autorize o acesso às fotografias."); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (res.canceled) return;
      const a = await shrinkAsset(res.assets[0], AVATAR_MAX_SIDE); // fotografia de perfil pequena (512 px)
      const type = a.mimeType;
      const body = a.base64 ? base64ToArrayBuffer(a.base64) : await (await fetch(a.uri)).arrayBuffer();
      if (body.byteLength > AVATAR_MAX_BYTES) { setErr("Escolha uma imagem até 2 MB."); return; }
      setBusy(true); setErr(""); setMsg("");
      const r = await uploadAvatar(supabase(), uid, body, "perfil." + (type.split("/")[1] ?? "jpg"), type); setBusy(false);
      if (r.error) setErr(friendlyError(r.error)); else { setAvatar(r.data); setMsg("Fotografia atualizada."); }
    }} />
    <Text style={ui.text}>Sessão iniciada como {email}</Text>
    <View style={{ gap: 8 }}>
      <Button title="📋 Os meus anúncios" variant="secondary" onPress={() => router.push("/meus-anuncios" as any)} />
      <Button title="🧰 Perfil profissional" variant="secondary" onPress={() => router.push("/conta/profissional" as any)} />
      <Button title="🏪 As minhas empresas" variant="secondary" onPress={() => router.push("/conta/empresas" as any)} />
      <Button title="🛍️ Os meus produtos" variant="secondary" onPress={() => router.push("/conta/produtos" as any)} />
      <Button title="💳 O meu plano" variant="secondary" onPress={() => router.push("/conta/plano" as any)} />
      <Button title="💸 Comissões" variant="secondary" onPress={() => router.push("/conta/comissoes" as any)} />
      <Button title="💰 O meu saldo" variant="secondary" onPress={() => router.push("/conta/saldo" as any)} />
      <Button title="📦 Encomendas" variant="secondary" onPress={() => router.push("/encomendas" as any)} />
      <Button title="↩️ Devoluções e reembolsos" variant="secondary" onPress={() => router.push("/disputas" as any)} />
      <Button title="🛠️ Pedidos de serviço" variant="secondary" onPress={() => router.push("/servicos" as any)} />
      <Button title="💬 As minhas propostas" variant="secondary" onPress={() => router.push("/propostas" as any)} />
      <Button title="🔨 As minhas licitações" variant="secondary" onPress={() => router.push("/licitacoes" as any)} />
      <Button title="⭐ Avaliações" variant="secondary" onPress={() => router.push("/avaliacoes" as any)} />
      <Button title="✔ Verificar perfil" variant="secondary" onPress={() => router.push("/conta/verificacao" as any)} />
      <Button title="❓ Ajuda" variant="secondary" onPress={() => router.push("/ajuda" as any)} />
      <Button title="📄 Termos e Privacidade" variant="secondary" onPress={() => router.push("/privacidade" as any)} />
      <Button title="📅 Alugueres" variant="secondary" onPress={() => router.push("/alugueres" as any)} />
      <Button title="🛵 Ser estafeta / Entregas" variant="secondary" onPress={() => router.push("/entregas" as any)} />
      <Button title="⭐ Guardados" variant="secondary" onPress={() => router.push("/guardados")} />
      <Button title="🕘 Vistos recentemente" variant="secondary" onPress={() => router.push("/historico" as any)} />
      <Button title="💬 Mensagens" variant="secondary" onPress={() => router.push("/mensagens")} />
      <Button title="🔔 Notificações" variant="secondary" onPress={() => router.push("/notificacoes")} />
      {isStaff && <Button title="🛡️ Administração" onPress={() => router.push("/admin" as any)} />}
    </View>
    <ThemePicker />
    {!!uid && <WhatsAppSettings uid={uid} />}
    <Message error={err} ok={msg} />
    {form && <View style={ui.card}>
      <Text style={ui.h2}>Dados pessoais</Text>
      <Text style={ui.label}>Nome</Text><TextInput style={ui.input} value={form.fullName} onChangeText={v => setForm({ ...form, fullName: v })} />
      <Text style={ui.label}>Telefone</Text><TextInput style={ui.input} keyboardType="phone-pad" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} />
      <Text style={ui.label}>Município</Text><TextInput style={ui.input} value={form.municipality} onChangeText={v => setForm({ ...form, municipality: v })} />
      <Button title="Guardar alterações" disabled={busy} onPress={() => void run(() => updateCurrentUserProfile(supabase(), form), "Perfil atualizado.")} />
    </View>}
    <View style={ui.card}>
      <Text style={ui.h2}>Segurança</Text>
      <Text style={ui.label}>Nova palavra-passe</Text><TextInput style={ui.input} secureTextEntry value={pw} onChangeText={setPw} />
      <Text style={ui.label}>Confirmar palavra-passe</Text><TextInput style={ui.input} secureTextEntry value={pw2} onChangeText={setPw2} />
      <Button title="Alterar palavra-passe" disabled={busy} onPress={async () => { if (await run(() => changeCurrentUserPassword(supabase(), pw, pw2), "Palavra-passe alterada com sucesso.")) { setPw(""); setPw2(""); } }} />
    </View>
    <View style={ui.card}>
      <Text style={ui.h2}>Privacidade</Text>
      <Text style={ui.text}>Eliminar a conta remove permanentemente os seus dados.</Text>
      <TextInput style={ui.input} value={del} onChangeText={setDel} placeholder="Escreva ELIMINAR para confirmar" />
      <Button title={busy ? "A eliminar…" : "Eliminar a minha conta"} variant="danger" disabled={busy} onPress={async () => { if (await run(() => deleteCurrentUserAccount(supabase(), del), "Conta eliminada.")) router.replace("/"); }} />
    </View>
    <Button title="Terminar sessão" variant="secondary" onPress={async () => { await signOutCurrentUser(supabase()); router.replace("/login"); }} />
  </ScrollView>;
}
