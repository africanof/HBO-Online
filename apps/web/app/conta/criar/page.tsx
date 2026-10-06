"use client";

import { FormEvent, useState } from "react";
import { createSupabaseClient, signUp } from "@huambo-online/supabase";

export default function CriarContaPage() {
  const [form, setForm] = useState({ fullName:"", email:"", phone:"", municipality:"", password:"" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
      const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
      if (!url || !key) throw new Error("Serviço de autenticação não configurado. Atualize o site e tente novamente.");
      if (!/^https:\/\//i.test(url)) throw new Error("Configuração inválida do serviço de autenticação.");
      const client = createSupabaseClient(url, key);
      const { data, error } = await signUp(client, form);
      if (error) throw error;
      setMessage(data.session ? "Conta criada com sucesso." : "Conta criada. Verifique o seu email para confirmar.");
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const msg = /failed to fetch|network|fetch/i.test(raw) ? "Não foi possível contactar o serviço de autenticação. Verifique a ligação à internet e tente novamente." : raw;
      setMessage(msg || "Não foi possível criar a conta.");
    } finally { setBusy(false); }
  }

  const field=(label:keyof typeof form,type="text")=><label>{label}<input required={label!=="phone"&&label!=="municipality"} type={type} value={form[label]} onChange={e=>setForm({...form,[label]:e.target.value})} style={{display:"block",width:"100%",padding:12,marginTop:6,boxSizing:"border-box"}} /></label>;

  return <main style={{maxWidth:480,margin:"0 auto",padding:"56px 24px"}}>
    <a href="/">← Huambo Online</a><h1>Criar conta</h1><p>Uma conta para descobrir, comprar, vender e prestar serviços.</p>
    <form onSubmit={submit} style={{display:"grid",gap:14}}>
      {field("fullName")} {field("email","email")} {field("phone")} {field("municipality")} {field("password","password")}
      <button type="submit" disabled={busy} style={{padding:12}}>{busy ? "A criar conta..." : "Criar conta"}</button>
      {message&&<p role="status">{message}</p>}
    </form>
    <p><a href="/conta/login">Já tenho conta</a></p>
  </main>;
}