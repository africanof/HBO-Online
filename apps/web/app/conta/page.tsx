"use client";
import { useEffect, useState } from "react";
import { getCurrentUserProfile, updateCurrentUserProfile, signOutCurrentUser, changeCurrentUserPassword, deleteCurrentUserAccount, friendlyError, getMyAdminRole, canModerate, uploadAvatar, AVATAR_MAX_BYTES, AVATAR_MAX_SIDE, PHOTO_RAW_MAX_BYTES } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { compressPhoto } from "../../lib/image";
import { ThemePicker } from "../../components/ThemePicker";
import { WhatsAppSettings } from "../../components/Engage";
import { DataSaverPicker } from "../../components/DataSaver";
import { LanguagePicker } from "../../components/LanguagePicker";
import { useT } from "../../lib/i18n";

/** Atalhos da conta: [ícone, chave do texto, endereço]. */
const ACCOUNT_LINKS: [string, string, string][] = [
  ["📋", "ft.my_ads", "/meus-anuncios"], ["🧰", "acct.l.professional", "/conta/profissional"], ["🏪", "acct.l.businesses", "/conta/empresas"], ["💳", "acct.l.plan", "/conta/plano"],
  ["💸", "acct.l.commissions", "/conta/comissoes"], ["💰", "acct.l.balance", "/conta/saldo"], ["📊", "acct.l.stats", "/conta/estatisticas"], ["🤝", "acct.l.agent", "/agente"],
  ["🎁", "acct.l.invite", "/convidar"], ["🎟️", "acct.l.tickets", "/bilhetes"], ["🎤", "acct.l.events", "/eventos/meus"], ["🎬", "acct.l.videos", "/videos/meus"],
  ["⛽", "acct.l.fuel_orders", "/combustivel/pedidos"], ["⛽", "acct.l.stations", "/combustivel/meus"], ["🛍️", "acct.l.products", "/conta/produtos"], ["🚚", "sh.dl.link", "/conta/entregas"], ["📦", "ft.orders", "/encomendas"],
  ["↩️", "info./devolucoes", "/disputas"], ["🛠️", "acct.l.services", "/servicos"], ["💬", "acct.l.offers", "/propostas"], ["🔨", "ft.my_bids", "/licitacoes"],
  ["⭐", "acct.l.reviews", "/avaliacoes"], ["✔", "acct.l.verify", "/conta/verificacao"], ["🏅", "acct.l.inspected", "/inspecao"], ["❓", "nav.help", "/ajuda"],
  ["🛡️", "acct.l.safety", "/seguranca"], ["📅", "ft.rentals", "/alugueres"], ["🛵", "acct.l.deliveries", "/entregas"], ["⭐", "nav.saved", "/guardados"],
  ["👥", "acct.l.following", "/seguindo"], ["🕘", "web.recent", "/historico"], ["💬", "nav.messages", "/mensagens"], ["🔔", "nav.notifications", "/notificacoes"]
];

export default function ContaPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [uid, setUid] = useState(""); const [avatar, setAvatar] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<{ fullName: string; phone: string; municipality: string } | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [del, setDel] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => {
    const c = supabase();
    const u = await c.auth.getUser();
    setEmail(u.data.user?.email ?? ""); setUid(u.data.user?.id ?? "");
    const r = await getCurrentUserProfile(c);
    if (r.error && u.data.user) setErr(friendlyError(r.error));
    if (u.data.user) setIsStaff(canModerate(await getMyAdminRole(c)));
    if (r.data) setAvatar(r.data.avatarUrl ?? null);
    if (r.data) setForm({ fullName: r.data.fullName, phone: r.data.phone ?? "", municipality: r.data.municipality });
    setLoaded(true);
  })(); }, []);

  async function run(fn: () => Promise<{ error: any }>, okMsg: string) {
    setBusy(true); setMsg(""); setErr("");
    const r = await fn(); setBusy(false);
    if (r.error) setErr(friendlyError(r.error)); else setMsg(okMsg);
    return !r.error;
  }

  if (!loaded) return <main><p>{t("common.loading")}</p></main>;
  if (!email) return <main><a href="/">← Huambo Online</a><h1>{t("acct.yours")}</h1><p>{t("acct.sign_in_to_manage")}</p><div className="row"><a className="btn" href="/conta/login">{t("auth.login")}</a><a className="btn secondary" href="/conta/criar">{t("auth.signup")}</a></div></main>;
  const [signedA, signedB] = t("acct.signed_in_as").split("{email}");

  return <main className="stack" style={{ maxWidth: 640 }}>
    <a href="/">← Huambo Online</a>
    <h1>{t("acct.yours")}</h1>
    <div className="row">
      {avatar ? <img src={avatar} alt={t("acct.photo")} style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover" }} /> : <div aria-hidden style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--placeholder)" }} />}
      <label>{t("acct.photo")}<input type="file" accept="image/*" disabled={busy} onChange={async e => {
        const raw = e.target.files?.[0]; e.target.value = ""; if (!raw) return;
        if (!raw.type.startsWith("image/") || raw.size > PHOTO_RAW_MAX_BYTES) { setErr(t("acct.pick_image")); return; }
        const f = await compressPhoto(raw, AVATAR_MAX_SIDE); // fotografia de perfil pequena (512 px)
        if (f.size > AVATAR_MAX_BYTES) { setErr(t("acct.image_2mb")); return; }
        setBusy(true); setErr(""); setMsg("");
        const r = await uploadAvatar(supabase(), uid, f, f.name, f.type); setBusy(false);
        if (r.error) setErr(friendlyError(r.error)); else { setAvatar(r.data); setMsg(t("acct.photo_updated")); }
      }} /></label>
    </div>
    <p style={{ overflowWrap: "anywhere" }}>{signedA}<strong>{email}</strong>{signedB}</p>
    <nav className="row">{ACCOUNT_LINKS.map(([icon, k, h]) => <a key={h} className="btn secondary" href={h}>{icon} {t(k)}</a>)}{isStaff && <a className="btn" href="/admin">🛡️ {t("nav.admin")}</a>}</nav>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    {form && <form className="stack card" onSubmit={async e => { e.preventDefault(); await run(() => updateCurrentUserProfile(supabase(), form), t("acct.profile_updated")); }}>
      <h2 style={{ margin: 0 }}>{t("acct.personal")}</h2>
      <label>{t("acct.name")}<input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
      <label>{t("auth.phone")}<input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>{t("auth.municipality")}<input value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })} /></label>
      <button disabled={busy}>{t("acct.save_changes")}</button>
    </form>}
    {uid && <WhatsAppSettings uid={uid} />}
    <form className="stack card" onSubmit={async e => { e.preventDefault(); if (await run(() => changeCurrentUserPassword(supabase(), pw, pw2), t("acct.pw_changed"))) { setPw(""); setPw2(""); } }}>
      <h2 style={{ margin: 0 }}>{t("acct.security")}</h2>
      <label>{t("recover.new_pw")}<input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      <label>{t("auth.password_confirm")}<input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label>
      <button disabled={busy}>{t("acct.change_pw")}</button>
    </form>
    <section className="card">
      <h2 style={{ margin: 0 }}>🔐 {t("acct.twostep")}</h2>
      <p style={{ margin: 0 }}>{t("acct.twostep_text")}{isStaff ? t("acct.recommended_admin") : ""}</p>
      <div className="row"><a className="btn secondary" href="/conta/seguranca">🔐 {t("acct.twostep")}</a></div>
    </section>
    <section className="card" id="lingua"><h2 style={{ margin: 0 }}>🌐 {t("lang.choose")}</h2><p style={{ margin: 0 }}>{t("acct.language_text")}</p><LanguagePicker /></section>
    <section className="card"><h2 style={{ margin: 0 }}>🌓 {t("nav.appearance")}</h2><p style={{ margin: 0 }}>{t("acct.appearance_text")}</p><ThemePicker /></section>
    <section className="card" id="poupar-dados"><h2 style={{ margin: 0 }}>📉 {t("nav.data_saver")}</h2><p style={{ margin: 0 }}>{t("acct.datasaver_text")}</p><DataSaverPicker /></section>
    <form className="stack card" onSubmit={async e => { e.preventDefault(); if (await run(() => deleteCurrentUserAccount(supabase(), del), t("acct.deleted"))) window.location.href = "/"; }}>
      <h2 style={{ margin: 0 }}>{t("acct.privacy")}</h2>
      <p>{t("acct.delete_text")}</p>
      <label>{t("acct.type_delete")}<input value={del} onChange={e => setDel(e.target.value)} /></label>
      <button className="danger" disabled={busy}>{t("acct.delete_btn")}</button>
    </form>
    <button className="secondary" onClick={async () => { await signOutCurrentUser(supabase()); window.location.href = "/conta/login"; }}>{t("acct.logout")}</button>
  </main>;
}
