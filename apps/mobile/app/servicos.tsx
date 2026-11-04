import { useCallback, useEffect, useState } from "react";
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { listMyServiceRequests, updateServiceRequest, confirmService, serviceActions, validateReview, friendlyErrorIn, sendServiceQuote, acceptServiceQuote, formatPrice,
  SERVICE_STATUS_LABELS, SERVICE_ACTION_LABELS, formatPreferredDate, type ServiceRequest, type ServiceAction } from "@huambo-online/core";
import { currentUserId, supabase } from "../lib/supabase";
import { C, ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { StarPicker } from "../components/Reputation";
import { useT, formatDateTimeIn } from "../lib/i18n";

function ConfirmBox({ id, onDone }: { id: string; onDone: (msg: string, err?: boolean) => void }) {
  const { t, tc, lang } = useT();
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  async function send() {
    const v = validateReview(rating, comment); if (v) { onDone(tc(v), true); return; }
    setBusy(true); const r = await confirmService(supabase(), id, rating, comment); setBusy(false);
    if (r.error) onDone(friendlyErrorIn(r.error, lang), true); else onDone(t("sv.srv_confirmed"));
  }
  return <View style={[ui.card, { backgroundColor: C.surface }]}>
    <Text style={ui.label}>{t("sv.srv_rate")}</Text>
    <StarPicker value={rating} onChange={setRating} />
    <TextInput style={[ui.input, ui.area]} multiline value={comment} onChangeText={setComment} placeholder={t("sv.srv_comment_ph")} />
    <Button title={busy ? t("sv.sending") : t("sv.srv_confirm_btn")} disabled={busy || !rating} onPress={() => void send()} />
  </View>;
}

export default function Servicos() {
  const router = useRouter(); const { t, tc, lang } = useT();
  const params = useLocalSearchParams<{ recebidos?: string }>();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [as, setAs] = useState<"client" | "provider">(params.recebidos ? "provider" : "client");
  const [items, setItems] = useState<ServiceRequest[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(""); const [note, setNote] = useState<Record<string, string>>({}); const [amount, setAmount] = useState<Record<string, string>>({});
  async function load(a = as) { setItems(null); const r = await listMyServiceRequests(supabase(), a); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useFocusEffect(useCallback(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []));
  useEffect(() => { if (uid) void load(as); }, [as]);
  async function run(id: string, action: ServiceAction) {
    setError(""); setNotice("");
    const r = await updateServiceRequest(supabase(), id, action, note[id]);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.srv_updated")); setNote(n => ({ ...n, [id]: "" })); await load(); }
  }
  async function quote(id: string) {
    const v = Number((amount[id] ?? "").replace(/\s/g, "").replace(",", "."));
    if (!(v > 0)) { setError(t("sv.quote_amount_bad")); return; }
    setError(""); setNotice("");
    const r = await sendServiceQuote(supabase(), id, v, note[id]);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.quote_sent")); setNote(n => ({ ...n, [id]: "" })); setAmount(n => ({ ...n, [id]: "" })); await load(); }
  }
  async function pay(id: string) {
    setError(""); setNotice("");
    const r = await acceptServiceQuote(supabase(), id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else router.push("/encomendas?pagar=1" as any);
  }
  function act(id: string, action: ServiceAction) {
    if (action === "decline" || action === "cancel") Alert.alert(action === "decline" ? t("sv.srv_decline") : t("sv.srv_cancel"), t("sv.are_you_sure"), [{ text: t("sv.no"), style: "cancel" }, { text: t("sv.yes"), style: "destructive", onPress: () => void run(id, action) }]);
    else void run(id, action);
  }
  if (uid === undefined) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.text}>{t("common.loading")}</Text></ScrollView>;
  if (!uid) return <ScrollView contentContainerStyle={ui.screen}><Text style={ui.h1}>{t("sv.srv_title")}</Text><Button title={t("auth.login")} onPress={() => router.push("/login")} /></ScrollView>;
  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/conta" style={ui.link}>{t("sv.account_back")}</Link>
    <Text style={ui.h1}>{t("sv.srv_title_icon")}</Text>
    <Chips<"client" | "provider"> options={[{ value: "client", label: t("sv.srv_mine") }, { value: "provider", label: t("sv.srv_received") }]} value={as} onChange={setAs} />
    {as === "client" && <Text style={ui.text}>{t("sv.srv_hint")}</Text>}
    <Message error={error} ok={notice} />
    {items === null && !error && <Text style={ui.text}>{t("common.loading")}</Text>}
    {items?.length === 0 && <Text style={ui.text}>{t("sv.srv_none")}</Text>}
    {items?.map(s => {
      const actions = serviceActions(s.status, as, { quoted: s.quote_amount != null, escrow: s.escrow_status });
      return <View key={s.id} style={ui.card}>
        {as === "client"
          ? <Link href={(s.provider_id ? "/profissionais/" + s.provider_id : "/empresas/" + s.business_id) as any} style={ui.link}>{s.target_name} →</Link>
          : <Text style={ui.h2}>{s.client_name}</Text>}
        <Text style={ui.label}>{tc(SERVICE_STATUS_LABELS[s.status])}</Text>
        <Text style={ui.text}>{s.description}</Text>
        {!!s.preferred_date && <Text style={ui.label}>📅 {tc(formatPreferredDate(s.preferred_date))}</Text>}
        {!!s.provider_note && <Text style={ui.text}>💬 {s.provider_note}</Text>}
        {s.quote_amount != null && <Text style={ui.text}>🧾 {t("sv.quote")}: <Text style={{ fontWeight: "800" }}>{formatPrice(s.quote_amount)}</Text>{s.quote_note ? " · " + s.quote_note : ""}{s.escrow_status === "held" ? " · 🛡️ " + t("sv.quote_paid") : s.escrow_status === "released" ? " · ✅ " + t("sv.quote_released") : ""}</Text>}
        {as === "provider" && actions.includes("quote") && <TextInput style={ui.input} value={amount[s.id] ?? ""} onChangeText={v => setAmount(n => ({ ...n, [s.id]: v }))} keyboardType="numeric" placeholder={t("sv.quote_amount_ph")} />}
        <Text style={ui.muted}>{formatDateTimeIn(s.created_at, lang)}</Text>
        {as === "provider" && actions.length > 0 && <TextInput style={ui.input} value={note[s.id] ?? ""} onChangeText={v => setNote(n => ({ ...n, [s.id]: v }))} placeholder={t("sv.srv_note_ph")} />}
        {actions.map(a => a === "confirm"
          ? <Button key={a} title={tc(SERVICE_ACTION_LABELS.confirm)} onPress={() => setConfirming(confirming === s.id ? "" : s.id)} />
          : a === "quote" ? <Button key={a} title={tc(SERVICE_ACTION_LABELS.quote)} onPress={() => void quote(s.id)} />
          : a === "pay" ? <Button key={a} title={tc(SERVICE_ACTION_LABELS.pay)} onPress={() => void pay(s.id)} />
          : <Button key={a} title={tc(SERVICE_ACTION_LABELS[a])} variant={a === "decline" || a === "cancel" ? "danger" : a === "accept" ? "primary" : "secondary"} onPress={() => act(s.id, a)} />)}
        {confirming === s.id && <ConfirmBox id={s.id} onDone={(msg, err) => { if (err) setError(msg); else { setConfirming(""); setNotice(msg); void load(); } }} />}
      </View>;
    })}
  </ScrollView>;
}
