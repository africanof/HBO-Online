"use client";
import { useEffect, useState } from "react";
import { findSaved, toggleSaved, recordView, shareMessage, friendlyError, type SavedKind, type KeyValueStore } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** localStorage com proteção (modo privado, bloqueios). */
export const browserStore: KeyValueStore = {
  getItem: k => { try { return window.localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* ignorar */ } }
};

export function useRecordView(kind: SavedKind, id: string | undefined, title: string | undefined, image?: string | null) {
  useEffect(() => { if (id && title) void recordView(browserStore, { kind, id, title, image: image ?? null }); }, [kind, id, title, image]);
}

export function SaveButton({ kind, id }: { kind: SavedKind; id: string }) {
  const [uid, setUid] = useState<string | null>(null); const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    const c = supabase(); const u = await c.auth.getUser(); const me = u.data.user?.id ?? null; setUid(me);
    if (me) { const r = await findSaved(c, me, kind, id); setSavedId((r.data as any)?.id ?? null); }
  })(); }, [kind, id]);
  async function click() {
    if (!uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; }
    setBusy(true); setError("");
    const r = await toggleSaved(supabase(), uid, kind, id, savedId); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setSavedId(r.data);
  }
  return <>
    <button type="button" className="secondary" onClick={click} disabled={busy} aria-pressed={!!savedId}>{savedId ? "★ Guardado" : "☆ Guardar"}</button>
    {error && <span className="error" role="alert">{error}</span>}
  </>;
}

export function ShareButton({ kind, id, title }: { kind: SavedKind; id: string; title: string }) {
  const [done, setDone] = useState("");
  async function click() {
    const { url, text } = shareMessage(window.location.origin, kind, id, title);
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard.writeText(url); setDone("Link copiado.");
    } catch { /* partilha cancelada */ }
  }
  function whatsapp() {
    window.open("https://wa.me/?text=" + encodeURIComponent(shareMessage(window.location.origin, kind, id, title).text), "_blank", "noopener");
  }
  return <>
    <button type="button" className="secondary" onClick={click}>🔗 Partilhar</button>
    <button type="button" className="secondary" onClick={whatsapp}>Enviar por WhatsApp</button>
    {done && <span className="ok" role="status">{done}</span>}
  </>;
}
