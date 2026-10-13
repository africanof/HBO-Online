"use client";
import { useEffect, useState } from "react";
import { checkAgentCode, normalizeAgentCode, isAgentCodeShape, listAgentsForAdmin, decideAgent, listAgentCommissionsForAdmin, decideAgentCommissions, sumCommissions,
  getPlatformSettings, formatPrice, friendlyError, agentCommissionLine, AGENT_STATUS_LABELS, AGENT_COMMISSION_STATUS_LABELS, SELLER_COMMISSION_LABELS,
  type AgentCodeInfo, type AdminAgent, type AdminAgentCommission, type AgentStatus, type AgentCommissionStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Campo «Código do agente» no formulário do anúncio, com confirmação do nome e da praça. */
export function AgentCodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [info, setInfo] = useState<AgentCodeInfo | null>(null); const [checked, setChecked] = useState(false);
  useEffect(() => {
    setInfo(null); setChecked(false);
    if (!isAgentCodeShape(value)) return;
    const t = setTimeout(() => { void checkAgentCode(supabase(), value).then(r => { setInfo(r); setChecked(true); }); }, 400);
    return () => clearTimeout(t);
  }, [value]);
  return <label>Código do agente que o ajudou (opcional)
    <input value={value} onChange={e => onChange(e.target.value)} placeholder="Ex.: AG1001" maxLength={12} autoCapitalize="characters" aria-describedby="agente-ajuda" />
    <small id="agente-ajuda" role="status">
      {info ? `✔ ${info.first_name}${info.market_name ? " — " + info.market_name : ""}` : checked ? "Código não encontrado. Confirme com o agente." :
        value.trim() && !isAgentCodeShape(value) ? "O código começa por AG e tem números (ex.: AG1001)." : "Se um agente do Huambo Online o ajudou a pôr este anúncio, escreva o código dele."}
    </small>
  </label>;
}

/** Lê «?agente=AG1001» da ligação que o agente partilhou. */
export function agentCodeFromUrl(): string {
  try { return normalizeAgentCode(new URLSearchParams(window.location.search).get("agente")); } catch { return ""; }
}

/** Administração: pedidos de agentes, comissões e valores. */
export function AdminAgents() {
  const [agents, setAgents] = useState<AdminAgent[]>([]); const [items, setItems] = useState<AdminAgentCommission[]>([]);
  const [status, setStatus] = useState<AgentCommissionStatus | "">("pending"); const [picked, setPicked] = useState<string[]>([]);
  const [pct, setPct] = useState("");
  const [note, setNote] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, c] = await Promise.all([listAgentsForAdmin(supabase()), listAgentCommissionsForAdmin(supabase(), status)]);
    if (a.error || c.error) setError(friendlyError(a.error ?? c.error));
    setAgents(a.data); setItems(c.data); setPicked([]);
  }
  useEffect(() => { void load(); }, [status]);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { const s = r.data; if (s) setPct(String(s.agent_sale_pct ?? "")); }); }, []);
  async function run(p: PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await p; setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setNote(""); await load(); }
  }
  function decide(a: AdminAgent, s: Exclude<AgentStatus, "pending">) {
    const reason = s === "active" ? "" : window.prompt(s === "suspended" ? "Motivo da suspensão:" : "Motivo da recusa:") ?? "";
    if (s !== "active" && !reason.trim()) return;
    void run(decideAgent(supabase(), a.user_id, s, reason), s === "active" ? `${a.full_name} é agente (${a.code}).` : "Feito.");
  }
  function saveRules(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(pct.replace(",", "."));
    if (!pct.trim() || !(v >= 0 && v <= 20)) { setError("Escreva a percentagem do agente (de 0 a 20)."); return; }
    void run(supabase().from("platform_settings").update({ agent_sale_pct: v, updated_at: new Date().toISOString() }).eq("id", 1), "Regras dos agentes guardadas.");
  }
  const pend = items.filter(i => i.status === "pending");
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🤝 Agentes no terreno</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <form className="card stack" onSubmit={saveRules} style={{ gap: 8 }}>
      <strong>Regras</strong>
      <label>Percentagem do agente em cada venda (%)<input inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} /></label>
      <small>Quando um anúncio feito com o código do agente é vendido, o agente ganha esta percentagem do valor da venda. Antes de confirmar, veja se o vendedor já pagou a comissão da venda.</small>
      <button type="submit" disabled={busy} style={{ justifySelf: "start" }}>Guardar regras</button>
    </form>
    <h3 style={{ margin: 0 }}>Agentes ({agents.length})</h3>
    {agents.length === 0 && <p>Ainda não há pedidos de agentes.</p>}
    {agents.map(a => <article key={a.user_id} className="card" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}><strong>{a.full_name} · {a.code}</strong><span>{AGENT_STATUS_LABELS[a.status]}</span></div>
      <span>📍 {a.market_name ?? "Sem praça"} · 📞 {a.phone}</span>
      {a.note && <span>«{a.note}»</span>}
      <span>{a.listings} anúncios · {a.sold} vendidos · {a.pending_count} comissões à espera ({formatPrice(a.pending_kz)}) · pago: {formatPrice(a.approved_kz)}</span>
      {a.admin_note && <small>Nota: {a.admin_note}</small>}
      <div className="row">
        {a.status !== "active" && <button type="button" disabled={busy} onClick={() => decide(a, "active")}>✅ Aprovar</button>}
        {a.status === "pending" && <button type="button" className="secondary" disabled={busy} onClick={() => decide(a, "rejected")}>Recusar</button>}
        {a.status === "active" && <button type="button" className="danger" disabled={busy} onClick={() => decide(a, "suspended")}>⛔ Suspender</button>}
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>Comissões</h3>
    <div className="row" role="radiogroup" aria-label="Estado das comissões">{(["pending", "approved", "rejected", "cancelled", ""] as const).map(s => <button key={s || "all"} type="button" role="radio" aria-checked={status === s} className={status === s ? "" : "secondary"} onClick={() => setStatus(s)}>{s ? AGENT_COMMISSION_STATUS_LABELS[s] : "Todas"}</button>)}</div>
    {items.length === 0 && <p>Nada aqui.</p>}
    {pend.length > 0 && <label className="check"><input type="checkbox" checked={picked.length === pend.length} onChange={e => setPicked(e.target.checked ? pend.map(i => i.id) : [])} /> Escolher todas as que estão à espera ({pend.length})</label>}
    {items.map(i => <article key={i.id} className="card" style={{ gap: 4 }}>
      <label className="check">{i.status === "pending" && <input type="checkbox" checked={picked.includes(i.id)} onChange={e => setPicked(p => e.target.checked ? [...p, i.id] : p.filter(x => x !== i.id))} />}
        <span>{i.listing_id ? <a href={"/classificados/" + i.listing_id}>{i.listing_title}</a> : i.listing_title} · {agentCommissionLine(i)}</span></label>
      <span>Agente {i.agent_name} ({i.agent_code}) · vendedor {i.owner_name}{i.seller_commission_status ? " · " + (SELLER_COMMISSION_LABELS[i.seller_commission_status] ?? i.seller_commission_status) : ""}</span>
      <small>{new Date(i.created_at).toLocaleString("pt-AO")} · {AGENT_COMMISSION_STATUS_LABELS[i.status]}{i.admin_note ? " · " + i.admin_note : ""}</small>
    </article>)}
    {picked.length > 0 && <div className="card stack" style={{ gap: 8 }}>
      <strong>{picked.length} escolhida(s) · {formatPrice(sumCommissions(items, picked))}</strong>
      <label>Motivo (só para recusar)<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
      <div className="row">
        <button type="button" disabled={busy} onClick={() => void run(decideAgentCommissions(supabase(), picked, true), "Comissões confirmadas: o valor já está no saldo dos agentes.")}>✅ Confirmar e pôr no saldo</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => void run(decideAgentCommissions(supabase(), picked, false, note), "Comissões recusadas.")}>Recusar</button>
      </div>
    </div>}
  </section>;
}
