"use client";
import { useEffect, useState } from "react";
import { checkAgentCode, normalizeAgentCode, isAgentCodeShape, listAgentsForAdmin, decideAgent, listAgentCommissionsForAdmin, decideAgentCommissions, sumCommissions,
  getPlatformSettings, formatPrice, friendlyErrorIn, agentCommissionLine, LANG_TAGS, AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, SELLER_COMMISSION_LABELS,
  type AgentCodeInfo, type AdminAgent, type AdminAgentCommission, type AgentStatus, type AgentCommissionStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

/** Campo «Código do agente» no formulário do anúncio, com confirmação do nome e da praça. */
export function AgentCodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t: tr } = useT();
  const [info, setInfo] = useState<AgentCodeInfo | null>(null); const [checked, setChecked] = useState(false);
  useEffect(() => {
    setInfo(null); setChecked(false);
    if (!isAgentCodeShape(value)) return;
    const t = setTimeout(() => { void checkAgentCode(supabase(), value).then(r => { setInfo(r); setChecked(true); }); }, 400);
    return () => clearTimeout(t);
  }, [value]);
  return <label>{tr("sv.ag_code_field")}
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={tr("sv.ag_code_ph")} maxLength={12} autoCapitalize="characters" aria-describedby="agente-ajuda" />
    <small id="agente-ajuda" role="status">
      {info ? `✔ ${info.first_name}${info.market_name ? " — " + info.market_name : ""}` : checked ? tr("sv.ag_code_not_found") :
        value.trim() && !isAgentCodeShape(value) ? tr("sv.ag_code_shape") : tr("sv.ag_code_help")}
    </small>
  </label>;
}

/** Lê «?agente=AG1001» da ligação que o agente partilhou. */
export function agentCodeFromUrl(): string {
  try { return normalizeAgentCode(new URLSearchParams(window.location.search).get("agente")); } catch { return ""; }
}

/** Administração: pedidos de agentes, comissões e valores. */
export function AdminAgents() {
  const { lang, t, tc } = useT();
  const [agents, setAgents] = useState<AdminAgent[]>([]); const [items, setItems] = useState<AdminAgentCommission[]>([]);
  const [status, setStatus] = useState<AgentCommissionStatus | "">("pending"); const [picked, setPicked] = useState<string[]>([]);
  const [pct, setPct] = useState("");
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, c] = await Promise.all([listAgentsForAdmin(supabase()), listAgentCommissionsForAdmin(supabase(), status)]);
    if (a.error || c.error) setError(friendlyErrorIn(a.error ?? c.error, lang));
    setAgents(a.data); setItems(c.data); setPicked([]);
  }
  useEffect(() => { void load(); }, [status]);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { const s = r.data; if (s) setPct(String(s.agent_sale_pct ?? "")); }); }, []);
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); setNote(""); await load(); }
  }
  function decide(a: AdminAgent, s: Exclude<AgentStatus, "pending">) {
    const reason = s === "active" ? "" : window.prompt(s === "suspended" ? t("sv.ag_why_suspend") : t("sv.ag_why_refuse")) ?? "";
    if (s !== "active" && !reason.trim()) return;
    void run(decideAgent(supabase(), a.user_id, s, reason), s === "active" ? t("sv.ag_is_agent", { name: a.full_name, code: a.code }) : t("sv.done"));
  }
  function saveRules(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(pct.replace(",", "."));
    if (!pct.trim() || !(v >= 0 && v <= 20)) { setError(t("sv.ag_pct_err")); return; }
    void run(supabase().from("platform_settings").update({ agent_sale_pct: v, updated_at: new Date().toISOString() }).eq("id", 1), t("sv.ag_rules_saved"));
  }
  const pend = items.filter(i => i.status === "pending");
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🤝 {t("sv.ag_title")}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <form className="card stack" onSubmit={saveRules} style={{ gap: 8 }}>
      <strong>{t("sv.ve_rules")}</strong>
      <label>{t("sv.ag_pct")}<input inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} /></label>
      <small>{t("sv.ag_pct_hint")}</small>
      <button type="submit" disabled={busy} style={{ justifySelf: "start" }}>{t("sv.save_rules")}</button>
    </form>
    <h3 style={{ margin: 0 }}>{t("sv.ag_agents", { n: agents.length })}</h3>
    {agents.length === 0 && <p>{t("sv.ag_no_agents")}</p>}
    {agents.map(a => <article key={a.user_id} className="card" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><strong>{a.full_name} · {a.code}</strong><span>{tc(AGENT_STATUS_LABELS[a.status])}</span></div>
      <span>📍 {a.market_name ?? t("sv.ag_no_market")} · 📞 {a.phone}</span>
      {a.note && <span>«{a.note}»</span>}
      <span>{t("sv.ag_adm_line", { listings: a.listings, sold: a.sold, pending: a.pending_count, pending_kz: formatPrice(a.pending_kz), paid: formatPrice(a.approved_kz) })}</span>
      {a.admin_note && <small>{t("sv.note")}: {a.admin_note}</small>}
      <div className="row">
        {a.status !== "active" && <button type="button" disabled={busy} onClick={() => decide(a, "active")}>✅ {t("sv.approve")}</button>}
        {a.status === "pending" && <button type="button" className="secondary" disabled={busy} onClick={() => decide(a, "rejected")}>{t("sv.refuse")}</button>}
        {a.status === "active" && <button type="button" className="danger" disabled={busy} onClick={() => decide(a, "suspended")}>⛔ {t("sv.suspend")}</button>}
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>{t("sv.ag_commissions")}</h3>
    <div className="row" role="radiogroup" aria-label={t("sv.ag_comm_status")}>{(["pending", "approved", "rejected", "cancelled", ""] as const).map(s => <button key={s || "all"} type="button" role="radio" aria-checked={status === s} className={status === s ? "" : "secondary"} onClick={() => setStatus(s)}>{s ? tc(AGENT_COMMISSION_STATUS_LABELS[s]) : t("sv.all_f")}</button>)}</div>
    {items.length === 0 && <p>{t("sv.nothing_here")}</p>}
    {pend.length > 0 && <label className="check"><input type="checkbox" checked={picked.length === pend.length} onChange={e => setPicked(e.target.checked ? pend.map(i => i.id) : [])} /> {t("sv.ag_pick_all", { n: pend.length })}</label>}
    {items.map(i => <article key={i.id} className="card" style={{ gap: 4 }}>
      <label className="check">{i.status === "pending" && <input type="checkbox" checked={picked.includes(i.id)} onChange={e => setPicked(p => e.target.checked ? [...p, i.id] : p.filter(x => x !== i.id))} />}
        <span>{i.listing_id ? <a href={"/classificados/" + i.listing_id}>{i.listing_title}</a> : i.listing_title} · {tc(agentCommissionLine(i))}</span></label>
      <span>{t("sv.ag_agent")} {i.agent_name} ({i.agent_code}) · {t("sv.ag_seller")} {i.owner_name}{i.seller_commission_status ? " · " + tc(SELLER_COMMISSION_LABELS[i.seller_commission_status] ?? i.seller_commission_status) : ""}</span>
      <small>{new Date(i.created_at).toLocaleString(LANG_TAGS[lang])} · {tc(AGENT_COMMISSION_STATUS_LABELS[i.status])}{i.admin_note ? " · " + i.admin_note : ""}</small>
    </article>)}
    {picked.length > 0 && <div className="card stack" style={{ gap: 8 }}>
      <strong>{t("sv.ag_picked", { n: picked.length })} · {formatPrice(sumCommissions(items, picked))}</strong>
      <label>{t("sv.ag_reason_refuse")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
      <div className="row">
        <button type="button" disabled={busy} onClick={() => void run(decideAgentCommissions(supabase(), picked, true), t("sv.ag_comm_ok"))}>✅ {t("sv.ag_confirm_balance")}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void run(decideAgentCommissions(supabase(), picked, false, note), t("sv.ag_comm_no"))}>{t("sv.refuse")}</button>
      </div>
    </div>}
  </section>;
}
