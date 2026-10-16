"use client";
import { useRef, useState } from "react";
import { uploadVideo, removeUnsavedVideo, validateVideo, friendlyErrorIn, VIDEO_MAX_SECONDS } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useDataSaver } from "../lib/dataSaver";
import { useT } from "../lib/i18n";

/** Lê a duração de um vídeo no navegador (segundos), ou null se não conseguir. */
function readDuration(file: File): Promise<number | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file); const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(v.duration) ? v.duration : null); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    v.src = url;
  });
}

/** Campo "Vídeo (opcional)": envia logo o vídeo e devolve o endereço. */
export function VideoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const { lang, t, tc } = useT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const unsaved = useRef<string | null>(null);
  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    const invalid = validateVideo({ size: file.size, type: file.type || undefined, durationSeconds: await readDuration(file) });
    if (invalid) { setError(tc(invalid)); return; }
    const c = supabase(); const { data: { user } } = await c.auth.getUser();
    if (!user) { setError(t("sv.vd_login")); return; }
    setBusy(true);
    const r = await uploadVideo(c, user.id, file, file.name, file.type || undefined);
    setBusy(false);
    if (r.error || !r.data) { setError(friendlyErrorIn(r.error, lang, t("sv.vd_fail"))); return; }
    if (unsaved.current) void removeUnsavedVideo(c, unsaved.current);
    unsaved.current = r.data; onChange(r.data);
  }
  function remove() {
    if (unsaved.current && unsaved.current === value) { void removeUnsavedVideo(supabase(), value); unsaved.current = null; }
    onChange("");
  }
  return <fieldset className="stack" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
    <legend style={{ fontWeight: 700 }}>🎬 {t("sv.vd_field")}</legend>
    <span className="item-meta">{t("sv.vd_hint", { s: VIDEO_MAX_SECONDS })}</span>
    {value ? <>
      <video src={value} controls preload="metadata" playsInline style={{ width: "100%", maxHeight: 320, background: "#000", borderRadius: 12 }} />
      <button type="button" className="secondary" onClick={remove} style={{ justifySelf: "start" }}>{t("sv.vd_remove")}</button>
    </> : <input type="file" accept="video/mp4,video/quicktime,video/webm,video/3gpp" disabled={busy} onChange={e => { void choose(e.target.files?.[0]); e.target.value = ""; }} aria-label={t("sv.vd_choose")} />}
    {busy && <p role="status">{t("sv.vd_sending")}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </fieldset>;
}

/** Vídeo da página do artigo: só descarrega quando a pessoa carrega em ▶ (poupa dados). */
export function VideoPlayer({ url, poster }: { url: string; poster?: string | null }) {
  const { t } = useT();
  return <video src={url} poster={poster ?? undefined} controls preload="none" playsInline className="gallery-main" style={{ background: "#000" }} aria-label={t("sv.vd_item_video")} />;
}

/** Galeria do artigo (fotografias + vídeo), como no eBay: miniaturas ao lado e imagem grande. */
export function Gallery({ media, video, icon, title }: { media: string[]; video?: string | null; icon: string; title: string }) {
  const [i, setI] = useState(0); // índice da foto; -1 = vídeo
  const showVideo = !!video && (i === -1 || media.length === 0);
  const tiles = media.length + (video ? 1 : 0);
  const saver = useDataSaver(); const [reveal, setReveal] = useState(false);
  const { t } = useT();
  if (!tiles) return <section className="gallery" aria-label={t("sv.vd_photos")}><div className="gallery-empty" aria-hidden>{icon}</div></section>;
  // Poupar dados: as fotografias só carregam quando a pessoa pede.
  if (saver && !reveal && media.length > 0) return <section className="gallery single" aria-label={t("sv.vd_photos_video")}>
    <div className="gallery-reveal"><span aria-hidden style={{ fontSize: 48 }}>{icon}</span>
      <span>📉 {t("sv.vd_saver_on")}</span>
      <button type="button" onClick={() => setReveal(true)}>📷 {media.length === 1 ? t("sv.vd_see_photo") : t("sv.vd_see_photos", { n: media.length })}</button>
      {video && <button type="button" className="secondary" onClick={() => { setReveal(true); setI(-1); }}>▶ {t("sv.vd_see_video")}</button>}
    </div>
  </section>;
  return <section className={"gallery" + (tiles === 1 ? " single" : "")} aria-label={t("sv.vd_photos_video")}>
    <div className="thumbs">{tiles > 1 && <>
      {media.map((m, j) => <button key={m} type="button" aria-current={!showVideo && i === j} onClick={() => setI(j)} aria-label={t("sv.vd_see_photo_n", { n: j + 1 })}><img src={m} alt="" /></button>)}
      {video && <button type="button" aria-current={showVideo} onClick={() => setI(-1)} aria-label={t("sv.vd_see_video")} style={{ display: "grid", placeItems: "center", background: "#111", color: "#fff", fontSize: 28 }}>▶</button>}
    </>}</div>
    {showVideo ? <VideoPlayer url={video!} poster={media[0]} /> : <img className="gallery-main" src={media[Math.max(0, i)]} alt={t("sv.vd_photo_alt", { title, n: Math.max(0, i) + 1, total: media.length })} />}
    {video && !showVideo && <button type="button" className="secondary" onClick={() => setI(-1)} style={{ gridColumn: "1 / -1", justifySelf: "start" }}>▶ {t("sv.vd_see_video")}</button>}
  </section>;
}
