import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Text, TextInput, View } from "react-native";
import { requestBoost, boostStateFor, boostOfferText, formatDate, boostRef, listBoostsForAdmin, decideBoost, paymentProofUrl, uploadPaymentProof, base64ToArrayBuffer,
  formatPrice, friendlyError, PLAN_METHOD_LABELS, BOOST_STATUS_LABELS, type MyBoost, type AdminBoost, type BoostStatus, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { PaymentDetails } from "./Plans";

/** «⭐ Destacar» num anúncio publicado (Os meus anúncios). */
export function BoostBox({ listing, uid, boosts, settings, onDone }: { listing: { id: string; title: string; status: string }; uid: string; boosts: MyBoost[]; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [proof, setProof] = useState<{ uri: string; base64?: string | null; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const state = boostStateFor(listing.id, boosts);
  if (listing.status !== "published" && state.kind !== "active") return null;
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? "Autorize a câmara." : "Autorize o acesso à galeria."); return; }
    const r = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!r.canceled && r.assets?.[0]) setProof(await shrinkAsset(r.assets[0]));
  }
  async function send() {
    if (!reference.trim() && !proof) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    setBusy(true); setError("");
    try {
      let path: string | null = null;
      if (proof) {
        const body = proof.base64 ? base64ToArrayBuffer(proof.base64) : await (await fetch(proof.uri)).arrayBuffer();
        const up = await uploadPaymentProof(supabase(), uid, body, "comprovativo.jpg", proof.mimeType || "image/jpeg");
        if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); path = up.data;
      }
      const r = await requestBoost(supabase(), listing.id, { method, reference, proofPath: path });
      if (r.error) throw r.error;
      setOpen(false); onDone("Pedido de destaque enviado. Fica ativo quando a administração confirmar o pagamento.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <View style={{ gap: 8 }}>
    {state.kind === "active" && <Text style={ui.ok}>⭐ Em destaque até {formatDate(state.until)}</Text>}
    {state.kind === "pending" && <Text style={ui.text}>⏳ Destaque: pagamento à espera de confirmação.</Text>}
    {state.kind === "rejected" && <Text style={ui.error}>Destaque não confirmado{state.note ? ": " + state.note : ""}</Text>}
    {listing.status === "published" && state.kind !== "pending" && (open ? <View style={[ui.card, { gap: 10 }]}>
      <Text style={ui.label}>{boostOfferText(settings)}{state.kind === "active" ? " — junta mais dias ao destaque atual" : ""}</Text>
      <Text style={ui.text}>O anúncio aparece no topo das listas e da pesquisa, com o selo «⭐ Destaque».</Text>
      <Text style={ui.label}>1. Pague para estes dados</Text>
      <PaymentDetails s={settings} />
      <Text style={ui.label}>2. Diga-nos como pagou</Text>
      <Chips options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(k => ({ value: k, label: PLAN_METHOD_LABELS[k] }))} value={method} onChange={setMethod} />
      <TextInput style={ui.input} value={reference} onChangeText={setReference} maxLength={120} placeholder="Referência ou número da operação" placeholderTextColor={C.muted} accessibilityLabel="Referência do pagamento" />
      {proof ? <View style={{ gap: 6 }}><Image source={{ uri: proof.uri }} style={{ width: 110, height: 110, borderRadius: 10 }} accessibilityLabel="Comprovativo" /><Button title="Tirar comprovativo" variant="secondary" onPress={() => setProof(null)} /></View>
        : <View style={ui.row}><Button title="📷 Fotografar comprovativo" variant="secondary" onPress={() => void pick(true)} /><Button title="🖼️ Galeria" variant="secondary" onPress={() => void pick(false)} /></View>}
      <Message error={error} />
      <Button title={busy ? "A enviar…" : "Enviar pagamento"} disabled={busy} onPress={() => void send()} />
      <Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)} />
    </View> : <Button title={state.kind === "active" ? "⭐ Prolongar o destaque" : boostOfferText(settings)} variant="secondary" onPress={() => setOpen(true)} />)}
  </View>;
}

/** Administração: pedidos de destaque. */
export function AdminBoosts() {
  const [items, setItems] = useState<AdminBoost[]>([]); const [status, setStatus] = useState<BoostStatus>("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reject, setReject] = useState<string | null>(null); const [note, setNote] = useState("");
  async function load() { const r = await listBoostsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(b: AdminBoost, ok: boolean) {
    if (!ok && !note.trim()) { setError("Escreva porque não confirma."); return; }
    const r = await decideBoost(supabase(), b.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Destaque ativo." : "Pedido recusado."); setReject(null); setNote(""); await load(); }
  }
  return <View style={{ gap: 12 }}>
    <Text style={ui.h2}>⭐ Destaques de anúncios</Text>
    <Message error={error} ok={notice} />
    <Chips options={(["pending", "active", "rejected", "expired"] as BoostStatus[]).map(k => ({ value: k, label: BOOST_STATUS_LABELS[k] }))} value={status} onChange={setStatus} />
    {items.length === 0 && <Text style={ui.text}>Sem pedidos de destaque.</Text>}
    {items.map(b => <View key={b.id} style={ui.card}>
      <Text style={ui.h2}>{boostRef(b.ref_no)} · {formatPrice(b.amount)} · {b.days} dias</Text>
      <Text style={ui.text}>{b.listing_title} · {b.owner_name}{b.phone ? " · " + b.phone : ""}</Text>
      <Text style={ui.muted}>{b.method ? PLAN_METHOD_LABELS[b.method] : ""}{b.reference ? " · Ref.: " + b.reference : ""} · {new Date(b.created_at).toLocaleString("pt-AO")}</Text>
      {!!b.ends_at && <Text style={ui.muted}>Destaque até {formatDate(b.ends_at)}</Text>}
      {!!b.proof_path && <Button title="📄 Comprovativo" variant="secondary" onPress={async () => { const r = await paymentProofUrl(supabase(), b.proof_path!); if (r.data) void Linking.openURL(r.data); else setError(friendlyError(r.error)); }} />}
      {b.status === "pending" && (reject === b.id ? <>
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} placeholder="Porque não confirma? (o vendedor vai ler)" placeholderTextColor={C.muted} accessibilityLabel="Motivo" />
        <Button title="✖ Não recebido" variant="danger" onPress={() => void decide(b, false)} />
        <Button title="Voltar" variant="secondary" onPress={() => setReject(null)} />
      </> : <>
        <Button title="✔ Confirmar e destacar" onPress={() => Alert.alert("Confirmar destaque", `${formatPrice(b.amount)} de ${b.owner_name}?`, [{ text: "Não", style: "cancel" }, { text: "Confirmar", onPress: () => void decide(b, true) }])} />
        <Button title="✖ Não recebido" variant="secondary" onPress={() => { setReject(b.id); setNote(""); }} />
      </>)}
    </View>)}
  </View>;
}
