"use client";
import { useEffect, useState } from "react";
import { getMyReferrals, claimReferral, referralLink, referralRewardText, referralInviteMessage, whatsappShareUrl, daysText, friendlyError,
  REFERRAL_STATUS_LABELS, type ReferralPanel } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";

export default function Convidar() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<ReferralPanel | null>(null); const [code, setCode] = useState(""); const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await getMyReferrals(supabase()); if (r.error) setError(friendlyError(r.error)); else setP(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function claim(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    const r = await claimReferral(supabase(), code); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice(`Pronto! Entrou com o convite de ${r.data ?? "um amigo"}.`); setCode(""); await load();
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied("Ligação copiada."); } catch { setCopied("Não foi possível copiar: selecione a ligação e copie."); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack" style={{ maxWidth: 760 }}><h1>🎁 Convide um amigo</h1><p>{referralRewardText(30)}</p><p><a className="btn" href="/conta/login?voltar=/convidar">Entrar para convidar</a></p></main>;
  const link = p ? referralLink(window.location.origin, p.code) : "";
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← A sua conta</a>
    <h1>🎁 Convide um amigo</h1>
    <p style={{ margin: 0, fontSize: 19 }}>{referralRewardText(p?.reward_days)}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {p && <>
      <section className="card" style={{ gap: 10, textAlign: "center" }}>
        <span>O seu código de convite</span>
        <strong style={{ fontSize: 40, letterSpacing: 4 }}>{p.code}</strong>
        <input aria-label="Ligação de convite" readOnly value={link} onFocus={e => e.target.select()} style={{ textAlign: "center" }} />
        <div className="row" style={{ justifyContent: "center" }}>
          <a className="btn" href={whatsappShareUrl(referralInviteMessage(window.location.origin, p.code))} target="_blank" rel="noopener">📲 Convidar no WhatsApp</a>
          <button type="button" className="secondary" onClick={() => void copy(link)}>🔗 Copiar ligação</button>
        </div>
        {copied && <small role="status">{copied}</small>}
      </section>
      <section className="stats" aria-label="Resumo">
        <div className="stat"><strong>{p.invited}</strong><span>👥 Amigos que entraram</span></div>
        <div className="stat"><strong>{p.earned}</strong><span>💳 Já pagaram a mensalidade</span></div>
        <div className="stat"><strong>{daysText(p.days_earned)}</strong><span>🎁 Grátis que ganhou</span></div>
      </section>
      {p.waiting_days > 0 && <p className="banner yellow" style={{ margin: 0 }}>🎁 Tem {daysText(p.waiting_days)} grátis guardados: entram quando criar o seu perfil profissional, a sua empresa ou a sua loja.</p>}
      {p.friends.length > 0 && <h2 style={{ margin: "8px 0 0" }}>Os seus convites</h2>}
      {p.friends.map((f, i) => <article key={i} className="card" style={{ gap: 4 }}>
        <strong>{f.name}</strong><small>{new Date(f.created_at).toLocaleDateString("pt-AO")} · {REFERRAL_STATUS_LABELS[f.status]}</small>
      </article>)}
      {p.invited_by && <p style={{ margin: 0 }}>Entrou no Huambo Online com o convite de <strong>{p.invited_by}</strong>.</p>}
      {p.can_claim && <form className="card stack" onSubmit={claim} style={{ gap: 8 }}>
        <strong>Alguém o convidou?</strong>
        <label>Código de convite<input value={code} onChange={e => setCode(e.target.value)} maxLength={8} placeholder="Ex.: K7M2QX" autoCapitalize="characters" /></label>
        <small>Pode usar um código nos primeiros 14 dias da sua conta.</small>
        <button type="submit" disabled={busy || !code.trim()} style={{ justifySelf: "start" }}>{busy ? "A confirmar…" : "Usar o código"}</button>
      </form>}
      <details className="card faq"><summary><strong>Como funciona?</strong></summary>
        <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 4 }}>
          <li>Envie a sua ligação ou o seu código a um amigo, uma empresa ou um profissional.</li>
          <li>O amigo cria a conta pela ligação (ou escreve o código em «Convidar amigos»).</li>
          <li>Quando o amigo pagar a primeira mensalidade, ganha {daysText(p.reward_days)} grátis na sua mensalidade.</li>
        </ol>
      </details>
    </>}
  </main>;
}
