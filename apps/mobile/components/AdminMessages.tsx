import { useEffect, useState } from "react";
import { Switch, Text, TextInput, View } from "react-native";
import { listMediatedConversations, listMessages, teamForwardMessage, teamSendMessage, markMessageHandled, otherParticipant, chatMediaUrls,
  friendlyErrorIn, listChatSuspensions, liftChatSuspension, chatBlockReasonKey, type MediatedConversation, type ChatSuspension } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { ui, C } from "../lib/ui";
import { Button, Chips, Message } from "./Ui";
import { MessageAttachment } from "./ChatMedia";
import { TeamReplySuggest } from "./AiTools";

/**
 * Mensagens mediadas: a equipa lê cada mensagem dos utilizadores e decide reencaminhá-la
 * à outra parte, responder a um dos lados ou marcá-la como tratada sem reencaminhar.
 */
export function AdminMessages() {
  const { lang, t } = useT();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [list, setList] = useState<MediatedConversation[]>([]);
  const [open, setOpen] = useState<MediatedConversation | null>(null);
  const [msgs, setMsgs] = useState<any[]>([]); const [media, setMedia] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reply, setReply] = useState(""); const [replyTo, setReplyTo] = useState<string>("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);

  async function loadList() {
    const r = await listMediatedConversations(supabase(), pendingOnly);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data);
  }
  async function loadConversation(c: MediatedConversation) {
    const r = await listMessages(supabase(), c.conversation_id); const rows = (r.data ?? []) as any[];
    setMsgs(rows);
    const paths = rows.map(m => m.attachment_path).filter((p: any): p is string => !!p && !media[p]);
    if (paths.length) { const urls = await chatMediaUrls(supabase(), paths); setMedia(old => ({ ...old, ...urls })); }
  }
  useEffect(() => { void loadList(); }, [pendingOnly]);
  useEffect(() => { if (open) { void loadConversation(open); setReplyTo(open.participants[0]?.user_id ?? ""); } }, [open?.conversation_id]);

  async function run(fn: () => PromiseLike<{ error: any }>, message: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(message); if (open) await loadConversation(open); await loadList();
  }
  const roleLabel = (role?: string) => role === "owner" ? t("ad.msg.owner") : t("ad.msg.starter");
  const nameOf = (id?: string | null) => open?.participants.find(p => p.user_id === id)?.name ?? t("ad.msg.user");

  if (open) return <View style={{ gap: 12 }}>
    <Button title={"← " + t("ad.msg.back")} variant="secondary" onPress={() => { setOpen(null); setOk(""); setErr(""); }} />
    <Text style={ui.h2}>{open.context_type === "support" ? "🆘 " : ""}{open.subject || t("ad.tab.messages")}</Text>
    <Text style={ui.muted}>{open.participants.map(p => `${p.name} (${roleLabel(p.role)})`).join(" · ")}</Text>
    <Message error={err} ok={ok} />
    {msgs.map(m => {
      const fromTeam = !!m.from_team; const handled = !!m.handled_at; const to = otherParticipant(open, m.sender_id);
      const sender = open.participants.find(p => p.user_id === m.sender_id);
      return <View key={m.id} style={[ui.card, { borderLeftWidth: 4, borderLeftColor: fromTeam ? C.blue : handled ? C.line : "#E5A800" }]}>
        <Text style={ui.muted}>{formatDateTimeIn(m.created_at, lang)} · {fromTeam
          ? `🛡️ ${t("ad.msg.team")} → ${m.audience ? nameOf(m.audience) : t("ad.msg.both")}`
          : `${sender?.name ?? t("ad.msg.user")} (${roleLabel(sender?.role)})${handled ? " · ✓ " + t("ad.msg.handled") : " · ⏳ " + t("ad.msg.pending")}`}</Text>
        <Text style={ui.text}>{m.body}</Text>
        {!!m.blocked_reason && <Text style={ui.error}>🚫 {t(chatBlockReasonKey(m.blocked_reason))}{String(m.blocked_reason).startsWith("ai_") ? " " + t("cg.by_ai") : ""}</Text>}
        {!!m.attachment_kind && <MessageAttachment m={m} url={m.attachment_path ? media[m.attachment_path] : undefined} />}
        {!fromTeam && !handled && to && <View style={{ gap: 6 }}>
          <TextInput style={ui.input} multiline value={drafts[m.id] ?? ""} onChangeText={v => setDrafts(d => ({ ...d, [m.id]: v }))}
            placeholder={t("ad.msg.edit_before")} placeholderTextColor={C.muted} accessibilityLabel={t("ad.msg.edit_before")} />
          <Button title={"➡️ " + t("ad.msg.forward_to", { name: to.name })} disabled={busy}
            onPress={() => void run(() => teamForwardMessage(supabase(), open.conversation_id, m.id, to.user_id, drafts[m.id]), t("ad.msg.ok_forwarded"))} />
          <Button title={t("ad.msg.mark_handled")} variant="secondary" disabled={busy}
            onPress={() => void run(() => markMessageHandled(supabase(), m.id), t("ad.msg.ok_handled"))} />
        </View>}
      </View>;
    })}
    <View style={ui.card}>
      <Text style={ui.h2}>🛡️ {t("ad.msg.write")}</Text>
      <Text style={ui.label}>{t("ad.msg.to")}</Text>
      <Chips options={[...open.participants.map(p => ({ value: p.user_id, label: `${p.name} (${roleLabel(p.role)})` })), { value: "both", label: t("ad.msg.both") }]}
        value={replyTo || "both"} onChange={v => setReplyTo(v === "both" ? "" : v)} />
      <TextInput style={ui.input} multiline value={reply} onChangeText={setReply} accessibilityLabel={t("ad.msg.write")} />
      <TeamReplySuggest conversationId={open.conversation_id} audienceId={replyTo} subject={open.subject} onUse={setReply} />
      <Button title={t("common.send")} disabled={busy || !reply.trim()}
        onPress={() => void run(() => teamSendMessage(supabase(), open.conversation_id, replyTo || null, reply), t("ad.msg.ok_sent")).then(() => setReply(""))} />
    </View>
  </View>;

  return <View style={{ gap: 12 }}>
    <ChatSuspensions />
    <Text style={ui.text}>{t("ad.msg.intro")}</Text>
    <View style={[ui.row, { alignItems: "center" }]}>
      <Switch value={pendingOnly} onValueChange={setPendingOnly} accessibilityLabel={t("ad.msg.pending_only")} />
      <Text style={[ui.text, { flex: 1 }]}>{t("ad.msg.pending_only")}</Text>
    </View>
    <Message error={err} />
    {!list.length && <Text style={ui.muted}>{t("ad.msg.none")}</Text>}
    {list.map(c => <View key={c.conversation_id} style={ui.card}>
      <Text style={ui.h2}>{c.context_type === "support" ? "🆘 " : ""}{c.subject || t("ad.tab.messages")}</Text>
      <Text style={ui.text}>{c.participants.map(p => p.name).join(" ↔ ")}</Text>
      <Text style={ui.muted}>{c.pending ? `⏳ ${t("ad.msg.pending_count", { n: c.pending })}` : `✓ ${t("ad.msg.all_handled")}`}{c.last_message_at ? " · " + formatDateTimeIn(c.last_message_at, lang) : ""}</Text>
      <Button title={t("ad.msg.open")} variant="secondary" onPress={() => setOpen(c)} />
    </View>)}
  </View>;
}

/** Quem está suspenso das mensagens (3 tentativas de partilhar contactos) e botão para levantar. */
function ChatSuspensions() {
  const { lang, t } = useT();
  const [items, setItems] = useState<ChatSuspension[]>([]); const [err, setErr] = useState("");
  async function load() { const r = await listChatSuspensions(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setItems(r.data); }
  useEffect(() => { void load(); }, []);
  return <View style={ui.card}>
    <Text style={ui.label}>{t("cg.title")} ({items.length})</Text>
    <Message error={err} />
    {!items.length && <Text style={ui.muted}>{t("cg.none")}</Text>}
    {items.map(s => <View key={s.user_id} style={{ gap: 6 }}>
      <Text style={ui.text}><Text style={ui.label}>{s.name}</Text> · {t("cg.until", { d: formatDateTimeIn(s.until, lang) })} · {t("cg.strikes", { n: s.strikes })} · {t(chatBlockReasonKey(s.last_reason))}{s.last_excerpt ? ": «" + s.last_excerpt + "»" : ""}</Text>
      <Button title={t("cg.lift")} variant="secondary" onPress={async () => { const r = await liftChatSuspension(supabase(), s.user_id); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else void load(); }} />
    </View>)}
  </View>;
}
