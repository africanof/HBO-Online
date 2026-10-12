"use client";
import { useEffect, useState } from "react";
import { listMyCommissions, submitCommissionPayment, commissionTotals, getPlatformSettings, uploadPaymentProof, validateDocument, formatPrice, friendlyError,
  COMMISSION_STATUS_LABELS, COMMISSION_SOURCE_LABELS, PLAN_METHOD_LABELS, type MyCommission, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { PaymentDetails } from "../../../components/Plans";

export default function Comissoes() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyCommission[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [sel, setSel] = useState<string[]>([]); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [c, s] = await Promise.all([listMyCommissions(supabase()), getPlatformSettings(supabase())]);
    if (c.error) setError(friendlyError(c.error)); setItems(c.data); setSettings(s.data);
    setSel(c.data.filter(x => x.status === "due").map(x => x.id));
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function pay() {
    if (!uid) return;
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError(""); setNotice("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitCommissionPayment(supabase(), sel, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      setNotice("Pagamento enviado. A administração vai confirmar e recebe uma notificação."); setReference(""); setFile(null); await load();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><h1>Comissões</h1><p><a href="/conta/login?voltar=/conta/comissoes">Inicie sessão</a>.</p></main>;
  const t = commissionTotals(items);
  const selTotal = items.filter(i => sel.includes(i.id)).reduce((s, i) => s + Number(i.amount), 0);
  const pct = settings?.listing_commission_pct ?? 5;
  return <main className="stack" style={{ maxWidth: 760 }}>
    <a href="/conta">← A sua conta</a>
    <h1>💸 Comissões das vendas</h1>
    <p style={{ margin: 0 }}>Publicar anúncios é grátis. Quando vende, paga à plataforma <strong>{String(pct)}%</strong> do valor da venda, em {settings?.commission_due_days ?? 7} dias. Com comissões em atraso não pode publicar anúncios novos.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {t.overdueCount > 0 && <p className="error" style={{ margin: 0 }}>⚠️ Tem {t.overdueCount} comissão(ões) em atraso. Pague para voltar a publicar.</p>}
    {items.length === 0 && <p>Ainda não tem comissões. Aparecem aqui quando marca um anúncio como vendido.</p>}
    {items.map(c => <article key={c.id} className="card" style={{ display: "grid", gridTemplateColumns: c.status === "due" ? "32px minmax(0,1fr)" : "minmax(0,1fr)", gap: 10 }}>
      {c.status === "due" && <input type="checkbox" aria-label={"Pagar " + c.listing_title} checked={sel.includes(c.id)} onChange={e => setSel(e.target.checked ? [...sel, c.id] : sel.filter(x => x !== c.id))} style={{ width: 26, height: 26 }} />}
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <a href={"/classificados/" + c.listing_id} style={{ overflowWrap: "anywhere" }}><strong>{c.listing_title}</strong></a>
        <span>Venda: {formatPrice(c.sale_amount)} · {String(c.rate_pct)}% = <strong>{formatPrice(c.amount)}</strong></span>
        <small className="muted">{COMMISSION_SOURCE_LABELS[c.source]} · prazo {new Date(c.due_at).toLocaleDateString("pt-AO")}</small>
        <span className={c.overdue ? "error" : c.status === "paid" ? "ok" : ""} style={{ margin: 0 }}><strong>{c.overdue ? "Em atraso" : COMMISSION_STATUS_LABELS[c.status]}</strong></span>
        {c.admin_note && <small>Nota da administração: {c.admin_note}</small>}
      </div>
    </article>)}
    {t.dueCount > 0 && <section className="card stack">
      <h2 style={{ margin: 0 }}>Pagar {sel.length} comissão(ões): {formatPrice(selTotal)}</h2>
      <strong>1. Pague para estes dados</strong>
      <PaymentDetails s={settings} />
      <strong>2. Diga-nos como pagou</strong>
      <div className="row" role="radiogroup" aria-label="Como pagou">{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PLAN_METHOD_LABELS[m]}</button>)}</div>
      <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
      <label>Comprovativo (opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button disabled={busy || !sel.length} onClick={pay} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : `Enviar pagamento de ${formatPrice(selTotal)}`}</button>
    </section>}
  </main>;
}
