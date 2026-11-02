"use client";
import { useRef, useState } from "react";
import { LISTING_PHOTO_SHOT } from "@huambo-online/core";
import { CameraCapture } from "./CameraCapture";
import { useT } from "../lib/i18n";

/**
 * Fotografias ao publicar: «🖼️ Escolher da galeria» ou «📷 Tirar fotografia».
 * No telemóvel, a câmara abre a câmara do próprio telemóvel; no computador, abre a webcam aqui na página
 * (pode tirar várias seguidas).
 */
export function PhotoPicker({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const { t } = useT();
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [webcam, setWebcam] = useState(false);
  const [shotN, setShotN] = useState(0);
  const touch = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

  function openCamera() {
    if (touch()) cameraRef.current?.click(); else { setShotN(n => n + 1); setWebcam(true); }
  }
  const pick = (list: FileList | null) => { const files = Array.from(list ?? []); if (files.length) onFiles(files); };

  return <div className="stack" style={{ gap: 8 }}>
    <div className="row">
      <button type="button" className="secondary" disabled={disabled} onClick={() => galleryRef.current?.click()}>{t("ls.from_gallery")}</button>
      <button type="button" className="secondary" disabled={disabled} onClick={openCamera}>{t("ls.take_photo")}</button>
    </div>
    <input ref={galleryRef} type="file" accept="image/*" multiple hidden aria-label={t("ls.select_photos")} onChange={e => { pick(e.target.files); e.target.value = ""; }} />
    <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden aria-label={t("ls.take_photo")} onChange={e => { pick(e.target.files); e.target.value = ""; }} />
    {webcam && !disabled && <CameraCapture key={shotN} shot={LISTING_PHOTO_SHOT} autoStart
      onUse={b => { onFiles([new File([b], `camara-${Date.now()}.jpg`, { type: "image/jpeg" })]); setShotN(n => n + 1); }}
      onCancel={() => setWebcam(false)} />}
  </div>;
}
