"use client";
import { useEffect, useState } from "react";
import { getCurrentUserProfile, updateCurrentUserProfile, signOutCurrentUser, changeCurrentUserPassword, deleteCurrentUserAccount, friendlyError, getMyAdminRole, canModerate } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";

export default function ContaPage() {
  const [email, setEmail] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<{ fullName: string; phone: string; municipality: string } | null>(null);
  const [msg, setMsg] = useState(""); const [err, setErr] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [del, setDel] = useState(""); const [busy, setBusy] = useState(false);

  useEffect(() => { void (async () => {
    const c = supabase();
    const u = await c.auth.getUser();
    setEmail(u.data.user?.email ?? "");
    const r = await getCurrentUserProfile(c);
    if (r.error && u.data.user) setErr(friendlyError(r.error));
    if (u.data.user) setIsStaff(canModerate(await getMyAdminRole(c)));
    if (r.data) setForm({ fullName: r.data.fullName, phone: r.data.phone ?? "", municipality: r.data.municipality });
    setLoaded(true);
  })(); }, []);

  async function run(fn: () => Promise<{ error: any }>, okMsg: string) {
    setBusy(true); setMsg(""); setErr("");
    const r = await fn(); setBusy(false);
    if (r.error) setErr(friendlyError(r.error)); else setMsg(okMsg);
    return !r.error;
  }

  if (!loaded) return <main><p>A carregar…</p></main>;
  if (!email) return <main><a href="/">← Huambo Online</a><h1>A sua conta</h1><p>Inicie sessão para gerir a sua conta.</p><div className="row"><a className="btn" href="/conta/login">Entrar</a><a className="btn secondary" href="/conta/criar">Criar conta</a></div></main>;

  return <main className="stack" style={{ maxWidth: 640 }}>
    <a href="/">← Huambo Online</a>
    <h1>A sua conta</h1>
    <p>Sessão iniciada como <strong>{email}</strong></p>
    <nav className="row"><a className="btn secondary" href="/meus-anuncios">📋 Os meus anúncios</a><a className="btn secondary" href="/conta/profissional">🧰 Perfil profissional</a><a className="btn secondary" href="/conta/empresas">🏪 As minhas empresas</a><a className="btn secondary" href="/conta/produtos">🛍️ Os meus produtos</a><a className="btn secondary" href="/encomendas">📦 Encomendas</a><a className="btn secondary" href="/guardados">⭐ Guardados</a><a className="btn secondary" href="/mensagens">💬 Mensagens</a><a className="btn secondary" href="/notificacoes">🔔 Notificações</a>{isStaff && <a className="btn" href="/admin">🛡️ Administração</a>}</nav>
    {msg && <p className="ok" role="status">{msg}</p>}
    {err && <p className="error" role="alert">{err}</p>}
    {form && <form className="stack card" onSubmit={async e => { e.preventDefault(); await run(() => updateCurrentUserProfile(supabase(), form), "Perfil atualizado."); }}>
      <h2 style={{ margin: 0 }}>Dados pessoais</h2>
      <label>Nome<input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
      <label>Telefone<input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      <label>Município<input value={form.municipality} onChange={e => setForm({ ...form, municipality: e.target.value })} /></label>
      <button disabled={busy}>Guardar alterações</button>
    </form>}
    <form className="stack card" onSubmit={async e => { e.preventDefault(); if (await run(() => changeCurrentUserPassword(supabase(), pw, pw2), "Palavra-passe alterada com sucesso.")) { setPw(""); setPw2(""); } }}>
      <h2 style={{ margin: 0 }}>Segurança</h2>
      <label>Nova palavra-passe<input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} /></label>
      <label>Confirmar palavra-passe<input type="password" autoComplete="new-password" value={pw2} onChange={e => setPw2(e.target.value)} /></label>
      <button disabled={busy}>Alterar palavra-passe</button>
    </form>
    <form className="stack card" onSubmit={async e => { e.preventDefault(); if (await run(() => deleteCurrentUserAccount(supabase(), del), "Conta eliminada.")) window.location.href = "/"; }}>
      <h2 style={{ margin: 0 }}>Privacidade</h2>
      <p>Eliminar a conta remove permanentemente os seus dados.</p>
      <label>Escreva ELIMINAR para confirmar<input value={del} onChange={e => setDel(e.target.value)} /></label>
      <button className="danger" disabled={busy}>Eliminar a minha conta</button>
    </form>
    <button className="secondary" onClick={async () => { await signOutCurrentUser(supabase()); window.location.href = "/conta/login"; }}>Terminar sessão</button>
  </main>;
}
