"use client";
import { useEffect, useState } from "react";
import { getMyReferrals, claimReferral, referralLink, referralRewardText, referralInviteMessage, whatsappShareUrl, daysText, friendlyErrorIn,
  REFERRAL_STATUS_LABELS, type ReferralPanel } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useT, formatDateIn } from "../../lib/i18n";

export default function Convidar() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<ReferralPanel | null>(null); const [code, setCode] = useState(""); const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await getMyReferrals(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setP(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function claim(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    const r = await claimReferral(supabase(), code); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(t("sv.rf_joined", { name: r.data ?? t("sv.rf_a_friend") })); setCode(""); await load();
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(t("sv.rf_copied")); } catch { setCopied(t("sv.rf_copy_fail")); }
  }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack" style={{ maxWidth: 760 }}><h1>🎁 {t("sv.rf_title")}</h1><p>{tc(referralRewardText(30))}</p><p><a className="btn" href="/conta/login?voltar=/convidar">{t("sv.rf_login")}</a></p></main>;
  const link = p ? referralLink(window.location.origin, p.code) : "";
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← {t("sv.your_account")}</a>
    <h1>🎁 {t("sv.rf_title")}</h1>
    <p style={{ margin: 0, fontSize: 19 }}>{tc(referralRewardText(p?.reward_days))}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {p && <>
      <section className="card" style={{ gap: 10, textAlign: "center" }}>
        <span>{t("sv.rf_your_code")}</span>
        <strong style={{ fontSize: 40, letterSpacing: 4 }}>{p.code}</strong>
        <input aria-label={t("sv.rf_link")} readOnly value={link} onFocus={e => e.target.select()} style={{ textAlign: "center" }} />
        <div className="row" style={{ justifyContent: "center" }}>
          <a className="btn" href={whatsappShareUrl(tc(referralInviteMessage(window.location.origin, p.code)))} target="_blank" rel="noopener">📲 {t("sv.rf_invite_wa")}</a>
          <button type="button" className="secondary" onClick={() => void copy(link)}>🔗 {t("sv.rf_copy")}</button>
        </div>
        {copied && <small role="status">{copied}</small>}
      </section>
      <section className="stats" aria-label={t("sv.summary")}>
        <div className="stat"><strong>{p.invited}</strong><span>👥 {t("sv.rf_st_invited")}</span></div>
        <div className="stat"><strong>{p.earned}</strong><span>💳 {t("sv.rf_st_paid")}</span></div>
        <div className="stat"><strong>{tc(daysText(p.days_earned))}</strong><span>🎁 {t("sv.rf_st_free")}</span></div>
      </section>
      {p.waiting_days > 0 && <p className="banner yellow" style={{ margin: 0 }}>🎁 {t("sv.rf_waiting", { days: tc(daysText(p.waiting_days)) })}</p>}
      {p.friends.length > 0 && <h2 style={{ margin: "8px 0 0" }}>{t("sv.rf_your_invites")}</h2>}
      {p.friends.map((f, i) => <article key={i} className="card" style={{ gap: 4 }}>
        <strong>{f.name}</strong><small>{formatDateIn(f.created_at, lang)} · {tc(REFERRAL_STATUS_LABELS[f.status])}</small>
      </article>)}
      {p.invited_by && <p style={{ margin: 0 }}>{t("sv.rf_invited_by")} <strong>{p.invited_by}</strong>.</p>}
      {p.can_claim && <form className="card stack" onSubmit={claim} style={{ gap: 8 }}>
        <strong>{t("sv.rf_someone")}</strong>
        <label>{t("sv.rf_code")}<input value={code} onChange={e => setCode(e.target.value)} maxLength={8} placeholder={t("sv.rf_code_ph")} autoCapitalize="characters" /></label>
        <small>{t("sv.rf_code_hint")}</small>
        <button type="submit" disabled={busy || !code.trim()} style={{ justifySelf: "start" }}>{busy ? t("sv.rf_confirming") : t("sv.rf_use_code")}</button>
      </form>}
      <details className="card faq"><summary><strong>{t("sv.rf_how")}</strong></summary>
        <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 4 }}>
          <li>{t("sv.rf_how1")}</li>
          <li>{t("sv.rf_how2")}</li>
          <li>{t("sv.rf_how3", { days: tc(daysText(p.reward_days)) })}</li>
        </ol>
      </details>
    </>}
  </main>;
}
