import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { listMyServiceRequests, updateServiceRequest, confirmService, serviceActions, validateReview, friendlyError,
  SERVICE_STATUS_LABELS, SERVICE_ACTION_LABELS, formatPreferredDate, type ServiceRequest, type ServiceAction } from "@huambo-online/core";
import { currentUserId, supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { StarPicker } from "../components/Reputation";

function ConfirmBox({ id, onDone }: { id: string; onDone: (msg: string, err?: boolean) => void }) {
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  async function send() {
    const v = validateReview(rating, comment); if (v) { onDone(v, true); return; }
    setBusy(true); const r = await confirmService(supabase(), id, rating, comment); setBusy(false);
    if (r.error) onDone(friendlyError(r.error), true); else onDone("Serviço confirmado e avaliado. Obrigado!");
  }
  return <View style={[ui.card, { backgroundColor: C.surface }]}>
    <Text style={ui.label}>O serviço foi feito? Avalie:</Text>
    <StarPicker value={rating} onChange={setRating} />
    <TextInput style={[ui.input, ui.area]} multiline value={comment} onChangeText={setComment} placeholder="Como correu o serviço? (opcional)" />
    <Button title={busy ? "A enviar…" : "✔ Confirmar serviço e publicar avaliação"} disabled={busy || !rating} onPress={() => void send()} />
  </View>;
}

export default function Servicos() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recebidos?: string }>();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [as, setAs] = useState<"client" | "provider">(params.recebidos ? "provider" : "client");
  const [items, setItems] = useState<ServiceRequest[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(""); const [note, setNote] = useState<Record<string, string>>({});
  async function load(a = as) { setItems(null); const r = await listMyServiceRequests(supabase(), a); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  useEffect(() => { if (uid) void load(as); }, [as]);
  async function run(id: string, action: ServiceAction) {
    setError(""); setNotice("");
    const r = await updateServiceRequest(supabase(), id, action, note[id]);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Pedido atualizado."); setNote(n => ({ ...n, [id]: "" })); await load(); }
  }
  function act(id: string, action: ServiceAction) {
    if (action === "decline" || action === "cancel") Alert.alert(action === "decline" ? "Recusar pedido" : "Cancelar pedido", "Tem a certeza?", [{ text: "Não", style: "cancel" }, { text: "Sim", style: "destructive", onPress: () => void run(id, action) }]);
    else void run(id, action);
  }
  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>A carregar…</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>Pedidos de serviço</Text><Button title="Entrar" onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>← A sua conta</Link>
    <Text style={ui.h1}>🛠️ Pedidos de serviço</Text>
    <Chips<"client" | "provider"> options={[{ value: "client", label: "Que eu pedi" }, { value: "provider", label: "Que recebi" }]} value={as} onChange={setAs} />
    {as === "client" && <Text style={ui.text}>Peça serviços nas páginas de profissionais e empresas. Quando o serviço terminar, confirme e avalie.</Text>}
    <Message error={error} ok={notice} />
    {items === null && !error && <Text style={ui.text}>A carregar…</Text>}
    {items?.length === 0 && <Text style={ui.text}>Sem pedidos de serviço.</Text>}
    {items?.map(s => {
      const actions = serviceActions(s.status, as);
      return <View key={s.id} style={ui.card}>
        {as === "client"
          ? <Link href={(s.provider_id ? "/profissionais/" + s.provider_id : "/empresas/" + s.business_id) as any} style={ui.link}>{s.target_name} →</Link>
          : <Text style={ui.h2}>{s.client_name}</Text>}
        <Text style={ui.label}>{SERVICE_STATUS_LABELS[s.status]}</Text>
        <Text style={ui.text}>{s.description}</Text>
        {!!s.preferred_date && <Text style={ui.label}>📅 {formatPreferredDate(s.preferred_date)}</Text>}
        {!!s.provider_note && <Text style={ui.text}>💬 {s.provider_note}</Text>}
        <Text style={ui.muted}>{new Date(s.created_at).toLocaleString("pt-AO")}</Text>
        {as === "provider" && actions.length > 0 && <TextInput style={ui.input} value={note[s.id] ?? ""} onChangeText={t => setNote(n => ({ ...n, [s.id]: t }))} placeholder="Mensagem para o cliente (opcional)" />}
        {actions.map(a => a === "confirm"
          ? <Button key={a} title={SERVICE_ACTION_LABELS.confirm} onPress={() => setConfirming(confirming === s.id ? "" : s.id)} />
          : <Button key={a} title={SERVICE_ACTION_LABELS[a]} variant={a === "decline" || a === "cancel" ? "danger" : a === "accept" ? "primary" : "secondary"} onPress={() => act(s.id, a)} />)}
        {confirming === s.id && <ConfirmBox id={s.id} onDone={(msg, err) => { if (err) setError(msg); else { setConfirming(""); setNotice(msg); void load(); } }} />}
      </View>;
    })}
  </ScrollView>;
}
