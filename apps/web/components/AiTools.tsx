"use client";
import { useEffect, useState } from "react";
import { fillFromPhoto, smartSearch, askHelp, openSupportConversation, translateListing, priceHint, suggestTeamReply, summarizeDispute, listAiFlags, dismissAiFlag, moderateListing,
  aiMessage, formatPrice, friendlyErrorIn, removePhotoBackground, photoBackgroundMessage, PHOTO_BACKGROUND_STYLES, type PhotoBackgroundStyle, type CategoryRef, type PhotoFill, type SmartSearch, type PriceHint, type HelpTurn, type AiFlag } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT, formatDateIn } from "../lib/i18n";

/** Fotografia → JPEG base64 com o lado maior até 1024 px (menos dados e mais barato). */
async function toBase64(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
}

/** «📷 Preencher pela foto»: a IA propõe título, descrição, categoria e campos a partir da 1.ª fotografia. */
export function PhotoFillButton({ getImage, categories, onApply }: { getImage: () => Promise<Blob | null>; categories: CategoryRef[]; onApply: (f: PhotoFill) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  async function run() {
    setBusy(true); setErr(""); setOk("");
    try {
      const blob = await getImage();
      if (!blob) { setErr(t("ai.fill.need_photo")); return; }
      const r = await fillFromPhoto(supabase(), await toBase64(blob), "image/jpeg", categories);
      if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
      if (!r.data.found) { setErr(t("ai.fill.not_found")); return; }
      onApply(r.data); setOk(t("ai.fill.done", { n: r.data.remaining }));
    } catch { setErr(tc(aiMessage("INVALID_IMAGE"))); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 6 }}>
    <button type="button" className="secondary" disabled={busy} onClick={() => void run()} style={{ justifySelf: "start" }}>{busy ? t("ai.fill.working") : t("ai.fill.button")}</button>
    <small>{t("ai.fill.hint")}</small>
    {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
    {ok && <p className="ok" role="status" style={{ margin: 0 }}>{ok}</p>}
  </div>;
}

/** Escolha do fundo para «🪄 Fundo branco» (branco ou o fundo claro da Huambo Online). */
export function BackgroundStylePicker({ value, onChange }: { value: PhotoBackgroundStyle; onChange: (v: PhotoBackgroundStyle) => void }) {
  const { t, tc } = useT();
  return <div className="stack" style={{ gap: 4 }}>
    <label className="row" style={{ gap: 8, alignItems: "center" }}>{t("ai.bg.style")}
      <select value={value} onChange={e => onChange(e.target.value as PhotoBackgroundStyle)}>
        {PHOTO_BACKGROUND_STYLES.map(s => <option key={s.value} value={s.value}>{tc(s.label)}</option>)}
      </select>
    </label>
    <small>{t("ai.bg.hint")}</small>
  </div>;
}

/** «🪄 Fundo branco» numa fotografia: tira o fundo (função /api/fundo do Site) e devolve a nova fotografia. */
export function BackgroundButton({ getImage, style, onDone }: { getImage: () => Promise<Blob | null>; style: PhotoBackgroundStyle; onDone: (file: File) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const blob = await getImage();
      if (!blob) { setMsg({ ok: false, text: tc(photoBackgroundMessage("INVALID_IMAGE")) }); return; }
      const { data: s } = await supabase().auth.getSession();
      const r = await removePhotoBackground(fetch as any, { siteUrl: window.location.origin, token: s.session?.access_token, image: blob, style });
      if (r.error || !r.data) { setMsg({ ok: false, text: tc(photoBackgroundMessage(r.error)) }); return; }
      onDone(new File([r.data.image], `fundo-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setMsg({ ok: true, text: t("ai.bg.done", { n: r.data.remaining }) });
    } catch { setMsg({ ok: false, text: tc(photoBackgroundMessage("SERVER_ERROR")) }); } finally { setBusy(false); }
  }
  return <>
    <button type="button" className="secondary" disabled={busy} onClick={() => void run()}>{busy ? t("ai.bg.working") : t("ai.bg.button")}</button>
    {msg && <small className={msg.ok ? "ok" : "error"} role={msg.ok ? "status" : "alert"}>{msg.text}</small>}
  </>;
}

/** «💡 Anúncios parecidos custam…» (sem IA: preços dos últimos 6 meses). */
export function PriceHintNote({ categoryId, listingType, purpose }: { categoryId?: string | null; listingType: string; purpose: string }) {
  const { t } = useT();
  const [hint, setHint] = useState<PriceHint | null>(null);
  useEffect(() => { let on = true; void priceHint(supabase(), categoryId, listingType, purpose).then(h => { if (on) setHint(h); }); return () => { on = false; }; }, [categoryId, listingType, purpose]);
  if (!hint) return null;
  return <small className="muted">{t("ai.price.hint", { low: formatPrice(hint.low), high: formatPrice(hint.high), median: formatPrice(hint.median), n: hint.samples })}</small>;
}

/** «✨ Pesquisa inteligente»: «carro diesel até 5 milhões» → filtros. */
export function SmartSearchButton({ text, categories, onApply }: { text: string; categories: CategoryRef[]; onApply: (s: SmartSearch) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  async function run() {
    setBusy(true); setErr(""); setOk("");
    const r = await smartSearch(supabase(), text, categories); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    onApply(r.data); setOk(t("ai.search.done"));
  }
  return <div className="stack" style={{ gap: 4 }}>
    <button type="button" className="secondary" disabled={busy || text.trim().length < 2} onClick={() => void run()}>{busy ? t("ai.search.working") : t("ai.search.button")}</button>
    <small>{t("ai.search.hint")}</small>
    {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
    {ok && <p className="ok" role="status" style={{ margin: 0 }}>{ok}</p>}
  </div>;
}

/** «🌐 Traduzir»: só aparece quando o Site está em inglês ou chinês. */
export function TranslateListing({ listingId, onTranslated }: { listingId: string; onTranslated: (v: { title: string; description: string | null } | null) => void }) {
  const { lang, t, tc } = useT();
  const [busy, setBusy] = useState(false); const [on, setOn] = useState(false); const [err, setErr] = useState("");
  if (lang === "pt") return null;
  async function run() {
    if (on) { onTranslated(null); setOn(false); return; }
    setBusy(true); setErr("");
    const r = await translateListing(supabase(), listingId, lang); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    onTranslated(r.data); setOn(true);
  }
  return <div className="row" style={{ gap: 8, alignItems: "center" }}>
    <button type="button" className="secondary" disabled={busy} onClick={() => void run()} style={{ minHeight: 40, padding: "4px 14px" }}>{busy ? t("ai.tr.working") : on ? t("ai.tr.original") : t("ai.tr.button")}</button>
    {on && <small className="muted">{t("ai.tr.note")}</small>}
    {err && <small className="error">{err}</small>}
  </div>;
}

/** Assistente da Ajuda e do Suporte: a IA responde primeiro; «👤 Falar com um agente» passa a conversa à equipa. */
export function HelpAssistant({ back = "/ajuda", title }: { back?: string; title?: string }) {
  const { lang, t, tc } = useT();
  const [q, setQ] = useState(""); const [turns, setTurns] = useState<HelpTurn[]>([]); const [handoff, setHandoff] = useState(false);
  const [busy, setBusy] = useState(false); const [agentBusy, setAgentBusy] = useState(false); const [err, setErr] = useState(""); const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => { void supabase().auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);
  async function ask() {
    const question = q.trim(); if (question.length < 2) return;
    setBusy(true); setErr("");
    const r = await askHelp(supabase(), question, lang, turns); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    setTurns(x => [...x, { role: "user" as const, content: question }, { role: "assistant" as const, content: r.data!.answer || t("ai.help.handoff") }].slice(-12));
    setHandoff(r.data.handoff); setQ("");
  }
  async function agent() {
    setAgentBusy(true); setErr("");
    const question = q.trim();
    const r = await openSupportConversation(supabase(), question.length >= 2 ? [...turns, { role: "user" as const, content: question }] : turns);
    if (r.error || !r.data) { setAgentBusy(false); setErr(friendlyErrorIn(r.error, lang)); return; }
    window.location.href = "/mensagens?conversation=" + r.data;
  }
  return <section id="assistente" className="card stack" aria-label={title ?? t("ai.help.title")}>
    <h2 style={{ margin: 0 }}>{title ?? t("ai.help.title")}</h2>
    {signedIn === false ? <p style={{ margin: 0 }}><a href={"/conta/login?voltar=" + back}>{t("ai.help.login")}</a></p> : <>
      {turns.map((m, i) => <p key={i} style={{ margin: 0, whiteSpace: "pre-wrap", padding: 10, borderRadius: 10, background: m.role === "user" ? "var(--accent-soft)" : "var(--card)", border: "1px solid var(--line)" }}>
        <strong>{m.role === "user" ? "🙂 " : "🤖 "}</strong>{m.content}</p>)}
      {handoff && <p className="ok" style={{ margin: 0 }}>{t("ai.help.handoff")}</p>}
      <form className="row" style={{ gap: 8, flexWrap: "nowrap" }} onSubmit={e => { e.preventDefault(); void ask(); }}>
        <input value={q} onChange={e => setQ(e.target.value)} maxLength={600} placeholder={t("ai.help.ph")} aria-label={title ?? t("ai.help.title")} style={{ flex: 1 }} />
        <button disabled={busy || q.trim().length < 2}>{busy ? "…" : t("ai.help.ask")}</button>
      </form>
      {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
      <small className="muted">{t("ai.help.note")}</small>
      <div className="stack" style={{ gap: 4, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
        <button type="button" className={handoff ? "" : "secondary"} disabled={agentBusy || signedIn !== true} onClick={() => void agent()} style={{ justifySelf: "start" }}>{agentBusy ? t("sp.agent_working") : t("sp.agent")}</button>
        <small className="muted">{t("sp.agent_note")}</small>
      </div>
    </>}
  </section>;
}

/** Equipa: «🤖 Sugerir resposta» numa conversa mediada (o texto fica para rever antes de enviar). */
export function TeamReplySuggest({ conversationId, audienceId, subject, onUse }: { conversationId: string; audienceId: string; subject?: string | null; onUse: (text: string) => void }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [note, setNote] = useState(""); const [err, setErr] = useState("");
  async function run() {
    setBusy(true); setErr(""); setNote("");
    const r = await suggestTeamReply(supabase(), conversationId, audienceId, subject); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    onUse(r.data.reply); setNote(r.data.note);
  }
  return <div className="stack" style={{ gap: 4 }}>
    <button type="button" className="secondary" disabled={busy || !audienceId} onClick={() => void run()} style={{ justifySelf: "start" }}>{busy ? t("ai.staff.working") : t("ai.staff.suggest")}</button>
    {!audienceId && <small className="muted">{t("ai.staff.pick_person")}</small>}
    {note && <small>🤖 {t("ai.staff.note")}: {note}</small>}
    {err && <small className="error">{err}</small>}
  </div>;
}

/** Equipa: «🤖 Resumir com IA» uma disputa antes de decidir. */
export function DisputeSummary({ disputeId }: { disputeId: string }) {
  const { t, tc } = useT();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [s, setS] = useState<{ summary: string; points: string[]; missing: string } | null>(null);
  async function run() {
    setBusy(true); setErr("");
    const r = await summarizeDispute(supabase(), disputeId); setBusy(false);
    if (r.error || !r.data) { setErr(tc(aiMessage(r.error))); return; }
    setS(r.data);
  }
  return <div className="stack" style={{ gap: 6 }}>
    {!s && <button type="button" className="secondary" disabled={busy} onClick={() => void run()} style={{ justifySelf: "start" }}>{busy ? t("ai.dispute.working") : t("ai.dispute.summary")}</button>}
    {s && <div className="stack" style={{ gap: 4, padding: 10, borderRadius: 10, border: "1px dashed var(--line)" }}>
      <strong>🤖 {t("ai.dispute.title")}</strong>
      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{s.summary}</p>
      {s.points.length > 0 && <><strong>{t("ai.dispute.points")}</strong><ul style={{ margin: 0 }}>{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul></>}
      {s.missing && <span><strong>{t("ai.dispute.missing")}:</strong> {s.missing}</span>}
      <small className="muted">{t("ai.dispute.note")}</small>
    </div>}
    {err && <small className="error">{err}</small>}
  </div>;
}

/** Equipa: anúncios que a IA assinalou (burla provável, contactos escondidos, categoria errada…). */
export function AdminAiFlags() {
  const { lang, t } = useT();
  const [list, setList] = useState<AiFlag[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await listAiFlags(supabase()); if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setList(r.data); }
  useEffect(() => { void load(); }, []);
  async function run(fn: () => PromiseLike<{ error: any }>, message: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setOk(message); await load();
  }
  return <section className="stack card">
    <h2 style={{ margin: 0 }}>{t("ai.flags.title")}</h2>
    <p style={{ margin: 0 }}>{t("ai.flags.intro")}</p>
    {err && <p className="error" role="alert">{err}</p>}
    {ok && <p className="ok" role="status">{ok}</p>}
    {!list.length && <p style={{ margin: 0 }}>{t("ai.flags.none")}</p>}
    {list.map(f => <article key={f.listing_id} className="card" style={{ borderLeft: `4px solid ${f.risk === "high" ? "var(--danger, #c62828)" : "var(--logo-yellow, #E5A800)"}` }}>
      <small>{f.risk === "high" ? "🔴 " + t("ai.flags.high") : "🟡 " + t("ai.flags.attention")} · {formatDateIn(f.checked_at, lang)}{f.ref_no ? ` · A-${f.ref_no}` : ""}</small>
      <strong>{f.title}</strong>
      <span>{f.owner_name ?? "—"}{f.price != null ? " · " + formatPrice(f.price) : ""}</span>
      {f.summary && <p style={{ margin: 0 }}>🤖 {f.summary}</p>}
      {f.reasons.length > 0 && <ul style={{ margin: 0 }}>{f.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
      {f.suggested_category && <small>{t("ai.flags.suggested")}: {f.suggested_category}</small>}
      <div className="row">
        <a className="btn secondary" href={"/classificados/" + f.listing_id} target="_blank" rel="noopener">{t("ai.flags.open")}</a>
        <button className="secondary" disabled={busy} onClick={() => void run(() => dismissAiFlag(supabase(), f.listing_id), t("ai.flags.ok_dismissed"))}>✔ {t("ai.flags.dismiss")}</button>
        {f.status === "published" && <button className="danger" disabled={busy} onClick={() => { if (confirm(t("ai.flags.confirm_hide"))) void run(async () => { const a = await moderateListing(supabase(), f.listing_id, "cancelled"); return a.error ? a : dismissAiFlag(supabase(), f.listing_id); }, t("ai.flags.ok_hidden")); }}>{t("ai.flags.hide")}</button>}
      </div>
    </article>)}
  </section>;
}
