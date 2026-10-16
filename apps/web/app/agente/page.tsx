"use client";
import { useEffect, useState } from "react";
import { getMyAgentPanel, applyAsAgent, listMarketOptions, agentOfferText, agentInviteMessage, agentTotals, agentCommissionLine, whatsappShareUrl, formatPrice, friendlyErrorIn,
  AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, type AgentPanel } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useT, formatDateIn } from "../../lib/i18n";

export default function Agente() {
  const { lang, t: tr, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [p, setP] = useState<AgentPanel | null>(null); const [markets, setMarkets] = useState<{ id: string; name: string }[]>([]);
  const [marketId, setMarketId] = useState(""); const [fullName, setFullName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const r = await getMyAgentPanel(supabase());
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setP(r.data);
    const a = r.data?.agent;
    if (a) { setMarketId(a.market_id ?? ""); setFullName(a.full_name); setPhone(a.phone); setNote(a.note ?? ""); }
  }
  useEffect(() => {
    void currentUserId().then(id => { setUid(id); if (id) void load(); });
    void listMarketOptions(supabase()).then(r => setMarkets((r.data ?? []) as { id: string; name: string }[]));
  }, []);
  async function apply(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    const r = await applyAsAgent(supabase(), { marketId, fullName, phone, note });
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setEditing(false); setNotice(p?.agent?.status === "active" ? tr("sv.ag_saved") : tr("sv.ag_sent"));
    await load();
  }
  if (uid === undefined) return <main><p>{tr("common.loading")}</p></main>;
  const intro = <>
    <h1>🤝 {tr("sv.ag_title")}</h1>
    <p style={{ margin: 0, fontSize: 19 }}>{tr("sv.ag_intro")}</p>
    {p && <p className="ok" style={{ margin: 0 }}>{tc(agentOfferText(p.sale_pct))}</p>}
    <ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 4 }}>
      <li>{tr("sv.ag_step1")}</li>
      <li>{tr("sv.ag_step2")} <strong>AG1001</strong>.</li>
      <li>{tr("sv.ag_step3")}</li>
      <li>{tr("sv.ag_step4")}</li>
      <li>{tr("sv.ag_step5")} <a href="/conta/saldo">💰 {tr("sv.ag_balance")}</a> {tr("sv.ag_step5_b")}</li>
    </ol>
  </>;
  if (!uid) return <main className="stack" style={{ maxWidth: 820 }}>{intro}<p><a className="btn" href="/conta/login?voltar=/agente">{tr("sv.ag_login")}</a></p></main>;
  const a = p?.agent, t = agentTotals(p);
  const form = <form className="card stack" onSubmit={apply} style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>{a ? tr("sv.ag_my_data") : tr("sv.ag_apply")}</h2>
    <label>{tr("sv.ag_market")}<select value={marketId} onChange={e => setMarketId(e.target.value)}>
      <option value="">{tr("sv.ag_choose_market")}</option>{markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label>{tr("auth.full_name")}<input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={120} autoComplete="name" /></label>
    <label>{tr("auth.phone")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} autoComplete="tel" placeholder="923 000 000" /></label>
    <label>{tr("sv.ag_note")}<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} placeholder={tr("sv.ag_note_ph")} /></label>
    <div className="row"><button type="submit" disabled={busy}>{busy ? tr("sv.sending") : a ? tr("common.save") : tr("sv.send_request")}</button>{a && <button type="button" className="secondary" onClick={() => setEditing(false)}>{tr("common.cancel")}</button>}</div>
  </form>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/conta">← {tr("sv.your_account")}</a>
    {intro}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!a && form}
    {a && <>
      <section className="card" style={{ gap: 6 }}>
        <strong>{tc(AGENT_STATUS_LABELS[a.status])}</strong>
        <span>{a.full_name} · 📍 {a.market_name ?? "—"} · 📞 {a.phone}</span>
        {a.status === "pending" && <span>{tr("sv.ag_pending")}</span>}
        {(a.status === "rejected" || a.status === "suspended") && a.admin_note && <span className="error">{tr("sv.reason")}: {a.admin_note}</span>}
        {a.status === "rejected" && <span>{tr("sv.ag_rejected")}</span>}
        {a.status !== "suspended" && !editing && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setEditing(true)}>{a.status === "rejected" ? tr("sv.ag_reapply") : tr("sv.ag_change")}</button>}
      </section>
      {editing && form}
      {a.status === "active" && <>
        <section className="card" style={{ gap: 8, textAlign: "center" }}>
          <span>{tr("sv.ag_your_code")}</span>
          <strong style={{ fontSize: 40, letterSpacing: 2 }}>{a.code}</strong>
          <span>{tr("sv.ag_code_hint")}</span>
          <div className="row" style={{ justifyContent: "center" }}>
            <a className="btn" href={whatsappShareUrl(tc(agentInviteMessage(a.code, a.full_name.split(" ")[0], window.location.origin)))} target="_blank" rel="noopener">📲 {tr("sv.ag_invite_wa")}</a>
            <a className="btn secondary" href={"/classificados/publicar?agente=" + a.code}>+ {tr("sv.ag_publish_with")}</a>
          </div>
        </section>
        <section className="stats" aria-label={tr("sv.summary")}>
          <div className="stat"><strong>{t.listings}</strong><span>📋 {tr("sv.ag_st_listings")}</span></div>
          <div className="stat"><strong>{t.sold}</strong><span>🎉 {tr("sv.ag_st_sold")}</span></div>
          <div className="stat"><strong>{formatPrice(t.pending)}</strong><span>⏳ {tr("sv.ag_st_pending")}</span></div>
          <div className="stat"><strong>{formatPrice(t.approved)}</strong><span>✅ {tr("sv.ag_st_approved")}</span></div>
        </section>
        <a className="btn secondary" href="/conta/saldo" style={{ justifySelf: "start" }}>💰 {tr("sv.ag_see_balance")}</a>
      </>}
      {(p?.helped ?? []).length > 0 && <h2 style={{ margin: "8px 0 0" }}>{tr("sv.ag_helped")}</h2>}
      {(p?.helped ?? []).map(h => <article key={h.id} className="card" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><a href={"/classificados/" + h.id}>{h.title}</a>{h.price != null && <span>{formatPrice(h.price, h.currency ?? undefined)}</span>}</div>
        <small>{h.status === "sold" ? "🎉 " + tr("sv.ag_h_sold") : h.status === "published" ? tr("sv.ag_h_live") : tr("sv.ag_h_off")}</small>
      </article>)}
      {(p?.commissions ?? []).length > 0 && <h2 style={{ margin: "8px 0 0" }}>{tr("sv.ag_commissions")}</h2>}
      {(p?.commissions ?? []).map(c => <article key={c.id} className="card" style={{ gap: 4 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>{c.listing_id && c.listing_status === "published" ? <a href={"/classificados/" + c.listing_id}>{c.listing_title}</a> : <span>{c.listing_title}</span>}<strong>{formatPrice(c.amount)}</strong></div>
        <span>{tc(agentCommissionLine(c))}</span>
        <small>{formatDateIn(c.created_at, lang)} · {tc(AGENT_COMMISSION_STATUS_LABELS[c.status])}{c.admin_note ? " · " + c.admin_note : ""}</small>
      </article>)}
    </>}
  </main>;
}
