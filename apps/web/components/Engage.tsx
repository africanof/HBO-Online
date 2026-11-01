"use client";
import { useEffect, useState } from "react";
import { getTeamWhatsapp, setTeamWhatsapp, teamWhatsappMessage, teamWhatsappRequestMessage, teamWhatsappLink, findSaved, toggleSaved, recordView, shareMessage, whatsappShareUrl, sellerWhatsappMessage, getSellerWhatsapp, getMyWhatsapp, setMyWhatsapp, formatWhatsapp, whatsappLink, friendlyErrorIn,
  getFollowInfo, toggleFollow, recordItemView, recordItemEvent, followersText, followButtonLabel, type FollowKind,
  type SavedKind, type KeyValueStore, type ShareExtra } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** localStorage com proteção (modo privado, bloqueios). */
export const browserStore: KeyValueStore = {
  getItem: k => { try { return window.localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* ignorar */ } }
};

export function useRecordView(kind: SavedKind, id: string | undefined, title: string | undefined, image?: string | null) {
  useEffect(() => { if (id && title) void recordView(browserStore, { kind, id, title, image: image ?? null }); }, [kind, id, title, image]);
  useEffect(() => { if (id && title) void recordItemView(supabase(), browserStore, kind, id); }, [kind, id, !!title]);
}

export function SaveButton({ kind, id }: { kind: SavedKind; id: string }) {
  const { lang, t } = useT();
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
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setSavedId(r.data);
  }
  return <>
    <button type="button" className="secondary" onClick={click} disabled={busy} aria-pressed={!!savedId}>{savedId ? "★ " + t("ls.saved") : "☆ " + t("common.save")}</button>
    {error && <span className="error" role="alert">{error}</span>}
  </>;
}

export function ShareButton({ kind, id, title, extra }: { kind: SavedKind; id: string; title: string; extra?: ShareExtra }) {
  const { t } = useT();
  const [done, setDone] = useState("");
  async function click() {
    void recordItemEvent(supabase(), kind, id, "share");
    const { url, text } = shareMessage(window.location.origin, kind, id, title, extra);
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return; }
      await navigator.clipboard.writeText(url); setDone(t("ls.link_copied"));
    } catch { /* partilha cancelada */ }
  }
  function whatsapp() {
    void recordItemEvent(supabase(), kind, id, "share");
    window.open(whatsappShareUrl(shareMessage(window.location.origin, kind, id, title, extra).text), "_blank", "noopener");
  }
  return <>
    <button type="button" className="secondary" onClick={click}>🔗 {t("common.share")}</button>
    <button type="button" className="secondary" onClick={whatsapp}>📲 {t("ls.share_whatsapp")}</button>
    {done && <span className="ok" role="status">{done}</span>}
  </>;
}

/** «Falar no WhatsApp» com o vendedor: só aparece à equipa (administração e moderadores). */
export function SellerWhatsApp({ sellerId, kind, id, title, refCode }: { sellerId: string; kind: "listing" | "product"; id: string; title: string; refCode?: string | null }) {
  const { t } = useT();
  // O vendedor só é devolvido à equipa; os outros falam com o WhatsApp oficial da equipa.
  const [seller, setSeller] = useState<string | null>(null); const [team, setTeam] = useState<string | null>(null);
  useEffect(() => { void getSellerWhatsapp(supabase(), sellerId).then(setSeller); void getTeamWhatsapp(supabase()).then(setTeam); }, [sellerId]);
  const url = typeof window !== "undefined" ? shareMessage(window.location.origin, kind, id, title).url : "";
  const track = () => void recordItemEvent(supabase(), kind, id, "whatsapp");
  if (seller) {
    const href = whatsappLink(seller, sellerWhatsappMessage(kind, title, refCode, url));
    return href ? <a className="btn secondary" href={href} target="_blank" rel="noopener">{t("wa.seller_staff")}</a> : null;
  }
  const href = teamWhatsappLink(team, teamWhatsappMessage(kind, title, refCode, url));
  if (!href) return null;
  return <div className="stack" style={{ gap: 4 }}>
    <a className="btn" href={href} target="_blank" rel="noopener" onClick={track} style={{ background: "#25D366", borderColor: "#25D366", color: "#08321A", fontWeight: 800 }}>{t("wa.team_btn")}</a>
    <small className="muted">{t("wa.team_hint")}</small>
  </div>;
}

/** «💬 Falar deste pedido no WhatsApp» (com o pedido e a ligação direta). */
export function RequestWhatsApp({ what, refNo, path }: { what: string; refNo?: number | null; path?: string | null }) {
  const { t } = useT();
  const [team, setTeam] = useState<string | null>(null);
  useEffect(() => { void getTeamWhatsapp(supabase()).then(setTeam); }, []);
  const url = path && typeof window !== "undefined" ? window.location.origin + path : null;
  const href = teamWhatsappLink(team, teamWhatsappRequestMessage(what, refNo, url));
  return href ? <a href={href} target="_blank" rel="noopener" style={{ fontWeight: 700, color: "#128C7E" }}>{t("wa.team_req")}</a> : null;
}

/** Administração: número oficial de WhatsApp da equipa. */
export function TeamWhatsappSettings() {
  const { lang, t } = useT();
  const [number, setNumber] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { void getTeamWhatsapp(supabase()).then(n => setNumber(formatWhatsapp(n))); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(""); setErr("");
    const r = await setTeamWhatsapp(supabase(), number); setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else { setMsg(number.trim() ? t("wa.team_saved") : t("wa.team_deleted")); setNumber(formatWhatsapp(r.data as string | null)); }
  }
  return <form className="stack card" onSubmit={save}>
    <h2 style={{ margin: 0 }}>{t("wa.team_title")}</h2>
    <p style={{ margin: 0 }}>{t("wa.team_text")}</p>
    <label>{t("wa.number")}<input type="tel" value={number} onChange={e => setNumber(e.target.value)} placeholder="923 000 000" /></label>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    <button disabled={busy} style={{ justifySelf: "start" }}>{t("wa.save")}</button>
  </form>;
}

/** «A sua conta»: número de WhatsApp (só a equipa o vê). */
export function WhatsAppSettings({ uid }: { uid: string }) {
  const { lang, t } = useT();
  const [number, setNumber] = useState("");
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { void getMyWhatsapp(supabase(), uid).then(r => setNumber(formatWhatsapp(r.data?.whatsapp))); }, [uid]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(""); setErr("");
    const r = await setMyWhatsapp(supabase(), number, false); setBusy(false);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setMsg(!number.trim() ? t("wa.deleted") : t("wa.saved_visible"));
  }
  return <form className="stack card" onSubmit={save}>
    <h2 style={{ margin: 0 }}>💬 WhatsApp</h2>
    <p style={{ margin: 0 }}>{t("wa.text")}</p>
    <label>{t("wa.number")}<input type="tel" value={number} onChange={e => setNumber(e.target.value)} placeholder="923 000 000" autoComplete="tel" /></label>
    <small>{t("wa.note")}</small>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    <button disabled={busy} style={{ justifySelf: "start" }}>{t("wa.save")}</button>
  </form>;
}

/** «➕ Seguir» / «✔ A seguir», com o número de seguidores. Sem sessão, leva a entrar. */
export function FollowButton({ kind, id, mine = false }: { kind: FollowKind; id: string; mine?: boolean }) {
  const { lang, t, tc } = useT();
  const [info, setInfo] = useState<{ followers: number; following: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { void getFollowInfo(supabase(), kind, id).then(r => setInfo(r.data)); }, [kind, id]);
  async function click() {
    if (!(await currentUserId())) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname); return; }
    setBusy(true); setErr("");
    const r = await toggleFollow(supabase(), kind, id); setBusy(false);
    if (r.error) { setErr(friendlyErrorIn(r.error, lang)); return; }
    setInfo(i => ({ following: !!r.data, followers: Math.max(0, (i?.followers ?? 0) + (r.data ? 1 : -1)) }));
  }
  if (!info) return null;
  return <>
    {mine ? <span className="badge">👥 {tc(followersText(info.followers))}</span>
      : <button type="button" className={info.following ? "secondary" : ""} aria-pressed={info.following} disabled={busy} onClick={click}
          title={info.following ? t("ls.follow_unfollow_hint") : t("ls.follow_hint")}>{tc(followButtonLabel(info.following))} · {tc(followersText(info.followers))}</button>}
    {err && <span className="error" role="alert">{err}</span>}
  </>;
}
