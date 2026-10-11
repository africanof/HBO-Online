"use client";
import { useEffect, useState } from "react";
import { getUserStats, requestService, validateServiceRequest, sellerBadge, friendlyError, type UserStats } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Quadro de números do perfil (vendas, compras, serviços…). */
export function StatsBlock({ rows, footer }: { rows: { label: string; value: string }[]; footer?: string }) {
  if (rows.length === 0) return null;
  return <section className="stats" aria-label="Números do perfil">
    {rows.map(r => <div key={r.label} className="stat"><strong>{r.value}</strong><span>{r.label}</span></div>)}
    {footer && <small className="stats-foot">{footer}</small>}
  </section>;
}

/** Escolher de 1 a 5 estrelas (botões grandes). */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <div className="row" role="radiogroup" aria-label="Estrelas">
    {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={n === value} className={n <= value ? "star on" : "star"} aria-label={`${n} estrela(s)`} onClick={() => onChange(n)}>★</button>)}
  </div>;
}
export const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** «★ 4,8 (12) · 23 vendas» ao lado do nome do vendedor. */
export function SellerBadge({ userId }: { userId?: string | null }) {
  const [s, setS] = useState<UserStats | null>(null);
  useEffect(() => { if (userId) void getUserStats(supabase(), userId).then(r => setS(r.data)); }, [userId]);
  const text = sellerBadge(s);
  return text ? <span className="seller-badge">{text}</span> : null;
}

/** Caixa «Pedir serviço» nas páginas de profissionais e empresas. */
export function RequestServiceBox({ target, signedIn }: { target: { providerId?: string; businessId?: string }; signedIn: boolean }) {
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!signedIn) { setError("Inicie sessão para pedir um serviço."); return; }
    const v = validateServiceRequest(text); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await requestService(supabase(), target, text); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setDone(true); setText(""); }
  }
  return <section className="card">
    <h2 style={{ margin: 0 }}>🛠️ Pedir serviço</h2>
    {done ? <p className="ok" role="status">Pedido enviado! Acompanhe em <a href="/servicos">Pedidos de serviço</a>.</p> : <>
      <p style={{ margin: 0 }}>Diga o que precisa. Quando o serviço terminar, confirma e avalia — a avaliação fica marcada «✔ Serviço confirmado».</p>
      <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Ex.: Instalar 3 tomadas na sala, no bairro São João." />
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar pedido de serviço"}</button>
    </>}
  </section>;
}
