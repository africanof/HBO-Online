import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Linking, Pressable, Text, TextInput, View } from "react-native";
import { disputeActions, disputeNextStep, disputeEventLabel, disputeAction, disputePhotoUrls, uploadDisputePhoto, listDisputesForAdmin, decideDispute,
  base64ToArrayBuffer, formatPrice, friendlyError, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS,
  DISPUTE_ACTION_LABELS, DISPUTE_DECISION_LABELS, DISPUTE_MAX_PHOTOS, PAYMENT_LABELS, ORDER_STATUS_LABELS,
  type DisputeAction, type DisputeDecision, type DisputeEvent, type MyDispute, type AdminDispute, type DisputeStatus, type PaymentMethod, type OrderStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { shrinkAsset } from "../lib/image";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

export type Evidence = { uri: string; base64?: string | null; mimeType: string };

/** Fotografar ou escolher até 4 fotografias de prova (reduzidas antes de enviar). */
export function EvidencePicker({ items, onChange, onError }: { items: Evidence[]; onChange: (e: Evidence[]) => void; onError: (m: string) => void }) {
  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { onError(camera ? "Autorize a câmara para fotografar o problema." : "Autorize o acesso à galeria."); return; }
    const room = DISPUTE_MAX_PHOTOS - items.length;
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: !camera, selectionLimit: room };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled || !r.assets?.length) return;
    const ready = await Promise.all(r.assets.slice(0, room).map(a => shrinkAsset(a)));
    onChange([...items, ...ready].slice(0, DISPUTE_MAX_PHOTOS));
  }
  return <View style={{ gap: 8 }}>
    <Text style={ui.label}>Fotografias ({items.length}/{DISPUTE_MAX_PHOTOS})</Text>
    {items.length > 0 && <View style={ui.row}>{items.map((p, i) => <Pressable key={p.uri} accessibilityRole="button" accessibilityLabel="Tirar fotografia" onPress={() => onChange(items.filter((_, j) => j !== i))}>
      <Image source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} /><Text style={ui.muted}>✖ tirar</Text></Pressable>)}</View>}
    {items.length < DISPUTE_MAX_PHOTOS && <View style={ui.row}>
      <Button title="📷 Fotografar" variant="secondary" onPress={() => void pick(true)} />
      <Button title="🖼️ Galeria" variant="secondary" onPress={() => void pick(false)} />
    </View>}
  </View>;
}
export async function uploadEvidence(orderId: string, uid: string, items: Evidence[]): Promise<string[]> {
  const out: string[] = [];
  for (const [i, p] of items.entries()) {
    const body = p.base64 ? base64ToArrayBuffer(p.base64) : await (await fetch(p.uri)).arrayBuffer();
    const r = await uploadDisputePhoto(supabase(), orderId, uid, body, `foto-${i + 1}.jpg`, p.mimeType || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error("Não foi possível enviar a fotografia.");
    out.push(r.data);
  }
  return out;
}

export function DisputeTimeline({ events }: { events: DisputeEvent[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = events.flatMap(e => e.photos ?? []);
  useEffect(() => { if (paths.length) void disputePhotoUrls(supabase(), paths).then(setUrls); }, [paths.join("|")]);
  return <View style={{ gap: 10 }}>
    {events.map((e, i) => <View key={i} style={{ borderLeftWidth: 3, borderLeftColor: C.line, paddingLeft: 10, gap: 4 }}>
      <Text style={ui.label}>{disputeEventLabel(e)}</Text>
      <Text style={ui.muted}>{new Date(e.created_at).toLocaleString("pt-AO")}</Text>
      {!!e.note && <Text style={ui.text}>{e.note}</Text>}
      {(e.photos ?? []).length > 0 && <View style={ui.row}>{e.photos.map(p => urls[p]
        ? <Pressable key={p} accessibilityRole="imagebutton" accessibilityLabel="Abrir fotografia de prova" onPress={() => void Linking.openURL(urls[p])}><Image source={{ uri: urls[p] }} style={{ width: 84, height: 84, borderRadius: 8 }} /></Pressable>
        : <Text key={p} style={ui.muted}>📷 fotografia</Text>)}</View>}
    </View>)}
  </View>;
}

const statusText = (status: DisputeStatus, outcome: MyDispute["outcome"]) => status === "resolved" && outcome ? DISPUTE_OUTCOME_LABELS[outcome] : DISPUTE_STATUS_LABELS[status];

export function DisputeCard({ d, uid, onChanged }: { d: MyDispute; uid: string; onChanged: (msg: string) => void }) {
  const [note, setNote] = useState(""); const [photos, setPhotos] = useState<Evidence[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const actions = disputeActions(d, d.my_role);
  async function send(action: DisputeAction) {
    setBusy(true); setError("");
    try {
      const paths = await uploadEvidence(d.order_id, uid, photos);
      const r = await disputeAction(supabase(), d.id, action, note, paths);
      if (r.error) throw r.error;
      setNote(""); setPhotos([]); onChanged(action === "comment" ? "Mensagem enviada." : "Pedido atualizado. A outra pessoa recebe uma notificação.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  function run(action: DisputeAction) {
    if (action === "decline" && !note.trim()) { setError("Escreva na caixa de mensagem porque recusa."); return; }
    if (action === "comment" && !note.trim() && !photos.length) { setError("Escreva uma mensagem ou junte uma fotografia."); return; }
    const ask = action === "withdraw" ? "Desistir deste pedido? Pode voltar a pedir depois, dentro do prazo."
      : action === "confirm_refund" ? "Confirma que recebeu o dinheiro? O pedido fica fechado."
      : action === "confirm_replacement" ? "Confirma que recebeu o artigo novo? O pedido fica fechado." : "";
    if (ask) Alert.alert(DISPUTE_ACTION_LABELS[action], ask, [{ text: "Não", style: "cancel" }, { text: "Sim", onPress: () => void send(action) }]);
    else void send(action);
  }
  return <View style={ui.card}>
    <Text style={ui.h2}>{DISPUTE_REASON_LABELS[d.reason]}</Text>
    <Text style={ui.label}>{statusText(d.status, d.outcome)}</Text>
    <Text style={ui.text}>{d.my_role === "buyer" ? "Vendedor" : "Cliente"}: {d.other_name} · Encomenda de {formatPrice(d.order_total)}</Text>
    {(d.order_items ?? []).length > 0 && <Text style={ui.muted}>{d.order_items.map(i => `${i.quantity} × ${i.name}`).join(", ")}</Text>}
    <Text style={ui.text}>Pedido: {DISPUTE_REQUEST_LABELS[d.request]}{d.amount != null ? " · " + formatPrice(d.amount) : ""}</Text>
    {!!d.admin_note && <Text style={ui.text}>⚖️ Decisão da administração: {d.admin_note}</Text>}
    <Text style={ui.ok}>👉 {disputeNextStep(d, d.my_role)}</Text>
    <Button title={open ? "Esconder histórico" : `Ver histórico (${d.events.length})`} variant="secondary" onPress={() => setOpen(!open)} />
    {open && <DisputeTimeline events={d.events} />}
    {d.status !== "resolved" && <>
      <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} accessibilityLabel="Mensagem"
        placeholder={d.my_role === "seller" && d.status === "open" ? "Resposta ao comprador (obrigatória se recusar)" : "Escreva aqui (ex.: onde entregar, referência da transferência)…"} placeholderTextColor={C.muted} />
      <EvidencePicker items={photos} onChange={setPhotos} onError={setError} />
      <Message error={error} />
      {actions.filter(a => a !== "withdraw").map(a => <Button key={a} disabled={busy} title={DISPUTE_ACTION_LABELS[a]} variant={a === "decline" || a === "escalate" ? "secondary" : "primary"} onPress={() => run(a)} />)}
      <Button disabled={busy} title={"💬 " + DISPUTE_ACTION_LABELS.comment} variant="secondary" onPress={() => run("comment")} />
      {actions.includes("withdraw") && <Button disabled={busy} title={DISPUTE_ACTION_LABELS.withdraw} variant="danger" onPress={() => run("withdraw")} />}
    </>}
  </View>;
}

/** Administração: disputas para decidir. */
export function AdminDisputes() {
  const [status, setStatus] = useState<"escalated" | "active" | "all">("escalated");
  const [items, setItems] = useState<AdminDispute[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null); const [decision, setDecision] = useState<DisputeDecision>("refund");
  const [amount, setAmount] = useState(""); const [note, setNote] = useState("");
  async function load() { const r = await listDisputesForAdmin(supabase(), status === "all" ? "" : status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(d: AdminDispute) {
    if (!note.trim()) { setError("Explique a decisão (as duas pessoas vão ler)."); return; }
    const value = decision === "refund" || decision === "return_refund" ? Number(amount.replace(/\s/g, "").replace(",", ".") || d.amount || d.order_total) : null;
    if (value !== null && (!Number.isFinite(value) || value <= 0)) { setError("Valor inválido."); return; }
    setError(""); setNotice("");
    const r = await decideDispute(supabase(), d.id, decision, note, value);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Decisão registada e enviada às duas pessoas."); setEditing(null); setNote(""); setAmount(""); await load(); }
  }
  async function comment(d: AdminDispute) {
    if (!note.trim()) { setError("Escreva a mensagem."); return; }
    const r = await disputeAction(supabase(), d.id, "comment", note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Mensagem enviada."); setNote(""); await load(); }
  }
  return <View style={{ gap: 12 }}>
    <Chips options={[{ value: "escalated" as const, label: "Para decidir" }, { value: "active" as const, label: "Abertos" }, { value: "all" as const, label: "Todos" }]} value={status} onChange={setStatus} />
    <Message error={error} ok={notice} />
    {items.length === 0 && <Text style={ui.text}>Sem pedidos.</Text>}
    {items.map(d => <View key={d.id} style={ui.card}>
      <Text style={ui.h2}>{DISPUTE_REASON_LABELS[d.reason]}</Text>
      <Text style={ui.label}>{statusText(d.status, d.outcome)}</Text>
      <Text style={ui.text}>Comprador: {d.buyer_name} · Vendedor: {d.seller_name}</Text>
      <Text style={ui.muted}>Encomenda de {formatPrice(d.order_total)} · {ORDER_STATUS_LABELS[d.order_status as OrderStatus] ?? d.order_status} · {PAYMENT_LABELS[d.payment_method as PaymentMethod] ?? ""}</Text>
      <Text style={ui.text}>Pedido: {DISPUTE_REQUEST_LABELS[d.request]}{d.amount != null ? " · " + formatPrice(d.amount) : ""}</Text>
      {!!d.admin_note && <Text style={ui.text}>Decisão: {d.admin_note}</Text>}
      <DisputeTimeline events={d.events} />
      {d.status !== "resolved" && (editing === d.id ? <>
        <Chips options={(Object.keys(DISPUTE_DECISION_LABELS) as DisputeDecision[]).map(k => ({ value: k, label: DISPUTE_DECISION_LABELS[k] }))} value={decision} onChange={setDecision} />
        {(decision === "refund" || decision === "return_refund") && <TextInput style={ui.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} accessibilityLabel="Valor a devolver em Kz" placeholder={"Valor a devolver (Kz): " + Number(d.amount ?? d.order_total)} placeholderTextColor={C.muted} />}
        <TextInput style={[ui.input, ui.area]} multiline value={note} onChangeText={setNote} accessibilityLabel="Explicação" placeholder="Explique a decisão ou escreva uma mensagem" placeholderTextColor={C.muted} />
        <Button title="⚖️ Registar decisão" onPress={() => void decide(d)} />
        <Button title="💬 Só enviar mensagem" variant="secondary" onPress={() => void comment(d)} />
        <Button title="Fechar" variant="secondary" onPress={() => setEditing(null)} />
      </> : <Button title="⚖️ Decidir ou escrever" onPress={() => { setEditing(d.id); setNote(""); setAmount(""); setDecision("refund"); }} />)}
    </View>)}
  </View>;
}
