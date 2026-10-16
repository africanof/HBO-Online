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
import { DataSaverPicker } from "../components/DataSaver";
import { LanguagePicker } from "../components/LanguagePicker";
import { useT } from "../lib/i18n";

export default function Conta() {
  const router = useRouter(); const { t } = useT();
  // Atalhos da conta: [texto, endereço].
  const menu: [string, string][] = [
    ["📋 " + t("more.my_listings"), "/meus-anuncios"], [t("account.pro_profile"), "/conta/profissional"], [t("account.businesses"), "/conta/empresas"],
    [t("account.products"), "/conta/produtos"], [t("account.plan"), "/conta/plano"], [t("account.commissions"), "/conta/comissoes"], [t("account.balance"), "/conta/saldo"],
    [t("account.stats"), "/conta/estatisticas"], ["🤝 " + t("more.agent"), "/agente"], [t("account.tickets"), "/bilhetes"], [t("account.fuel_bookings"), "/combustivel/pedidos"],
    [t("account.fuel_stations"), "/combustivel/meus"], ["🎬 " + t("more.videos"), "/videos/meus"], [t("account.events"), "/eventos/meus"], ["🎁 " + t("more.invite"), "/convidar"],
    ["📦 " + t("more.orders"), "/encomendas"], [t("account.returns"), "/disputas"], [t("account.service_requests"), "/servicos"], [t("account.offers"), "/propostas"],
    [t("account.bids"), "/licitacoes"], [t("account.reviews"), "/avaliacoes"], [t("account.verify"), "/conta/verificacao"], [t("account.two_step"), "/conta/seguranca"],
    [t("account.inspected"), "/inspecao"], ["❓ " + t("nav.help"), "/ajuda"], ["🛡️ " + t("more.safety"), "/seguranca"], [t("account.terms"), "/privacidade"],
    [t("account.rentals"), "/alugueres"], [t("account.courier"), "/entregas"], ["⭐ " + t("nav.saved"), "/guardados"], ["👥 " + t("more.following"), "/seguindo"],
    ["🕘 " + t("more.recent"), "/historico"], ["💬 " + t("nav.messages"), "/mensagens"], ["🔔 " + t("nav.notifications"), "/notificacoes"]
  ];
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

  if (!loaded) return <View style={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></View>;
  if (!email) return <ScrollView contentContainerStyle={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.h1}>{t("account.title")}</Text><Text style={ui.text}>{t("account.sign_in_hint")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /><Button title={t("auth.signup")} variant="secondary" onPress={() => router.push("/criar-conta")} /><LanguagePicker /><ThemePicker /><DataSaverPicker /></ScrollView>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{t("account.title")}</Text>
    {avatar ? <Image source={{ uri: avatar }} style={{ width: 96, height: 96, borderRadius: 48 }} accessibilityLabel={t("account.photo")} /> : <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.placeholder }} />}
    <Button title={t("account.change_photo")} variant="secondary" disabled={busy} onPress={async () => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setErr(t("account.photo_permission")); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (res.canceled) return;
      const a = await shrinkAsset(res.assets[0], AVATAR_MAX_SIDE); // fotografia de perfil pequena (512 px)
      const type = a.mimeType;
      const body = a.base64 ? base64ToArrayBuffer(a.base64) : await (await fetch(a.uri)).arrayBuffer();
      if (body.byteLength > AVATAR_MAX_BYTES) { setErr(t("account.photo_too_big")); return; }
      setBusy(true); setErr(""); setMsg("");
      const r = await uploadAvatar(supabase(), uid, body, "perfil." + (type.split("/")[1] ?? "jpg"), type); setBusy(false);
      if (r.error) setErr(friendlyError(r.error)); else { setAvatar(r.data); setMsg(t("account.photo_ok")); }
    }} />
    <Text style={ui.text}>{t("account.signed_in_as", { email })}</Text>
    <View style={{ gap: 8 }}>
      {menu.map(([label, href]) => <Button key={href} title={label} variant="secondary" onPress={() => router.push(href as any)} />)}
      {isStaff && <Button title={"🛡️ " + t("nav.admin")} onPress={() => router.push("/admin" as any)} />}
    </View>
    <LanguagePicker />
    <ThemePicker />
    <DataSaverPicker />
    {!!uid && <WhatsAppSettings uid={uid} />}
    <Message error={err} ok={msg} />
    {form && <View style={ui.card}>
      <Text style={ui.h2}>{t("account.personal")}</Text>
      <Text style={ui.label}>{t("account.name")}</Text><TextInput accessibilityLabel={t("account.name")} style={ui.input} value={form.fullName} onChangeText={v => setForm({ ...form, fullName: v })} />
      <Text style={ui.label}>{t("auth.phone")}</Text><TextInput accessibilityLabel={t("auth.phone")} style={ui.input} keyboardType="phone-pad" value={form.phone} onChangeText={v => setForm({ ...form, phone: v })} />
      <Text style={ui.label}>{t("auth.municipality")}</Text><TextInput accessibilityLabel={t("auth.municipality")} style={ui.input} value={form.municipality} onChangeText={v => setForm({ ...form, municipality: v })} />
      <Button title={t("account.save_changes")} disabled={busy} onPress={() => void run(() => updateCurrentUserProfile(supabase(), form), t("account.profile_ok"))} />
    </View>}
    <View style={ui.card}>
      <Text style={ui.h2}>{t("account.security")}</Text>
      <Text style={ui.label}>{t("recover.title")}</Text><TextInput accessibilityLabel={t("recover.title")} style={ui.input} secureTextEntry value={pw} onChangeText={setPw} />
      <Text style={ui.label}>{t("auth.password_confirm")}</Text><TextInput accessibilityLabel={t("auth.password_confirm")} style={ui.input} secureTextEntry value={pw2} onChangeText={setPw2} />
      <Button title={t("account.change_password")} disabled={busy} onPress={async () => { if (await run(() => changeCurrentUserPassword(supabase(), pw, pw2), t("account.password_ok"))) { setPw(""); setPw2(""); } }} />
    </View>
    <View style={ui.card}>
      <Text style={ui.h2}>{t("account.privacy")}</Text>
      <Text style={ui.text}>{t("account.delete_text")}</Text>
      <TextInput style={ui.input} value={del} onChangeText={setDel} placeholder={t("account.delete_placeholder")} placeholderTextColor={C.muted} accessibilityLabel={t("account.delete_placeholder")} />
      <Button title={busy ? t("account.deleting") : t("account.delete")} variant="danger" disabled={busy} onPress={async () => { if (await run(() => deleteCurrentUserAccount(supabase(), del), t("account.deleted"))) router.replace("/"); }} />
    </View>
    <Button title={t("account.sign_out")} variant="secondary" onPress={async () => { await signOutCurrentUser(supabase()); router.replace("/login"); }} />
  </ScrollView>;
}
