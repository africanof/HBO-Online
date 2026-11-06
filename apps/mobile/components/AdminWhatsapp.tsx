import { useEffect, useState } from "react";
import { Pressable, Switch, Text, TextInput, View } from "react-native";
import { listWhatsappThreads, whatsappMessages, setWhatsappThreadStatus, sendWhatsappReply, listWhatsappNumbers, saveWhatsappNumber, formatWaId, friendlyErrorIn,
  WHATSAPP_AREAS, type WhatsappThread, type WhatsappMessage, type WhatsappNumber, type WhatsappArea } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";

/** Administração → WhatsApp (APP): conversas (a IA responde primeiro) e números da equipa. */
export function AdminWhatsapp() {
  const { t, lang } = useT();
  const [threads, setThreads] = useState<WhatsappThread[]>([]); const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [onlyWaiting, setOnlyWaiting] = useState(false); const [numberId, setNumberId] = useState("");
  const [open, setOpen] = useState<WhatsappThread | null>(null); const [error, setError] = useState("");
  async function load() {
    const [a, b] = await Promise.all([listWhatsappThreads(supabase(), onlyWaiting, numberId || null), listWhatsappNumbers(supabase())]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); else { setError(""); setThreads(a.data); }
    setNumbers(b.data);
  }
  useEffect(() => { void load(); const i = setInterval(() => void load(), 20_000); return () => clearInterval(i); }, [onlyWaiting, numberId]);
  if (open) return <ThreadView thread={open} onBack={() => { setOpen(null); void load(); }} />;
  return <View style={{ gap: 10 }}>
    <Text style={ui.h2}>{t("wa.title")}</Text>
    <Text style={ui.muted}>{t("wa.intro")}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={onlyWaiting} onValueChange={setOnlyWaiting} /><Text style={[ui.text, { flex: 1 }]}>{t("wa.waiting_only")}</Text></View>
    {numbers.length > 1 && <Chips options={[{ value: "", label: t("wa.all_numbers") }, ...numbers.map(n => ({ value: n.id, label: n.label }))]} value={numberId} onChange={setNumberId} />}
    <Message error={error} />
    {!threads.length && <Text style={ui.muted}>{t("wa.none")}</Text>}
    {threads.map(c => <Pressable key={c.id} onPress={() => setOpen(c)} accessibilityRole="button"
      style={[ui.card, { gap: 4, borderLeftWidth: 5, borderLeftColor: c.status === "human" ? "#E0B100" : c.status === "ai" ? C.blue : C.line }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={[ui.label, { flex: 1 }]} numberOfLines={1}>{c.contact_name || formatWaId(c.wa_id)}{c.unread > 0 ? `  (${c.unread})` : ""}</Text>
        <Text style={ui.muted}>{formatDateTimeIn(c.last_message_at, lang)}</Text>
      </View>
      <Text style={ui.muted}>{t("wa.st." + c.status)} · {c.number_label}{c.account_name ? " · " + t("wa.account", { n: c.account_name }) : ""}</Text>
      {!!c.last_body && <Text style={ui.text} numberOfLines={1}>{c.last_body}</Text>}
    </Pressable>)}
    <NumbersAdmin numbers={numbers} onChange={() => void load()} />
  </View>;
}

function ThreadView({ thread, onBack }: { thread: WhatsappThread; onBack: () => void }) {
  const { t, lang } = useT();
  const [msgs, setMsgs] = useState<WhatsappMessage[]>([]); const [th, setTh] = useState(thread);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function load() {
    const r = await whatsappMessages(supabase(), thread.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setMsgs(r.data);
    const l = await listWhatsappThreads(supabase(), false, thread.number_id); const now = l.data.find(x => x.id === thread.id); if (now) setTh(now);
  }
  useEffect(() => { void load(); const i = setInterval(() => void load(), 10_000); return () => clearInterval(i); }, [thread.id]);
  async function send() {
    const body = text.trim(); if (!body) return;
    setBusy(true); setError("");
    const err = await sendWhatsappReply(supabase(), thread.id, body); setBusy(false);
    if (err) { const k = "wa.err." + err; const m = t(k); setError(m === k ? t("wa.err.WHATSAPP_SEND_FAILED") : m); } else setText("");
    void load();
  }
  async function status(s: "ai" | "human" | "closed") {
    const r = await setWhatsappThreadStatus(supabase(), thread.id, s);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else void load();
  }
  return <View style={{ gap: 10 }}>
    <Button title={t("wa.back")} variant="secondary" onPress={onBack} />
    <View style={[ui.card, { gap: 4 }]}>
      <Text style={ui.label}>{th.contact_name || formatWaId(th.wa_id)} · {formatWaId(th.wa_id)}</Text>
      <Text style={ui.muted}>{t("wa.st." + th.status)} · {th.number_label} · {th.account_name ? t("wa.account", { n: th.account_name }) : t("wa.no_account")}</Text>
      {th.status !== "human" && <Button title={t("wa.take")} variant="secondary" onPress={() => void status("human")} />}
      {th.status !== "ai" && <Button title={t("wa.back_ai")} variant="secondary" onPress={() => void status("ai")} />}
      {th.status !== "closed" && <Button title={t("wa.close")} variant="secondary" onPress={() => void status("closed")} />}
    </View>
    {msgs.map(m => {
      const mine = m.direction === "out";
      return <View key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "88%", padding: 10, borderRadius: 14, borderWidth: 1, borderColor: C.line,
        backgroundColor: mine ? (m.author === "team" ? C.greenSoft : C.blueSoft) : C.surface }}>
        <Text style={[ui.muted, { fontWeight: "700" }]}>{t("wa.a." + m.author)}</Text>
        <Text style={ui.text}>{m.body ?? (m.media_type ? `📎 ${m.media_type}` : "")}</Text>
        <Text style={[ui.muted, { textAlign: "right", fontSize: 12 }]}>{formatDateTimeIn(m.created_at, lang)}{m.status === "failed" || m.error ? " · ⚠️ " + t("wa.failed") : m.status === "read" ? " · ✓✓" : ""}</Text>
      </View>;
    })}
    {th.window_open ? <>
      <TextInput style={[ui.input, { minHeight: 80, textAlignVertical: "top" }]} value={text} onChangeText={setText} multiline maxLength={4000} placeholder={t("wa.reply_ph")} placeholderTextColor={C.muted} accessibilityLabel={t("wa.reply_ph")} />
      <Button title={busy ? "…" : t("wa.send")} disabled={busy || !text.trim()} onPress={() => void send()} />
    </> : <Text style={[ui.text, { backgroundColor: C.yellowSoft, padding: 10, borderRadius: 10 }]}>{t("wa.window_closed")}</Text>}
    <Message error={error} />
  </View>;
}

const EMPTY = { id: "", label: "", display_phone: "", phone_number_id: "", area: "support" as WhatsappArea, ai_enabled: true, ai_instructions: "", active: true, sort: "100" };
function NumbersAdmin({ numbers, onChange }: { numbers: WhatsappNumber[]; onChange: () => void }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false); const [f, setF] = useState(EMPTY); const [show, setShow] = useState(false);
  const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  function edit(n: WhatsappNumber) {
    setF({ id: n.id, label: n.label, display_phone: n.display_phone ?? "", phone_number_id: n.phone_number_id, area: n.area, ai_enabled: n.ai_enabled,
      ai_instructions: n.ai_instructions ?? "", active: n.active, sort: String(n.sort) }); setShow(true); setOk(""); setError("");
  }
  async function save() {
    setBusy(true); setError(""); setOk("");
    const r = await saveWhatsappNumber(supabase(), { id: f.id || undefined, label: f.label, display_phone: f.display_phone || null, phone_number_id: f.phone_number_id,
      area: f.area, ai_enabled: f.ai_enabled, ai_instructions: f.ai_instructions || null, active: f.active, sort: Number(f.sort) || 100 });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setOk(t("wa.n.saved")); setF(EMPTY); setShow(false); onChange();
  }
  if (!open) return <Button title={`${t("wa.numbers")} (${numbers.length})`} variant="secondary" onPress={() => setOpen(true)} />;
  return <View style={[ui.card, { gap: 8 }]}>
    <Text style={ui.h2}>{t("wa.numbers")}</Text>
    <Text style={ui.muted}>{t("wa.numbers_hint")}</Text>
    {numbers.map(n => <View key={n.id} style={{ gap: 4, opacity: n.active ? 1 : 0.55 }}>
      <Text style={ui.text}>{n.label} · {t("wa.area." + n.area)}{n.display_phone ? " · " + n.display_phone : ""} · {n.ai_enabled ? "🤖" : "👤"}</Text>
      <Button title={t("wa.n.edit")} variant="secondary" onPress={() => edit(n)} />
    </View>)}
    {!show && <Button title={t("wa.n.add")} variant="secondary" onPress={() => { setF(EMPTY); setShow(true); }} />}
    {show && <View style={{ gap: 6 }}>
      <Text style={ui.muted}>{t("wa.n.label")}</Text>
      <TextInput style={ui.input} value={f.label} onChangeText={v => setF({ ...f, label: v })} maxLength={60} />
      <Text style={ui.muted}>{t("wa.n.phone")}</Text>
      <TextInput style={ui.input} value={f.display_phone} onChangeText={v => setF({ ...f, display_phone: v })} maxLength={30} keyboardType="phone-pad" />
      <Text style={ui.muted}>{t("wa.n.id")}</Text>
      <TextInput style={ui.input} value={f.phone_number_id} onChangeText={v => setF({ ...f, phone_number_id: v.replace(/\D/g, "") })} maxLength={30} keyboardType="number-pad" />
      <Text style={ui.muted}>{t("wa.n.area")}</Text>
      <Chips options={WHATSAPP_AREAS.map(a => ({ value: a, label: t("wa.area." + a) }))} value={f.area} onChange={v => setF({ ...f, area: v })} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={f.ai_enabled} onValueChange={v => setF({ ...f, ai_enabled: v })} /><Text style={[ui.text, { flex: 1 }]}>{t("wa.n.ai")}</Text></View>
      <Text style={ui.muted}>{t("wa.n.instructions")}</Text>
      <TextInput style={[ui.input, { minHeight: 90, textAlignVertical: "top" }]} value={f.ai_instructions} onChangeText={v => setF({ ...f, ai_instructions: v })} multiline maxLength={3000} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Switch value={f.active} onValueChange={v => setF({ ...f, active: v })} /><Text style={[ui.text, { flex: 1 }]}>{t("wa.n.active")}</Text></View>
      <Message error={error} />
      <Button title={t("wa.n.save")} disabled={busy || f.label.trim().length < 2 || f.phone_number_id.length < 5} onPress={() => void save()} />
      <Button title={t("wa.n.cancel")} variant="secondary" onPress={() => { setShow(false); setF(EMPTY); }} />
    </View>}
    <Message ok={ok} />
  </View>;
}
