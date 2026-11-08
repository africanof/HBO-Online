"use client";
import { FormEvent, useState } from "react";
import { signIn } from "@huambo-online/supabase";
import { requestPasswordReset, authErrorMessage, mfaRequired, signOutCurrentUser } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { MfaPrompt } from "../../../components/Mfa";
import { useT } from "../../../lib/i18n";
import { SocialLogin } from "../../../components/SocialLogin";

function goBack() {
  const back = new URLSearchParams(window.location.search).get("voltar");
  window.location.href = back && back.startsWith("/") && !back.startsWith("//") ? back : "/";
}

export default function LoginPage() {
  const { t } = useT();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [message, setMessage] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false); const [forgot, setForgot] = useState(false);
  const [needCode, setNeedCode] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setMessage(""); setOk(""); setBusy(true);
    try {
      if (forgot) {
        const r = await requestPasswordReset(supabase(), email, `${window.location.origin}/conta/recuperar`);
        if (r.error) throw r.error;
        setOk(t("login.reset_sent"));
      } else {
        const { error } = await signIn(supabase(), email, password);
        if (error) throw error;
        // Conta com APP autenticadora: falta o segundo passo (código de 6 algarismos).
        if (await mfaRequired(supabase())) { setNeedCode(true); return; }
        goBack();
      }
    } catch (error) { setMessage(authErrorMessage(error)); } finally { setBusy(false); }
  }

  if (needCode) return <main style={{ maxWidth: 480 }}>
    <a href="/">← Huambo Online</a>
    <h1>{t("login.step2_title")}</h1>
    <p>{t("login.step2_text")}</p>
    <MfaPrompt onDone={goBack} onCancel={async () => { await signOutCurrentUser(supabase()); setNeedCode(false); setPassword(""); }} />
  </main>;

  return <main style={{ maxWidth: 480 }}>
    <a href="/">← Huambo Online</a>
    <h1>{forgot ? t("login.recover_title") : t("auth.login")}</h1>
    {!forgot && <SocialLogin back={typeof window === "undefined" ? "/" : new URLSearchParams(window.location.search).get("voltar") ?? "/"} />}
    <form onSubmit={submit} className="stack">
      <label>{t("auth.email")}<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {!forgot && <label>{t("auth.password")}<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <button type="submit" disabled={busy}>{busy ? t("login.wait") : forgot ? t("login.send_link") : t("auth.login")}</button>
      {message && <p className="error" role="alert">{message}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
    </form>
    <p><button type="button" className="secondary" onClick={() => { setForgot(!forgot); setMessage(""); setOk(""); }}>{forgot ? t("login.back_to_login") : t("auth.forgot")}</button></p>
    <p><a href="/conta/criar">{t("login.create")}</a></p>
  </main>;
}
