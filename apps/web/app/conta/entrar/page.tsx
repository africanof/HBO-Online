"use client";
import { Suspense, useEffect, useState } from "react";
import { completeSocialLogin, claimPendingReferral, mfaRequired, signOutCurrentUser } from "@huambo-online/core";
import { supabase } from "../../../lib/supabase";
import { browserStore } from "../../../components/Engage";
import { MfaPrompt } from "../../../components/Mfa";
import { useT } from "../../../lib/i18n";

/** Regresso do Google / Facebook / Apple: guarda a sessão e volta à página de onde a pessoa veio. */
function Entrar() {
  const { t } = useT();
  const [error, setError] = useState(""); const [needCode, setNeedCode] = useState(false);
  const back = () => { const v = new URLSearchParams(window.location.search).get("voltar") ?? "/"; return v.startsWith("/") && !v.startsWith("//") ? v : "/"; };
  useEffect(() => {
    void (async () => {
      const c = supabase();
      // O cliente do Site já lê a sessão do endereço; se não leu (código PKCE), trocamos aqui.
      let { data } = await c.auth.getSession();
      if (!data.session) {
        const r = await completeSocialLogin(c, window.location.href);
        if (r.error) { setError(r.error.message === "SOCIAL_LOGIN_CANCELLED" ? t("social.cancelled") : t("social.failed", { error: r.error.message })); return; }
        data = (await c.auth.getSession()).data;
      }
      if (!data.session) { setError(t("social.cancelled")); return; }
      await claimPendingReferral(c, browserStore).catch(() => {});
      if (await mfaRequired(c)) { setNeedCode(true); return; }
      window.location.replace(back());
    })();
  }, []);
  if (needCode) return <main style={{ maxWidth: 480 }}><h1>{t("login.step2_title")}</h1><p>{t("login.step2_text")}</p>
    <MfaPrompt onDone={() => window.location.replace(back())} onCancel={async () => { await signOutCurrentUser(supabase()); window.location.replace("/conta/login"); }} /></main>;
  return <main style={{ maxWidth: 480 }}>
    {error ? <><p className="error" role="alert">{error}</p><p><a href="/conta/login">← {t("auth.login")}</a></p></> : <p>{t("social.finishing")}</p>}
  </main>;
}
export default function Page() { return <Suspense fallback={null}><Entrar /></Suspense>; }
