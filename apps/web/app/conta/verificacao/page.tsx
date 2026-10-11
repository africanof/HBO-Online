"use client";
import { useEffect, useState } from "react";
import { listMyVerifications, requestVerification, uploadVerificationDocument, validateDocument, listMyBusinesses, getProvider, friendlyError,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type MyVerification, type VerificationKind } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";

export default function Verificacao() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyVerification[]>([]); const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]); const [isProvider, setIsProvider] = useState(false);
  const [kind, setKind] = useState<VerificationKind>("identity"); const [businessId, setBusinessId] = useState(""); const [file, setFile] = useState<File | null>(null); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");

  async function load(id: string) {
    const c = supabase();
    const [v, b, p] = await Promise.all([listMyVerifications(c), listMyBusinesses(c, id), getProvider(c, id)]);
    setItems(v.data); setBusinesses(((b.data as any[]) ?? []).map(x => ({ id: x.id, name: x.name }))); setIsProvider(!!p.data);
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []);

  async function send() {
    if (!uid) return;
    if (!file) { setError("Escolha a fotografia ou o PDF do documento."); return; }
    const v = validateDocument({ size: file.size, type: file.type }); if (v) { setError(v); return; }
    if (kind === "business" && !businessId) { setError("Escolha a empresa."); return; }
    setBusy(true); setError(""); setNotice("");
    const c = supabase();
    const up = await uploadVerificationDocument(c, uid, file, file.name, file.type);
    if (up.error || !up.data) { setBusy(false); setError(friendlyError(up.error, "Não foi possível enviar o documento.")); return; }
    const r = await requestVerification(c, kind, up.data, { businessId: kind === "business" ? businessId : undefined, note });
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice("Pedido enviado. A administração vai analisar e recebe uma notificação com a resposta."); setFile(null); setNote(""); await load(uid);
  }

  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/conta">← A sua conta</a><h1>Verificar perfil</h1><p><a href="/conta/login?voltar=/conta/verificacao">Inicie sessão</a>.</p></main>;
  const kinds: VerificationKind[] = ["identity", ...(isProvider ? ["provider" as const] : []), ...(businesses.length ? ["business" as const] : [])];
  return <main className="stack">
    <a href="/conta">← A sua conta</a>
    <h1>✔ Verificar perfil</h1>
    <p>Envie um documento para a administração confirmar quem é. Depois de aprovado, o seu perfil mostra o selo <span className="verified">✔ Verificado</span> e os clientes confiam mais.</p>
    <p style={{ margin: 0 }}>🔒 O documento fica guardado em privado: só a administração o pode ver. Nunca é mostrado no site.</p>
    <section className="card">
      <strong>O que quer verificar?</strong>
      <div className="row">{kinds.map(k => <button key={k} type="button" className={kind === k ? "" : "secondary"} onClick={() => setKind(k)}>{VERIFICATION_KIND_LABELS[k]}</button>)}</div>
      {kind === "business" && <label>Empresa<select value={businessId} onChange={e => setBusinessId(e.target.value)}><option value="">Escolha…</option>{businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
      <label>{kind === "business" ? "Alvará, NIF ou certidão comercial" : "Bilhete de Identidade (fotografia da frente)"}
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Nota para a administração (opcional)" />
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="ok" role="status">{notice}</p>}
      <button disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar para verificação"}</button>
    </section>
    <h2>Os meus pedidos</h2>
    {items.length === 0 && <p>Ainda não pediu nenhuma verificação.</p>}
    {items.map(v => <article key={v.id} className="card">
      <strong>{VERIFICATION_KIND_LABELS[v.kind]}{v.business_name ? " — " + v.business_name : ""} · <span className="badge">{VERIFICATION_STATUS_LABELS[v.status]}</span></strong>
      {v.admin_note && <span>Nota da administração: {v.admin_note}</span>}
      <small>{new Date(v.created_at).toLocaleDateString("pt-AO")}</small>
    </article>)}
  </main>;
}
