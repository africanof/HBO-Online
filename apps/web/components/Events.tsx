"use client";
import { useEffect, useState } from "react";
import { listEvents, getEvent, getEventTickets, getEventPaymentInfo, saveEvent, setEventPublished, cancelEvent, reserveTickets, submitTicketPayment, decideTicketOrder,
  cancelTicketOrder, checkInTicket, myTicketOrders, organizerPanel, submitEventPlatformPayment, listEventPaymentsForAdmin, decideEventPayment, listMyEvents,
  formatEventDate, isoToLocalInput, eventIsOver, eventRef, ticketOrderRef, priceFromText, ticketsLeftText, eventShareMessage, normalizeTicketCode, qrSvgPath, ticketUsable,
  validateEvent, uploadClassifiedMedia, uploadPaymentProof, validateDocument, paymentProofUrl, getPlatformSettings, updatePlatformSettings, formatPrice, formatDate, friendlyError,
  whatsappShareUrl, pointFrom, EVENT_CATEGORY_LABELS, TICKET_ORDER_STATUS_LABELS, TICKET_METHOD_LABELS, CHECKIN_LABELS, PLAN_METHOD_LABELS,
  type EventCategory, type EventSummary, type EventRow, type TicketTypeAvailability, type TicketTypeDraft, type EventPaymentInfo, type MyTicketOrder,
  type OrganizerPanel, type OrganizerOrder, type AdminEventPayment, type CheckInResult, type PaymentMethodPlan, type PlatformSettings, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { ItemCard } from "./ItemCard";
import { LiteImg } from "./LiteImg";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";

const CATS = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
const METHODS = Object.keys(TICKET_METHOD_LABELS) as PaymentMethodPlan[];
const icon = (c: EventCategory) => EVENT_CATEGORY_LABELS[c].split(" ")[0];

function MethodPicker({ value, onChange, labels = TICKET_METHOD_LABELS }: { value: PaymentMethodPlan; onChange: (m: PaymentMethodPlan) => void; labels?: Record<PaymentMethodPlan, string> }) {
  return <div className="row" role="radiogroup" aria-label="Como pagou">{METHODS.map(m =>
    <button key={m} type="button" role="radio" aria-checked={value === m} className={value === m ? "" : "secondary"} onClick={() => onChange(m)}>{labels[m]}</button>)}</div>;
}

/** Lista pública de eventos: os destacados primeiro. */
export function EventList() {
  const [cat, setCat] = useState<EventCategory | "">(""); const [q, setQ] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const { municipalities } = useTerritory();
  const [items, setItems] = useState<EventSummary[] | null>(null); const [error, setError] = useState("");
  async function load() {
    const r = await listEvents(supabase(), { category: cat, municipalityId, query: q });
    if (r.error) setError(friendlyError(r.error)); else { setError(""); setItems(r.data); }
  }
  useEffect(() => { void load(); }, [cat, municipalityId]);
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>🎟️ Eventos no Huambo</h1>
      <div className="row"><a className="btn secondary" href="/bilhetes">🎟️ Os meus bilhetes</a><a className="btn" href="/eventos/meus">➕ Organizar um evento</a></div>
    </div>
    <form className="row" role="search" onSubmit={e => { e.preventDefault(); void load(); }}>
      <input aria-label="Procurar eventos" value={q} onChange={e => setQ(e.target.value)} placeholder="Ex.: concerto, feira, jogo…" style={{ flex: 1, minWidth: 200 }} />
      <select aria-label="Município" value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}>
        <option value="">Todos os municípios</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button type="submit">Procurar</button>
    </form>
    <div className="chips" role="group" aria-label="Tipo de evento">
      <button type="button" className={"chip" + (cat === "" ? " on" : "")} aria-pressed={cat === ""} onClick={() => setCat("")}>Todos</button>
      {CATS.map(c => <button key={c} type="button" className={"chip" + (cat === c ? " on" : "")} aria-pressed={cat === c} onClick={() => setCat(c)}>{EVENT_CATEGORY_LABELS[c]}</button>)}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não há eventos nesta pesquisa. Organiza um? <a href="/eventos/meus">Publique o seu evento</a>.</p> :
      <div className="results-grid">{items.map(e => <ItemCard key={e.id} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon={icon(e.category)}
        title={e.title} price={priceFromText(e.price_from)} featured={e.featured}
        tag={e.status === "cancelled" ? "Cancelado" : e.tickets_left === 0 ? "Esgotado" : undefined} tagRed={e.status === "cancelled" || e.tickets_left === 0}
        meta={`📅 ${formatEventDate(e.starts_at)} · 📍 ${e.venue}${e.municipality_name ? ", " + e.municipality_name : ""}`} />)}</div>}
  </main>;
}

/** Página do evento: detalhes, bilhetes e compra. */
export function EventDetail({ id }: { id: string }) {
  const [e, setE] = useState<EventRow | null | undefined>(undefined); const [types, setTypes] = useState<TicketTypeAvailability[]>([]);
  const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  const [typeId, setTypeId] = useState(""); const [qty, setQty] = useState(1); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b] = await Promise.all([getEvent(supabase(), id), getEventTickets(supabase(), id)]);
    if (a.error) setError(friendlyError(a.error)); setE(a.data); setTypes(b.data.filter(t => t.active));
  }
  useEffect(() => { void load(); void currentUserId().then(setUid); }, [id]);
  if (e === undefined) return <main><p>A carregar…</p></main>;
  if (!e) return <main className="stack"><h1>Evento não encontrado</h1><p>{error || "Este evento já não está disponível."}</p><a href="/eventos">← Ver todos os eventos</a></main>;
  const mine = uid === e.organizer_id; const over = eventIsOver(e); const onSale = e.status === "published" && !over;
  const chosen = types.find(t => t.id === typeId); const priceFrom = types.length ? Math.min(...types.map(t => t.price)) : null;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now();
  async function buy(ev: React.FormEvent) {
    ev.preventDefault(); if (!chosen) { setError("Escolha o tipo de bilhete."); return; }
    setBusy(true); setError("");
    const r = await reserveTickets(supabase(), chosen.id, qty, name, phone); setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    window.location.href = "/bilhetes?novo=" + (r.data as { id: string }).id;
  }
  const share = eventShareMessage(typeof window === "undefined" ? "" : window.location.origin + "/", e, priceFrom);
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/eventos">← Todos os eventos</a>
    {e.cover_url && <LiteImg src={e.cover_url} alt={"Cartaz: " + e.title} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16 }} placeholder="🎟️" />}
    <div className="row" style={{ alignItems: "center" }}>
      <span className="badge">{EVENT_CATEGORY_LABELS[e.category]}</span>
      {featured && <span className="badge">⭐ Destaque</span>}
      <small className="muted">{eventRef(e.ref_no)}</small>
    </div>
    <h1 style={{ margin: 0 }}>{e.title}</h1>
    {e.status === "cancelled" && <p className="banner yellow" role="alert" style={{ margin: 0 }}>❌ Evento cancelado{e.cancel_reason ? ": " + e.cancel_reason : ""}. Quem pagou deve falar com o organizador para o reembolso.</p>}
    {e.status === "draft" && <p className="banner yellow" style={{ margin: 0 }}>📝 Rascunho: só o organizador vê esta página.</p>}
    {over && e.status === "published" && <p className="banner yellow" style={{ margin: 0 }}>Este evento já aconteceu.</p>}
    <dl className="facts card" style={{ margin: 0 }}>
      <dt>📅 Quando</dt><dd><strong>{formatEventDate(e.starts_at)}</strong>{e.ends_at && <> até {formatEventDate(e.ends_at)}</>}</dd>
      <dt>📍 Onde</dt><dd><strong>{e.venue}</strong>{e.municipalities?.name ? ", " + e.municipalities.name : ""}</dd>
      <dt>💰 Preço</dt><dd>{priceFromText(priceFrom)}</dd>
    </dl>
    {mine && <div className="row"><a className="btn" href={`/eventos/${e.id}/gerir`}>⚙️ Gerir o evento</a><a className="btn secondary" href={`/eventos/${e.id}/editar`}>✏️ Editar</a></div>}
    {e.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{e.description}</p>}
    <PlaceView directions={e.directions} lat={e.geo_lat} lng={e.geo_lng} />
    <section className="card stack" style={{ gap: 10 }} aria-labelledby="bilhetes">
      <h2 id="bilhetes" style={{ margin: 0 }}>🎟️ Bilhetes</h2>
      {types.length === 0 && <p style={{ margin: 0 }}>Ainda não há bilhetes à venda.</p>}
      {types.map(t => <label key={t.id} className="card row" style={{ alignItems: "center", justifyContent: "space-between", cursor: onSale && t.left_count > 0 ? "pointer" : "default" }}>
        <span className="row" style={{ alignItems: "center" }}>
          {onSale && !mine && <input type="radio" name="tipo" value={t.id} checked={typeId === t.id} disabled={t.left_count === 0} onChange={() => { setTypeId(t.id); setQty(1); }} style={{ width: 24, height: 24 }} />}
          <strong>{t.name}</strong>
        </span>
        <span style={{ textAlign: "right" }}><strong className="price">{t.price > 0 ? formatPrice(t.price) : "Grátis"}</strong><br /><small className={t.left_count === 0 ? "error" : "muted"}>{ticketsLeftText(t.left_count)}</small></span>
      </label>)}
      {onSale && !mine && types.length > 0 && (!uid ? <a className="btn" href={`/conta/login?voltar=/eventos/${e.id}`}>Entrar para comprar bilhete</a> :
        <form className="stack" style={{ gap: 10 }} onSubmit={buy}>
          {chosen && <label>Quantos bilhetes?<select value={qty} onChange={ev => setQty(Number(ev.target.value))}>
            {Array.from({ length: Math.min(chosen.max_per_order, chosen.left_count) }, (_, k) => k + 1).map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
          <label>O seu nome (aparece no bilhete)<input value={name} onChange={ev => setName(ev.target.value)} maxLength={80} autoComplete="name" /></label>
          <label>Telefone (opcional, para o organizador o contactar)<input value={phone} onChange={ev => setPhone(ev.target.value)} maxLength={20} inputMode="tel" autoComplete="tel" placeholder="9XX XXX XXX" /></label>
          {chosen && <strong>Total: {chosen.price > 0 ? formatPrice(chosen.price * qty) : "Grátis"}</strong>}
          {chosen && chosen.price > 0 && <small>Depois de reservar, paga diretamente ao organizador e envia a referência. O bilhete aparece quando o organizador confirmar.</small>}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !chosen}>{busy ? "A reservar…" : chosen && chosen.price === 0 ? "🎟️ Pedir bilhete grátis" : "🎟️ Reservar bilhete"}</button>
        </form>)}
    </section>
    <div className="row">
      <a className="btn secondary" href={whatsappShareUrl(share)} target="_blank" rel="noopener">📲 Partilhar no WhatsApp</a>
    </div>
    <p className="muted" style={{ margin: 0 }}>O Huambo Online não organiza este evento. Pague só pelos dados que aparecem depois de reservar e guarde o comprovativo. <a href="/seguranca">Dicas de segurança</a>.</p>
  </main>;
}

/** Formulário para criar ou editar um evento. */
export function EventForm({ id }: { id?: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const { municipalities } = useTerritory();
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState<EventCategory>("music");
  const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState(""); const [venue, setVenue] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const [directions, setDirections] = useState(""); const [point, setPoint] = useState<GeoPoint | null>(null); const [cover, setCover] = useState<string | null>(null); const [file, setFile] = useState<File | null>(null);
  const [pay, setPay] = useState<EventPaymentInfo>({ holder: "", iban: "", express: "", note: "" });
  const [tickets, setTickets] = useState<TicketTypeDraft[]>([{ name: "Normal", price: "", quantity: "" }]); const [existing, setExisting] = useState<{ id: string }[]>([]);
  const [status, setStatus] = useState("draft"); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loaded, setLoaded] = useState(!id);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => { if (!id) return; void (async () => {
    const [a, b, c] = await Promise.all([getEvent(supabase(), id), getEventTickets(supabase(), id), getEventPaymentInfo(supabase(), id)]);
    const e = a.data; if (!e) { setError("Evento não encontrado."); return; }
    setTitle(e.title); setDescription(e.description ?? ""); setCategory(e.category); setStartsAt(isoToLocalInput(e.starts_at)); setEndsAt(isoToLocalInput(e.ends_at));
    setVenue(e.venue); setMunicipalityId(e.municipality_id ?? ""); setDirections(e.directions ?? ""); setPoint(pointFrom(e.geo_lat, e.geo_lng)); setCover(e.cover_url); setStatus(e.status);
    setPay(c); setExisting(b.data.map(t => ({ id: t.id })));
    if (b.data.length) setTickets(b.data.map(t => ({ id: t.id, name: t.name, price: String(t.price), quantity: String(t.quantity), max_per_order: String(t.max_per_order), active: t.active })));
    setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <main><p>{error || "A carregar…"}</p></main>;
  if (!uid) return <main className="stack"><h1>🎟️ Organizar um evento</h1><a className="btn" href="/conta/login?voltar=/eventos/novo">Entrar para publicar</a></main>;
  const setT = (k: number, p: Partial<TicketTypeDraft>) => setTickets(l => l.map((t, i) => i === k ? { ...t, ...p } : t));
  const input = { title, description, category, startsAt, endsAt, venue, municipalityId, directions, point, coverUrl: cover, pay, tickets };
  const paid = tickets.some(t => Number(t.price.replace(/\s/g, "").replace(",", ".")) > 0);
  async function save(publish: boolean) {
    const bad = validateEvent(input); if (bad) { setError(bad); return; }
    if (file) { const b = validateDocument({ size: file.size, type: file.type }); if (b || !file.type.startsWith("image/")) { setError(b ?? "O cartaz tem de ser uma fotografia."); return; } }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (file) { const up = await uploadClassifiedMedia(supabase(), file, uid!, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o cartaz."); coverUrl = up.data; }
      const r = await saveEvent(supabase(), uid!, { ...input, coverUrl }, id, existing);
      if (r.error || !r.data) throw r.error ?? new Error("Não foi possível gravar.");
      if (publish && status !== "published") { const p = await setEventPublished(supabase(), r.data.id, true); if (p.error) { window.location.href = `/eventos/${r.data.id}/editar?erro=` + encodeURIComponent(friendlyError(p.error)); return; } }
      window.location.href = `/eventos/${r.data.id}/gerir`;
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  const urlError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("erro") : null;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href={id ? `/eventos/${id}/gerir` : "/eventos/meus"}>← Voltar</a>
    <h1 style={{ margin: 0 }}>{id ? "✏️ Editar evento" : "🎟️ Novo evento"}</h1>
    {urlError && !error && <p className="error" role="alert">{urlError}</p>}
    <form className="stack" onSubmit={e => { e.preventDefault(); void save(status !== "published"); }}>
      <label>Nome do evento<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: Noite de Kizomba no Cine Ruacaná" /></label>
      <label>Tipo<select value={category} onChange={e => setCategory(e.target.value as EventCategory)}>{CATS.map(c => <option key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</option>)}</select></label>
      <div className="row">
        <label style={{ flex: 1, minWidth: 220 }}>Começa (dia e hora)<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
        <label style={{ flex: 1, minWidth: 220 }}>Acaba (opcional)<input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></label>
      </div>
      <label>Local<input value={venue} onChange={e => setVenue(e.target.value)} maxLength={120} placeholder="Ex.: Cine Ruacaná, Estádio dos Kurikutelas" /></label>
      <label>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">— Escolha —</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint="Marque a entrada do local para as pessoas chegarem sem se perderem." />
      <label>Descrição (programa, artistas, regras de entrada)<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} rows={5} /></label>
      <fieldset className="card stack" style={{ gap: 8 }}>
        <legend style={{ fontWeight: 700 }}>🖼️ Cartaz (opcional)</legend>
        {cover && !file && <div className="row" style={{ alignItems: "center" }}><LiteImg src={cover} alt="Cartaz atual" style={{ width: 120, borderRadius: 8 }} /><button type="button" className="secondary" onClick={() => setCover(null)}>Tirar o cartaz</button></div>}
        <input type="file" aria-label="Escolher o cartaz" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </fieldset>
      <fieldset className="card stack" style={{ gap: 10 }}>
        <legend style={{ fontWeight: 700 }}>🎟️ Bilhetes</legend>
        <small>Preço 0 = entrada grátis (a pessoa recebe logo o bilhete). Depois da primeira venda já não pode mudar o preço.</small>
        {tickets.map((t, k) => <div key={k} className="card stack" style={{ gap: 8 }}>
          <div className="row">
            <label style={{ flex: 2, minWidth: 160 }}>Nome<input value={t.name} onChange={e => setT(k, { name: e.target.value })} maxLength={60} placeholder="Normal, VIP, Mesa…" /></label>
            <label style={{ flex: 1, minWidth: 120 }}>Preço (Kz)<input value={t.price} onChange={e => setT(k, { price: e.target.value })} inputMode="numeric" placeholder="0" /></label>
            <label style={{ flex: 1, minWidth: 120 }}>Quantidade<input value={t.quantity} onChange={e => setT(k, { quantity: e.target.value })} inputMode="numeric" placeholder="100" /></label>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={t.active ?? true} onChange={e => setT(k, { active: e.target.checked })} style={{ width: 22, height: 22 }} /> À venda</label>
            {tickets.length > 1 && <button type="button" className="secondary" onClick={() => setTickets(l => l.filter((_, i) => i !== k))}>Tirar este bilhete</button>}
          </div>
        </div>)}
        <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setTickets(l => [...l, { name: "", price: "", quantity: "" }])}>➕ Outro tipo de bilhete</button>
      </fieldset>
      {paid && <fieldset className="card stack" style={{ gap: 8 }}>
        <legend style={{ fontWeight: 700 }}>💰 Onde recebe o dinheiro dos bilhetes</legend>
        <small>Os compradores pagam diretamente para si. Estes dados só aparecem a quem reservou bilhete.</small>
        <label>Titular da conta<input value={pay.holder} onChange={e => setPay({ ...pay, holder: e.target.value })} maxLength={80} /></label>
        <label>IBAN<input value={pay.iban} onChange={e => setPay({ ...pay, iban: e.target.value })} maxLength={40} placeholder="AO06 …" /></label>
        <label>Número Multicaixa Express<input value={pay.express} onChange={e => setPay({ ...pay, express: e.target.value })} maxLength={20} inputMode="tel" /></label>
        <label>Nota para quem paga (opcional)<input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} maxLength={200} placeholder="Ex.: escreva o seu nome no descritivo" /></label>
      </fieldset>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        {status !== "published" && <button type="submit" disabled={busy}>{busy ? "A gravar…" : "✅ Publicar o evento"}</button>}
        <button type={status === "published" ? "submit" : "button"} className={status === "published" ? "" : "secondary"} disabled={busy} onClick={status === "published" ? undefined : () => void save(false)}>{busy ? "A gravar…" : status === "published" ? "Guardar alterações" : "Guardar como rascunho"}</button>
      </div>
    </form>
  </main>;
}

/** Os meus eventos (organizador). */
export function MyEvents() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<Awaited<ReturnType<typeof listMyEvents>>["data"] | null>(null);
  useEffect(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyEvents(supabase(), u)).data); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🎟️ Os meus eventos</h1><p>Publique o seu concerto, festa, jogo ou feira e venda os bilhetes aqui.</p><a className="btn" href="/conta/login?voltar=/eventos/meus">Entrar para organizar</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/eventos">← Todos os eventos</a>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h1 style={{ margin: 0 }}>🎟️ Os meus eventos</h1><a className="btn" href="/eventos/novo">➕ Novo evento</a></div>
    <p className="muted" style={{ margin: 0 }}>Os compradores pagam-lhe diretamente. O Huambo Online cobra uma pequena comissão dos bilhetes pagos que confirmar.</p>
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não tem eventos. <a href="/eventos/novo">Criar o primeiro</a>.</p> :
      items.map(e => <a key={e.id} href={`/eventos/${e.id}/gerir`} className="card" style={{ color: "inherit", textDecoration: "none", gap: 4 }}>
        <strong>{e.title}</strong>
        <small>{eventRef(e.ref_no)} · 📅 {formatEventDate(e.starts_at)} · {e.status === "draft" ? "📝 Rascunho" : e.status === "cancelled" ? "❌ Cancelado" : eventIsOver(e) ? "Já aconteceu" : "✅ Publicado"}
          {e.featured_until && Date.parse(e.featured_until) > Date.now() ? " · ⭐ Destaque" : ""}</small>
      </a>)}
  </main>;
}

/** Pagar à plataforma: comissão dos bilhetes ou destaque. */
function PlatformPayBox({ eventId, uid, kind, amount, settings, onDone, onClose }: { eventId: string; uid: string; kind: "fee" | "boost"; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !file) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitEventPlatformPayment(supabase(), eventId, kind, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      onDone(kind === "boost" ? "Pedido de destaque enviado. Fica ativo quando a administração confirmar o pagamento." : "Pagamento da comissão enviado. A administração vai confirmar.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="card stack" style={{ gap: 10 }}>
    <strong>Valor a pagar: {formatPrice(amount)}</strong>
    <strong>1. Pague ao Huambo Online para estes dados</strong>
    <PaymentDetails s={settings} />
    <strong>2. Diga-nos como pagou</strong>
    <MethodPicker value={method} onChange={setMethod} labels={PLAN_METHOD_LABELS} />
    <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder="Ex.: 1234 5678" /></label>
    <label>Comprovativo (opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar pagamento"}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></div>
  </div>;
}

/** Painel do organizador: vendas, pedidos por confirmar, entrada, comissão, destaque e cancelar. */
export function EventManage({ id }: { id: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [e, setE] = useState<EventRow | null>(null); const [p, setP] = useState<OrganizerPanel | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [open, setOpen] = useState<"" | "fee" | "boost" | "cancel">("");
  const [code, setCode] = useState(""); const [check, setCheck] = useState<CheckInResult | null>(null); const [reason, setReason] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b, s] = await Promise.all([getEvent(supabase(), id), organizerPanel(supabase(), id), getPlatformSettings(supabase())]);
    setE(a.data); setSettings(s.data); if (b.error) setError(friendlyError(b.error)); else setP(b.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><a className="btn" href={`/conta/login?voltar=/eventos/${id}/gerir`}>Entrar</a></main>;
  if (!e || !p) return <main className="stack"><p className={error ? "error" : ""}>{error || "A carregar…"}</p><a href="/eventos/meus">← Os meus eventos</a></main>;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now();
  const waiting = p.orders.filter(o => o.status === "submitted"); const reserved = p.orders.filter(o => o.status === "reserved");
  const done = (m: string) => { setNotice(m); setError(""); setOpen(""); void load(); };
  async function decide(o: OrganizerOrder, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (o comprador vai ler)") ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirma que recebeu ${formatPrice(o.total)} de ${o.buyer_name}?`)) return;
    const r = await decideTicketOrder(supabase(), o.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else done(ok ? `Pagamento confirmado: ${o.quantity} bilhete(s) enviados a ${o.buyer_name}.` : "Pagamento recusado.");
  }
  async function doCheck(ev: React.FormEvent) {
    ev.preventDefault(); if (!code.trim()) return; setBusy(true); setCheck(null);
    const r = await checkInTicket(supabase(), id, normalizeTicketCode(code)); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function publish(on: boolean) {
    const r = await setEventPublished(supabase(), id, on);
    if (r.error) setError(friendlyError(r.error)); else done(on ? "Evento publicado. Já aparece em «Eventos»." : "O evento voltou a rascunho.");
  }
  async function doCancel() {
    if (!confirm("Cancelar o evento? Os bilhetes são anulados e os compradores recebem um aviso. Não dá para voltar atrás.")) return;
    setBusy(true); const r = await cancelEvent(supabase(), id, reason); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else done("Evento cancelado. Avisámos os compradores: devolva o dinheiro a quem pagou.");
  }
  const active = e.status === "published" && !eventIsOver(e);
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/eventos/meus">← Os meus eventos</a>
    <h1 style={{ margin: 0 }}>⚙️ {e.title}</h1>
    <small>{eventRef(e.ref_no)} · 📅 {formatEventDate(e.starts_at)} · {e.status === "draft" ? "📝 Rascunho" : e.status === "cancelled" ? "❌ Cancelado" : "✅ Publicado"}{featured ? ` · ⭐ Destaque até ${formatDate(e.featured_until!)}` : ""}</small>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="row">
      <a className="btn secondary" href={`/eventos/${id}`}>👁️ Ver a página</a>
      {e.status !== "cancelled" && <a className="btn secondary" href={`/eventos/${id}/editar`}>✏️ Editar</a>}
      {e.status === "draft" && <button type="button" onClick={() => void publish(true)}>✅ Publicar</button>}
      {e.status === "published" && p.sold === 0 && <button type="button" className="secondary" onClick={() => void publish(false)}>Voltar a rascunho</button>}
    </div>
    <section className="stats" aria-label="Resumo das vendas">
      <div className="stat"><strong>{p.sold}</strong><span>🎟️ Bilhetes confirmados</span></div>
      <div className="stat"><strong>{formatPrice(p.revenue)}</strong><span>💰 Recebido</span></div>
      <div className="stat"><strong>{p.checked_in}</strong><span>🚪 Já entraram</span></div>
    </section>
    {active && <section className="card stack" style={{ gap: 8 }} aria-labelledby="entrada">
      <h2 id="entrada" style={{ margin: 0 }}>🚪 Entrada: validar bilhete</h2>
      <form className="row" onSubmit={doCheck}>
        <input aria-label="Código do bilhete" value={code} onChange={ev => setCode(ev.target.value)} placeholder="HO-XXXX-XXXX" autoCapitalize="characters" style={{ flex: 1, minWidth: 180, fontSize: 22, letterSpacing: 2 }} />
        <button type="submit" disabled={busy}>Validar</button>
      </form>
      {check && <p role="status" className={check.result === "ok" ? "ok" : "error"} style={{ fontSize: 22, margin: 0 }}>{CHECKIN_LABELS[check.result]}{check.type ? ` · ${check.type}` : ""}{check.holder ? ` · ${check.holder}` : ""}</p>}
      <small>Escreva o código que está no bilhete (ou no ecrã do telemóvel do comprador). Cada bilhete só entra uma vez.</small>
    </section>}
    <section className="stack" style={{ gap: 8 }} aria-labelledby="pedidos">
      <h2 id="pedidos" style={{ margin: 0 }}>💳 Pagamentos por confirmar ({waiting.length})</h2>
      {waiting.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum pagamento à espera.</p>}
      {waiting.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
        <strong>{o.buyer_name} — {o.quantity} × {o.type_name} = {formatPrice(o.total)}</strong>
        <small>{ticketOrderRef(o.ref_no)} · {o.method ? TICKET_METHOD_LABELS[o.method] : ""} · Referência: <strong>{o.reference}</strong>{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</small>
        <div className="row"><button type="button" onClick={() => void decide(o, true)}>✅ Recebi o dinheiro</button><button type="button" className="secondary" onClick={() => void decide(o, false)}>❌ Não recebi</button></div>
      </article>)}
      {reserved.length > 0 && <details className="card"><summary><strong>⏳ Reservas ainda por pagar ({reserved.length})</strong></summary>
        {reserved.map(o => <p key={o.id} style={{ margin: "6px 0" }}>{o.buyer_name} — {o.quantity} × {o.type_name} · {formatPrice(o.total)}{o.pay_by ? ` · paga até ${formatEventDate(o.pay_by)}` : ""}</p>)}</details>}
      {p.orders.some(o => o.status === "confirmed") && <details className="card"><summary><strong>✅ Compradores confirmados</strong></summary>
        {p.orders.filter(o => o.status === "confirmed").map(o => <p key={o.id} style={{ margin: "6px 0" }}>{o.buyer_name} — {o.quantity} × {o.type_name}{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</p>)}</details>}
    </section>
    <section className="card stack" style={{ gap: 8 }} aria-labelledby="comissao">
      <h2 id="comissao" style={{ margin: 0 }}>🧾 Comissão do Huambo Online ({p.fee_pct}% dos bilhetes pagos)</h2>
      <span>Total: {formatPrice(p.fee_total)} · Por pagar: <strong>{formatPrice(p.fee_due)}</strong></span>
      {p.fee_pending && <span>⏳ Pagamento enviado, à espera de confirmação.</span>}
      {p.fee_due > 0 && !p.fee_pending && (open === "fee" ? <PlatformPayBox eventId={id} uid={uid} kind="fee" amount={p.fee_due} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen("fee")}>Pagar a comissão</button>)}
      <small>Pague até 7 dias depois do evento. Com comissões em atraso não pode publicar novos eventos.</small>
    </section>
    {active && <section className="card stack" style={{ gap: 8 }} aria-labelledby="destaque">
      <h2 id="destaque" style={{ margin: 0 }}>⭐ Destacar o evento</h2>
      <span>{formatPrice(p.boost_price_kz)} por {p.boost_days} dias: o evento aparece no topo de «Eventos» e na página inicial, com o selo «⭐ Destaque».</span>
      {featured && <span className="ok">⭐ Em destaque até {formatDate(e.featured_until!)}</span>}
      {p.boost_pending ? <span>⏳ Pagamento do destaque à espera de confirmação.</span> : open === "boost"
        ? <PlatformPayBox eventId={id} uid={uid} kind="boost" amount={p.boost_price_kz} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen("boost")}>{featured ? "⭐ Juntar mais dias" : "⭐ Destacar"}</button>}
    </section>}
    {p.payments.length > 0 && <details className="card"><summary><strong>Pagamentos ao Huambo Online</strong></summary>
      {p.payments.map(x => <p key={x.id} style={{ margin: "6px 0" }}>P-{x.ref_no} · {x.kind === "boost" ? `Destaque ${x.days} dias` : "Comissão"} · {formatPrice(x.amount)} · {x.status === "pending" ? "⏳ À espera" : x.status === "confirmed" ? "✅ Confirmado" : "❌ Recusado" + (x.admin_note ? ": " + x.admin_note : "")}</p>)}</details>}
    {e.status === "published" && <section className="card stack" style={{ gap: 8 }}>
      {open === "cancel" ? <>
        <label>Motivo do cancelamento (os compradores vão ler)<input value={reason} onChange={ev => setReason(ev.target.value)} maxLength={300} /></label>
        <div className="row"><button type="button" className="danger" disabled={busy || !reason.trim()} onClick={() => void doCancel()}>Cancelar o evento</button><button type="button" className="secondary" onClick={() => setOpen("")}>Voltar</button></div>
      </> : <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen("cancel")}>❌ Cancelar o evento</button>}
    </section>}
  </main>;
}

function TicketQr({ code }: { code: string }) {
  const q = qrSvgPath(code);
  return <svg role="img" aria-label={"Código QR do bilhete " + code} viewBox={`-2 -2 ${q.size + 4} ${q.size + 4}`} width={180} height={180} style={{ background: "#fff", borderRadius: 8 }} shapeRendering="crispEdges">
    <path d={q.d} fill="#000" />
  </svg>;
}

/** Os meus bilhetes (comprador). */
export function MyTickets() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyTicketOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myTicketOrders(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🎟️ Os meus bilhetes</h1><a className="btn" href="/conta/login?voltar=/bilhetes">Entrar para ver os bilhetes</a></main>;
  const fresh = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("novo") : null;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/eventos">← Eventos</a>
    <h1 style={{ margin: 0 }}>🎟️ Os meus bilhetes</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não tem bilhetes. <a href="/eventos">Ver eventos</a>.</p> :
      items.map(o => <TicketOrderCard key={o.id} o={o} highlight={o.id === fresh} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </main>;
}
function TicketOrderCard({ o, highlight, onDone, onError }: { o: MyTicketOrder; highlight: boolean; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true); const r = await submitTicketPayment(supabase(), o.id, method, reference); setBusy(false);
    if (r.error) onError(friendlyError(r.error)); else onDone("Referência enviada. O organizador vai confirmar e o bilhete aparece aqui.");
  }
  async function cancel() {
    if (!confirm("Cancelar esta reserva?")) return;
    const r = await cancelTicketOrder(supabase(), o.id);
    if (r.error) onError(friendlyError(r.error)); else onDone("Reserva cancelada.");
  }
  const usable = ticketUsable(o);
  return <article className="card stack" style={{ gap: 8, outline: highlight ? "3px solid var(--accent)" : undefined }}>
    <a href={"/eventos/" + o.event_id} style={{ fontWeight: 800, fontSize: 19 }}>{o.title}</a>
    <small>{ticketOrderRef(o.ref_no)} · 📅 {formatEventDate(o.starts_at)} · 📍 {o.venue}</small>
    <span>{o.quantity} × {o.type_name} · <strong>{o.total > 0 ? formatPrice(o.total) : "Grátis"}</strong> · {TICKET_ORDER_STATUS_LABELS[o.status]}</span>
    {o.event_status === "cancelled" && <p className="error" style={{ margin: 0 }}>❌ Evento cancelado{o.cancel_reason ? ": " + o.cancel_reason : ""}. Fale com o organizador para o reembolso.</p>}
    {o.note && o.status === "rejected" && <span className="error">Motivo: {o.note}</span>}
    {o.status === "reserved" && <div className="stack" style={{ gap: 8 }}>
      <strong>1. Pague {formatPrice(o.total)} ao organizador{o.pay_by ? ` até ${formatEventDate(o.pay_by)}` : ""}</strong>
      <dl className="facts card" style={{ margin: 0 }}>
        {o.pay_holder && <><dt>Titular</dt><dd>{o.pay_holder}</dd></>}
        {o.pay_iban && <><dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{o.pay_iban}</strong></dd></>}
        {o.pay_express && <><dt>Multicaixa Express</dt><dd><strong>{o.pay_express}</strong></dd></>}
      </dl>
      {o.pay_note && <span>{o.pay_note}</span>}
      <strong>2. Diga como pagou</strong>
      <MethodPicker value={method} onChange={setMethod} />
      <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
      <div className="row"><button type="button" disabled={busy} onClick={pay}>{busy ? "A enviar…" : "Já paguei"}</button><button type="button" className="secondary" onClick={cancel}>Cancelar reserva</button></div>
    </div>}
    {o.status === "confirmed" && o.tickets.length > 0 && <div className="row" style={{ gap: 16 }}>
      {o.tickets.map(t => <div key={t.code} className="card" style={{ justifyItems: "center", textAlign: "center", gap: 6, borderStyle: t.status === "valid" && usable ? "solid" : "dashed" }}>
        {t.status === "valid" && usable && <TicketQr code={t.code} />}
        <strong style={{ fontSize: 22, letterSpacing: 2 }}>{t.code}</strong>
        <small>{t.status === "used" ? "🚪 Já entrou" : t.status === "void" ? "❌ Anulado" : usable ? "Mostre este código à entrada" : "Evento terminado"}</small>
      </div>)}
    </div>}
  </article>;
}

/** Administração: comissões e destaques dos eventos por confirmar, e as regras. */
export function AdminEvents() {
  const [s, setS] = useState<PlatformSettings | null>(null); const [items, setItems] = useState<AdminEventPayment[]>([]);
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected" | "">("pending"); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b] = await Promise.all([getPlatformSettings(supabase()), listEventPaymentsForAdmin(supabase(), status)]);
    setS(a.data); if (b.error) setError(friendlyError(b.error)); setItems(b.data);
  }
  useEffect(() => { void load(); }, [status]);
  async function decide(p: AdminEventPayment, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (o organizador vai ler)") ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirmar ${formatPrice(p.amount)} de ${p.organizer_name}?`)) return;
    const r = await decideEventPayment(supabase(), p.id, ok, note);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? (p.kind === "boost" ? "Confirmado: o evento fica em destaque." : "Comissão confirmada.") : "Pagamento recusado."); await load(); }
  }
  async function save(ev: React.FormEvent) {
    ev.preventDefault(); if (!s) return;
    const pct = Number(s.event_ticket_fee_pct), price = Number(s.event_boost_price_kz), days = Number(s.event_boost_days), hours = Number(s.event_payment_hours);
    if (!(pct >= 0 && pct <= 30) || !(price >= 0) || !Number.isInteger(days) || days < 1 || days > 60 || !Number.isInteger(hours) || hours < 1 || hours > 168) { setError("Verifique a percentagem, o preço, os dias e as horas."); return; }
    const r = await updatePlatformSettings(supabase(), { event_ticket_fee_pct: pct, event_boost_price_kz: price, event_boost_days: days, event_payment_hours: hours });
    if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Regras dos eventos guardadas."); }
  }
  async function openProof(path: string) { const { data: url } = await paymentProofUrl(supabase(), path); if (url) window.open(url, "_blank", "noopener"); else setError("Não foi possível abrir o comprovativo."); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🎟️ Eventos: comissões e destaques</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card stack" style={{ gap: 8 }} onSubmit={save}>
      <div className="row">
        <label style={{ flex: 1, minWidth: 160 }}>Comissão nos bilhetes (%)<input value={String(s.event_ticket_fee_pct ?? "")} onChange={e => setS({ ...s, event_ticket_fee_pct: e.target.value })} inputMode="decimal" /></label>
        <label style={{ flex: 1, minWidth: 160 }}>Preço do destaque (Kz)<input value={String(s.event_boost_price_kz ?? "")} onChange={e => setS({ ...s, event_boost_price_kz: e.target.value })} inputMode="numeric" /></label>
        <label style={{ flex: 1, minWidth: 160 }}>Dias de destaque<input value={String(s.event_boost_days ?? "")} onChange={e => setS({ ...s, event_boost_days: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
        <label style={{ flex: 1, minWidth: 160 }}>Horas para pagar a reserva<input value={String(s.event_payment_hours ?? "")} onChange={e => setS({ ...s, event_payment_hours: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      </div>
      <button type="submit" style={{ justifySelf: "start" }}>Guardar regras</button>
    </form>}
    <div className="chips" role="group" aria-label="Estado">
      {([["pending", "⏳ Por confirmar"], ["confirmed", "✅ Confirmados"], ["rejected", "❌ Recusados"], ["", "Todos"]] as const).map(([k, l]) =>
        <button key={k} type="button" className={"chip" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}
    </div>
    {items.length === 0 && <p className="muted">Nada nesta lista.</p>}
    {items.map(p => <article key={p.id} className="card" style={{ gap: 6 }}>
      <strong>{p.kind === "boost" ? `⭐ Destaque ${p.days} dias` : "🧾 Comissão dos bilhetes"} · {formatPrice(p.amount)}</strong>
      <small>P-{p.ref_no} · <a href={"/eventos/" + p.event_id}>{eventRef(p.event_ref)} {p.event_title}</a> · {p.organizer_name} · {PLAN_METHOD_LABELS[p.method]}{p.reference ? ` · Ref.: ${p.reference}` : ""}</small>
      {p.admin_note && <small>Nota: {p.admin_note}</small>}
      <div className="row">
        {p.proof_path && <button type="button" className="secondary" onClick={() => void openProof(p.proof_path!)}>📄 Ver comprovativo</button>}
        {p.status === "pending" && <><button type="button" onClick={() => void decide(p, true)}>✅ Confirmar</button><button type="button" className="secondary" onClick={() => void decide(p, false)}>❌ Recusar</button></>}
      </div>
    </article>)}
  </section>;
}
