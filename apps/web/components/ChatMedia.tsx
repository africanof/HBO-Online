"use client";
import { useEffect, useRef, useState } from "react";
import { PHOTO_MAX_SIDE, PHOTO_QUALITY, uploadChatFile, sendAttachmentMessage, validateChatFile, chatAttachmentKind, formatSeconds, friendlyErrorIn, CHAT_LIMITS, CHAT_KIND_LABELS,
  type ChatAttachmentKind, type ChatMessage } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useDataSaver } from "../lib/dataSaver";
import { useT } from "../lib/i18n";

/** Duração de um vídeo ou áudio no navegador (segundos), ou null. */
function readDuration(file: Blob, kind: "video" | "audio"): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file); const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(el.duration) ? el.duration : null); };
    el.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    el.src = url;
  });
}
/** Reduz a fotografia (lado maior 1280 px, JPEG 70%) para gastar menos dados. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file); const max = PHOTO_MAX_SIDE; const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", PHOTO_QUALITY));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}
function recorderType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return "";
}

type Draft = { kind: ChatAttachmentKind; blob: Blob; type: string; seconds: number | null; preview: string };

/** Botões «📷 Fotografia», «🎬 Vídeo» e «🎤 Voz» por baixo da caixa de texto do chat. */
export function ChatAttachButtons({ conversationId, uid, caption, onSent }: { conversationId: string; uid: string; caption: string; onSent: () => void }) {
  const { lang, t, tc } = useT();
  const [draft, setDraft] = useState<Draft | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [recording, setRecording] = useState(false); const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const started = useRef(0); const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const photo = useRef<HTMLInputElement>(null); const video = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); rec.current?.stream.getTracks().forEach(t => t.stop()); }, []);
  useEffect(() => () => { if (draft) URL.revokeObjectURL(draft.preview); }, [draft]);

  async function choose(file: File | undefined, expected: "image" | "video") {
    if (!file) return; setError("");
    const kind = chatAttachmentKind(file.type);
    if (kind !== expected) { setError(expected === "image" ? t("ls.chat_pick_photo") : t("ls.chat_pick_video")); return; }
    const blob = kind === "image" ? await shrinkImage(file) : file;
    const seconds = kind === "video" ? await readDuration(file, "video") : null;
    const type = blob === file ? file.type : "image/jpeg";
    const bad = validateChatFile({ type, size: blob.size, seconds }); if (bad) { setError(tc(bad)); return; }
    setDraft({ kind, blob, type, seconds, preview: URL.createObjectURL(blob) });
  }
  async function startRecording() {
    setError("");
    const type = recorderType();
    if (!type || !navigator.mediaDevices?.getUserMedia) { setError(t("ls.chat_no_audio")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32000 });
      chunks.current = []; r.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const seconds = (Date.now() - started.current) / 1000; const blob = new Blob(chunks.current, { type: r.mimeType || type });
        const bad = validateChatFile({ type: blob.type, size: blob.size, seconds }); if (bad) { setError(tc(bad)); return; }
        setDraft({ kind: "audio", blob, type: blob.type, seconds, preview: URL.createObjectURL(blob) });
      };
      rec.current = r; started.current = Date.now(); setElapsed(0); r.start(); setRecording(true);
      timer.current = setInterval(() => {
        const s = (Date.now() - started.current) / 1000; setElapsed(s);
        if (s >= CHAT_LIMITS.audio.seconds!) stopRecording();
      }, 250);
    } catch { setError(t("ls.chat_mic_denied")); }
  }
  function stopRecording() {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    if (rec.current?.state === "recording") rec.current.stop();
    setRecording(false);
  }
  async function send() {
    if (!draft) return; setBusy(true); setError("");
    try {
      const up = await uploadChatFile(supabase(), conversationId, uid, draft.blob, draft.type, draft.seconds);
      if (up.error || !up.data) throw up.error ?? new Error(t("ls.chat_file_failed"));
      const r = await sendAttachmentMessage(supabase(), conversationId, uid, { kind: draft.kind, path: up.data, seconds: draft.seconds }, caption);
      if (r.error) { void supabase().storage.from("chat-media").remove([up.data]); throw r.error; }
      setDraft(null); onSent();
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }

  return <div className="stack" style={{ gap: 8 }}>
    {!draft && !recording && <div className="row">
      <button type="button" className="secondary" onClick={() => photo.current?.click()}>📷 {t("ls.photo")}</button>
      <button type="button" className="secondary" onClick={() => video.current?.click()}>🎬 {t("promo.video")}</button>
      <button type="button" className="secondary" onClick={() => void startRecording()}>🎤 {t("ls.voice_msg")}</button>
      <input ref={photo} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-hidden tabIndex={-1} onChange={e => { void choose(e.target.files?.[0], "image"); e.target.value = ""; }} />
      <input ref={video} type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp" hidden aria-hidden tabIndex={-1} onChange={e => { void choose(e.target.files?.[0], "video"); e.target.value = ""; }} />
    </div>}
    {recording && <div className="card row" role="status" style={{ alignItems: "center" }}>
      <span style={{ color: "var(--danger)", fontWeight: 800 }}>● {t("ls.recording")} {formatSeconds(elapsed)} / {formatSeconds(CHAT_LIMITS.audio.seconds)}</span>
      <button type="button" onClick={stopRecording}>⏹️ {t("ls.stop")}</button>
    </div>}
    {draft && <div className="card stack" style={{ gap: 8 }}>
      <strong>{tc(CHAT_KIND_LABELS[draft.kind])}{draft.seconds ? ` · ${formatSeconds(draft.seconds)}` : ""}</strong>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {draft.kind === "image" && <img src={draft.preview} alt={t("ls.photo_chosen")} style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12 }} />}
      {draft.kind === "video" && <video src={draft.preview} controls playsInline style={{ maxWidth: 320, borderRadius: 12, background: "#000" }} aria-label={t("ls.video_chosen")} />}
      {draft.kind === "audio" && <audio src={draft.preview} controls aria-label={t("ls.listen_recorded")} />}
      <small>{t("ls.caption_goes")}</small>
      <div className="row"><button type="button" disabled={busy} onClick={() => void send()}>{busy ? t("ls.sending") : t("common.send")}</button><button type="button" className="secondary" disabled={busy} onClick={() => setDraft(null)}>{t("common.cancel")}</button></div>
    </div>}
    {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
  </div>;
}

/** Anexo dentro da conversa. Com «Poupar dados», a fotografia só carrega quando se pede. */
export function MessageAttachment({ m, url }: { m: ChatMessage; url?: string }) {
  const lite = useDataSaver(); const [show, setShow] = useState(false); const { t, tc } = useT();
  if (!m.attachment_kind) return null;
  if (!url) return <small className="muted">{tc(CHAT_KIND_LABELS[m.attachment_kind])} ({t("ls.loading_lc")})</small>;
  if (m.attachment_kind === "audio") return <audio src={url} controls preload="none" aria-label={t("ls.voice_msg_dur", { d: formatSeconds(m.attachment_seconds) })} style={{ maxWidth: "100%" }} />;
  if (m.attachment_kind === "video") return <video src={url} controls preload="none" playsInline aria-label={t("ls.video_sent")} style={{ maxWidth: "100%", width: 320, borderRadius: 12, background: "#000" }} />;
  if (lite && !show) return <button type="button" className="secondary" onClick={() => setShow(true)}>📷 {t("ls.see_photo_data")}</button>;
  return <a href={url} target="_blank" rel="noopener">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={t("ls.photo_sent")} loading="lazy" style={{ maxWidth: 260, maxHeight: 320, borderRadius: 12, display: "block" }} /></a>;
}
