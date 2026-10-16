"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@huambo-online/supabase";
import { useT } from "../../../lib/i18n";

export default function RecuperarConta() {
  const router = useRouter();
  const { t } = useT();
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [msg, setMsg] = useState(""); const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setMsg(t("recover.too_short")); return; }
    if (pw !== pw2) { setMsg(t("recover.mismatch")); return; }
    setSaving(true);
    const c = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
    const r = await c.auth.updateUser({ password: pw });
    setSaving(false);
    if (r.error) { setMsg(r.error.message); return; }
    setMsg(t("recover.done"));
    setTimeout(() => router.push("/conta/login"), 700);
  }
  return <main style={{ maxWidth: 520, margin: "0 auto", padding: 40 }}>
    <h1>{t("recover.title")}</h1>
    <p>{t("recover.intro")}</p>
    <form onSubmit={save} style={{ display: "grid", gap: 14 }}>
      <input type="password" minLength={8} required autoComplete="new-password" placeholder={t("recover.new_pw")} aria-label={t("recover.new_pw")} value={pw} onChange={e => setPw(e.target.value)} />
      <input type="password" minLength={8} required autoComplete="new-password" placeholder={t("auth.password_confirm")} aria-label={t("auth.password_confirm")} value={pw2} onChange={e => setPw2(e.target.value)} />
      <button disabled={saving}>{saving ? t("recover.saving") : t("recover.submit")}</button>
    </form>
    {msg && <p role="status">{msg}</p>}
  </main>;
}
