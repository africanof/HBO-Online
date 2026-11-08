"use client";
import { FormEvent, useEffect, useState } from "react";
import { signUp } from "@huambo-online/supabase";
import { authErrorMessage, validateNewPassword, validateProfileInput, isReferralCodeShape, storeReferralCode, pendingReferralCode, claimPendingReferral } from "@huambo-online/core";
import { browserStore } from "../../../components/Engage";
import { supabase, supabaseConfigured } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";
import { SocialLogin } from "../../../components/SocialLogin";

export default function CriarContaPage() {
  const { t } = useT();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", municipality: "", password: "", confirm: "" });
  const [message, setMessage] = useState(""); const [ok, setOk] = useState(""); const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState("");
  useEffect(() => { void pendingReferralCode(browserStore).then(setInvite); }, []);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setMessage(""); setOk("");
    if (!supabaseConfigured) { setMessage(t("signup.not_configured")); return; }
    const invalid = validateProfileInput(form) ?? (!/^\S+@\S+\.\S+$/.test(form.email.trim()) ? t("signup.bad_email") : null) ?? validateNewPassword(form.password, form.confirm);
    if (invalid) { setMessage(invalid); return; }
    if (invite.trim() && !isReferralCodeShape(invite)) { setMessage(t("signup.invite_shape")); return; }
    await storeReferralCode(browserStore, invite);
    setBusy(true);
    try {
      const { data, error } = await signUp(supabase(), { ...form, emailRedirectTo: `${window.location.origin}/conta/login` });
      if (error) throw error;
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { setMessage(t("signup.exists")); return; }
      if (data.session) { setOk(t("signup.created_in")); await claimPendingReferral(supabase(), browserStore); window.location.href = "/conta"; }
      else setOk(t("signup.created_confirm"));
    } catch (error) { setMessage(authErrorMessage(error)); } finally { setBusy(false); }
  }

  return <main style={{ maxWidth: 480 }}>
    <a href="/">← Huambo Online</a><h1>{t("auth.signup")}</h1><p>{t("signup.intro")}</p>
    <SocialLogin back="/conta" />
    <form onSubmit={submit} className="stack" noValidate>
      <label>{t("auth.full_name")}<input autoComplete="name" value={form.fullName} onChange={set("fullName")} /></label>
      <label>{t("auth.email")}<input type="email" autoComplete="email" value={form.email} onChange={set("email")} /></label>
      <label>{t("signup.phone_opt")}<input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} placeholder="923 000 000" /></label>
      <label>{t("signup.muni_opt")}<input value={form.municipality} onChange={set("municipality")} placeholder={t("signup.muni_ph")} /></label>
      <label>{t("auth.password_min")}<input type="password" autoComplete="new-password" value={form.password} onChange={set("password")} /></label>
      <label>{t("auth.password_confirm")}<input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} /></label>
      <label>{t("signup.invite")}<input value={invite} onChange={e => setInvite(e.target.value)} maxLength={8} placeholder={t("signup.invite_ph")} autoCapitalize="characters" /></label>
      <button type="submit" disabled={busy}>{busy ? t("auth.creating") : t("auth.signup")}</button>
      {message && <p className="error" role="alert">{message}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
    </form>
    <p><a href="/conta/login">{t("signup.have")}</a></p>
  </main>;
}
