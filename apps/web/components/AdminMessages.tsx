"use client";
import { useEffect, useState } from "react";
import { listMediatedConversations, listMessages, teamForwardMessage, teamSendMessage, markMessageHandled, otherParticipant, chatMediaUrls,
  friendlyErrorIn, type ChatMessage, type MediatedConversation } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";
import { MessageAttachment } from "./ChatMedia";

/**
 * Mensagens mediadas: a equipa lê cada mensagem dos utilizadores e decide reencaminhá-la
 * à outra parte, responder a um dos lados ou marcá-la como tratada sem reencaminhar.
 */
export function AdminMessages() {
  const { lang, t } = useT();
  const [pendingOnly, setPendingOnly] = useState(true);
  const [list, setList] = useState<MediatedConversation[]>([]);
  const [open, setOpen] = useState<MediatedConversation | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]); const [media, setMedia] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [reply, setReply] = useState(""); const [replyTo, setReplyTo] = useState<string>("");
  const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);

  async function loadList() {
    const r = await listMediatedConversations(supabase(), pendingOnly);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data);
  }
  async function loadConversation(c: MediatedConversation) {
    const r = await listMessages(supabase(), c.conversation_id); const rows = (r.data ?? []) as ChatMessage[];
    setMsgs(rows);
    const paths = rows.map(m => m.attachment_path).filter((p): p is string => !!p && !media[p]);
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
  const nameOf = (id: string | null | undefined) => open?.participants.find(p => p.user_id === id)?.name ?? t("ad.msg.user");
  const roleOf = (id: string | null | undefined) => open?.participants.find(p => p.user_id === id)?.role === "owner" ? t("ad.msg.owner") : t("ad.msg.starter");

  if (open) return <section className="stack">
    <button className="secondary" style={{ justifySelf: "start" }} onClick={() => { setOpen(null); setOk(""); setErr(""); }}>← {t("ad.msg.back")}</button>
    <h2 style={{ margin: 0 }}>{open.subject || t("ls.conversation")}</h2>
    <p style={{ margin: 0 }}>{open.participants.map(p => `${p.name} (${p.role === "owner" ? t("ad.msg.owner") : t("ad.msg.starter")})`).join(" · ")}</p>
    {err && <p className="error" role="alert">{err}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
    {msgs.map(m => {
      const fromTeam = !!(m as any).from_team; const handled = !!(m as any).handled_at; const to = otherParticipant(open, m.sender_id);
      return <article key={m.id} className="card" style={{ borderLeft: fromTeam ? "4px solid var(--logo-blue)" : handled ? undefined : "4px solid var(--logo-yellow)" }}>
        <small>{formatDateIn(m.created_at, lang)} · {fromTeam
          ? `🛡️ ${t("ad.msg.team")} → ${(m as any).audience ? nameOf((m as any).audience) : t("ad.msg.both")}`
          : `${nameOf(m.sender_id)} (${roleOf(m.sender_id)})${handled ? " · ✓ " + t("ad.msg.handled") : " · ⏳ " + t("ad.msg.pending")}`}</small>
        <p style={{ margin: "6px 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
        {m.attachment_kind && <MessageAttachment m={m} url={m.attachment_path ? media[m.attachment_path] : undefined} />}
        {!fromTeam && !handled && to && <div className="stack" style={{ gap: 6 }}>
          <textarea rows={2} value={drafts[m.id] ?? ""} onChange={e => setDrafts(d => ({ ...d, [m.id]: e.target.value }))}
            placeholder={t("ad.msg.edit_before")} aria-label={t("ad.msg.edit_before")} />
          <div className="row">
            <button disabled={busy} onClick={() => run(() => teamForwardMessage(supabase(), open.conversation_id, m.id, to.user_id, drafts[m.id]), t("ad.msg.ok_forwarded"))}>
              ➡️ {t("ad.msg.forward_to", { name: to.name })}</button>
            <button className="secondary" disabled={busy} onClick={() => run(() => markMessageHandled(supabase(), m.id), t("ad.msg.ok_handled"))}>{t("ad.msg.mark_handled")}</button>
          </div>
        </div>}
      </article>;
    })}
    <form className="stack card" onSubmit={e => { e.preventDefault(); void run(() => teamSendMessage(supabase(), open.conversation_id, replyTo || null, reply), t("ad.msg.ok_sent")).then(() => setReply("")); }}>
      <h3 style={{ margin: 0 }}>🛡️ {t("ad.msg.write")}</h3>
      <label>{t("ad.msg.to")}
        <select value={replyTo} onChange={e => setReplyTo(e.target.value)}>
          {open.participants.map(p => <option key={p.user_id} value={p.user_id}>{p.name} ({p.role === "owner" ? t("ad.msg.owner") : t("ad.msg.starter")})</option>)}
          <option value="">{t("ad.msg.both")}</option>
        </select>
      </label>
      <textarea rows={3} value={reply} onChange={e => setReply(e.target.value)} aria-label={t("ad.msg.write")} />
      <button disabled={busy || !reply.trim()} style={{ justifySelf: "start" }}>{t("common.send")}</button>
    </form>
  </section>;

  return <section className="stack">
    <p style={{ margin: 0 }}>{t("ad.msg.intro")}</p>
    <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={pendingOnly} onChange={e => setPendingOnly(e.target.checked)} style={{ width: 22, height: 22 }} /> {t("ad.msg.pending_only")}</label>
    {err && <p className="error" role="alert">{err}</p>}
    {!list.length && <p>{t("ad.msg.none")}</p>}
    {list.map(c => <button key={c.conversation_id} className="card" style={{ textAlign: "left" }} onClick={() => setOpen(c)}>
      <strong>{c.subject || t("ls.conversation")}</strong>
      <span>{c.participants.map(p => p.name).join(" ↔ ")}</span>
      <small>{c.pending ? `⏳ ${t("ad.msg.pending_count", { n: c.pending })}` : `✓ ${t("ad.msg.all_handled")}`}{c.last_message_at ? " · " + formatDateIn(c.last_message_at, lang) : ""}</small>
    </button>)}
  </section>;
}
