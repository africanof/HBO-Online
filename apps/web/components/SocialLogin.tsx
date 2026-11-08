"use client";
import { useEffect, useState } from "react";
import { enabledSocialProviders, SOCIAL_PROVIDERS, type SocialProvider } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""; const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
let cache: Promise<SocialProvider[]> | null = null;
const LOGO: Record<SocialProvider, React.ReactNode> = {
  google: <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>,
  facebook: <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#fff" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>,
  apple: <svg width="18" height="20" viewBox="0 0 17 20"><path fill="#fff" d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM11.6 3c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>
};

/** «Continuar com Google / Facebook / Apple». Só aparecem os que estão ligados no Supabase. */
export function SocialLogin({ back = "/" }: { back?: string }) {
  const { t } = useT();
  const [list, setList] = useState<SocialProvider[]>([]); const [busy, setBusy] = useState<SocialProvider | null>(null); const [error, setError] = useState("");
  useEffect(() => { cache ??= enabledSocialProviders(URL_, KEY); void cache.then(setList); }, []);
  if (!list.length) return null;
  async function go(p: SocialProvider) {
    setError(""); setBusy(p);
    const safeBack = back.startsWith("/") && !back.startsWith("//") ? back : "/";
    const { error: e } = await supabase().auth.signInWithOAuth({ provider: p, options: { redirectTo: `${window.location.origin}/conta/entrar?voltar=${encodeURIComponent(safeBack)}` } });
    if (e) { setBusy(null); setError(t("social.failed", { error: e.message })); }
  }
  return <div className="social-login stack">
    {SOCIAL_PROVIDERS.filter(p => list.includes(p.id)).map(p =>
      <button key={p.id} type="button" className={"social-btn " + p.id} disabled={!!busy} onClick={() => void go(p.id)}>
        <span className="social-ic" aria-hidden>{LOGO[p.id]}</span>{busy === p.id ? t("social.wait", { name: p.label }) : t("social.continue", { name: p.label })}
      </button>)}
    <small className="muted">{t("social.note")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="social-or" aria-hidden><span>{t("social.or")}</span></div>
  </div>;
}
