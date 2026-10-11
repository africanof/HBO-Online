"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { listMyServiceRequests, updateServiceRequest, confirmService, serviceActions, validateReview, friendlyError,
  SERVICE_STATUS_LABELS, SERVICE_ACTION_LABELS, formatPreferredDate, type ServiceRequest, type ServiceAction } from "@huambo-online/core";
import { currentUserId, supabase } from "../../lib/supabase";
import { StarPicker } from "../../components/Reputation";

function ConfirmBox({ id, onDone }: { id: string; onDone: (msg: string, err?: boolean) => void }) {
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  async function send() {
    const v = validateReview(rating, comment); if (v) { onDone(v, true); return; }
    setBusy(true); const r = await confirmService(supabase(), id, rating, comment); setBusy(false);
    if (r.error) onDone(friendlyError(r.error), true); else onDone("Serviço confirmado e avaliado. Obrigado!");
  }
  return <div className="card" style={{ background: "var(--surface)" }}>
    <strong>O serviço foi feito? Avalie:</strong>
    <StarPicker value={rating} onChange={setRating} />
    <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Como correu o serviço? (opcional)" />
    <button disabled={busy || !rating} onClick={send}>{busy ? "A enviar…" : "✔ Confirmar serviço e publicar avaliação"}</button>
  </div>;
}

function Servicos() {
  const params = useSearchParams();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [as, setAs] = useState<"client" | "provider">(params.get("recebidos") ? "provider" : "client");
  const [items, setItems] = useState<ServiceRequest[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState("");
  async function load(a = as) { setItems(null); const r = await listMyServiceRequests(supabase(), a); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  useEffect(() => { if (uid) void load(as); }, [as]);
  async function act(id: string, action: ServiceAction) {
    if (action === "decline" || action === "cancel") { if (!confirm(action === "decline" ? "Recusar este pedido?" : "Cancelar este pedido?")) return; }
    const note = action === "accept" || action === "done" || action === "decline" ? prompt("Mensagem para o cliente (opcional):") ?? undefined : undefined;
    setError(""); setNotice("");
    const r = await updateServiceRequest(supabase(), id, action, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Pedido atualizado."); await load(); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>Pedidos de serviço</h1><p><a href="/conta/login?voltar=/servicos">Inicie sessão</a>.</p></main>;
  return <main className="stack">
    <a href="/conta">← A sua conta</a>
    <h1>🛠️ Pedidos de serviço</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={as === "client"} className={as === "client" ? "" : "secondary"} onClick={() => setAs("client")}>Que eu pedi</button>
      <button role="tab" aria-selected={as === "provider"} className={as === "provider" ? "" : "secondary"} onClick={() => setAs("provider")}>Que recebi</button>
    </div>
    {as === "client" && <p>Peça serviços nas páginas de <a href="/profissionais">profissionais</a> e <a href="/empresas">empresas</a>. Quando o serviço terminar, confirme e avalie.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && !error && <p>A carregar…</p>}
    {items?.length === 0 && <p>Sem pedidos de serviço.</p>}
    {items?.map(s => <article key={s.id} className="card">
      <strong style={{ fontSize: 19 }}>{as === "client" ? <a href={s.provider_id ? "/profissionais/" + s.provider_id : "/empresas/" + s.business_id}>{s.target_name}</a> : s.client_name} · <span className="badge">{SERVICE_STATUS_LABELS[s.status]}</span></strong>
      <span style={{ whiteSpace: "pre-wrap" }}>{s.description}</span>
      {s.preferred_date && <span>📅 {formatPreferredDate(s.preferred_date)}</span>}
      {s.provider_note && <span>💬 {s.provider_note}</span>}
      <small>{new Date(s.created_at).toLocaleString("pt-AO")}</small>
      <div className="row">{serviceActions(s.status, as).map(a => a === "confirm"
        ? <button key={a} onClick={() => setConfirming(confirming === s.id ? "" : s.id)}>{SERVICE_ACTION_LABELS.confirm}</button>
        : <button key={a} className={a === "decline" || a === "cancel" ? "danger" : a === "accept" ? "" : "secondary"} onClick={() => act(s.id, a)}>{SERVICE_ACTION_LABELS[a]}</button>)}</div>
      {confirming === s.id && <ConfirmBox id={s.id} onDone={(msg, err) => { if (err) setError(msg); else { setConfirming(""); setNotice(msg); void load(); } }} />}
    </article>)}
  </main>;
}
export default function Page() { return <Suspense fallback={<main><p>A carregar…</p></main>}><Servicos /></Suspense>; }
