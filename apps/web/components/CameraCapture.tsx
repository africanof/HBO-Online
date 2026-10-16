"use client";
import { useEffect, useRef, useState } from "react";
import type { IDENTITY_SHOTS } from "@huambo-online/core";
import { useT } from "../lib/i18n";

type Shot = (typeof IDENTITY_SHOTS)[number];

export const CAMERA_ERROR = "Não foi possível abrir a câmara. Autorize a câmara no navegador, ou use a APP / um telemóvel com câmara.";
const MAX_SIDE = 1600;
const QUALITY = 0.85;

/** Tamanho final da fotografia: o lado maior fica com no máximo 1600 px. */
export function captureSize(w: number, h: number, max = MAX_SIDE) {
  const s = Math.min(1, max / Math.max(w, h, 1));
  return { width: Math.round(w * s), height: Math.round(h * s) };
}

/** Chave do dicionário com o motivo do erro da câmara. */
function cameraErrorKey(e: unknown): string {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "sv.cam_not_found";
  if (name === "NotReadableError") return "sv.cam_busy";
  return "sv.cam_error";
}

/**
 * Fotografia tirada na hora com a câmara (sem galeria nem ficheiros).
 * A selfie aparece espelhada no ecrã (como num espelho), mas a fotografia guardada não é espelhada.
 */
export function CameraCapture({ shot, onUse, onCancel }: { shot: Shot; onUse: (photo: Blob) => void; onCancel?: () => void }) {
  const { t, tc } = useT();
  const title = tc(shot.title);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<"off" | "starting" | "live" | "preview" | "error">("off");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const selfie = shot.camera === "front";

  function stop() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }
  // Ao sair do passo (ou da página): desligar a câmara e libertar a pré-visualização.
  useEffect(() => () => stop(), []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  // Mudou de passo (frente → verso → selfie): começa de novo.
  useEffect(() => { stop(); setPhoto(null); setError(""); setPhase("off"); }, [shot.key]);

  async function start() {
    setError(""); setPhoto(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) { setPhase("error"); setError(t("sv.cam_error")); return; }
    setPhase("starting");
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: selfie ? "user" : "environment", width: { ideal: 1920 } } });
      streamRef.current = stream;
      setPhase("live");
      const v = videoRef.current;
      if (v) { v.srcObject = stream; await v.play().catch(() => undefined); }
    } catch (e) { stop(); setPhase("error"); setError(t(cameraErrorKey(e))); }
  }
  // O <video> só existe depois de passar a «live»: ligar o stream quando aparecer.
  useEffect(() => {
    const v = videoRef.current;
    if (phase === "live" && v && streamRef.current && v.srcObject !== streamRef.current) { v.srcObject = streamRef.current; void v.play().catch(() => undefined); }
  }, [phase]);

  async function take() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) { setError(t("sv.cam_opening")); return; }
    const { width, height } = captureSize(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d"); if (!ctx) { setError(t("sv.cam_error")); return; }
    ctx.drawImage(v, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", QUALITY));
    if (!blob) { setError(t("sv.cam_take_fail")); return; }
    stop();
    setPhoto({ blob, url: URL.createObjectURL(blob) }); setPhase("preview");
  }

  const guide = <div className="camera-guide" aria-hidden><span className={selfie ? "guide-face" : "guide-card"} /></div>;
  return <section className="card" aria-labelledby={`shot-${shot.key}`}>
    <h3 id={`shot-${shot.key}`} style={{ margin: 0 }}>{title}</h3>
    <p style={{ margin: 0 }}>{tc(shot.hint)}</p>
    {phase === "live" || phase === "starting" ? <>
      <div className="camera">
        <video ref={videoRef} className={selfie ? "mirror" : undefined} playsInline muted autoPlay aria-label={t("sv.cam_view", { title })} />
        {guide}
        <p className="camera-tip">{selfie ? t("sv.cam_tip_selfie") : t("sv.cam_tip_card")}</p>
      </div>
      <div className="row">
        <button type="button" onClick={take} disabled={phase !== "live"}>📸 {t("sv.cam_take")}</button>
        {onCancel && <button type="button" className="secondary" onClick={() => { stop(); setPhase("off"); onCancel(); }}>{t("common.cancel")}</button>}
      </div>
    </> : phase === "preview" && photo ? <>
      <div className="camera"><img src={photo.url} alt={t("sv.cam_taken", { title })} className={selfie ? "mirror" : undefined} /></div>
      <p style={{ margin: 0 }}>{t("sv.cam_check")}</p>
      <div className="row">
        <button type="button" className="secondary" onClick={start}>🔁 {t("sv.cam_retry")}</button>
        <button type="button" onClick={() => onUse(photo.blob)}>✔ {t("sv.cam_use")}</button>
      </div>
    </> : <div className="row">
      <button type="button" onClick={start}>📷 {t("sv.cam_open")}</button>
      {onCancel && <button type="button" className="secondary" onClick={onCancel}>{t("common.cancel")}</button>}
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
