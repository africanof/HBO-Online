"use client";
import { useEffect, useState } from "react";
import { listVerificationsForAdminV2, decideVerification, verificationDocumentUrl, listAudit, auditLabel, friendlyError, biNumberText,
  IDENTITY_ADMIN_CHECKLIST, IDENTITY_REJECT_REASONS,
  VERIFICATION_KIND_LABELS, VERIFICATION_STATUS_LABELS, type AdminVerificationV2, type AuditEntry, type VerificationStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";

type Photo = { label: string; path: string };
function photosOf(v: AdminVerificationV2): Photo[] {
  if (v.kind !== "identity" || !v.selfie_path) return [];
  return [{ label: "BI — frente", path: v.document_path }, ...(v.back_path ? [{ label: "BI — verso", path: v.back_path }] : []), { label: "Selfie com o BI", path: v.selfie_path }];
}
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-AO") : "—";

/** As três fotografias lado a lado (ligações temporárias de 10 minutos); tocar abre em grande. */
function IdentityPhotos({ v, onError }: { v: AdminVerificationV2; onError: (m: string) => void }) {
  const photos = photosOf(v);
  const [urls, setUrls] = useState<(string | null)[]>([]); const [big, setBig] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.all(photos.map(p => verificationDocumentUrl(supabase(), p.path))).then(rs => {
      if (!alive) return;
      setUrls(rs.map(r => r.data));
      if (rs.some(r => r.error || !r.data)) onError("Não foi possível abrir algumas fotografias. Tente atualizar a página.");
    });
    return () => { alive = false; };
  }, [v.id]);
  return <>
    <div className="id-shots">
      {photos.map((p, i) => <figure key={p.label} className="id-shot">
        <button type="button" onClick={() => urls[i] && setBig(i)} disabled={!urls[i]} aria-label={`Ver em grande: ${p.label}`}>
          {urls[i] ? <img src={urls[i]!} alt={`${p.label} de ${v.user_name}`} /> : <span className="lite-ph" aria-hidden>⏳</span>}
        </button>
        <figcaption>{p.label}</figcaption>
      </figure>)}
    </div>
    {big !== null && urls[big] && <div className="lightbox" role="dialog" aria-modal="true" aria-label={photos[big].label} onClick={() => setBig(null)}
      onKeyDown={e => { if (e.key === "Escape") setBig(null); }}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <img src={urls[big]!} alt={`${photos[big].label} de ${v.user_name}`} />
        <div className="row">
          <strong>{photos[big].label}</strong>
          <button type="button" className="secondary" onClick={() => setBig((big + photos.length - 1) % photos.length)}>← Anterior</button>
          <button type="button" className="secondary" onClick={() => setBig((big + 1) % photos.length)}>Seguinte →</button>
          <button type="button" autoFocus onClick={() => setBig(null)}>Fechar</button>
        </div>
      </div>
    </div>}
  </>;
}

/** Um pedido: dados da conta, fotografias, lista de confirmação e decisão. */
function VerificationCard({ v, onDecided, onError }: { v: AdminVerificationV2; onDecided: (msg: string) => Promise<void>; onError: (m: string) => void }) {
  const identityV2 = v.kind === "identity" && !!v.selfie_path;
  const [checked, setChecked] = useState<boolean[]>(IDENTITY_ADMIN_CHECKLIST.map(() => false));
  const [rejecting, setRejecting] = useState(false); const [reasons, setReasons] = useState<string[]>([]); const [text, setText] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const allChecked = !identityV2 || checked.every(Boolean);

  async function open(path: string) {
    const r = await verificationDocumentUrl(supabase(), path);
    if (r.error || !r.data) onError(friendlyError(r.error, "Não foi possível abrir o documento.")); else window.open(r.data, "_blank", "noopener");
  }
  async function decide(approve: boolean) {
    const note = approve ? "" : [...reasons, text.trim()].filter(Boolean).join(". ");
    if (!approve && !note) { setErr("Escolha pelo menos um motivo ou escreva o motivo da recusa."); return; }
    if (approve && !allChecked) { setErr("Confirme todos os pontos da lista antes de aprovar."); return; }
    setBusy(true); setErr("");
    const r = await decideVerification(supabase(), v.id, approve, note);
    setBusy(false);
    if (r.error) { setErr(friendlyError(r.error)); return; }
    await onDecided(approve ? "Verificação aprovada." : "Verificação recusada.");
  }
  const id = "v-" + v.id;
  return <article className="card" aria-labelledby={id}>
    <strong id={id}>{VERIFICATION_KIND_LABELS[v.kind]}{v.business_name ? " — " + v.business_name : ""} · <span className="badge">{VERIFICATION_STATUS_LABELS[v.status]}</span></strong>
    <span><a href={"/vendedor/" + v.user_id} target="_blank">{v.user_name || "(sem nome)"}</a>{v.phone ? " · " + v.phone : ""}</span>
    <small>Pedido em {new Date(v.created_at).toLocaleString("pt-AO")} · Conta criada em {fmtDate(v.account_created_at)}</small>
    {v.kind === "identity" && v.id_number && <span>Número do BI escrito: <span className="bi-number">{biNumberText(v.id_number)}</span></span>}
    {v.previous_rejections > 0 && <p className="scam-warn" style={{ margin: 0 }}>⚠️ Esta pessoa já teve {v.previous_rejections} {v.previous_rejections === 1 ? "pedido recusado" : "pedidos recusados"}. Veja com mais atenção.</p>}
    {v.note && <span>Nota: {v.note}</span>}
    {v.admin_note && <span>Resposta: {v.admin_note}</span>}
    {identityV2 ? <IdentityPhotos v={v} onError={onError} /> : <>
      {v.kind === "identity" && <small>Pedido antigo: só tem um documento (sem verso nem selfie).</small>}
      <div className="row"><button type="button" className="secondary" onClick={() => open(v.document_path)}>📄 Ver documento</button></div>
    </>}
    {v.status === "pending" && <>
      {identityV2 && <fieldset className="checklist">
        <legend style={{ fontWeight: 800, marginBottom: 6 }}>Antes de aprovar, confirme:</legend>
        {IDENTITY_ADMIN_CHECKLIST.map((c, i) => <label key={c}>
          <input type="checkbox" checked={checked[i]} onChange={e => setChecked(checked.map((x, j) => j === i ? e.target.checked : x))} />
          <span>{c}</span>
        </label>)}
      </fieldset>}
      {rejecting ? <div className="stack" style={{ gap: 8 }}>
        <strong>Motivo da recusa (a pessoa vai ver)</strong>
        {v.kind === "identity" && <div className="chips">
          {IDENTITY_REJECT_REASONS.map(r => <button key={r} type="button" className={"chip" + (reasons.includes(r) ? " on" : "")} aria-pressed={reasons.includes(r)}
            onClick={() => setReasons(reasons.includes(r) ? reasons.filter(x => x !== r) : [...reasons, r])}>{r}</button>)}
        </div>}
        <label>Outro motivo ou explicação<textarea rows={2} value={text} onChange={e => setText(e.target.value)} /></label>
        <div className="row">
          <button type="button" className="danger" disabled={busy} onClick={() => decide(false)}>✖ Confirmar recusa</button>
          <button type="button" className="secondary" onClick={() => { setRejecting(false); setErr(""); }}>Voltar</button>
        </div>
      </div> : <div className="row">
        <button type="button" disabled={busy || !allChecked} onClick={() => decide(true)} title={allChecked ? undefined : "Confirme todos os pontos da lista"}>✔ Aprovar</button>
        <button type="button" className="danger" disabled={busy} onClick={() => setRejecting(true)}>✖ Recusar</button>
      </div>}
      {identityV2 && !allChecked && !rejecting && <small>O botão «Aprovar» fica ativo depois de confirmar os {IDENTITY_ADMIN_CHECKLIST.length} pontos.</small>}
      {err && <p className="error" role="alert">{err}</p>}
    </>}
  </article>;
}

/** Pedidos de verificação: ver as fotografias (ligações temporárias) e aprovar ou recusar. */
export function AdminVerifications() {
  const [status, setStatus] = useState<VerificationStatus | "">("pending");
  const [items, setItems] = useState<AdminVerificationV2[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listVerificationsForAdminV2(supabase(), status); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void load(); }, [status]);
  return <section className="stack">
    <label style={{ maxWidth: 260 }}>Estado<select value={status} onChange={e => setStatus(e.target.value as any)}><option value="">Todos</option>{Object.entries(VERIFICATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <p style={{ margin: 0 }}>🔒 As fotografias são privadas. As ligações só funcionam durante 10 minutos. Não as partilhe.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Sem pedidos de verificação.</p>}
    {items.map(v => <VerificationCard key={v.id} v={v} onError={m => setError(m)} onDecided={async m => { setError(""); setNotice(m); await load(); }} />)}
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
