import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BackHandler, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { listConversations, listMessages, sendMessage, markConversationRead, subscribeToConversationMessages, subscribeToUserConversationMessages, conversationFromParticipantRow,
  isConversationUnread, listConversationPartners, conversationAllowsDocuments, friendlyErrorIn, messagePreview, chatMediaUrls, chatListTime, chatDayLabel, chatClock,
  groupChatMessages, initials, avatarColor } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { themed, C } from "../lib/ui";
import { useT } from "../lib/i18n";
import { ConversationSafety } from "../components/Safety";
import { ChatAttachButtons, MessageAttachment } from "../components/ChatMedia";

/** Fotografia redonda ou iniciais numa cor fixa por pessoa. */
function Avatar({ name, src, seed, size = 52 }: { name?: string | null; src?: string | null; seed?: string | null; size?: number }) {
  if (src) return <Image source={{ uri: src }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.surface }} accessibilityIgnoresInvertColors />;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(seed ?? name), alignItems: "center", justifyContent: "center" }}>
    <Text style={{ color: "#fff", fontWeight: "800", fontSize: size * 0.38 }}>{initials(name)}</Text>
  </View>;
}
/** Para onde leva «Ver anúncio» (anúncio, produto ou profissional). */
function contextHref(x: any): string | null {
  if (x?.classified_listing_id) return "/classificados/" + x.classified_listing_id;
  if (x?.product_id) return "/loja/" + x.product_id;
  if (x?.provider_id) return "/profissionais/" + x.provider_id;
  return null;
}

export default function Mensagens() {
  const { t, tc, lang } = useT(); const router = useRouter();
  const { conversation } = useLocalSearchParams<{ conversation?: string }>();
  const [items, setItems] = useState<any[]>([]); const [previews, setPreviews] = useState<Record<string, any>>({}); const [selected, setSelected] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]); const [uid, setUid] = useState(""); const [partners, setPartners] = useState<Record<string, any>>({});
  const [body, setBody] = useState(""); const [sendError, setSendError] = useState(""); const [sending, setSending] = useState(false);
  const [media, setMedia] = useState<Record<string, string>>({}); const [allowDocs, setAllowDocs] = useState(false); const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false); const [safetyOpen, setSafetyOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);

  async function showMessages(c: any, id: string) {
    const r = await listMessages(c, id); const list = (r.data ?? []) as any[]; setMsgs(list);
    const paths = list.map(m => m.attachment_path).filter((p: any) => !!p && !media[p]);
    if (paths.length) { const urls = await chatMediaUrls(c, paths); setMedia(o => ({ ...o, ...urls })); }
  }
  async function load() {
    const c = supabase(); const u = await c.auth.getUser(); if (!u.data.user) { setLoaded(true); return; }
    setUid(u.data.user.id);
    const r = await listConversations(c, u.data.user.id); const rows = r.data ?? []; const pv: any = {};
    await Promise.all(rows.map(async (row: any) => { const x = conversationFromParticipantRow(row); const z = await listMessages(c, x.id); pv[x.id] = z.data?.at(-1) ?? null; }));
    const last = (row: any) => { const x = conversationFromParticipantRow(row); return pv[x.id]?.created_at ?? x.updated_at ?? x.created_at; };
    setItems([...rows].sort((a, b) => String(last(b)).localeCompare(String(last(a)))));
    setPreviews(pv); setPartners(await listConversationPartners(c)); setLoaded(true);
  }
  async function open(x: any) {
    setSelected(x); setSendError(""); setBody(""); setSafetyOpen(false); const c = supabase(); setAllowDocs(false);
    void conversationAllowsDocuments(c, x).then(setAllowDocs);
    await showMessages(c, x.id);
    if (uid) { await markConversationRead(c, x.id, uid); setItems(old => old.map(r => conversationFromParticipantRow(r).id === x.id ? { ...r, last_read_at: new Date().toISOString() } : r)); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!uid) return; return subscribeToUserConversationMessages(supabase(), uid, () => { void load(); }); }, [uid]);
  useEffect(() => { if (conversation && items.length && !selected) { const x = items.map(conversationFromParticipantRow).find(v => v?.id === conversation); if (x) void open(x); } }, [conversation, items.length]);
  useEffect(() => {
    if (!selected) return; const c = supabase();
    return subscribeToConversationMessages(c, selected.id, async () => { await showMessages(c, selected.id); if (uid) await markConversationRead(c, selected.id, uid); });
  }, [selected?.id, uid]);
  // Botão «voltar» do Android: da conversa para a lista.
  useEffect(() => {
    if (!selected) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { setSelected(null); return true; });
    return () => sub.remove();
  }, [selected?.id]);

  async function send() {
    const text = body.trim(); if (!text || !selected || !uid || sending) return;
    const c = supabase(); setSending(true); setSendError("");
    const r = await sendMessage(c, selected.id, uid, text); setSending(false);
    if (r.error) { setSendError(friendlyErrorIn(r.error, lang)); if (r.data) { setBody(""); void showMessages(c, selected.id); } return; }
    setBody(""); void showMessages(c, selected.id);
  }
  const partner = (id?: string) => partners[id ?? ""];
  const rows = useMemo(() => groupChatMessages(msgs, uid), [msgs, uid]);

  // ───── Lista de conversas ─────
  if (!selected) {
    const visible = items.filter(row => {
      if (!query.trim()) return true; const x = conversationFromParticipantRow(row);
      return ((partner(x.id)?.other_name ?? "") + " " + (x.subject ?? "")).toLowerCase().includes(query.trim().toLowerCase());
    });
    return <ScrollView contentContainerStyle={s.listWrap} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{t("nav.messages")}</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder={"🔎 " + t("cg.search")} placeholderTextColor={C.muted} style={s.search} accessibilityLabel={t("cg.search")} />
      {loaded && !items.length && <Text style={s.muted}>{t("cg.empty")}</Text>}
      {visible.map(row => {
        const x = conversationFromParticipantRow(row); const last = previews[x.id]; const unread = isConversationUnread(row, last, uid); const p = partner(x.id);
        const mine = last && last.sender_id === uid && !last.from_team;
        return <Pressable key={x.id} onPress={() => void open(x)} accessibilityRole="button" accessibilityLabel={(p?.other_name ?? t("ls.user")) + (unread ? ", " + t("ls.chat.unread") : "")}
          android_ripple={{ color: "rgba(0,0,0,0.06)" }} style={s.item}>
          <Avatar name={p?.other_name} src={p?.other_avatar} seed={p?.other_user_id} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.itemTop}>
              <Text style={[s.name, unread && s.strong]} numberOfLines={1}>{p?.other_name ?? t("ls.user")}</Text>
              <Text style={[s.time, unread && s.strong]}>{chatListTime(last?.created_at ?? x.updated_at, lang)}</Text>
            </View>
            <Text style={s.sub} numberOfLines={1}>{x.subject || x.context_type}</Text>
            <Text style={[s.last, unread && s.strong]} numberOfLines={1}>{last ? (mine ? t("cg.you_prefix") : "") + tc(messagePreview(last)) : t("ls.chat.no_messages")}</Text>
          </View>
          {unread && <View style={s.dot} />}
        </Pressable>;
      })}
    </ScrollView>;
  }

  // ───── Conversa ─────
  const other = partner(selected.id); const href = contextHref(selected);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={s.head}>
      <Pressable onPress={() => setSelected(null)} accessibilityRole="button" accessibilityLabel={t("cg.back")} hitSlop={10} style={s.back}><Text style={s.backTx}>←</Text></Pressable>
      <Avatar name={other?.other_name} src={other?.other_avatar} seed={other?.other_user_id} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.headName} numberOfLines={1}>{other?.other_name ?? t("ls.user")}</Text>
        <Text style={s.sub} numberOfLines={1}>{selected.subject || selected.context_type}</Text>
      </View>
      {href && <Pressable onPress={() => router.push(href as any)} accessibilityRole="link" hitSlop={8}><Text style={s.link}>{t("cg.view_listing")}</Text></Pressable>}
      <Pressable onPress={() => setSafetyOpen(v => !v)} accessibilityRole="button" accessibilityLabel={t("cg.safety")} accessibilityState={{ expanded: safetyOpen }} hitSlop={8} style={s.back}><Text style={{ fontSize: 22 }}>🛡️</Text></Pressable>
    </View>
    {safetyOpen && <ScrollView style={s.safety} contentContainerStyle={{ gap: 8, padding: 12 }}>
      <Text style={s.muted}>{t("ls.chat.mediated_note")}</Text>
      {!!uid && <ConversationSafety messages={msgs} uid={uid} otherUserId={other?.other_user_id} otherName={other?.other_name} />}
    </ScrollView>}
    <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={s.thread} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
      {!msgs.length && <View style={s.hello}><Avatar name={other?.other_name} src={other?.other_avatar} seed={other?.other_user_id} size={80} /><Text style={s.headName}>{other?.other_name}</Text><Text style={s.muted}>{t("cg.say_hi")}</Text></View>}
      {rows.map(({ m, mine, newDay, first, last }) => {
        const team = !!m.from_team; const blocked = mine && !!m.blocked_reason; const pending = mine && !!m.attachment_kind && !m.handled_at;
        const media_ = !!m.attachment_kind && !m.body;
        const corner = mine ? { borderTopRightRadius: first ? 20 : 6, borderBottomRightRadius: last ? 20 : 6 } : { borderTopLeftRadius: first ? 20 : 6, borderBottomLeftRadius: last ? 20 : 6 };
        return <View key={m.id}>
          {newDay && <View style={s.dayWrap}><Text style={s.day}>{chatDayLabel(m.created_at, lang)}</Text></View>}
          <View style={[s.row, mine && s.rowMine, { marginTop: first ? 10 : 2 }]}>
            {!mine && <View style={{ width: 28 }}>{last && (team ? <View style={s.teamAv}><Text>🛡️</Text></View> : <Avatar name={other?.other_name} src={other?.other_avatar} seed={other?.other_user_id} size={28} />)}</View>}
            <View style={[s.col, mine && { alignItems: "flex-end" }]}>
              {team && first && <Text style={s.teamName}>🛡️ {t("cg.team")}</Text>}
              <View style={[s.bubble, mine ? s.bubbleMine : team ? s.bubbleTeam : s.bubbleOther, corner, blocked && s.bubbleBlocked, media_ && s.bubbleMedia]}>
                {!!m.attachment_kind && <MessageAttachment m={m} url={m.attachment_path ? media[m.attachment_path] : undefined} />}
                {!!m.body && <Text style={[s.msg, mine && !blocked && { color: C.onAccent }, team && { color: C.yellowText }, blocked && s.msgBlocked]}>{m.body}</Text>}
              </View>
              {blocked && <Text style={s.noteErr}>{t("ls.chat.msg_blocked")}</Text>}
              {pending && <Text style={s.note}>{t("ls.chat.msg_pending")}</Text>}
              {last && !blocked && !pending && <Text style={s.note}>{chatClock(m.created_at, lang)}</Text>}
            </View>
          </View>
        </View>;
      })}
    </ScrollView>
    {!!sendError && <Text accessibilityRole="alert" style={s.err}>{sendError}</Text>}
    {!!uid && <View style={s.composer}>
      {<ChatAttachButtons compact iconsHidden={!!body.trim()} allowDocuments={allowDocs} conversationId={selected.id} uid={uid} caption={body} onSent={() => { setBody(""); void showMessages(supabase(), selected.id); }} />}
      <TextInput accessibilityLabel={t("ls.chat.write")} value={body} onChangeText={setBody} placeholder={t("ls.chat.write")} placeholderTextColor={C.muted} multiline style={s.input} />
      <Pressable accessibilityRole="button" accessibilityLabel={t("cg.send")} disabled={sending || !body.trim()} onPress={() => void send()}
        style={({ pressed }) => [s.send, { opacity: sending || !body.trim() ? 0.4 : pressed ? 0.7 : 1 }]}><Text style={s.sendTx}>➤</Text></Pressable>
    </View>}
  </KeyboardAvoidingView>;
}

const s = themed(C => StyleSheet.create({
  listWrap: { paddingTop: 54, paddingHorizontal: 12, paddingBottom: 24, gap: 4 },
  title: { color: C.ink, fontSize: 30, fontWeight: "800", paddingHorizontal: 4 },
  search: { backgroundColor: C.surface, color: C.ink, borderRadius: 999, paddingHorizontal: 18, minHeight: 46, fontSize: 16, marginVertical: 8 },
  muted: { color: C.muted, fontSize: 15, lineHeight: 21 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 14, minHeight: 74 },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  name: { color: C.ink, fontSize: 17, fontWeight: "600", flexShrink: 1 },
  time: { color: C.muted, fontSize: 13 },
  sub: { color: C.muted, fontSize: 13 },
  last: { color: C.muted, fontSize: 15 },
  strong: { color: C.ink, fontWeight: "800" },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.blue },
  head: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 50, paddingBottom: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: C.white },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  backTx: { color: C.blue, fontSize: 26, fontWeight: "700" },
  headName: { color: C.ink, fontSize: 17, fontWeight: "800" },
  link: { color: C.blue, fontWeight: "800", fontSize: 14 },
  safety: { maxHeight: 280, borderBottomWidth: 1, borderBottomColor: C.line },
  thread: { paddingHorizontal: 10, paddingVertical: 10, flexGrow: 1, justifyContent: "flex-end" },
  hello: { alignItems: "center", gap: 6, marginBottom: 20 },
  dayWrap: { alignItems: "center", marginTop: 14, marginBottom: 6 },
  day: { color: C.muted, fontSize: 12, fontWeight: "700", backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  rowMine: { justifyContent: "flex-end" },
  col: { maxWidth: "78%" },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, gap: 6 },
  bubbleMine: { backgroundColor: C.blue },
  bubbleOther: { backgroundColor: C.surface },
  bubbleTeam: { backgroundColor: C.yellowSoft, borderWidth: 1, borderColor: C.yellowLine },
  bubbleBlocked: { backgroundColor: "transparent", borderWidth: 2, borderStyle: "dashed", borderColor: C.red },
  bubbleMedia: { backgroundColor: "transparent", paddingHorizontal: 2, paddingVertical: 2 },
  msg: { color: C.ink, fontSize: 16, lineHeight: 22 },
  msgBlocked: { color: C.muted, textDecorationLine: "line-through" },
  teamAv: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.yellowSoft, alignItems: "center", justifyContent: "center" },
  teamName: { color: C.muted, fontSize: 12, fontWeight: "700", marginLeft: 4, marginBottom: 2 },
  note: { color: C.muted, fontSize: 12, marginTop: 3, marginHorizontal: 6 },
  noteErr: { color: C.red, fontSize: 12, fontWeight: "700", marginTop: 3, marginHorizontal: 6 },
  err: { color: C.red, fontWeight: "800", fontSize: 15, paddingHorizontal: 12, paddingTop: 6 },
  composer: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white },
  input: { flex: 1, minWidth: 120, color: C.ink, backgroundColor: C.surface, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, minHeight: 44, maxHeight: 130, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" },
  sendTx: { color: C.onAccent, fontSize: 18, fontWeight: "800" }
}));
