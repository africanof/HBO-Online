"use client";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { useSearchParams } from "next/navigation";
import { listConversations, listMessages, sendMessage, markConversationRead, subscribeToConversationMessages, subscribeToUserConversationMessages, conversationFromParticipantRow,
  isConversationUnread, listConversationPartners, friendlyErrorIn, messagePreview, CHAT_KIND_LABELS, chatMediaUrls, type ChatMessage } from "@huambo-online/core";
import { ConversationSafety } from "../../components/Safety";
import { ChatAttachButtons, MessageAttachment } from "../../components/ChatMedia";
import { useT } from "../../lib/i18n";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function MensagensContent() {
  const searchParams = useSearchParams();
  const { lang, t, tc } = useT();
  /** Tipo de conversa (anúncio, produto…) na língua escolhida; se não houver tradução mostra o valor tal como vem. */
  const ctx = (v: string) => { const k = "ls.ctx." + v; const r = t(k); return r === k ? v : r; };
  /** Pré-visualização com a etiqueta do anexo («🎤 Mensagem de voz») traduzida. */
  const preview = (m: any) => { let s = messagePreview(m); if (m?.attachment_kind) { const l = CHAT_KIND_LABELS[m.attachment_kind as keyof typeof CHAT_KIND_LABELS]; if (l && s.startsWith(l)) s = tc(l) + s.slice(l.length); } return s; };
  const [items, setItems] = useState<any[]>([]); const [previews, setPreviews] = useState<Record<string, any>>({}); const [selected, setSelected] = useState<any>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]); const [media, setMedia] = useState<Record<string, string>>({}); const [body, setBody] = useState(""); const [uid, setUid] = useState("");
  const [partners, setPartners] = useState<Record<string, any>>({}); const [sendError, setSendError] = useState(""); const [sending, setSending] = useState(false);
  const client = () => createSupabaseClient(url, key);

  async function load() {
    const c = client(); const u = await c.auth.getUser(); if (!u.data.user) return;
    setUid(u.data.user.id);
    const r = await listConversations(c, u.data.user.id); const rows = r.data ?? []; setItems(rows);
    const pv: any = {};
    for (const row of rows) { const x = conversationFromParticipantRow(row); const m = await listMessages(c, x.id); pv[x.id] = m.data?.at(-1) ?? null; }
    setPreviews(pv); setPartners(await listConversationPartners(c));
  }
  async function showMessages(c: ReturnType<typeof client>, id: string) {
    const r = await listMessages(c, id); const list = (r.data ?? []) as ChatMessage[]; setMsgs(list);
    const paths = list.map(m => m.attachment_path).filter((p): p is string => !!p && !media[p]);
    if (paths.length) { const urls = await chatMediaUrls(c, paths); setMedia(old => ({ ...old, ...urls })); }
  }
  async function open(x: any) {
    setSelected(x); setSendError(""); const c = client();
    await showMessages(c, x.id); if (uid) await markConversationRead(c, x.id, uid);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!uid) return; return subscribeToUserConversationMessages(client(), uid, () => { void load(); }); }, [uid]);
  useEffect(() => { const id = searchParams.get("conversation"); if (id && items.length) { const x = items.map(conversationFromParticipantRow).find(v => v?.id === id); if (x) void open(x); } }, [searchParams, items.length]);
  useEffect(() => {
    if (!selected) return; const c = client();
    return subscribeToConversationMessages(c, selected.id, async () => { await showMessages(c, selected.id); if (uid) await markConversationRead(c, selected.id, uid); });
  }, [selected?.id, uid]);
  async function send() {
    if (!body.trim() || !selected || !uid) return;
    setSending(true); setSendError("");
    const r = await sendMessage(client(), selected.id, uid, body); setSending(false);
    if (r.error) { setSendError(friendlyErrorIn(r.error, lang)); return; }
    setBody("");
  }
  const otherName = (id?: string) => partners[id ?? ""]?.other_name;

  return <main style={{ maxWidth: 1100 }}>
    <a href="/">← Huambo Online</a>
    <h1>{t("nav.messages")}</h1>
    <section className="inbox">
      <aside>{items.map(row => {
        const x = conversationFromParticipantRow(row); const last = previews[x.id]; const unread = isConversationUnread(row, last, uid);
        return <button key={x.id} onClick={() => open(x)} style={{ display: "block", width: "100%", textAlign: "left", padding: 14, marginBottom: 8, fontWeight: unread ? 800 : 400 }}>
          {(otherName(x.id) ? otherName(x.id) + " — " : "") + (x.subject || t("ls.conversation"))}<small> · {ctx(x.context_type)}</small>
          <div>{preview(last).slice(0, 90) || t("ls.no_messages")}</div>
          {unread && <small>● {t("ls.unread")}</small>}
        </button>;
      })}</aside>
      <article>
        <h2>{selected ? ((otherName(selected.id) ? otherName(selected.id) + " — " : "") + (selected.subject || t("ls.conversation"))) : t("ls.select_conversation")}</h2>
        {selected && <p className="scam-warn" style={{ margin: "0 0 8px" }}>{t("ls.mediated_note")}</p>}
        {selected && uid && <ConversationSafety messages={msgs} uid={uid} otherUserId={partners[selected.id]?.other_user_id} otherName={otherName(selected.id)} />}
        {msgs.map(m => <div key={m.id} style={{ margin: "10px 0" }}>
          <strong>{m.sender_id === uid ? t("ls.you") : (otherName(selected?.id) ?? t("ls.user"))}:</strong> {m.body}
          {m.attachment_kind && <div style={{ marginTop: 6 }}><MessageAttachment m={m} url={m.attachment_path ? media[m.attachment_path] : undefined} /></div>}
        </div>)}
        {selected && uid && <div className="stack" style={{ gap: 8 }}>
          <textarea aria-label={t("ls.write_message")} value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder={t("ls.write_message")} style={{ width: "100%" }} />
          {sendError && <p className="error" role="alert">{sendError}</p>}
          <button onClick={send} disabled={sending} style={{ justifySelf: "start" }}>{sending ? t("ls.sending") : t("common.send")}</button>
          <ChatAttachButtons conversationId={selected.id} uid={uid} caption={body} onSent={() => { setBody(""); void showMessages(client(), selected.id); }} />
        </div>}
      </article>
    </section>
  </main>;
}
function Loading() { const { t } = useT(); return <main style={{ padding: 32 }}>{t("ls.loading_messages")}</main>; }
function Page() { return <Suspense fallback={<Loading />}><MensagensContent /></Suspense>; }
export default Page;
