"use client";
import { useEffect, useRef, useState } from "react";
import { listWhatsappThreads, whatsappMessages, setWhatsappThreadStatus, sendWhatsappReply, listWhatsappNumbers, saveWhatsappNumber, formatWaId, friendlyErrorIn,
  WHATSAPP_AREAS, type WhatsappThread, type WhatsappMessage, type WhatsappNumber, type WhatsappArea } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";

/** Administração → WhatsApp: conversas (a IA responde primeiro) e números da equipa. */
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
  if (open) return <WhatsappThreadView thread={open} onBack={() => { setOpen(null); void load(); }} />;
  return <section className="stack">
    <h2 style={{ margin: 0 }}>{t("wa.title")}</h2>
    <p style={{ margin: 0 }}>{t("wa.intro")}</p>
    <div className="row" style={{ alignItems: "center" }}>
      <label className="row" style={{ gap: 8, alignItems: "center" }}><input type="checkbox" checked={onlyWaiting} onChange={e => setOnlyWaiting(e.target.checked)} style={{ width: 22, height: 22 }} /> {t("wa.waiting_only")}</label>
      {numbers.length > 1 && <select value={numberId} onChange={e => setNumberId(e.target.value)} aria-label={t("wa.all_numbers")} style={{ maxWidth: 260 }}>
        <option value="">{t("wa.all_numbers")}</option>{numbers.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {!threads.length && <p className="muted">{t("wa.none")}</p>}
    {threads.map(c => <button key={c.id} type="button" className="card" onClick={() => setOpen(c)}
      style={{ textAlign: "left", display: "grid", gap: 4, borderLeft: `5px solid ${c.status === "human" ? "var(--yellow-line, #e0b100)" : c.status === "ai" ? "var(--accent)" : "var(--line)"}` }}>
      <span className="row" style={{ justifyContent: "space-between" }}>
        <strong>{c.contact_name || formatWaId(c.wa_id)}{c.unread > 0 && <span className="badge" style={{ marginLeft: 8 }}>{c.unread}</span>}</strong>
        <small>{formatDateIn(c.last_message_at, lang)}</small>
      </span>
      <small>{t("wa.st." + c.status)} · {c.number_label} · {formatWaId(c.wa_id)}{c.account_name ? " · " + t("wa.account", { n: c.account_name }) : ""}</small>
      {c.last_body && <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last_body}</span>}
    </button>)}
    <WhatsappNumbersAdmin numbers={numbers} onChange={() => void load()} />
  </section>;
}

function WhatsappThreadView({ thread, onBack }: { thread: WhatsappThread; onBack: () => void }) {
  const { t, lang } = useT();
  const [msgs, setMsgs] = useState<WhatsappMessage[]>([]); const [th, setTh] = useState(thread);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  async function load() {
    const r = await whatsappMessages(supabase(), thread.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setMsgs(r.data);
    const l = await listWhatsappThreads(supabase(), false, thread.number_id); const now = l.data.find(x => x.id === thread.id); if (now) setTh(now);
  }
  useEffect(() => { void load(); const i = setInterval(() => void load(), 10_000); return () => clearInterval(i); }, [thread.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);
  async function send() {
    const body = text.trim(); if (!body) return;
    setBusy(true); setError("");
    const err = await sendWhatsappReply(supabase(), thread.id, body); setBusy(false);
    if (err) { const k = "wa.err." + err; const m = t(k); setError(m === k ? t("wa.err.WHATSAPP_SEND_FAILED") : m); }
    else setText("");
    void load();
  }
  async function status(s: "ai" | "human" | "closed") {
    const r = await setWhatsappThreadStatus(supabase(), thread.id, s);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else void load();
  }
  return <section className="stack">
    <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={onBack}>{t("wa.back")}</button>
    <div className="card stack" style={{ gap: 4 }}>
      <strong>{th.contact_name || formatWaId(th.wa_id)} · {formatWaId(th.wa_id)}</strong>
      <small>{t("wa.st." + th.status)} · {th.number_label} · {th.account_name ? t("wa.account", { n: th.account_name }) : t("wa.no_account")}</small>
      <div className="row">
        {th.status !== "human" && <button type="button" className="secondary" onClick={() => void status("human")}>{t("wa.take")}</button>}
        {th.status !== "ai" && <button type="button" className="secondary" onClick={() => void status("ai")}>{t("wa.back_ai")}</button>}
        {th.status !== "closed" && <button type="button" className="secondary" onClick={() => void status("closed")}>{t("wa.close")}</button>}
      </div>
    </div>
    <div className="card stack" style={{ gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
      {msgs.map(m => {
        const mine = m.direction === "out";
        return <div key={m.id} style={{ justifySelf: mine ? "end" : "start", maxWidth: "85%", padding: "8px 12px", borderRadius: 14,
          background: mine ? (m.author === "team" ? "var(--green-soft)" : "var(--accent-soft)") : "var(--surface)", border: "1px solid var(--line)" }}>
          <small style={{ display: "block", fontWeight: 700 }}>{t("wa.a." + m.author)}</small>
          <span style={{ whiteSpace: "pre-wrap" }}>{m.body ?? (m.media_type ? `📎 ${m.media_type}` : "")}</span>
          <small className="muted" style={{ display: "block", textAlign: "right" }}>{formatDateIn(m.created_at, lang)}{m.status === "failed" || m.error ? " · ⚠️ " + t("wa.failed") : m.status === "read" ? " · ✓✓" : ""}</small>
        </div>;
      })}
      <div ref={end} />
    </div>
    {th.window_open ? <div className="stack" style={{ gap: 6 }}>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={4000} placeholder={t("wa.reply_ph")} aria-label={t("wa.reply_ph")} />
      <button type="button" disabled={busy || !text.trim()} style={{ justifySelf: "start" }} onClick={() => void send()}>{busy ? "…" : t("wa.send")}</button>
    </div> : <p className="scam-warn" style={{ margin: 0 }}>{t("wa.window_closed")}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}

const EMPTY = { id: "", label: "", display_phone: "", phone_number_id: "", area: "support" as WhatsappArea, ai_enabled: true, ai_instructions: "", active: true, sort: "100" };
function WhatsappNumbersAdmin({ numbers, onChange }: { numbers: WhatsappNumber[]; onChange: () => void }) {
  const { t, lang } = useT();
  const [f, setF] = useState(EMPTY); const [show, setShow] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
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
  return <details className="card">
    <summary style={{ fontWeight: 800, cursor: "pointer" }}>{t("wa.numbers")} ({numbers.length})</summary>
    <div className="stack" style={{ gap: 8, marginTop: 10 }}>
      <small className="muted">{t("wa.numbers_hint")}</small>
      {numbers.map(n => <div key={n.id} className="row" style={{ justifyContent: "space-between", opacity: n.active ? 1 : 0.55 }}>
        <span><strong>{n.label}</strong> · {t("wa.area." + n.area)}{n.display_phone ? " · " + n.display_phone : ""} · {n.ai_enabled ? "🤖" : "👤"}</span>
        <button type="button" className="secondary" onClick={() => edit(n)}>{t("wa.n.edit")}</button>
      </div>)}
      {!show && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => { setF(EMPTY); setShow(true); }}>{t("wa.n.add")}</button>}
      {show && <div className="stack" style={{ gap: 8, padding: 12, borderRadius: 12, border: "1px dashed var(--line)" }}>
        <label>{t("wa.n.label")}<input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} maxLength={60} /></label>
        <label>{t("wa.n.phone")}<input value={f.display_phone} onChange={e => setF({ ...f, display_phone: e.target.value })} maxLength={30} inputMode="tel" /></label>
        <label>{t("wa.n.id")}<input value={f.phone_number_id} onChange={e => setF({ ...f, phone_number_id: e.target.value.replace(/\D/g, "") })} inputMode="numeric" maxLength={30} /></label>
        <label>{t("wa.n.area")}<select value={f.area} onChange={e => setF({ ...f, area: e.target.value as WhatsappArea })}>{WHATSAPP_AREAS.map(a => <option key={a} value={a}>{t("wa.area." + a)}</option>)}</select></label>
        <label className="row" style={{ gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.ai_enabled} onChange={e => setF({ ...f, ai_enabled: e.target.checked })} style={{ width: 22, height: 22 }} /> {t("wa.n.ai")}</label>
        <label>{t("wa.n.instructions")}<textarea value={f.ai_instructions} onChange={e => setF({ ...f, ai_instructions: e.target.value })} rows={4} maxLength={3000} /></label>
        <label className="row" style={{ gap: 8, alignItems: "center" }}><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} style={{ width: 22, height: 22 }} /> {t("wa.n.active")}</label>
        {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="row">
          <button type="button" disabled={busy || f.label.trim().length < 2 || f.phone_number_id.length < 5} onClick={() => void save()}>{t("wa.n.save")}</button>
          <button type="button" className="secondary" onClick={() => { setShow(false); setF(EMPTY); }}>{t("wa.n.cancel")}</button>
        </div>
      </div>}
      {ok && <p className="ok" role="status" style={{ margin: 0 }}>{ok}</p>}
    </div>
  </details>;
}
