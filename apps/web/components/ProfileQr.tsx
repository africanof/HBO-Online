"use client";
import { useEffect, useId, useRef, useState } from "react";
import { PROFILE_QR_LABELS, profileUrl, profileQrPngUrl, profileQrSvg, profileQrFilename, profileShareText, type ProfileQrKind } from "@huambo-online/core";
import { useT } from "../lib/i18n";
import { SITE_URL } from "../lib/site";

const FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

/**
 * 📱 Botão «Código QR» de um perfil (profissional, empresa, loja, estabelecimento, posto, praça).
 * Abre uma janela com o QR, para baixar (PNG ou cartaz SVG), partilhar, copiar a ligação ou imprimir.
 * «owner»: mostra a dica «Imprima e cole na sua loja ou banca» (páginas do dono).
 */
export function ProfileQr({ kind, id, name, owner = false }: { kind: ProfileQrKind; id: string; name: string; owner?: boolean }) {
  const { t, tc } = useT();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(""); const [manual, setManual] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null); const box = useRef<HTMLDivElement>(null); const linkInput = useRef<HTMLInputElement>(null);
  const titleId = useId(); const descId = useId();
  const label = name.trim() || "Huambo Online";
  const url = profileUrl(SITE_URL, kind, id);
  const svg = open ? profileQrSvg(url, label, tc("Leia com a câmara do telemóvel")) : "";

  function close() { setOpen(false); setStatus(""); setManual(false); }
  useEffect(() => {
    if (!open) return;
    const prev = (document.activeElement as HTMLElement | null) ?? trigger.current;
    box.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !box.current) return;
      const els = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)]; if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!box.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; (prev ?? trigger.current)?.focus(); };
  }, [open]);

  function downloadSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = href; a.download = profileQrFilename(label, "svg");
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function share() {
    const text = tc(profileShareText(label, url));
    if (typeof navigator.share === "function") {
      // O texto já leva a ligação (para não aparecer duas vezes no WhatsApp).
      try { await navigator.share({ title: label, text }); return; }
      catch (e) { if ((e as Error)?.name === "AbortError") return; }
    }
    window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setManual(false); setStatus(t("sv.qr.copied")); }
    catch { setManual(true); setStatus(t("sv.qr.copy_manual")); setTimeout(() => { linkInput.current?.focus(); linkInput.current?.select(); }, 0); }
  }
  function print() {
    // Só o cartaz é impresso (ver «body.printing-qr» em globals.css).
    document.body.classList.add("printing-qr");
    const done = () => { document.body.classList.remove("printing-qr"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
    setTimeout(done, 1000);
  }

  const button = <button ref={trigger} type="button" className="secondary" aria-haspopup="dialog" onClick={() => setOpen(true)}>📱 {t("sv.qr.button")}</button>;
  return <>
    {owner ? <div className="stack" style={{ gap: 6, justifyItems: "start" }}>{button}<small className="muted">🖨️ {t("sv.qr.owner_hint")}</small></div> : button}
    {open && <div className="lightbox" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div ref={box} className="lightbox-inner" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} style={{ maxWidth: 440, justifyItems: "center", textAlign: "center" }}>
        <h2 id={titleId} style={{ margin: 0 }}>📱 {t("sv.qr.title")}</h2>
        <div className="qr-print" style={{ width: "100%", display: "grid", justifyItems: "center", gap: 8 }}>
          <img src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)} alt={t("sv.qr.img_alt", { name: label })}
            style={{ width: "100%", maxWidth: 300, maxHeight: "none", height: "auto", background: "#fff", borderRadius: 8, border: "1px solid var(--line)" }} />
          <p style={{ margin: 0, overflowWrap: "anywhere" }}><strong>{label}</strong> · {tc(PROFILE_QR_LABELS[kind])}</p>
        </div>
        <p id={descId} style={{ margin: 0 }}>{t("sv.qr.explain")}</p>
        {owner && <p style={{ margin: 0 }}><strong>🖨️ {t("sv.qr.owner_hint")}</strong></p>}
        <div className="stack" style={{ width: "100%", gap: 8 }}>
          <a className="btn" href={profileQrPngUrl("", kind, id) + "&download=1"} download={profileQrFilename(label, "png")}>⬇️ {t("sv.qr.png")}</a>
          <button type="button" className="secondary" onClick={downloadSvg}>⬇️ {t("sv.qr.svg")}</button>
          <button type="button" className="secondary" onClick={() => void share()}>📤 {t("sv.qr.share")}</button>
          <button type="button" className="secondary" onClick={() => void copy()}>🔗 {t("sv.qr.copy")}</button>
          {manual && <label style={{ textAlign: "start" }}>{t("sv.qr.link")}<input ref={linkInput} readOnly value={url} onFocus={e => e.currentTarget.select()} /></label>}
          <p role="status" className={status ? (manual ? "error" : "ok") : undefined} style={{ margin: 0 }}>{status}</p>
          <button type="button" className="secondary" onClick={print}>🖨️ {t("sv.qr.print")}</button>
          <button type="button" onClick={close}>{t("sv.qr.close")}</button>
        </div>
      </div>
    </div>}
  </>;
}
