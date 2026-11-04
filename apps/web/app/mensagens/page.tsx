"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { useSearchParams } from "next/navigation";
import { listConversations, listMessages, sendMessage, markConversationRead, subscribeToConversationMessages, subscribeToUserConversationMessages, conversationFromParticipantRow,
  isConversationUnread, listConversationPartners, conversationAllowsDocuments, friendlyErrorIn, messagePreview, CHAT_KIND_LABELS, chatMediaUrls,
  chatListTime, chatDayLabel, chatClock, groupChatMessages, initials, avatarColor, type ChatMessage } from "@huambo-online/core";
import { ConversationSafety } from "../../components/Safety";
import { ChatAttachButtons, MessageAttachment } from "../../components/ChatMedia";
import { useT } from "../../lib/i18n";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""; const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Fotografia redonda ou iniciais numa cor fixa por pessoa. */
function Avatar({ name, src, seed, size = 48 }: { name?: string | null; src?: string | null; seed?: string | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className="chat-avatar" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  return <span className="chat-avatar" aria-hidden style={{ width: size, height: size, background: avatarColor(seed ?? name), fontSize: size * 0.38 }}>{initials(name)}</span>;
}

/** Ligação para o que deu origem à conversa (anúncio, produto, profissional). */
function contextHref(x: any): string | null {
  if (x?.classified_listing_id) return "/classificados/" + x.classified_listing_id;
  if (x?.product_id) return "/loja/" + x.product_id;
  if (x?.provider_id) return "/profissionais/" + x.provider_id;
  return null;
}

function MensagensContent() {
  const searchParams = useSearchParams();
  const { lang, t, tc } = useT();
  const ctx = (v: string) => { const k = "ls.ctx." + v; const r = t(k); return r === k ? v : r; };
  const preview = (m: any) => { let s = messagePreview(m); if (m?.attachment_kind) { const l = CHAT_KIND_LABELS[m.attachment_kind as keyof typeof CHAT_KIND_LABELS]; if (l && s.startsWith(l)) s = tc(l) + s.slice(l.length); } return s; };
  const [items, setItems] = useState<any[]>([]); const [previews, setPreviews] = useState<Record<string, any>>({}); const [selected, setSelected] = useState<any>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]); const [media, setMedia] = useState<Record<string, string>>({}); const [body, setBody] = useState(""); const [uid, setUid] = useState("");
  const [partners, setPartners] = useState<Record<string, any>>({}); const [allowDocs, setAllowDocs] = useState(false); const [sendError, setSendError] = useState(""); const [sending, setSending] = useState(false);
  const [query, setQuery] = useState(""); const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement>(null); const inputRef = useRef<HTMLTextAreaElement>(null);
  const client = () => createSupabaseClient(url, key);

  async function load() {
    const c = client(); const u = await c.auth.getUser(); if (!u.data.user) { setLoaded(true); return; }
    setUid(u.data.user.id);
    const r = await listConversations(c, u.data.user.id); const rows = r.data ?? [];
    const pv: any = {};
    await Promise.all(rows.map(async row => { const x = conversationFromParticipantRow(row); const m = await listMessages(c, x.id); pv[x.id] = m.data?.at(-1) ?? null; }));
    const last = (row: any) => { const x = conversationFromParticipantRow(row); return pv[x.id]?.created_at ?? x.updated_at ?? x.created_at; };
    setItems([...rows].sort((a, b) => String(last(b)).localeCompare(String(last(a)))));
    setPreviews(pv); setPartners(await listConversationPartners(c)); setLoaded(true);
  }
  async function showMessages(c: ReturnType<typeof client>, id: string) {
    const r = await listMessages(c, id); const list = (r.data ?? []) as ChatMessage[]; setMsgs(list);
    const paths = list.map(m => m.attachment_path).filter((p): p is string => !!p && !media[p]);
    if (paths.length) { const urls = await chatMediaUrls(c, paths); setMedia(old => ({ ...old, ...urls })); }
  }
  async function open(x: any) {
    setSelected(x); setSendError(""); setBody(""); const c = client(); setAllowDocs(false);
    void conversationAllowsDocuments(c, x).then(setAllowDocs);
    await showMessages(c, x.id); if (uid) { await markConversationRead(c, x.id, uid); setItems(old => old.map(r => conversationFromParticipantRow(r).id === x.id ? { ...r, last_read_at: new Date().toISOString() } : r)); }
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!uid) return; return subscribeToUserConversationMessages(client(), uid, () => { void load(); }); }, [uid]);
  useEffect(() => { const id = searchParams.get("conversation"); if (id && items.length && !selected) { const x = items.map(conversationFromParticipantRow).find(v => v?.id === id); if (x) void open(x); } }, [searchParams, items.length]);
  useEffect(() => {
    if (!selected) return; const c = client();
    return subscribeToConversationMessages(c, selected.id, async () => { await showMessages(c, selected.id); if (uid) await markConversationRead(c, selected.id, uid); });
  }, [selected?.id, uid]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length, selected?.id]);
  useEffect(() => { const el = inputRef.current; if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 140) + "px"; } }, [body]);

  async function send() {
    const text = body.trim(); if (!text || !selected || !uid || sending) return;
    setSending(true); setSendError("");
    const r = await sendMessage(client(), selected.id, uid, text); setSending(false);
    if (r.error) { setSendError(friendlyErrorIn(r.error, lang)); if (r.data) { setBody(""); void showMessages(client(), selected.id); } return; }
    setBody(""); void showMessages(client(), selected.id);
  }
  const partner = (id?: string) => partners[id ?? ""];
  const rows = useMemo(() => groupChatMessages(msgs, uid), [msgs, uid]);
  const visible = items.filter(row => {
    if (!query.trim()) return true; const x = conversationFromParticipantRow(row);
    return ((partner(x.id)?.other_name ?? "") + " " + (x.subject ?? "")).toLowerCase().includes(query.trim().toLowerCase());
  });
  const other = selected ? partner(selected.id) : null; const href = selected ? contextHref(selected) : null;

  return <main className="chat-page">
    <div className={"chat-app" + (selected ? " has-open" : "")}>
      <aside className="chat-list" aria-label={t("nav.messages")}>
        <div className="chat-list-head">
          <h1>{t("nav.messages")}</h1>
          <input className="chat-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("cg.search")} aria-label={t("cg.search")} />
        </div>
        <div className="chat-list-items">
          {loaded && !items.length && <p className="muted" style={{ padding: 16 }}>{t("cg.empty")}</p>}
          {visible.map(row => {
            const x = conversationFromParticipantRow(row); const last = previews[x.id]; const unread = isConversationUnread(row, last, uid); const p = partner(x.id);
            const mine = last && last.sender_id === uid && !last.from_team;
            return <button key={x.id} type="button" className={"chat-item" + (selected?.id === x.id ? " on" : "") + (unread ? " unread" : "")} onClick={() => void open(x)}>
              <Avatar name={p?.other_name} src={p?.other_avatar} seed={p?.other_user_id} />
              <span className="chat-item-text">
                <span className="chat-item-top"><strong>{p?.other_name ?? t("ls.user")}</strong><small>{chatListTime(last?.created_at ?? x.updated_at, lang)}</small></span>
                <span className="chat-item-sub">{x.subject || ctx(x.context_type)}</span>
                <span className="chat-item-last">{last ? (mine ? t("cg.you_prefix") : "") + preview(last) : t("ls.no_messages")}</span>
              </span>
              {unread && <span className="chat-dot" aria-label={t("ls.unread")} />}
            </button>;
          })}
        </div>
      </aside>

      <section className="chat-pane" aria-label={selected ? (other?.other_name ?? t("ls.conversation")) : t("ls.select_conversation")}>
        {!selected ? <div className="chat-empty"><span style={{ fontSize: 56 }}>💬</span><p>{t("ls.select_conversation")}</p></div> : <>
          <header className="chat-head">
            <button type="button" className="chat-icon chat-back" aria-label={t("cg.back")} onClick={() => setSelected(null)}>←</button>
            <Avatar name={other?.other_name} src={other?.other_avatar} seed={other?.other_user_id} size={40} />
            <div className="chat-head-text">
              <strong>{other?.other_name ?? t("ls.user")}</strong>
              <small>{selected.subject || ctx(selected.context_type)}{href && <> · <a href={href}>{t("cg.view_listing")}</a></>}</small>
            </div>
          </header>
          <details className="chat-safety">
            <summary>🛡️ {t("cg.safety")}</summary>
            <p className="muted" style={{ margin: "0 0 8px" }}>{t("ls.mediated_note")}</p>
            {uid && <ConversationSafety messages={msgs} uid={uid} otherUserId={other?.other_user_id} otherName={other?.other_name} />}
          </details>
          <div className="chat-scroll">
            {!msgs.length && <div className="chat-empty small"><Avatar name={other?.other_name} src={other?.other_avatar} seed={other?.other_user_id} size={72} /><p>{t("cg.say_hi")}</p></div>}
            {rows.map(({ m, mine, newDay, first, last }) => {
              const team = !!m.from_team; const blocked = mine && !!m.blocked_reason; const pending = mine && !!m.attachment_kind && !m.handled_at;
              return <div key={m.id}>
                {newDay && <div className="chat-day"><span>{chatDayLabel(m.created_at, lang)}</span></div>}
                <div className={"chat-row" + (mine ? " mine" : "") + (team ? " team" : "") + (first ? " first" : "") + (last ? " last" : "")}>
                  {!mine && <span className="chat-row-avatar">{last && !team ? <Avatar name={other?.other_name} src={other?.other_avatar} seed={other?.other_user_id} size={28} /> : last && team ? <span className="chat-avatar team" style={{ width: 28, height: 28 }}>🛡️</span> : null}</span>}
                  <div className="chat-col">
                    {team && first && <small className="chat-team-name">🛡️ {t("cg.team")}</small>}
                    <div className={"chat-bubble" + (blocked ? " blocked" : "") + (m.attachment_kind && !m.body ? " media" : "")} title={chatClock(m.created_at, lang)}>
                      {m.attachment_kind && <div className="chat-media"><MessageAttachment m={m} url={m.attachment_path ? media[m.attachment_path] : undefined} /></div>}
                      {m.body && <span>{m.body}</span>}
                    </div>
                    {blocked && <small className="chat-note error">{t("ls.msg_blocked")}</small>}
                    {pending && <small className="chat-note">{t("ls.msg_pending")}</small>}
                    {last && !blocked && !pending && <small className="chat-time">{chatClock(m.created_at, lang)}</small>}
                  </div>
                </div>
              </div>;
            })}
            <div ref={endRef} />
          </div>
          {sendError && <p className="error chat-error" role="alert">{sendError}</p>}
          {uid && <div className={"chat-composer" + (body.trim() ? " typing" : "")}>
            <ChatAttachButtons compact conversationId={selected.id} uid={uid} caption={body} allowDocuments={allowDocs} onSent={() => { setBody(""); void showMessages(client(), selected.id); }} />
            <textarea ref={inputRef} rows={1} className="chat-input" aria-label={t("ls.write_message")} title={t("cg.enter_hint")} value={body} placeholder={t("ls.write_message")}
              onChange={e => setBody(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
            <button type="button" className="chat-send" aria-label={t("cg.send")} title={t("cg.send")} disabled={sending || !body.trim()} onClick={() => void send()}>➤</button>
          </div>}
        </>}
      </section>
    </div>
  </main>;
}
function Loading() { const { t } = useT(); return <main style={{ padding: 32 }}>{t("ls.loading_messages")}</main>; }
function Page() { return <Suspense fallback={<Loading />}><MensagensContent /></Suspense>; }
export default Page;
