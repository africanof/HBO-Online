import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Linking, Pressable, Share, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTeamWhatsapp, setTeamWhatsapp, teamWhatsappMessage, teamWhatsappRequestMessage, teamWhatsappLink, findSaved, toggleSaved, recordView, shareMessage, whatsappShareUrl, sellerWhatsappMessage, getSellerWhatsapp, getMyWhatsapp, setMyWhatsapp, formatWhatsapp, whatsappLink,
  getFollowInfo, toggleFollow, recordItemView, recordItemEvent, followersText, followButtonLabel, type FollowKind,
  friendlyErrorIn, type SavedKind, type KeyValueStore, type ShareExtra } from "@huambo-online/core";
import { supabase, siteUrl, currentUserId } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Message } from "./Ui";
import { useT } from "../lib/i18n";

export const deviceStore: KeyValueStore = { getItem: k => AsyncStorage.getItem(k), setItem: (k, v) => AsyncStorage.setItem(k, v) };

export function useRecordView(kind: SavedKind, id: string | undefined, title: string | undefined, image?: string | null) {
  useEffect(() => { if (id && title) void recordView(deviceStore, { kind, id, title, image: image ?? null }); }, [kind, id, title, image]);
  useEffect(() => { if (id && title) void recordItemView(supabase(), deviceStore, kind, id); }, [kind, id, !!title]);
}

export function SaveButton({ kind, id }: { kind: SavedKind; id: string }) {
  const router = useRouter(); const { t, lang } = useT();
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
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setSavedId(r.data);
  }
  return <>
    <Button title={savedId ? t("ls.detail.saved") : t("ls.engage.save")} variant="secondary" disabled={busy} onPress={() => void press()} />
    {!!error && <Text style={ui.error}>{error}</Text>}
  </>;
}

export function ShareButton({ kind, id, title, extra }: { kind: SavedKind; id: string; title: string; extra?: ShareExtra }) {
  const { t, tc } = useT();
  const { url, text: raw } = shareMessage(siteUrl, kind, id, title, extra); const text = tc(raw);
  return <>
    <Button title={"🔗 " + t("common.share")} variant="secondary" onPress={() => { void recordItemEvent(supabase(), kind, id, "share"); void Share.share({ message: text, url: url || undefined, title }); }} />
    <Button title={t("ls.engage.share_wa")} variant="secondary" onPress={() => { void recordItemEvent(supabase(), kind, id, "share"); void Linking.openURL(whatsappShareUrl(text)); }} />
  </>;
}

/** «Falar no WhatsApp» com o vendedor: só aparece à equipa (administração e moderadores). */
export function SellerWhatsApp({ sellerId, kind, id, title, refCode }: { sellerId: string; kind: "listing" | "product"; id: string; title: string; refCode?: string | null }) {
  const { t, tc } = useT();
  // O vendedor só é devolvido à equipa; os outros falam com o WhatsApp oficial da equipa.
  const [seller, setSeller] = useState<string | null>(null); const [team, setTeam] = useState<string | null>(null);
  useEffect(() => { void getSellerWhatsapp(supabase(), sellerId).then(setSeller); void getTeamWhatsapp(supabase()).then(setTeam); }, [sellerId]);
  const url = shareMessage(siteUrl, kind, id, title).url;
  if (seller) {
    const href = whatsappLink(seller, tc(sellerWhatsappMessage(kind, title, refCode, url)));
    return href ? <Button title={t("wa.seller_staff")} variant="secondary" onPress={() => void Linking.openURL(href)} /> : null;
  }
  const href = teamWhatsappLink(team, teamWhatsappMessage(kind, title, refCode, url));
  if (!href) return null;
  return <View style={{ gap: 4 }}>
    <Pressable accessibilityRole="button" onPress={() => { void recordItemEvent(supabase(), kind, id, "whatsapp"); void Linking.openURL(href); }}
      style={{ backgroundColor: "#25D366", borderRadius: 14, minHeight: 52, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
      <Text style={{ color: "#08321A", fontSize: 18, fontWeight: "800" }}>{t("wa.team_btn")}</Text>
    </Pressable>
    <Text style={ui.muted}>{t("wa.team_hint")}</Text>
  </View>;
}

/** «💬 Falar deste pedido no WhatsApp» (com o pedido e a ligação direta). */
export function RequestWhatsApp({ what, refNo, path }: { what: string; refNo?: number | null; path?: string | null }) {
  const { t } = useT();
  const [team, setTeam] = useState<string | null>(null);
  useEffect(() => { void getTeamWhatsapp(supabase()).then(setTeam); }, []);
  const href = teamWhatsappLink(team, teamWhatsappRequestMessage(what, refNo, path ? siteUrl.replace(/\/$/, "") + path : null));
  return href ? <Text accessibilityRole="link" onPress={() => void Linking.openURL(href)} style={[ui.text, { color: "#128C7E", fontWeight: "700" }]}>{t("wa.team_req")}</Text> : null;
}

/** Administração: número oficial de WhatsApp da equipa. */
export function TeamWhatsappSettings() {
  const { lang, t } = useT();
  const [number, setNumber] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { void getTeamWhatsapp(supabase()).then(n => setNumber(formatWhatsapp(n))); }, []);
  async function save() {
    setBusy(true); setMsg(""); setErr("");
    const r = await setTeamWhatsapp(supabase(), number); setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setMsg(number.trim() ? t("wa.team_saved") : t("wa.team_deleted")); setNumber(formatWhatsapp(r.data as string | null)); }
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{t("wa.team_title")}</Text>
    <Text style={ui.text}>{t("wa.team_text")}</Text>
    <Text style={ui.label}>{t("wa.number")}</Text>
    <TextInput style={ui.input} keyboardType="phone-pad" value={number} onChangeText={setNumber} placeholder="923 000 000" placeholderTextColor={C.muted} accessibilityLabel={t("wa.number")} />
    <Message error={err} ok={msg} />
    <Button title={t("wa.save")} disabled={busy} onPress={() => void save()} />
  </View>;
}

/** «A sua conta»: número de WhatsApp (só a equipa o vê). */
export function WhatsAppSettings({ uid }: { uid: string }) {
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState(""); const { t, lang } = useT();
  useEffect(() => { void getMyWhatsapp(supabase(), uid).then(r => setNumber(formatWhatsapp(r.data?.whatsapp))); }, [uid]);
  async function save() {
    setBusy(true); setMsg(""); setErr("");
    const r = await setMyWhatsapp(supabase(), number, false); setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setMsg(!number.trim() ? t("wa.deleted") : t("wa.saved_public"));
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>💬 WhatsApp</Text>
    <Text style={ui.text}>{t("wa.text")}</Text>
    <Text style={ui.label}>{t("wa.number")}</Text>
    <TextInput style={ui.input} keyboardType="phone-pad" value={number} onChangeText={setNumber} placeholder="923 000 000" placeholderTextColor={C.muted} accessibilityLabel={t("wa.number")} />
    <Text style={ui.muted}>{t("wa.privacy")}</Text>
    <Message error={err} ok={msg} />
    <Button title={t("wa.save")} disabled={busy} onPress={() => void save()} />
  </View>;
}

/** «➕ Seguir» / «✔ A seguir», com o número de seguidores. Sem sessão, leva a entrar. */
export function FollowButton({ kind, id, mine = false }: { kind: FollowKind; id: string; mine?: boolean }) {
  const router = useRouter(); const { tc, lang } = useT();
  const [info, setInfo] = useState<{ followers: number; following: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { void getFollowInfo(supabase(), kind, id).then(r => setInfo(r.data)); }, [kind, id]);
  async function press() {
    if (!(await currentUserId())) { router.push("/login"); return; }
    setBusy(true); setErr("");
    const r = await toggleFollow(supabase(), kind, id); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setInfo(i => ({ following: !!r.data, followers: Math.max(0, (i?.followers ?? 0) + (r.data ? 1 : -1)) }));
  }
  if (!info) return null;
  return <>
    {mine ? <Text style={ui.muted}>👥 {tc(followersText(info.followers))}</Text>
      : <Button title={`${tc(followButtonLabel(info.following))} · ${tc(followersText(info.followers))}`} variant={info.following ? "secondary" : "primary"} disabled={busy} onPress={() => void press()} />}
    {!!err && <Text style={ui.error}>{err}</Text>}
  </>;
}
