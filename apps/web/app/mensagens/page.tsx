"use client";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { useSearchParams } from "next/navigation";
import { listConversations, listMessages, sendMessage, markConversationRead, subscribeToConversationMessages, subscribeToUserConversationMessages, conversationFromParticipantRow,
  isConversationUnread, listConversationPartners, friendlyError, messagePreview, chatMediaUrls, type ChatMessage } from "@huambo-online/core";
import { ConversationSafety } from "../../components/Safety";
import { ChatAttachButtons, MessageAttachment } from "../../components/ChatMedia";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function MensagensContent() {
  const searchParams = useSearchParams();
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
    if (r.error) { setSendError(friendlyError(r.error)); return; }
    setBody("");
  }
  const otherName = (id?: string) => partners[id ?? ""]?.other_name;

  return <main style={{ maxWidth: 1100 }}>
    <a href="/">← Huambo Online</a>
    <h1>Mensagens</h1>
    <section className="inbox">
      <aside>{items.map(row => {
        const x = conversationFromParticipantRow(row); const last = previews[x.id]; const unread = isConversationUnread(row, last, uid);
        return <button key={x.id} onClick={() => open(x)} style={{ display: "block", width: "100%", textAlign: "left", padding: 14, marginBottom: 8, fontWeight: unread ? 800 : 400 }}>
          {(otherName(x.id) ? otherName(x.id) + " — " : "") + (x.subject || "Conversa")}<small> · {x.context_type}</small>
          <div>{messagePreview(last).slice(0, 90) || "Sem mensagens"}</div>
          {unread && <small>● Não lida</small>}
        </button>;
      })}</aside>
      <article>
        <h2>{selected ? ((otherName(selected.id) ? otherName(selected.id) + " — " : "") + (selected.subject || "Conversa")) : "Selecione uma conversa"}</h2>
        {selected && uid && <ConversationSafety messages={msgs} uid={uid} otherUserId={partners[selected.id]?.other_user_id} otherName={otherName(selected.id)} />}
        {msgs.map(m => <div key={m.id} style={{ margin: "10px 0" }}>
          <strong>{m.sender_id === uid ? "Você" : (otherName(selected?.id) ?? "Utilizador")}:</strong> {m.body}
          {m.attachment_kind && <div style={{ marginTop: 6 }}><MessageAttachment m={m} url={m.attachment_path ? media[m.attachment_path] : undefined} /></div>}
        </div>)}
        {selected && uid && <div className="stack" style={{ gap: 8 }}>
          <textarea aria-label="Escreva uma mensagem" value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Escreva uma mensagem" style={{ width: "100%" }} />
          {sendError && <p className="error" role="alert">{sendError}</p>}
          <button onClick={send} disabled={sending} style={{ justifySelf: "start" }}>{sending ? "A enviar…" : "Enviar"}</button>
          <ChatAttachButtons conversationId={selected.id} uid={uid} caption={body} onSent={() => { setBody(""); void showMessages(client(), selected.id); }} />
        </div>}
      </article>
    </section>
  </main>;
}
function Page() { return <Suspense fallback={<main style={{ padding: 32 }}>A carregar mensagens…</main>}><MensagensContent /></Suspense>; }
export default Page;
