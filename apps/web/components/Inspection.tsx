"use client";
import { useEffect, useState } from "react";
import { inspectedMap, inspectionBadgeText, isInspected, requestInspection, cancelInspection, myInspections, listInspectionsForAdmin, scheduleInspection,
  decideInspection, revokeInspection, hasStore, getProvider, listMyBusinesses, getPlatformSettings, updatePlatformSettings, friendlyError, inspectionRef, scheduledText,
  INSPECTION_BADGE, INSPECTION_EXPLAINED, INSPECTION_KIND_LABELS, INSPECTION_STATUS_LABELS, INSPECTION_CHECKLIST,
  type InspectedInfo, type InspectionKind, type InspectionStatus, type MyInspection, type AdminInspection, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";

/** 🏅 Selo «Inspecionado» (só aparece se estiver válido). */
export function InspectedBadge({ info, big }: { info?: InspectedInfo | null; big?: boolean }) {
  if (!isInspected(info)) return null;
  const text = inspectionBadgeText(info);
  return big
    ? <p className="card" style={{ margin: 0, gap: 4, borderColor: "var(--ok)" }}><strong className="verified" style={{ fontSize: 18 }}>{INSPECTION_BADGE}</strong><span>{INSPECTION_EXPLAINED}</span><small>{text}</small></p>
    : <span className="verified" title={INSPECTION_EXPLAINED + " " + text}>{INSPECTION_BADGE}</span>;
}
/** Selos de uma lista (um pedido só para todos). */
export function useInspected(kind: InspectionKind, ids: (string | null | undefined)[]) {
  const [map, setMap] = useState<Record<string, InspectedInfo>>({});
  const key = ids.filter(Boolean).join(",");
  useEffect(() => { if (key) void inspectedMap(supabase(), kind, ids).then(setMap); }, [kind, key]);
  return map;
}

type Target = { kind: InspectionKind; id: string; name: string };

/** Página do dono: pedir a inspeção dos seus perfis, empresas/fábricas e loja. */
export function MyInspectionsPage() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [targets, setTargets] = useState<Target[] | null>(null);
  const [items, setItems] = useState<MyInspection[]>([]); const [badges, setBadges] = useState<Record<string, InspectedInfo>>({});
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(u: string) {
    const c = supabase();
    const [p, b, s, m] = await Promise.all([getProvider(c, u), listMyBusinesses(c, u), hasStore(c, u), myInspections(c)]);
    const t: Target[] = [];
    if (p.data) t.push({ kind: "provider", id: u, name: (p.data as any).display_name });
    for (const x of (b.data ?? []) as any[]) t.push({ kind: "business", id: x.id, name: x.name });
    if (s) t.push({ kind: "store", id: u, name: "A minha loja" });
    setTargets(t); setItems(m.data);
    const maps = await Promise.all((["provider", "business", "store"] as InspectionKind[]).map(k => inspectedMap(c, k, t.filter(x => x.kind === k).map(x => x.id))));
    setBadges(Object.fromEntries(t.map(x => [x.kind + x.id, maps[["provider", "business", "store"].indexOf(x.kind)][x.id]]).filter(([, v]) => v)));
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🏅 Selo «Inspecionado»</h1><a className="btn" href="/conta/login?voltar=/inspecao">Entrar</a></main>;
  async function cancel(i: MyInspection) {
    if (!confirm("Cancelar o pedido de inspeção?")) return;
    const r = await cancelInspection(supabase(), i.id); if (r.error) setError(friendlyError(r.error)); else { setNotice("Pedido cancelado."); void load(uid!); }
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/conta">← A minha conta</a>
    <h1 style={{ margin: 0 }}>🏅 Selo «Inspecionado»</h1>
    <p style={{ margin: 0 }}>{INSPECTION_EXPLAINED} Os clientes confiam mais em quem tem o selo. O selo vale um ano; depois pode pedir nova visita.</p>
    <p className="muted" style={{ margin: 0 }}>Diferente do ✔ (documento verificado): aqui alguém da administração vai mesmo ao local.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {targets === null ? <p>A carregar…</p> : targets.length === 0 ? <p className="card" style={{ margin: 0 }}>Primeiro crie um <a href="/conta/profissional">perfil profissional</a>, uma <a href="/conta/empresas">empresa ou fábrica</a>, ou ponha <a href="/conta/produtos">produtos na sua loja</a>.</p> :
      targets.map(t => { const k = t.kind + t.id; const last = items.find(i => i.kind === t.kind && i.target_id === t.id); const busy = last && (last.status === "requested" || last.status === "scheduled");
        return <article key={k} className="card stack" style={{ gap: 8 }}>
          <strong style={{ fontSize: 19 }}>{INSPECTION_KIND_LABELS[t.kind]} · {t.name}</strong>
          {badges[k] ? <InspectedBadge info={badges[k]} big /> : null}
          {last && <span>{inspectionRef(last.ref_no)} · {INSPECTION_STATUS_LABELS[last.status]}{last.status === "scheduled" && last.scheduled_for ? " — " + scheduledText(last.scheduled_for) : ""}</span>}
          {last?.admin_note && (last.status === "rejected" || last.status === "revoked" || last.status === "scheduled") && <span className={last.status === "scheduled" ? "" : "error"}>Nota da administração: {last.admin_note}</span>}
          {busy ? <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void cancel(last!)}>Cancelar pedido</button>
            : open === k ? <RequestForm t={t} onDone={m => { setOpen(null); setNotice(m); setError(""); void load(uid!); }} onClose={() => setOpen(null)} />
            : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen(k)}>{badges[k] ? "🔁 Pedir nova inspeção" : "🏅 Pedir inspeção"}</button>}
        </article>; })}
  </main>;
}
function RequestForm({ t, onDone, onClose }: { t: Target; onDone: (m: string) => void; onClose: () => void }) {
  const [address, setAddress] = useState(""); const [phone, setPhone] = useState(""); const [when, setWhen] = useState(""); const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const r = await requestInspection(supabase(), t.kind, t.id, { address, phone, preferredTime: when, note }); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else onDone("Pedido enviado. A administração vai ligar para marcar a visita.");
  }
  return <form className="stack" style={{ gap: 8 }} onSubmit={send}>
    <label>Morada e ponto de referência do local<textarea value={address} onChange={e => setAddress(e.target.value)} maxLength={300} rows={2} placeholder="Ex.: Bairro São João, rua da escola, portão verde" /></label>
    <label>Telefone para combinar a visita<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} /></label>
    <label>Melhor dia/hora (opcional)<input value={when} onChange={e => setWhen(e.target.value)} maxLength={120} placeholder="Ex.: dias úteis de manhã" /></label>
    <label>Nota (opcional)<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" disabled={busy}>{busy ? "A enviar…" : "✅ Enviar pedido"}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></div>
  </form>;
}

/** Administração: marcar visitas, aprovar com a lista do que foi visto, recusar e retirar selos. */
export function AdminInspections() {
  const [status, setStatus] = useState<InspectionStatus | "">("requested"); const [items, setItems] = useState<AdminInspection[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b] = await Promise.all([listInspectionsForAdmin(supabase(), status), getPlatformSettings(supabase())]);
    if (a.error) setError(friendlyError(a.error)); setItems(a.data); setS(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  const done = (m: string) => { setNotice(m); setError(""); setOpen(null); void load(); };
  async function saveMonths(e: React.FormEvent) {
    e.preventDefault(); const m = Number(s?.inspection_valid_months);
    if (!Number.isInteger(m) || m < 1 || m > 60) { setError("Escolha entre 1 e 60 meses."); return; }
    const r = await updatePlatformSettings(supabase(), { inspection_valid_months: m }); if (r.error) setError(friendlyError(r.error)); else done("Regra guardada.");
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🏅 Inspeções no local</h2>
    <small>Vá ao local, confirme que existe e trabalha de verdade, e só depois aprove. O selo aparece nos perfis, empresas, fábricas e lojas.</small>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card row" style={{ alignItems: "end" }} onSubmit={saveMonths}>
      <label style={{ flex: 1, minWidth: 160 }}>Meses de validade do selo<input value={String(s.inspection_valid_months ?? "")} onChange={e => setS({ ...s, inspection_valid_months: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      <button type="submit">Guardar</button></form>}
    <div className="chips" role="group" aria-label="Estado">{([["requested", "⏳ Pedidos"], ["scheduled", "📅 Marcadas"], ["approved", "🏅 Com selo"], ["rejected", "❌ Recusadas"], ["", "Todas"]] as const).map(([k, l]) =>
      <button key={k || "all"} type="button" className={"chip" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}</div>
    {items.length === 0 && <p className="muted" style={{ margin: 0 }}>Nada nesta lista.</p>}
    {items.map(i => <article key={i.id} className="card stack" style={{ gap: 6 }}>
      <strong>{INSPECTION_KIND_LABELS[i.kind]}{i.category_slug === "fabricas" ? " (🏭 fábrica)" : ""} · {i.target_name ?? "—"}</strong>
      <small>{inspectionRef(i.ref_no)} · {INSPECTION_STATUS_LABELS[i.status]} · dono: {i.owner_name}{i.phone ? " · 📞 " + i.phone : ""}</small>
      {i.address && <span>📍 {i.address}</span>}
      {i.preferred_time && <small>Preferência: {i.preferred_time}</small>}
      {i.note && <small>Nota: {i.note}</small>}
      {i.scheduled_for && <span>📅 Visita: {scheduledText(i.scheduled_for)}{i.inspector_name ? " · " + i.inspector_name : ""}</span>}
      {i.valid_until && i.status === "approved" && <span className="verified">{INSPECTION_BADGE} até {new Date(i.valid_until).toLocaleDateString("pt-AO")}</span>}
      {i.admin_note && <small>Nota da administração: {i.admin_note}</small>}
      <div className="row"><a className="btn secondary" href={i.kind === "provider" ? "/profissionais/" + i.target_id : i.kind === "business" ? "/empresas/" + i.target_id : "/vendedor/" + i.target_id}>👁️ Ver</a>
        {(i.status === "requested" || i.status === "scheduled") && <button type="button" className="secondary" onClick={() => setOpen(open === "s" + i.id ? null : "s" + i.id)}>📅 Marcar visita</button>}
        {(i.status === "requested" || i.status === "scheduled") && <button type="button" onClick={() => setOpen(open === "d" + i.id ? null : "d" + i.id)}>📝 Resultado da visita</button>}
        {i.status === "approved" && <button type="button" className="secondary" onClick={async () => { const why = prompt("Porque retira o selo? (o dono vai ler)") ?? ""; if (!why.trim()) return;
          const r = await revokeInspection(supabase(), i.id, why); if (r.error) setError(friendlyError(r.error)); else done("Selo retirado."); }}>⛔ Retirar selo</button>}
      </div>
      {open === "s" + i.id && <ScheduleForm i={i} onDone={done} onError={setError} />}
      {open === "d" + i.id && <DecideForm i={i} onDone={done} onError={setError} />}
    </article>)}
  </section>;
}
function ScheduleForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [when, setWhen] = useState(""); const [who, setWho] = useState(i.inspector_name ?? ""); const [note, setNote] = useState("");
  async function send(e: React.FormEvent) { e.preventDefault(); const r = await scheduleInspection(supabase(), i.id, when, who, note); if (r.error) onError(friendlyError(r.error)); else onDone("Visita marcada: o dono foi avisado."); }
  return <form className="stack" style={{ gap: 8 }} onSubmit={send}>
    <label>Dia e hora<input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></label>
    <label>Quem vai (opcional)<input value={who} onChange={e => setWho(e.target.value)} maxLength={80} /></label>
    <label>Nota para o dono (opcional)<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
    <button type="submit" style={{ justifySelf: "start" }}>Marcar e avisar</button>
  </form>;
}
function DecideForm({ i, onDone, onError }: { i: AdminInspection; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [check, setCheck] = useState<Record<string, boolean>>({}); const [note, setNote] = useState("");
  async function decide(ok: boolean) {
    if (ok && !check.exists) { onError("Só pode aprovar se confirmou que existe mesmo no local."); return; }
    if (ok && !confirm(`Dar o selo «Inspecionado» a ${i.target_name}?`)) return;
    const r = await decideInspection(supabase(), i.id, ok, check, note); if (r.error) onError(friendlyError(r.error)); else onDone(ok ? "Selo dado: já aparece ao público." : "Inspeção recusada: o dono foi avisado.");
  }
  return <div className="stack" style={{ gap: 8 }}>
    <strong>O que confirmou no local?</strong>
    {INSPECTION_CHECKLIST.map(c => <label key={c.key} className="row" style={{ alignItems: "center", gap: 8, fontWeight: 400 }}>
      <input type="checkbox" checked={!!check[c.key]} onChange={e => setCheck({ ...check, [c.key]: e.target.checked })} style={{ width: 24, height: 24 }} />{c.label}{c.required ? " (obrigatório)" : ""}</label>)}
    <label>Nota (obrigatória para recusar)<input value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label>
    <div className="row"><button type="button" onClick={() => void decide(true)}>🏅 Aprovar e dar o selo</button><button type="button" className="secondary" onClick={() => void decide(false)}>❌ Recusar</button></div>
  </div>;
}
