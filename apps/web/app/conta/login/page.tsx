"use client";
import { FormEvent, useState } from "react";
import { signIn } from "@huambo-online/supabase";
import { requestPasswordReset, authErrorMessage } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false); const [forgot, setForgot] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setMessage(""); setOk(""); setBusy(true);
    try {
      if (forgot) {
        const r = await requestPasswordReset(supabase(), email, `${window.location.origin}/conta/recuperar`);
        if (r.error) throw r.error;
        setOk("Se o email existir, enviámos um link para definir uma nova palavra-passe.");
      } else {
        const { error } = await signIn(supabase(), email, password);
        if (error) throw error;
        const back = new URLSearchParams(window.location.search).get("voltar");
        window.location.href = back && back.startsWith("/") ? back : "/";
      }
    } catch (error) { setMessage(authErrorMessage(error)); } finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 480 }}>
    <a href="/">← Huambo Online</a>
    <h1>{forgot ? "Recuperar palavra-passe" : "Entrar"}</h1>
    <form onSubmit={submit} className="stack">
      <label>Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!forgot && <label>Palavra-passe<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <button type="submit" disabled={busy}>{busy ? "Aguarde…" : forgot ? "Enviar link de recuperação" : "Entrar"}</button>
      {message && <p className="error" role="alert">{message}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
    </form>
    <p><button type="button" className="secondary" onClick={() => { setForgot(!forgot); setMessage(""); setOk(""); }}>{forgot ? "← Voltar a entrar" : "Esqueci-me da palavra-passe"}</button></p>
    <p><a href="/conta/criar">Criar uma conta</a></p>
  </main>;
}
