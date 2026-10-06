"use client";

import { FormEvent, useState } from "react";
import { createSupabaseClient, signIn } from "@huambo-online/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      const client = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ""
      );
      const { error } = await signIn(client, email, password);
      if (error) throw error;
      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "56px 24px" }}>
      <a href="/">← Huambo Online</a>
      <h1>Entrar</h1>
      <p>Aceda à sua conta Huambo Online.</p>
      <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ display:"block", width:"100%", padding:12, marginTop:6, boxSizing:"border-box" }} /></label>
        <label>Palavra-passe<input required type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ display:"block", width:"100%", padding:12, marginTop:6, boxSizing:"border-box" }} /></label>
        <button type="submit" style={{ padding:12 }}>Entrar</button>
        {message && <p role="alert">{message}</p>}
      </form>
      <p><a href="/conta/criar">Criar uma conta</a></p>
    </main>
  );
}