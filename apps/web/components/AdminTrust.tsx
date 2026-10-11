"use client";
import { useEffect, useState } from "react";
import { listVerificationsForAdmin, decideVerification, verificationDocumentUrl, listAudit, auditLabel, friendlyError,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type AdminVerification, type AuditEntry, type VerificationStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

/** Pedidos de verificação: ver o documento (ligação temporária) e aprovar ou recusar. */
export function AdminVerifications() {
  const [status, setStatus] = useState<VerificationStatus | "">("pending");
  const [items, setItems] = useState<AdminVerification[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listVerificationsForAdmin(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  async function open(path: string) {
    const r = await verificationDocumentUrl(supabase(), path);
    if (r.error || !r.data) setError(friendlyError(r.error, "Não foi possível abrir o documento.")); else window.open(r.data, "_blank", "noopener");
  }
  async function decide(v: AdminVerification, approve: boolean) {
    const note = approve ? "" : prompt("Motivo da recusa (a pessoa vai ver):") ?? "";
    if (!approve && !note.trim()) return;
    setError(""); setNotice("");
    const r = await decideVerification(supabase(), v.id, approve, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(approve ? "Verificação aprovada." : "Verificação recusada."); await load(); }
  }
  return <section className="stack">
    <label style={{ maxWidth: 260 }}>Estado<select value={status} onChange={e => setStatus(e.target.value as any)}><option value="">Todos</option>{Object.entries(VERIFICATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Sem pedidos de verificação.</p>}
    {items.map(v => <article key={v.id} className="card">
      <strong>{VERIFICATION_KIND_LABELS[v.kind]}{v.business_name ? " — " + v.business_name : ""} · <span className="badge">{VERIFICATION_STATUS_LABELS[v.status]}</span></strong>
      <span><a href={"/vendedor/" + v.user_id} target="_blank">{v.user_name}</a>{v.phone ? " · " + v.phone : ""} · {new Date(v.created_at).toLocaleString("pt-AO")}</span>
      {v.note && <span>Nota: {v.note}</span>}
      {v.admin_note && <span>Resposta: {v.admin_note}</span>}
      <div className="row">
        <button className="secondary" onClick={() => open(v.document_path)}>📄 Ver documento</button>
        {v.status === "pending" && <><button onClick={() => decide(v, true)}>✔ Aprovar</button><button className="danger" onClick={() => decide(v, false)}>✖ Recusar</button></>}
      </div>
    </article>)}
  </section>;
}

/** Registo das ações da administração (só leitura). */
export function AdminAudit() {
  const [items, setItems] = useState<AuditEntry[]>([]); const [error, setError] = useState("");
  useEffect(() => { void listAudit(supabase(), 200).then(r => { if (r.error) setError(friendlyError(r.error)); setItems(r.data); }); }, []);
  return <section className="stack">
    <p>Tudo o que a administração muda (contas, papéis, denúncias, anúncios, estafetas, categorias, verificações) fica aqui registado.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {items.length === 0 && !error && <p>Ainda sem registos.</p>}
    {items.map(e => <div key={e.id} className="card"><strong>{auditLabel(e)}</strong><small>{e.actor_name} · {new Date(e.created_at).toLocaleString("pt-AO")}</small></div>)}
  </section>;
}
