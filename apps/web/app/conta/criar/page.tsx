"use client";
import { FormEvent, useState } from "react";
import { signUp } from "@huambo-online/supabase";
import { authErrorMessage, validateNewPassword, validateProfileInput } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../../../lib/supabase";

export default function CriarContaPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", municipality: "", password: "", confirm: "" });
  const [message, setMessage] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setMessage(""); setOk("");
    if (!supabaseConfigured) { setMessage("Serviço de autenticação não configurado. Tente mais tarde."); return; }
    const invalid = validateProfileInput(form) ?? (!/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "Email inválido." : null) ?? validateNewPassword(form.password, form.confirm);
    if (invalid) { setMessage(invalid); return; }
    setBusy(true);
    try {
      const { data, error } = await signUp(supabase(), { ...form, emailRedirectTo: `${window.location.origin}/conta/login` });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { setMessage("Já existe uma conta com este email. Use «Entrar»."); return; }
      if (data.session) { setOk("Conta criada com sucesso. A entrar…"); window.location.href = "/conta"; }
      else setOk("Conta criada. Abra o email que enviámos e clique no link para confirmar a conta. Depois pode entrar.");
    } catch (error) { setMessage(authErrorMessage(error)); } finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 480 }}>
    <a href="/">← Huambo Online</a><h1>Criar conta</h1><p>Uma conta para descobrir, comprar, vender e prestar serviços.</p>
    <form onSubmit={submit} className="stack" noValidate>
      <label>Nome completo<input autoComplete="name" value={form.fullName} onChange={set("fullName")} /></label>
      <label>Email<input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></label>
      <label>Telefone (opcional)<input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="923 000 000" /></label>
      <label>Município (opcional)<input value={form.municipality} onChange={set("municipality")} placeholder="Ex.: Huambo, Caála…" /></label>
      <label>Palavra-passe (mínimo 8 caracteres)<input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} /></label>
      <label>Confirmar palavra-passe<input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} /></label>
      <button type="submit" disabled={busy}>{busy ? "A criar conta..." : "Criar conta"}</button>
      {message && <p className="error" role="alert">{message}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
    </form>
    <p><a href="/conta/login">Já tenho conta</a></p>
  </main>;
}
