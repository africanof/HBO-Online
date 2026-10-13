"use client";
import { useEffect, useState } from "react";
import { findSaved, toggleSaved, recordView, shareMessage, whatsappShareUrl, sellerWhatsappMessage, getSellerWhatsapp, getMyWhatsapp, setMyWhatsapp, formatWhatsapp, whatsappLink, friendlyError,
  getFollowInfo, toggleFollow, followersText, followButtonLabel, type FollowKind,
  type SavedKind, type KeyValueStore, type ShareExtra } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";

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

export function ShareButton({ kind, id, title, extra }: { kind: SavedKind; id: string; title: string; extra?: ShareExtra }) {
  const [done, setDone] = useState("");
  async function click() {
    const { url, text } = shareMessage(window.location.origin, kind, id, title, extra);
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard.writeText(url); setDone("Link copiado.");
    } catch { /* partilha cancelada */ }
  }
  function whatsapp() {
    window.open(whatsappShareUrl(shareMessage(window.location.origin, kind, id, title, extra).text), "_blank", "noopener");
  }
  return <>
    <button type="button" className="secondary" onClick={click}>🔗 Partilhar</button>
    <button type="button" className="secondary" onClick={whatsapp}>📲 Partilhar no WhatsApp</button>
    {done && <span className="ok" role="status">{done}</span>}
  </>;
}

/** «Falar no WhatsApp» com o vendedor: só aparece se ele escolheu mostrar o número e para quem tem sessão iniciada. */
export function SellerWhatsApp({ sellerId, kind, id, title, refCode }: { sellerId: string; kind: "listing" | "product"; id: string; title: string; refCode?: string | null }) {
  const [number, setNumber] = useState<string | null>(null);
  useEffect(() => { void getSellerWhatsapp(supabase(), sellerId).then(setNumber); }, [sellerId]);
  if (!number) return null;
  const url = shareMessage(window.location.origin, kind, id, title).url;
  const href = whatsappLink(number, sellerWhatsappMessage(kind, title, refCode, url));
  return href ? <a className="btn secondary" href={href} target="_blank" rel="noopener">💬 Falar no WhatsApp</a> : null;
}

/** «A sua conta»: número de WhatsApp e se aparece nos anúncios e produtos. */
export function WhatsAppSettings({ uid }: { uid: string }) {
  const [number, setNumber] = useState(""); const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { void getMyWhatsapp(supabase(), uid).then(r => { setNumber(formatWhatsapp(r.data?.whatsapp)); setVisible(!!r.data?.whatsapp_public); }); }, [uid]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(""); setErr("");
    const r = await setMyWhatsapp(supabase(), number, visible); setBusy(false);
    if (r.error) setErr(friendlyError(r.error)); else setMsg(!number.trim() ? "Número de WhatsApp apagado." : visible ? "Guardado. O botão «Falar no WhatsApp» aparece nos seus anúncios e produtos." : "Guardado. O número fica escondido.");
  }
  return <form className="stack card" onSubmit={save}>
    <h2 style={{ margin: 0 }}>💬 WhatsApp</h2>
    <p style={{ margin: 0 }}>Os compradores podem falar consigo pelo WhatsApp, além das mensagens do Huambo Online.</p>
    <label>Número de WhatsApp<input type="tel" value={number} onChange={e => setNumber(e.target.value)} placeholder="923 000 000" autoComplete="tel" /></label>
    <label className="row" style={{ gap: 8 }}><input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} style={{ width: 24, height: 24 }} /> Mostrar o botão «Falar no WhatsApp» nos meus anúncios e produtos</label>
    <small>Só quem tem sessão iniciada vê o seu número. Pode esconder ou apagar quando quiser.</small>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    <button disabled={busy} style={{ justifySelf: "start" }}>Guardar WhatsApp</button>
  </form>;
}

/** «➕ Seguir» / «✔ A seguir», com o número de seguidores. Sem sessão, leva a entrar. */
export function FollowButton({ kind, id, mine = false }: { kind: FollowKind; id: string; mine?: boolean }) {
  const [info, setInfo] = useState<{ followers: number; following: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { void getFollowInfo(supabase(), kind, id).then(r => setInfo(r.data)); }, [kind, id]);
  async function click() {
    if (!(await currentUserId())) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; }
    setBusy(true); setErr("");
    const r = await toggleFollow(supabase(), kind, id); setBusy(false);
    if (r.error) { setErr(friendlyError(r.error)); return; }
    setInfo(i => ({ following: !!r.data, followers: Math.max(0, (i?.followers ?? 0) + (r.data ? 1 : -1)) }));
  }
  if (!info) return null;
  return <>
    {mine ? <span className="badge">👥 {followersText(info.followers)}</span>
      : <button type="button" className={info.following ? "secondary" : ""} aria-pressed={info.following} disabled={busy} onClick={click}
          title={info.following ? "Carregue para deixar de seguir" : "Receba um aviso quando publicar algo novo"}>{followButtonLabel(info.following)} · {followersText(info.followers)}</button>}
    {err && <span className="error" role="alert">{err}</span>}
  </>;
}
