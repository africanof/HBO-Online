"use client";
import { useEffect, useState } from "react";
import { getMyCourier, registerCourier, setCourierAvailable, listAvailableDeliveries, claimDelivery, updateDeliveryStatus, listMyDeliveries,
  nextCourierSteps, isActiveDelivery, formatPrice, friendlyError, DELIVERY_STATUS_LABELS, COURIER_STATUS_LABELS, VEHICLE_LABELS, STEP_LABELS,
  type Courier, type CourierStep, type DeliveryStatus, type Vehicle } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useTerritory } from "../../components/Directory";

export default function Entregas() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [courier, setCourier] = useState<Courier | null>(null);
  const [available, setAvailable] = useState<any[]>([]); const [mine, setMine] = useState<any[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", vehicle: "moto" as Vehicle, municipalityId: "" }); const [editing, setEditing] = useState(false);
  const { municipalities } = useTerritory();

  async function load(id = uid) {
    if (!id) return;
    const c = supabase();
    const r = await getMyCourier(c, id);
    setCourier(r.data ?? null);
    if (r.data) setForm({ name: r.data.display_name, phone: r.data.phone, vehicle: r.data.vehicle, municipalityId: r.data.municipality_id ?? "" });
    if (r.data?.status === "approved") {
      const [a, m] = await Promise.all([listAvailableDeliveries(c), listMyDeliveries(c, "courier")]);
      setAvailable((a.data as any[]) ?? []); setMine((m.data as any[]) ?? []);
    }
  }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(id); }); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) {
    setBusy(true); setError(""); setNotice("");
    const r = await fn(); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); setEditing(false); await load(); }
  }

  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>Entregas</h1><p><a href="/conta/login?voltar=/entregas">Inicie sessão</a> para ser estafeta.</p></main>;

  const registration = <form className="card stack" onSubmit={e => { e.preventDefault(); void act(() => registerCourier(supabase(), form), courier ? "Dados atualizados." : "Registo enviado. A administração vai aprovar a sua conta."); }}>
    <h2 style={{ margin: 0 }}>{courier ? "Os meus dados de estafeta" : "Quero ser estafeta"}</h2>
    <label>Nome<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
    <label>Telefone<input inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+244 9xx xxx xxx" /></label>
    <label>Meio de transporte<select value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value as Vehicle })}>{Object.entries(VEHICLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label>Município onde trabalha<select value={form.municipalityId} onChange={e => setForm({ ...form, municipalityId: e.target.value })}><option value="">Qualquer</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <div className="row"><button disabled={busy}>{courier ? "Guardar" : "Registar"}</button>{courier && <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancelar</button>}</div>
  </form>;

  return <main className="stack">
    <a href="/conta">← Conta</a>
    <h1>🛵 Entregas</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {!courier ? <>
      <p>Faça entregas das encomendas da loja do Huambo Online. Registe-se e espere pela aprovação da administração.</p>
      {registration}
    </> : <>
      <div className="card">
        <strong>{courier.display_name} · {VEHICLE_LABELS[courier.vehicle]}</strong>
        <span>Estado: <span className="badge">{COURIER_STATUS_LABELS[courier.status]}</span></span>
        <div className="row">
          {courier.status === "approved" && <button className={courier.available ? "" : "secondary"} disabled={busy} onClick={() => act(() => setCourierAvailable(supabase(), !courier.available), courier.available ? "Ficou indisponível." : "Ficou disponível.")}>{courier.available ? "🟢 Disponível" : "⚪ Indisponível"}</button>}
          <button className="secondary" onClick={() => setEditing(!editing)}>Editar dados</button>
        </div>
      </div>
      {editing && registration}
      {courier.status === "pending" && <p>A sua conta está à espera de aprovação. Vai receber uma notificação.</p>}
      {courier.status === "suspended" && <p className="error">A sua conta de estafeta está suspensa. Contacte a administração.</p>}
      {courier.status === "approved" && <>
        <h2>As minhas entregas</h2>
        {mine.filter(d => isActiveDelivery(d.status)).length === 0 && <p>Nenhuma entrega em curso.</p>}
        {mine.filter(d => isActiveDelivery(d.status)).map(d => <article key={d.id} className="card">
          <strong>{formatPrice(d.total, d.currency)} · <span className="badge">{DELIVERY_STATUS_LABELS[d.status as DeliveryStatus]}</span></strong>
          <span>Recolher em: {d.seller_name}</span>
          <span>Entregar a: {d.buyer_name}{d.delivery_text ? " — " + d.delivery_text : ""}</span>
          {d.contact_phone && <span>Telefone do cliente: <a href={"tel:" + d.contact_phone.replace(/\s/g, "")}>{d.contact_phone}</a></span>}
          {d.notes && <span>Nota: {d.notes}</span>}
          <div className="row">{nextCourierSteps(d.status).map((s: CourierStep) => <button key={s} disabled={busy} className={s === "released" ? "secondary" : ""} onClick={() => { if (s !== "released" || confirm("Desistir desta entrega?")) void act(() => updateDeliveryStatus(supabase(), d.id, s), "Entrega atualizada."); }}>{STEP_LABELS[s]}</button>)}</div>
        </article>)}
        <h2>Entregas disponíveis</h2>
        {available.length === 0 && <p>Sem entregas à espera neste momento.</p>}
        {available.map(d => <article key={d.id} className="card">
          <strong>{formatPrice(d.total, d.currency)}</strong>
          <span>Recolher em: {d.seller_name}{d.seller_municipality ? " (" + d.seller_municipality + ")" : ""}</span>
          {d.delivery_text && <span>Entregar em: {d.delivery_text}</span>}
          <span>{(d.items ?? []).map((i: any) => i.quantity + " × " + i.name).join(", ")}</span>
          {d.notes && <span>Nota: {d.notes}</span>}
          <button disabled={busy} onClick={() => act(() => claimDelivery(supabase(), d.id), "Entrega aceite. O vendedor e o cliente foram avisados.")}>Aceitar entrega</button>
        </article>)}
        {mine.some(d => d.status === "delivered") && <><h2>Entregas feitas</h2>
          {mine.filter(d => d.status === "delivered").map(d => <div key={d.id} className="card"><span>{formatPrice(d.total, d.currency)} · {d.buyer_name} · {new Date(d.delivered_at).toLocaleString("pt-AO")}</span></div>)}</>}
      </>}
    </>}
  </main>;
}
