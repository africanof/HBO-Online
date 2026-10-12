"use client";
import { useEffect, useState } from "react";
import { disputeActions, disputeNextStep, disputeEventLabel, disputeAction, disputePhotoUrls, uploadDisputePhoto, listDisputesForAdmin, decideDispute,
  formatPrice, friendlyError, DISPUTE_STATUS_LABELS, DISPUTE_OUTCOME_LABELS, DISPUTE_REASON_LABELS, DISPUTE_REQUEST_LABELS, DISPUTE_ACTION_LABELS,
  DISPUTE_DECISION_LABELS, DISPUTE_MAX_PHOTOS, PAYMENT_LABELS, ORDER_STATUS_LABELS,
  type DisputeAction, type DisputeDecision, type DisputeEvent, type DisputeRole, type MyDispute, type AdminDispute, type DisputeStatus, type PaymentMethod, type OrderStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { compressPhoto } from "../lib/image";

/** Escolher até 4 fotografias de prova (reduzidas antes de enviar). */
export function EvidencePicker({ files, onChange, label = "Fotografias (opcional, até 4)" }: { files: File[]; onChange: (f: File[]) => void; label?: string }) {
  return <label>{label}
    <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => onChange([...files, ...Array.from(e.target.files ?? [])].slice(0, DISPUTE_MAX_PHOTOS))} />
    {files.length > 0 && <span className="row" style={{ gap: 6 }}>{files.map((f, i) => <span key={i} className="badge">📷 {f.name} <button type="button" className="secondary" aria-label={"Tirar " + f.name} onClick={() => onChange(files.filter((_, j) => j !== i))}>✖</button></span>)}</span>}
  </label>;
}
export async function uploadEvidence(orderId: string, uid: string, files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    const small = await compressPhoto(f);
    const r = await uploadDisputePhoto(supabase(), orderId, uid, small, small.name, small.type || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error("Não foi possível enviar a fotografia.");
    out.push(r.data);
  }
  return out;
}

/** Histórico do pedido, com as fotografias abertas por ligação temporária (privadas). */
export function DisputeTimeline({ events }: { events: DisputeEvent[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const paths = events.flatMap(e => e.photos ?? []);
  useEffect(() => { if (paths.length) void disputePhotoUrls(supabase(), paths).then(setUrls); }, [paths.join("|")]);
  return <ol className="stack" style={{ gap: 8, margin: 0, paddingLeft: 20 }}>
    {events.map((e, i) => <li key={i}>
      <strong>{disputeEventLabel(e)}</strong> <small className="muted">{new Date(e.created_at).toLocaleString("pt-AO")}</small>
      {e.note && <div style={{ overflowWrap: "anywhere" }}>{e.note}</div>}
      {(e.photos ?? []).length > 0 && <div className="row" style={{ gap: 6 }}>{e.photos.map(p => urls[p]
        ? <a key={p} href={urls[p]} target="_blank" rel="noopener"><img src={urls[p]} alt="Fotografia de prova" width={96} height={96} style={{ objectFit: "cover", borderRadius: 8 }} /></a>
        : <span key={p} className="badge">📷 fotografia</span>)}</div>}
    </li>)}
  </ol>;
}

function statusBadge(status: DisputeStatus, outcome: MyDispute["outcome"]) {
  return <span className="badge">{status === "resolved" && outcome ? DISPUTE_OUTCOME_LABELS[outcome] : DISPUTE_STATUS_LABELS[status]}</span>;
}

/** Um pedido visto pelo comprador ou pelo vendedor, com os botões do passo seguinte. */
export function DisputeCard({ d, uid, onChanged }: { d: MyDispute; uid: string; onChanged: (msg: string) => void }) {
  const [note, setNote] = useState(""); const [files, setFiles] = useState<File[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const role: DisputeRole = d.my_role;
  const actions = disputeActions(d, role);
  async function run(action: DisputeAction) {
    if (action === "decline" && !note.trim()) { setError("Escreva na caixa de mensagem porque recusa."); return; }
    if (action === "comment" && !note.trim() && !files.length) { setError("Escreva uma mensagem ou junte uma fotografia."); return; }
    if (action === "withdraw" && !confirm("Desistir deste pedido? Pode voltar a pedir depois, dentro do prazo.")) return;
    if ((action === "confirm_refund" || action === "confirm_replacement") && !confirm(action === "confirm_refund" ? "Confirma que recebeu o dinheiro? O pedido fica fechado." : "Confirma que recebeu o artigo novo? O pedido fica fechado.")) return;
    setBusy(true); setError("");
    try {
      const photos = await uploadEvidence(d.order_id, uid, files);
      const r = await disputeAction(supabase(), d.id, action, note, photos);
      if (r.error) throw r.error;
      setNote(""); setFiles([]); onChanged(action === "comment" ? "Mensagem enviada." : "Pedido atualizado. A outra pessoa recebe uma notificação.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <article className="card" id={"pedido-" + d.id}>
    <strong>{DISPUTE_REASON_LABELS[d.reason]} · {statusBadge(d.status, d.outcome)}</strong>
    <span>{role === "buyer" ? "Vendedor" : "Cliente"}: {d.other_name} · Encomenda de {formatPrice(d.order_total)} · {new Date(d.created_at).toLocaleDateString("pt-AO")}</span>
    <span>{(d.order_items ?? []).map(i => `${i.quantity} × ${i.name}`).join(", ")}</span>
    <span>Pedido: <strong>{DISPUTE_REQUEST_LABELS[d.request]}</strong>{d.amount != null ? <> · Valor: <strong>{formatPrice(d.amount)}</strong></> : null}</span>
    {d.admin_note && <span>⚖️ Decisão da administração: {d.admin_note}</span>}
    <p className="ok" style={{ margin: 0 }}>👉 {disputeNextStep(d, role)}</p>
    <details><summary>Histórico ({d.events.length})</summary><DisputeTimeline events={d.events} /></details>
    {d.status !== "resolved" && <>
      <label>Mensagem<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={role === "seller" && d.status === "open" ? "Resposta ao comprador (obrigatória se recusar)" : "Escreva aqui (ex.: onde entregar, referência da transferência)…"} /></label>
      <EvidencePicker files={files} onChange={setFiles} />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        {actions.filter(a => a !== "withdraw").map(a => <button key={a} disabled={busy} className={a === "decline" || a === "escalate" ? "secondary" : ""} onClick={() => run(a)}>{DISPUTE_ACTION_LABELS[a]}</button>)}
        <button disabled={busy} className="secondary" onClick={() => run("comment")}>💬 {DISPUTE_ACTION_LABELS.comment}</button>
        {actions.includes("withdraw") && <button disabled={busy} className="danger" onClick={() => run("withdraw")}>{DISPUTE_ACTION_LABELS.withdraw}</button>}
      </div>
    </>}
  </article>;
}

/** Administração: disputas para decidir e todas as outras. */
export function AdminDisputes() {
  const [status, setStatus] = useState<DisputeStatus | "active" | "">("escalated");
  const [items, setItems] = useState<AdminDispute[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listDisputesForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function decide(d: AdminDispute, decision: DisputeDecision) {
    let amount: number | null = null;
    if (decision === "refund" || decision === "return_refund") {
      const v = prompt("Valor a devolver ao comprador (Kz):", String(Number(d.amount ?? d.order_total)));
      if (v === null) return;
      amount = Number(v.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) { setError("Valor inválido."); return; }
    }
    const note = prompt("Explique a decisão (o comprador e o vendedor vão ler):") ?? "";
    if (!note.trim()) return;
    setError(""); setNotice("");
    const r = await decideDispute(supabase(), d.id, decision, note, amount);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Decisão registada e enviada às duas pessoas."); await load(); }
  }
  async function comment(d: AdminDispute) {
    const note = prompt("Mensagem para o comprador e o vendedor:") ?? "";
    if (!note.trim()) return;
    const r = await disputeAction(supabase(), d.id, "comment", note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Mensagem enviada."); await load(); }
  }
  return <section className="stack">
    <p>Pedidos de devolução, reembolso ou troca das encomendas da Loja. Veja o histórico e as fotografias, fale com as duas pessoas e decida.</p>
    <label style={{ maxWidth: 300 }}>Mostrar<select value={status} onChange={e => setStatus(e.target.value as any)}>
      <option value="escalated">Para decidir</option><option value="active">Todos os abertos</option><option value="">Todos</option>
      {(Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[]).filter(s => s !== "escalated").map(s => <option key={s} value={s}>{DISPUTE_STATUS_LABELS[s]}</option>)}
    </select></label>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Sem pedidos.</p>}
    {items.map(d => <article key={d.id} className="card">
      <strong>{DISPUTE_REASON_LABELS[d.reason]} · {statusBadge(d.status, d.outcome)}</strong>
      <span>Comprador: <a href={"/vendedor/" + d.buyer_id} target="_blank">{d.buyer_name}</a> · Vendedor: <a href={"/vendedor/" + d.seller_id} target="_blank">{d.seller_name}</a></span>
      <span>Encomenda de {formatPrice(d.order_total)} · {ORDER_STATUS_LABELS[d.order_status as OrderStatus] ?? d.order_status} · {PAYMENT_LABELS[d.payment_method as PaymentMethod] ?? d.payment_method ?? ""}</span>
      <span>Pedido: <strong>{DISPUTE_REQUEST_LABELS[d.request]}</strong>{d.amount != null ? <> · {formatPrice(d.amount)}</> : null}</span>
      {d.admin_note && <span>Decisão: {d.admin_note}</span>}
      <DisputeTimeline events={d.events} />
      {d.status !== "resolved" && <div className="row">
        {(Object.keys(DISPUTE_DECISION_LABELS) as DisputeDecision[]).map(k => <button key={k} className={k === "reject" ? "danger" : k === "refund" ? "" : "secondary"} onClick={() => decide(d, k)}>{DISPUTE_DECISION_LABELS[k]}</button>)}
        <button className="secondary" onClick={() => comment(d)}>💬 Mensagem</button>
      </div>}
    </article>)}
  </section>;
}
