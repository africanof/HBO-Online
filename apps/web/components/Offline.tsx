"use client";
import { useEffect, useState } from "react";
import { offlineNotice } from "@huambo-online/core";

/** Faixa «Sem internet — a mostrar o que foi guardado…» (quando a página usa uma cópia guardada). */
export function OfflineBanner({ savedAt, show }: { savedAt: number | null; show: boolean }) {
  return show ? <p className="offline" role="alert">{offlineNotice(savedAt)}</p> : null;
}

/** Aviso no topo de todas as páginas quando o browser perde a ligação. */
export function ConnectionWatcher() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online ? null : <p className="offline" role="alert" style={{ margin: 0, borderRadius: 0 }}>📡 Está sem internet. Pode continuar a ver o que já abriu; as alterações só são enviadas quando a ligação voltar.</p>;
}
