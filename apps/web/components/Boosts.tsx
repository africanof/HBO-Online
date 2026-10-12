"use client";
import { useEffect, useState } from "react";
import { requestBoost, boostStateFor, boostOfferText, formatDate, boostRef, listBoostsForAdmin, decideBoost, paymentProofUrl, uploadPaymentProof, validateDocument,
  formatPrice, friendlyError, PLAN_METHOD_LABELS, BOOST_STATUS_LABELS, type MyBoost, type AdminBoost, type BoostStatus, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { PaymentDetails } from "./Plans";

/** «⭐ Destacar» num anúncio publicado (Os meus anúncios). */
export function BoostBox({ listing, uid, boosts, settings, onDone }: { listing: { id: string; title: string; status: string }; uid: string; boosts: MyBoost[]; settings: PlatformSettings | null; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false); const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express");
  const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const state = boostStateFor(listing.id, boosts);
  if (listing.status !== "published" && state.kind !== "active") return null;
  async function send() {
    if (!reference.trim() && !file) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await requestBoost(supabase(), listing.id, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      setOpen(false); onDone("Pedido de destaque enviado. Fica ativo quando a administração confirmar o pagamento.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 8 }}>
    {state.kind === "active" && <span className="ok">⭐ Em destaque até {formatDate(state.until)}</span>}
    {state.kind === "pending" && <span>⏳ Destaque: pagamento à espera de confirmação.</span>}
    {state.kind === "rejected" && <span className="error">Destaque não confirmado{state.note ? ": " + state.note : ""}</span>}
    {listing.status === "published" && state.kind !== "pending" && (open ? <div className="card stack" style={{ gap: 10 }}>
      <strong>{boostOfferText(settings)}{state.kind === "active" ? " — junta mais dias ao destaque atual" : ""}</strong>
      <span>O anúncio aparece no topo das listas e da pesquisa, com o selo «⭐ Destaque».</span>
      <strong>1. Pague para estes dados</strong>
      <PaymentDetails s={settings} />
      <strong>2. Diga-nos como pagou</strong>
      <div className="row" role="radiogroup" aria-label="Como pagou">{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PLAN_METHOD_LABELS[m]}</button>)}</div>
      <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="Ex.: 1234 5678" /></label>
      <label>Comprovativo (opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row"><button disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar pagamento"}</button><button className="secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
    </div> : <button className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>{state.kind === "active" ? "⭐ Prolongar o destaque" : boostOfferText(settings)}</button>)}
  </div>;
}

/** Administração: pedidos de destaque. */
export function AdminBoosts() {
  const [items, setItems] = useState<AdminBoost[]>([]); const [status, setStatus] = useState<BoostStatus | "">("pending");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listBoostsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(b: AdminBoost, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (o vendedor vai ler)") ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirmar ${formatPrice(b.amount)} de ${b.owner_name} e pôr «${b.listing_title}» em destaque ${b.days} dias?`)) return;
    const r = await decideBoost(supabase(), b.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Destaque ativo." : "Pedido recusado."); await load(); }
  }
  async function proof(path: string) { const r = await paymentProofUrl(supabase(), path); if (r.data) window.open(r.data, "_blank", "noopener"); else setError(friendlyError(r.error)); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>⭐ Destaques de anúncios</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <label style={{ maxWidth: 260 }}>Mostrar<select value={status} onChange={e => setStatus(e.target.value as any)}>
      {(Object.keys(BOOST_STATUS_LABELS) as BoostStatus[]).map(k => <option key={k} value={k}>{BOOST_STATUS_LABELS[k]}</option>)}<option value="">Todos</option></select></label>
    {items.length === 0 && <p>Sem pedidos de destaque.</p>}
    {items.map(b => <article key={b.id} className="card">
      <strong>{boostRef(b.ref_no)} · {formatPrice(b.amount)} · {b.days} dias · <span className="badge">{BOOST_STATUS_LABELS[b.status]}</span></strong>
      <span><a href={"/classificados/" + b.listing_id} target="_blank">{b.listing_title}</a> · {b.owner_name}{b.phone ? " · " + b.phone : ""}</span>
      <span>{b.method ? PLAN_METHOD_LABELS[b.method] : ""}{b.reference ? " · Ref.: " + b.reference : ""} · {new Date(b.created_at).toLocaleString("pt-AO")}</span>
      {b.ends_at && <small>Destaque até {formatDate(b.ends_at)}</small>}
      {b.admin_note && <small>Nota: {b.admin_note}</small>}
      <div className="row">
        {b.proof_path && <button className="secondary" onClick={() => proof(b.proof_path!)}>📄 Comprovativo</button>}
        {b.status === "pending" && <><button onClick={() => decide(b, true)}>✔ Confirmar e destacar</button><button className="danger" onClick={() => decide(b, false)}>✖ Não recebido</button></>}
      </div>
    </article>)}
  </section>;
}
