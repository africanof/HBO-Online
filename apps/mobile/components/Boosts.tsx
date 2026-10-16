import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Text, TextInput, View } from "react-native";
import { requestBoost, boostStateFor, boostOfferText, boostRef, listBoostsForAdmin, decideBoost, paymentProofUrl, uploadPaymentProof, base64ToArrayBuffer,
  formatPrice, friendlyErrorIn, PLAN_METHOD_LABELS, BOOST_STATUS_LABELS, type MyBoost, type AdminBoost, type BoostStatus, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";
import { useT, formatDateTimeIn, formatDayIn } from "../lib/i18n";

/** «⭐ Destacar» num anúncio publicado (Os meus anúncios). */
export function BoostBox({ listing, uid, boosts, settings, onDone }: { listing: { id: string; title: string; status: string }; uid: string; boosts: MyBoost[]; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const { t, tc, lang } = useT(); const day = (iso: string) => formatDayIn(Date.parse(iso), lang);
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const state = boostStateFor(listing.id, boosts);
  if (listing.status !== "published" && state.kind !== "active") return null;
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? t("ls.cm.perm_camera") : t("ls.photo.perm_gallery")); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function send() {
    if (!reference.trim() && !proof) { setError(t("ls.boost.need_ref")); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error(t("ls.boost.proof_failed")); path = up.data;
      }
      const r = await requestBoost(supabase(), listing.id, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      setOpen(false); onDone(t("ls.boost.sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {state.kind === "active" && <Text style={ui.ok}>{t("ls.boost.active_until", { date: day(state.until) })}</Text>}
    {state.kind === "pending" && <Text style={ui.text}>{t("ls.boost.pending")}</Text>}
    {state.kind === "rejected" && <Text style={ui.error}>{t("ls.boost.rejected")}{state.note ? ": " + state.note : ""}</Text>}
    {listing.status === "published" && state.kind !== "pending" && (open ? <View style={[ui.card, { gap: 10 }]}>
      <Text style={ui.label}>{tc(boostOfferText(settings))}{state.kind === "active" ? " — " + t("ls.boost.add_days") : ""}</Text>
      <Text style={ui.text}>{t("ls.boost.explain")}</Text>
      <Text style={ui.label}>{t("ls.boost.step1")}</Text>
      <PaymentDetails s={settings} />
      <Text style={ui.label}>{t("ls.boost.step2")}</Text>
      <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: tc(PLAN_METHOD_LABELS[k]) }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder={t("ls.boost.ref_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("ls.boost.ref")} />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel={t("ls.boost.proof")} /><Button title={t("ls.boost.remove_proof")} variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title={t("ls.boost.shoot_proof")} variant="secondary" onPress={() => void pick(true)} /><Button title={t("ls.boost.gallery")} variant="secondary" onPress={() => void pick(false)} /></View>}
      <Message error={error} />
      <Button title={busy ? t("ls.sending") : t("ls.boost.send")} disabled={busy} onPress={() => void send()} />
      <Button title={t("common.cancel")} variant="secondary" onPress={() => setOpen(false)} />
    </View> : <Button title={state.kind === "active" ? t("ls.boost.extend") : tc(boostOfferText(settings))} variant="secondary" onPress={() => setOpen(true)} />)}
  </View>;
}

/** Administração: pedidos de destaque. */
export function AdminBoosts() {
  const { t, tc, lang } = useT(); const day = (iso: string) => formatDayIn(Date.parse(iso), lang);
  const [items, setItems] = useState<AdminBoost[]>([]); const [status, setStatus] = useState<BoostStatus>("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  async function load() { const r = await listBoostsForAdmin(supabase(), status); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(b: AdminBoost, ok: boolean) {
    if (!ok && !note.trim()) { setError(t("ls.boost.why_needed")); return; }
    const r = await decideBoost(supabase(), b.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("ls.boost.activated") : t("ls.rent.declined")); setReject(null); setNote(""); await load(); }
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>{t("ls.boost.admin_title")}</Text>
    <Message error={error} ok={notice} />
    <Chips options={(["pending", "active", "rejected", "expired"] as BoostStatus[]).map(k => ({ value: k, label: tc(BOOST_STATUS_LABELS[k]) }))} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>{t("ls.boost.none")}</Text>}
    {items.map(b => <View key={b.id} style={ui.card}>
      <Text style={ui.h2}>{tc(boostRef(b.ref_no))} · {formatPrice(b.amount)} · {t("ls.form.days", { n: b.days })}</Text>
      <Text style={ui.text}>{b.listing_title} · {b.owner_name}{b.phone ? " · " + b.phone : ""}</Text>
      <Text style={ui.muted}>{b.method ? tc(PLAN_METHOD_LABELS[b.method]) : ""}{b.reference ? " · " + t("ls.boost.ref_short", { ref: b.reference }) : ""} · {formatDateTimeIn(b.created_at, lang)}</Text>
      {!!b.ends_at && <Text style={ui.muted}>{t("ls.boost.until", { date: day(b.ends_at) })}</Text>}
      {!!b.proof_path && <Button title={"📄 " + t("ls.boost.proof")} variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), b.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyErrorIn(r.error, lang)); }} />}
      {b.status === "pending" && (reject === b.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder={t("ls.boost.why_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("ls.bh.reason")} />
        <Button title={t("ls.boost.not_received")} variant="danger" onPress={() => void decide(b, false)} />
        <Button title={t("common.back")} variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title={t("ls.boost.confirm_btn")} onPress={() => Alert.alert(t("ls.boost.confirm_title"), t("ls.boost.confirm_q", { amount: formatPrice(b.amount), name: b.owner_name }), [{ text: t("ls.no"), style: "cancel" }, { text: t("common.confirm"), onPress: () => void decide(b, true) }])} />
        <Button title={t("ls.boost.not_received")} variant="secondary" onPress={() => { setReject(b.id); setNote(""); }} />
      </>)}
    </View>)}
  </View>;
}
