import { useCallback, useState } from "react";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScrollView, Text, TextInput, View } from "react-native";
import { listMyVerificationsV2, requestVerification, uploadVerificationDocument, validateDocument, listMyBusinesses, getProvider, friendlyErrorIn,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, LANG_TAGS, type MyVerificationV2, type VerificationKind } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { ui } from "../../lib/ui";
import { Button, Chips, Message } from "../../components/Ui";
import { VerifiedTag } from "../../components/Reputation";
import { IdentityCapture } from "../../components/IdentityCapture";
import { useT } from "../../lib/i18n";

export default function Verificacao() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyVerificationV2[]>([]); const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]); const [isProvider, setIsProvider] = useState(false);
  const [kind, setKind] = useState<VerificationKind>("identity"); const [businessId, setBusinessId] = useState("");
  const [doc, setDoc] = useState<{ uri: string; name: string; type: string; size?: number | null } | null>(null); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  async function load(id: string) {
    const c = supabase();
    const [v, b, p] = await Promise.all([listMyVerificationsV2(c), listMyBusinesses(c, id), getProvider(c, id)]);
    setItems(v.data); setBusinesses(((b.data as any[]) ?? []).map(x => ({ id: x.id, name: x.name }))); setIsProvider(!!p.data);
  }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []));

  async function pick(camera: boolean) {
    setError("");
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? t("sv.ver_camera_perm") : t("sv.gallery_perm")); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const type = a.mimeType || "image/jpeg";
    const invalid = validateDocument({ size: a.fileSize ?? null, type }); if (invalid) { setError(tc(invalid)); return; }
    setDoc({ uri: a.uri, name: a.fileName || "documento.jpg", type, size: a.fileSize });
  }
  async function send() {
    if (!uid) return;
    if (!doc) { setError(t("sv.ver_need_doc")); return; }
    if (kind === "business" && !businessId) { setError(t("sv.ver_need_biz")); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const c = supabase();
      const body = await (await fetch(doc.uri)).arrayBuffer();
      const up = await uploadVerificationDocument(c, uid, body, doc.name, doc.type);
      if (up.error || !up.data) throw up.error ?? new Error(t("sv.ver_doc_fail"));
      const r = await requestVerification(c, kind, up.data, { businessId: kind === "business" ? businessId : undefined, note });
      if (r.error) throw r.error;
      setNotice(t("sv.ver_sent")); setDoc(null); setNote(""); await load(uid);
    } catch (e) { setError(friendlyErrorIn(e, lang, t("sv.ver_fail"))); }
    finally { setBusy(false); }
  }

  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.ver_title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  const identity = items.find(v => v.kind === "identity" && v.status === "approved") ?? items.find(v => v.kind === "identity" && v.status === "pending");
  const kinds: VerificationKind[] = ["identity", ...(isProvider ? ["provider" as const] : []), ...(businesses.length ? ["business" as const] : [])];
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back")}</Link>
    <Text style={ui.h1}>{t("sv.ver_title_icon")}</Text>
    <Text style={ui.text}>{t("sv.ver_intro")}</Text>
    <Text style={ui.muted}>{t("sv.ver_private")}</Text>
    <View style={ui.card}>
      <Text style={ui.label}>{t("sv.ver_what")}</Text>
      <Chips options={kinds.map(k => ({ value: k, label: tc(VERIFICATION_KIND_LABELS[k]) }))} value={kind} onChange={setKind} />
      {kind === "identity" ? (identity ? <View style={{ gap: 6 }}>
        {identity.status === "approved" ? <VerifiedTag text={t("sv.ver_identity_ok")} /> : <Text style={ui.h2}>{t("sv.ver_waiting")}</Text>}
        <Text style={ui.text}>{identity.status === "approved" ? t("sv.ver_identity_done") : t("sv.ver_identity_pending")}</Text>
        {!!identity.id_number_hint && <Text style={ui.muted}>{t("sv.ver_id_hint", { hint: identity.id_number_hint })}</Text>}
      </View> : <IdentityCapture userId={uid} onSent={() => { setNotice(t("sv.ver_sent")); void load(uid); }} />)
      : <>
      {kind === "business" && <><Text style={ui.label}>{t("sv.business")}</Text><Chips options={businesses.map(b => ({ value: b.id, label: b.name }))} value={businessId} onChange={setBusinessId} /></>}
      <Text style={ui.label}>{kind === "business" ? t("sv.ver_biz_doc") : t("sv.ver_id_doc")}</Text>
      <Button title={t("sv.ver_photo_doc")} variant="secondary" onPress={() => void pick(true)} />
      <Button title={t("sv.choose_gallery")} variant="secondary" onPress={() => void pick(false)} />
      {!!doc && <Text style={ui.ok}>{t("sv.ver_doc_chosen")}</Text>}
      <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("sv.ver_note_ph")} />
      <Message error={error} ok={notice} />
      <Button title={busy ? t("sv.sending") : t("sv.ver_send")} disabled={busy} onPress={() => void send()} />
      </>}
      {kind === "identity" && <Message ok={notice} />}
    </View>
    <Text style={ui.h2}>{t("sv.ver_mine")}</Text>
    {items.length === 0 && <Text style={ui.text}>{t("sv.ver_none")}</Text>}
    {items.map(v => <View key={v.id} style={ui.card}>
      <Text style={ui.label}>{tc(VERIFICATION_KIND_LABELS[v.kind])}{v.business_name ? " — " + v.business_name : ""}</Text>
      {v.status === "approved" ? <VerifiedTag text={tc(VERIFICATION_STATUS_LABELS[v.status])} /> : <Text style={ui.text}>{tc(VERIFICATION_STATUS_LABELS[v.status])}</Text>}
      {!!v.id_number_hint && <Text style={ui.muted}>{t("sv.ver_id_hint", { hint: v.id_number_hint })}</Text>}
      {!!v.admin_note && <Text style={ui.text}>{t("sv.admin_note", { note: v.admin_note })}</Text>}
      <Text style={ui.muted}>{new Date(v.created_at).toLocaleDateString(LANG_TAGS[lang])}</Text>
    </View>)}
  </ScrollView>;
}
