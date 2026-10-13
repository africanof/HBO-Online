import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Linking, Share, Switch, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { findSaved, toggleSaved, recordView, shareMessage, whatsappShareUrl, sellerWhatsappMessage, getSellerWhatsapp, getMyWhatsapp, setMyWhatsapp, formatWhatsapp, whatsappLink,
  getFollowInfo, toggleFollow, followersText, followButtonLabel, type FollowKind,
  friendlyError, type SavedKind, type KeyValueStore, type ShareExtra } from "@huambo-online/core";
import { supabase, siteUrl, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";

export const deviceStore: KeyValueStore = { getItem: k => AsyncStorage.getItem(k), setItem: (k, v) => AsyncStorage.setItem(k, v) };

export function useRecordView(kind: SavedKind, id: string | undefined, title: string | undefined, image?: string | null) {
  useEffect(() => { if (id && title) void recordView(deviceStore, { kind, id, title, image: image ?? null }); }, [kind, id, title, image]);
}

export function SaveButton({ kind, id }: { kind: SavedKind; id: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null); const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    const c = supabase(); const u = await c.auth.getUser(); const me = u.data.user?.id ?? null; setUid(me);
    if (me) { const r = await findSaved(c, me, kind, id); setSavedId((r.data as any)?.id ?? null); }
  })(); }, [kind, id]);
  async function press() {
    if (!uid) { router.push("/login"); return; }
    setBusy(true); setError("");
    const r = await toggleSaved(supabase(), uid, kind, id, savedId); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setSavedId(r.data);
  }
  return <>
    <Button title={savedId ? "★ Guardado" : "☆ Guardar"} variant="secondary" disabled={busy} onPress={() => void press()} />
    {!!error && <Text style={ui.error}>{error}</Text>}
  </>;
}

export function ShareButton({ kind, id, title, extra }: { kind: SavedKind; id: string; title: string; extra?: ShareExtra }) {
  const { url, text } = shareMessage(siteUrl, kind, id, title, extra);
  return <>
    <Button title="🔗 Partilhar" variant="secondary" onPress={() => void Share.share({ message: text, url: url || undefined, title })} />
    <Button title="📲 Partilhar no WhatsApp" variant="secondary" onPress={() => void Linking.openURL(whatsappShareUrl(text))} />
  </>;
}

/** «Falar no WhatsApp» com o vendedor: só aparece se ele escolheu mostrar o número e para quem tem sessão iniciada. */
export function SellerWhatsApp({ sellerId, kind, id, title, refCode }: { sellerId: string; kind: "listing" | "product"; id: string; title: string; refCode?: string | null }) {
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => { void getSellerWhatsapp(supabase(), sellerId).then(setNumber); }, [sellerId]);
  if (!number) return null;
  const href = whatsappLink(number, sellerWhatsappMessage(kind, title, refCode, shareMessage(siteUrl, kind, id, title).url));
  return href ? <Button title="💬 Falar no WhatsApp" variant="secondary" onPress={() => void Linking.openURL(href)} /> : null;
}

/** «A sua conta»: número de WhatsApp e se aparece nos anúncios e produtos. */
export function WhatsAppSettings({ uid }: { uid: string }) {
  const [number, setNumber] = useState(""); const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { void getMyWhatsapp(supabase(), uid).then(r => { setNumber(formatWhatsapp(r.data?.whatsapp)); setVisible(!!r.data?.whatsapp_public); }); }, [uid]);
  async function save() {
    setBusy(true); setMsg(""); setErr("");
    const r = await setMyWhatsapp(supabase(), number, visible); setBusy(false);
    if (r.error) setErr(friendlyError(r.error)); else setMsg(!number.trim() ? "Número de WhatsApp apagado." : visible ? "Guardado. O botão «Falar no WhatsApp» aparece nos seus anúncios e produtos." : "Guardado. O número fica escondido.");
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>💬 WhatsApp</Text>
    <Text style={ui.text}>Os compradores podem falar consigo pelo WhatsApp, além das mensagens do Huambo Online.</Text>
    <Text style={ui.label}>Número de WhatsApp</Text>
    <TextInput style={ui.input} keyboardType="phone-pad" value={number} onChangeText={setNumber} placeholder="923 000 000" placeholderTextColor={C.muted} accessibilityLabel="Número de WhatsApp" />
    <View style={[ui.row, { alignItems: "center" }]}>
      <Switch value={visible} onValueChange={setVisible} accessibilityLabel="Mostrar o botão «Falar no WhatsApp» nos meus anúncios e produtos" />
      <Text style={[ui.text, { flex: 1 }]}>Mostrar o botão «Falar no WhatsApp» nos meus anúncios e produtos</Text>
    </View>
    <Text style={ui.muted}>Só quem tem sessão iniciada vê o seu número. Pode esconder ou apagar quando quiser.</Text>
    <Message error={err} ok={msg} />
    <Button title="Guardar WhatsApp" disabled={busy} onPress={() => void save()} />
  </View>;
}

/** «➕ Seguir» / «✔ A seguir», com o número de seguidores. Sem sessão, leva a entrar. */
export function FollowButton({ kind, id, mine = false }: { kind: FollowKind; id: string; mine?: boolean }) {
  const router = useRouter();
  const [info, setInfo] = useState<{ followers: number; following: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { void getFollowInfo(supabase(), kind, id).then(r => setInfo(r.data)); }, [kind, id]);
  async function press() {
    if (!(await currentUserId())) { router.push("/login"); return; }
    setBusy(true); setErr("");
    const r = await toggleFollow(supabase(), kind, id); setBusy(false);
    if (r.error) { setErr(friendlyError(r.error)); return; }
    setInfo(i => ({ following: !!r.data, followers: Math.max(0, (i?.followers ?? 0) + (r.data ? 1 : -1)) }));
  }
  if (!info) return null;
  return <>
    {mine ? <Text style={ui.muted}>👥 {followersText(info.followers)}</Text>
      : <Button title={`${followButtonLabel(info.following)} · ${followersText(info.followers)}`} variant={info.following ? "secondary" : "primary"} disabled={busy} onPress={() => void press()} />}
    {!!err && <Text style={ui.error}>{err}</Text>}
  </>;
}
