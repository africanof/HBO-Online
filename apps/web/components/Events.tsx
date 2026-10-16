"use client";
import { useEffect, useState } from "react";
import { listEvents, getEvent, getEventTickets, getEventPaymentInfo, saveEvent, setEventPublished, cancelEvent, reserveTickets, submitTicketPayment, decideTicketOrder,
  cancelTicketOrder, checkInTicket, myTicketOrders, organizerPanel, submitEventPlatformPayment, listEventPaymentsForAdmin, decideEventPayment, listMyEvents,
  formatEventDate, isoToLocalInput, eventIsOver, eventRef, ticketOrderRef, priceFromText, ticketsLeftText, eventShareMessage, normalizeTicketCode, qrSvgPath, ticketUsable,
  validateEvent, uploadClassifiedMedia, uploadPaymentProof, validateDocument, paymentProofUrl, getPlatformSettings, updatePlatformSettings, formatPrice, friendlyErrorIn,
  whatsappShareUrl, pointFrom, EVENT_CATEGORY_LABELS, TICKET_ORDER_STATUS_LABELS, TICKET_METHOD_LABELS, CHECKIN_LABELS, PLAN_METHOD_LABELS,
  type EventCategory, type EventSummary, type EventRow, type TicketTypeAvailability, type TicketTypeDraft, type EventPaymentInfo, type MyTicketOrder,
  type OrganizerPanel, type OrganizerOrder, type AdminEventPayment, type CheckInResult, type PaymentMethodPlan, type PlatformSettings, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT, eventDateIn, formatDateIn } from "../lib/i18n";
import { SITE_URL } from "../lib/site";
import { ticketVerifyUrl, ticketByCode, checkInTicket as checkInTicketFn, CHECKIN_LABELS as CHECKIN_TEXT, formatEventDate as fmtDate, type TicketView } from "@huambo-online/core";
import { ItemCard } from "./ItemCard";
import { LiteImg } from "./LiteImg";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";

const CATS = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];
const METHODS = Object.keys(TICKET_METHOD_LABELS) as PaymentMethodPlan[];
const icon = (c: EventCategory) => EVENT_CATEGORY_LABELS[c].split(" ")[0];

function MethodPicker({ value, onChange, labels = TICKET_METHOD_LABELS }: { value: PaymentMethodPlan; onChange: (m: PaymentMethodPlan) => void; labels?: Record<PaymentMethodPlan, string> }) {
  const { t, tc } = useT();
  return <div className="row" role="radiogroup" aria-label={t("sv.how_paid")}>{METHODS.map(m =>
    <button key={m} type="button" role="radio" aria-checked={value === m} className={value === m ? "" : "secondary"} onClick={() => onChange(m)}>{tc(labels[m])}</button>)}</div>;
}

/** Lista pública de eventos: os destacados primeiro. */
export function EventList() {
  const { lang, t, tc } = useT();
  const [cat, setCat] = useState<EventCategory | "">(""); const [q, setQ] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const { municipalities } = useTerritory();
  const [items, setItems] = useState<EventSummary[] | null>(null); const [error, setError] = useState("");
  async function load() {
    const r = await listEvents(supabase(), { category: cat, municipalityId, query: q });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setItems(r.data); }
  }
  useEffect(() => { void load(); }, [cat, municipalityId]);
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>🎟️ {t("sv.ev_title")}</h1>
      <div className="row"><a className="btn secondary" href="/bilhetes">🎟️ {t("sv.ev_my_tickets")}</a><a className="btn" href="/eventos/meus">➕ {t("sv.ev_organize")}</a></div>
    </div>
    <form className="row" role="search" onSubmit={e => { e.preventDefault(); void load(); }}>
      <input aria-label={t("sv.ev_search")} value={q} onChange={e => setQ(e.target.value)} placeholder={t("sv.ev_search_ph")} style={{ flex: 1, minWidth: 200 }} />
      <select aria-label={t("sv.municipality")} value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}>
        <option value="">{t("sv.all_municipalities")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button type="submit">{t("sv.search_btn")}</button>
    </form>
    <div className="chips" role="group" aria-label={t("sv.ev_type")}>
      <button type="button" className={"chip" + (cat === "" ? " on" : "")} aria-pressed={cat === ""} onClick={() => setCat("")}>{t("sv.all")}</button>
      {CATS.map(c => <button key={c} type="button" className={"chip" + (cat === c ? " on" : "")} aria-pressed={cat === c} onClick={() => setCat(c)}>{tc(EVENT_CATEGORY_LABELS[c])}</button>)}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.ev_none")} <a href="/eventos/meus">{t("sv.ev_publish_yours")}</a>.</p> :
      <div className="results-grid">{items.map(e => <ItemCard key={e.id} href={"/eventos/" + e.id} media={e.cover_url ? [e.cover_url] : null} icon={icon(e.category)}
        title={e.title} price={tc(priceFromText(e.price_from))} featured={e.featured}
        tag={e.status === "cancelled" ? t("sv.ev_cancelled") : e.tickets_left === 0 ? t("sv.mk_sold_out") : undefined} tagRed={e.status === "cancelled" || e.tickets_left === 0}
        meta={`📅 ${eventDateIn(e.starts_at, lang)} · 📍 ${e.venue}${e.municipality_name ? ", " + e.municipality_name : ""}`} />)}</div>}
  </main>;
}

/** Página do evento: detalhes, bilhetes e compra. */
export function EventDetail({ id }: { id: string }) {
  const { lang, t, tc } = useT();
  const [e, setE] = useState<EventRow | null | undefined>(undefined); const [types, setTypes] = useState<TicketTypeAvailability[]>([]);
  const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  const [typeId, setTypeId] = useState(""); const [qty, setQty] = useState(1); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b] = await Promise.all([getEvent(supabase(), id), getEventTickets(supabase(), id)]);
    if (a.error) setError(friendlyErrorIn(a.error, lang)); setE(a.data); setTypes(b.data.filter(x => x.active));
  }
  useEffect(() => { void load(); void currentUserId().then(setUid); }, [id]);
  if (e === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!e) return <main className="stack"><h1>{t("sv.ev_not_found")}</h1><p>{error || t("sv.ev_unavailable")}</p><a href="/eventos">← {t("sv.ev_see_all")}</a></main>;
  const mine = uid === e.organizer_id; const over = eventIsOver(e); const onSale = e.status === "published" && !over;
  const chosen = types.find(x => x.id === typeId); const priceFrom = types.length ? Math.min(...types.map(x => x.price)) : null;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now();
  async function buy(ev: React.FormEvent) {
    ev.preventDefault(); if (!chosen) { setError(t("sv.ev_choose_type")); return; }
    setBusy(true); setError("");
    const r = await reserveTickets(supabase(), chosen.id, qty, name, phone); setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    window.location.href = "/bilhetes?novo=" + (r.data as { id: string }).id;
  }
  const share = tc(eventShareMessage(typeof window === "undefined" ? "" : window.location.origin + "/", e, priceFrom));
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/eventos">← {t("sv.ev_all")}</a>
    {e.cover_url && <LiteImg src={e.cover_url} alt={t("sv.ev_poster_of", { title: e.title })} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderRadius: 16 }} placeholder="🎟️" />}
    <div className="row" style={{ alignItems: "center" }}>
      <span className="badge">{tc(EVENT_CATEGORY_LABELS[e.category])}</span>
      {featured && <span className="badge">⭐ {t("sv.featured")}</span>}
      <small className="muted">{eventRef(e.ref_no)}</small>
    </div>
    <h1 style={{ margin: 0 }}>{e.title}</h1>
    {e.status === "cancelled" && <p className="banner yellow" role="alert" style={{ margin: 0 }}>❌ {t("sv.ev_cancelled_banner")}{e.cancel_reason ? ": " + e.cancel_reason : ""}. {t("sv.ev_refund_hint")}</p>}
    {e.status === "draft" && <p className="banner yellow" style={{ margin: 0 }}>📝 {t("sv.ev_draft_banner")}</p>}
    {over && e.status === "published" && <p className="banner yellow" style={{ margin: 0 }}>{t("sv.ev_over")}</p>}
    <dl className="facts card" style={{ margin: 0 }}>
      <dt>📅 {t("sv.ev_when")}</dt><dd><strong>{eventDateIn(e.starts_at, lang)}</strong>{e.ends_at && <> {t("sv.until")} {eventDateIn(e.ends_at, lang)}</>}</dd>
      <dt>📍 {t("sv.ev_where")}</dt><dd><strong>{e.venue}</strong>{e.municipalities?.name ? ", " + e.municipalities.name : ""}</dd>
      <dt>💰 {t("sv.price")}</dt><dd>{tc(priceFromText(priceFrom))}</dd>
    </dl>
    {mine && <div className="row"><a className="btn" href={`/eventos/${e.id}/gerir`}>⚙️ {t("sv.ev_manage")}</a><a className="btn secondary" href={`/eventos/${e.id}/editar`}>✏️ {t("common.edit")}</a></div>}
    {e.description && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{e.description}</p>}
    <PlaceView directions={e.directions} lat={e.geo_lat} lng={e.geo_lng} />
    <section className="card stack" style={{ gap: 10 }} aria-labelledby="bilhetes">
      <h2 id="bilhetes" style={{ margin: 0 }}>🎟️ {t("sv.ev_tickets")}</h2>
      {types.length === 0 && <p style={{ margin: 0 }}>{t("sv.ev_no_tickets")}</p>}
      {types.map(x => <label key={x.id} className="card row" style={{ alignItems: "center", justifyContent: "space-between", cursor: onSale && x.left_count > 0 ? "pointer" : "default" }}>
        <span className="row" style={{ alignItems: "center" }}>
          {onSale && !mine && <input type="radio" name="tipo" value={x.id} checked={typeId === x.id} disabled={x.left_count === 0} onChange={() => { setTypeId(x.id); setQty(1); }} style={{ width: 24, height: 24 }} />}
          <strong>{x.name}</strong>
        </span>
        <span style={{ textAlign: "right" }}><strong className="price">{x.price > 0 ? formatPrice(x.price) : t("sv.free")}</strong><br /><small className={x.left_count === 0 ? "error" : "muted"}>{tc(ticketsLeftText(x.left_count))}</small></span>
      </label>)}
      {onSale && !mine && types.length > 0 && (!uid ? <a className="btn" href={`/conta/login?voltar=/eventos/${e.id}`}>{t("sv.ev_login_buy")}</a> :
        <form className="stack" style={{ gap: 10 }} onSubmit={buy}>
          {chosen && <label>{t("sv.ev_how_many")}<select value={qty} onChange={ev => setQty(Number(ev.target.value))}>
            {Array.from({ length: Math.min(chosen.max_per_order, chosen.left_count) }, (_, k) => k + 1).map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
          <label>{t("sv.ev_name_ticket")}<input value={name} onChange={ev => setName(ev.target.value)} maxLength={80} autoComplete="name" /></label>
          <label>{t("sv.ev_phone")}<input value={phone} onChange={ev => setPhone(ev.target.value)} maxLength={20} inputMode="tel" autoComplete="tel" placeholder="9XX XXX XXX" /></label>
          {chosen && <strong>{t("sv.total")}: {chosen.price > 0 ? formatPrice(chosen.price * qty) : t("sv.free")}</strong>}
          {chosen && chosen.price > 0 && <small>{t("sv.ev_pay_hint")}</small>}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={busy || !chosen}>{busy ? t("sv.fu_reserving") : chosen && chosen.price === 0 ? "🎟️ " + t("sv.ev_free_ticket") : "🎟️ " + t("sv.ev_reserve_ticket")}</button>
        </form>)}
    </section>
    <div className="row">
      <a className="btn secondary" href={whatsappShareUrl(share)} target="_blank" rel="noopener">📲 {t("sv.share_wa")}</a>
    </div>
    <p className="muted" style={{ margin: 0 }}>{t("sv.ev_disclaimer")} <a href="/seguranca">{t("sv.safety_tips")}</a>.</p>
  </main>;
}

/** Formulário para criar ou editar um evento. */
export function EventForm({ id }: { id?: string }) {
  const { lang, t, tc } = useT();
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
    const e = a.data; if (!e) { setError(t("sv.ev_not_found") + "."); return; }
    setTitle(e.title); setDescription(e.description ?? ""); setCategory(e.category); setStartsAt(isoToLocalInput(e.starts_at)); setEndsAt(isoToLocalInput(e.ends_at));
    setVenue(e.venue); setMunicipalityId(e.municipality_id ?? ""); setDirections(e.directions ?? ""); setPoint(pointFrom(e.geo_lat, e.geo_lng)); setCover(e.cover_url); setStatus(e.status);
    setPay(c); setExisting(b.data.map(x => ({ id: x.id })));
    if (b.data.length) setTickets(b.data.map(x => ({ id: x.id, name: x.name, price: String(x.price), quantity: String(x.quantity), max_per_order: String(x.max_per_order), active: x.active })));
    setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <main><p>{error || t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🎟️ {t("sv.ev_organize")}</h1><a className="btn" href="/conta/login?voltar=/eventos/novo">{t("sv.ev_login_publish")}</a></main>;
  const setT = (k: number, p: Partial<TicketTypeDraft>) => setTickets(l => l.map((x, i) => i === k ? { ...x, ...p } : x));
  const input = { title, description, category, startsAt, endsAt, venue, municipalityId, directions, point, coverUrl: cover, pay, tickets };
  const paid = tickets.some(x => Number(x.price.replace(/\s/g, "").replace(",", ".")) > 0);
  async function save(publish: boolean) {
    const bad = validateEvent(input); if (bad) { setError(tc(bad)); return; }
    if (file) { const b = validateDocument({ size: file.size, type: file.type }); if (b || !file.type.startsWith("image/")) { setError(b ? tc(b) : t("sv.ev_poster_photo")); return; } }
    setBusy(true); setError("");
    try {
      let coverUrl = cover;
      if (file) { const up = await uploadClassifiedMedia(supabase(), file, uid!, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.ev_poster_fail")); coverUrl = up.data; }
      const r = await saveEvent(supabase(), uid!, { ...input, coverUrl }, id, existing);
      if (r.error || !r.data) throw r.error ?? new Error(t("sv.save_fail"));
      if (publish && status !== "published") { const p = await setEventPublished(supabase(), r.data.id, true); if (p.error) { window.location.href = `/eventos/${r.data.id}/editar?erro=` + encodeURIComponent(friendlyErrorIn(p.error, lang)); return; } }
      window.location.href = `/eventos/${r.data.id}/gerir`;
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  const urlError = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("erro") : null;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href={id ? `/eventos/${id}/gerir` : "/eventos/meus"}>← {t("common.back")}</a>
    <h1 style={{ margin: 0 }}>{id ? "✏️ " + t("sv.ev_edit") : "🎟️ " + t("sv.ev_new")}</h1>
    {urlError && !error && <p className="error" role="alert">{urlError}</p>}
    <form className="stack" onSubmit={e => { e.preventDefault(); void save(status !== "published"); }}>
      <label>{t("sv.ev_name")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={t("sv.ev_name_ph")} /></label>
      <label>{t("sv.type")}<select value={category} onChange={e => setCategory(e.target.value as EventCategory)}>{CATS.map(c => <option key={c} value={c}>{tc(EVENT_CATEGORY_LABELS[c])}</option>)}</select></label>
      <div className="row">
        <label style={{ flex: 1, minWidth: 220 }}>{t("sv.ev_starts")}<input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} /></label>
        <label style={{ flex: 1, minWidth: 220 }}>{t("sv.ev_ends")}<input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} /></label>
      </div>
      <label>{t("sv.mk_place")}<input value={venue} onChange={e => setVenue(e.target.value)} maxLength={120} placeholder={t("sv.ev_venue_ph")} /></label>
      <label>{t("sv.municipality")}<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">— {t("sv.f_choose")} —</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint={t("sv.ev_place_hint")} />
      <label>{t("sv.ev_desc")}<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} rows={5} /></label>
      <fieldset className="card stack" style={{ gap: 8 }}>
        <legend style={{ fontWeight: 700 }}>🖼️ {t("sv.ev_poster_opt")}</legend>
        {cover && !file && <div className="row" style={{ alignItems: "center" }}><LiteImg src={cover} alt={t("sv.ev_poster_current")} style={{ width: 120, borderRadius: 8 }} /><button type="button" className="secondary" onClick={() => setCover(null)}>{t("sv.ev_poster_remove")}</button></div>}
        <input type="file" aria-label={t("sv.ev_poster_choose")} accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </fieldset>
      <fieldset className="card stack" style={{ gap: 10 }}>
        <legend style={{ fontWeight: 700 }}>🎟️ {t("sv.ev_tickets")}</legend>
        <small>{t("sv.ev_tickets_hint")}</small>
        {tickets.map((x, k) => <div key={k} className="card stack" style={{ gap: 8 }}>
          <div className="row">
            <label style={{ flex: 2, minWidth: 160 }}>{t("sv.f_name")}<input value={x.name} onChange={e => setT(k, { name: e.target.value })} maxLength={60} placeholder={t("sv.ev_ticket_name_ph")} /></label>
            <label style={{ flex: 1, minWidth: 120 }}>{t("sv.price_kz")}<input value={x.price} onChange={e => setT(k, { price: e.target.value })} inputMode="numeric" placeholder="0" /></label>
            <label style={{ flex: 1, minWidth: 120 }}>{t("sv.ve_quantity")}<input value={x.quantity} onChange={e => setT(k, { quantity: e.target.value })} inputMode="numeric" placeholder="100" /></label>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={x.active ?? true} onChange={e => setT(k, { active: e.target.checked })} style={{ width: 22, height: 22 }} /> {t("sv.ev_on_sale")}</label>
            {tickets.length > 1 && <button type="button" className="secondary" onClick={() => setTickets(l => l.filter((_, i) => i !== k))}>{t("sv.ev_remove_ticket")}</button>}
          </div>
        </div>)}
        <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setTickets(l => [...l, { name: "", price: "", quantity: "" }])}>➕ {t("sv.ev_other_ticket")}</button>
      </fieldset>
      {paid && <fieldset className="card stack" style={{ gap: 8 }}>
        <legend style={{ fontWeight: 700 }}>💰 {t("sv.ev_where_money")}</legend>
        <small>{t("sv.ev_where_money_hint")}</small>
        <label>{t("sv.account_holder")}<input value={pay.holder} onChange={e => setPay({ ...pay, holder: e.target.value })} maxLength={80} /></label>
        <label>IBAN<input value={pay.iban} onChange={e => setPay({ ...pay, iban: e.target.value })} maxLength={40} placeholder="AO06 …" /></label>
        <label>{t("sv.ev_express_number")}<input value={pay.express} onChange={e => setPay({ ...pay, express: e.target.value })} maxLength={20} inputMode="tel" /></label>
        <label>{t("sv.payer_note")}<input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} maxLength={200} placeholder={t("sv.ev_payer_note_ph")} /></label>
      </fieldset>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="row">
        {status !== "published" && <button type="submit" disabled={busy}>{busy ? t("sv.saving") : "✅ " + t("sv.ev_publish")}</button>}
        <button type={status === "published" ? "submit" : "button"} className={status === "published" ? "" : "secondary"} disabled={busy} onClick={status === "published" ? undefined : () => void save(false)}>{busy ? t("sv.saving") : status === "published" ? t("sv.save_changes") : t("sv.save_draft")}</button>
      </div>
    </form>
  </main>;
}

/** Os meus eventos (organizador). */
export function MyEvents() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<Awaited<ReturnType<typeof listMyEvents>>["data"] | null>(null);
  useEffect(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyEvents(supabase(), u)).data); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🎟️ {t("sv.ev_mine")}</h1><p>{t("sv.ev_mine_intro")}</p><a className="btn" href="/conta/login?voltar=/eventos/meus">{t("sv.ev_login_organize")}</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/eventos">← {t("sv.ev_all")}</a>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h1 style={{ margin: 0 }}>🎟️ {t("sv.ev_mine")}</h1><a className="btn" href="/eventos/novo">➕ {t("sv.ev_new")}</a></div>
    <p className="muted" style={{ margin: 0 }}>{t("sv.ev_mine_hint")}</p>
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.ev_none_mine")} <a href="/eventos/novo">{t("sv.ev_create_first")}</a>.</p> :
      items.map(e => <a key={e.id} href={`/eventos/${e.id}/gerir`} className="card" style={{ color: "inherit", textDecoration: "none", gap: 4 }}>
        <strong>{e.title}</strong>
        <small>{eventRef(e.ref_no)} · 📅 {eventDateIn(e.starts_at, lang)} · {e.status === "draft" ? "📝 " + t("sv.draft") : e.status === "cancelled" ? "❌ " + t("sv.ev_cancelled") : eventIsOver(e) ? t("sv.ev_happened") : "✅ " + t("sv.published")}
          {e.featured_until && Date.parse(e.featured_until) > Date.now() ? " · ⭐ " + t("sv.featured") : ""}</small>
      </a>)}
  </main>;
}

/** Pagar à plataforma: comissão dos bilhetes ou destaque. */
function PlatformPayBox({ eventId, uid, kind, amount, settings, onDone, onClose }: { eventId: string; uid: string; kind: "fee" | "boost"; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const { lang, t, tc } = useT();
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !file) { setError(t("sv.need_ref_or_proof")); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail")); proof = up.data; }
      const r = await submitEventPlatformPayment(supabase(), eventId, kind, { method, reference, proofPath: proof });
      if (r.error) throw r.error;
      onDone(kind === "boost" ? t("sv.ev_boost_sent") : t("sv.ev_fee_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="card stack" style={{ gap: 10 }}>
    <strong>{t("sv.amount_to_pay")}: {formatPrice(amount)}</strong>
    <strong>1. {t("sv.pay_ho_details")}</strong>
    <PaymentDetails s={settings} />
    <strong>2. {t("sv.tell_how_paid")}</strong>
    <MethodPicker value={method} onChange={setMethod} labels={PLAN_METHOD_LABELS} />
    <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} placeholder={t("sv.ref_ph")} /></label>
    <label>{t("sv.proof_opt")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" disabled={busy} onClick={send}>{busy ? t("sv.sending") : t("sv.send_payment")}</button><button type="button" className="secondary" onClick={onClose}>{t("common.cancel")}</button></div>
  </div>;
}

/** Painel do organizador: vendas, pedidos por confirmar, entrada, comissão, destaque e cancelar. */
export function EventManage({ id }: { id: string }) {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [e, setE] = useState<EventRow | null>(null); const [p, setP] = useState<OrganizerPanel | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null); const [open, setOpen] = useState<"" | "fee" | "boost" | "cancel">("");
  const [code, setCode] = useState(""); const [check, setCheck] = useState<CheckInResult | null>(null); const [reason, setReason] = useState("");
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    const [a, b, s] = await Promise.all([getEvent(supabase(), id), organizerPanel(supabase(), id), getPlatformSettings(supabase())]);
    setE(a.data); setSettings(s.data); if (b.error) setError(friendlyErrorIn(b.error, lang)); else setP(b.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><a className="btn" href={`/conta/login?voltar=/eventos/${id}/gerir`}>{t("auth.login")}</a></main>;
  if (!e || !p) return <main className="stack"><p className={error ? "error" : ""}>{error || t("common.loading")}</p><a href="/eventos/meus">← {t("sv.ev_mine")}</a></main>;
  const featured = !!e.featured_until && Date.parse(e.featured_until) > Date.now();
  const waiting = p.orders.filter(o => o.status === "submitted"); const reserved = p.orders.filter(o => o.status === "reserved");
  const done = (m: string) => { setNotice(m); setError(""); setOpen(""); void load(); };
  async function decide(o: OrganizerOrder, ok: boolean) {
    const note = ok ? "" : prompt(t("sv.why_not_confirm_buyer")) ?? "";
    if (!ok && !note.trim()) return;
    if (ok && !confirm(t("sv.fu_confirm_received", { amount: formatPrice(o.total), name: o.buyer_name }))) return;
    const r = await decideTicketOrder(supabase(), o.id, ok, note);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(ok ? t("sv.ev_pay_confirmed", { n: o.quantity, name: o.buyer_name }) : t("sv.pay_refused"));
  }
  async function doCheck(ev: React.FormEvent) {
    ev.preventDefault(); if (!code.trim()) return; setBusy(true); setCheck(null);
    const r = await checkInTicket(supabase(), id, normalizeTicketCode(code)); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function publish(on: boolean) {
    const r = await setEventPublished(supabase(), id, on);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(on ? t("sv.ev_published_done") : t("sv.ev_back_draft"));
  }
  async function doCancel() {
    if (!confirm(t("sv.ev_cancel_q"))) return;
    setBusy(true); const r = await cancelEvent(supabase(), id, reason); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.ev_cancel_done"));
  }
  const active = e.status === "published" && !eventIsOver(e);
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/eventos/meus">← {t("sv.ev_mine")}</a>
    <h1 style={{ margin: 0 }}>⚙️ {e.title}</h1>
    <small>{eventRef(e.ref_no)} · 📅 {eventDateIn(e.starts_at, lang)} · {e.status === "draft" ? "📝 " + t("sv.draft") : e.status === "cancelled" ? "❌ " + t("sv.ev_cancelled") : "✅ " + t("sv.published")}{featured ? " · ⭐ " + t("sv.featured_until", { date: formatDateIn(e.featured_until!, lang) }) : ""}</small>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="row">
      <a className="btn secondary" href={`/eventos/${id}`}>👁️ {t("sv.see_page")}</a>
      {e.status !== "cancelled" && <a className="btn secondary" href={`/eventos/${id}/editar`}>✏️ {t("common.edit")}</a>}
      {e.status === "draft" && <button type="button" onClick={() => void publish(true)}>✅ {t("sv.publish")}</button>}
      {e.status === "published" && p.sold === 0 && <button type="button" className="secondary" onClick={() => void publish(false)}>{t("sv.ev_to_draft")}</button>}
    </div>
    <section className="stats" aria-label={t("sv.ev_sales_summary")}>
      <div className="stat"><strong>{p.sold}</strong><span>🎟️ {t("sv.ev_st_sold")}</span></div>
      <div className="stat"><strong>{formatPrice(p.revenue)}</strong><span>💰 {t("sv.ev_st_revenue")}</span></div>
      <div className="stat"><strong>{p.checked_in}</strong><span>🚪 {t("sv.ev_st_in")}</span></div>
    </section>
    {active && <section className="card stack" style={{ gap: 8 }} aria-labelledby="entrada">
      <h2 id="entrada" style={{ margin: 0 }}>🚪 {t("sv.ev_entry")}</h2>
      <form className="row" onSubmit={doCheck}>
        <input aria-label={t("sv.ev_ticket_code")} value={code} onChange={ev => setCode(ev.target.value)} placeholder="HO-XXXX-XXXX" autoCapitalize="characters" style={{ flex: 1, minWidth: 180, fontSize: 22, letterSpacing: 2 }} />
        <button type="submit" disabled={busy}>{t("sv.validate")}</button>
      </form>
      {check && <p role="status" className={check.result === "ok" ? "ok" : "error"} style={{ fontSize: 22, margin: 0 }}>{tc(CHECKIN_LABELS[check.result])}{check.type ? ` · ${check.type}` : ""}{check.holder ? ` · ${check.holder}` : ""}</p>}
      <small>{t("sv.ev_entry_hint")}</small>
    </section>}
    <section className="stack" style={{ gap: 8 }} aria-labelledby="pedidos">
      <h2 id="pedidos" style={{ margin: 0 }}>💳 {t("sv.fu_pay_to_confirm", { n: waiting.length })}</h2>
      {waiting.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("sv.ev_none_waiting")}</p>}
      {waiting.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
        <strong>{o.buyer_name} — {o.quantity} × {o.type_name} = {formatPrice(o.total)}</strong>
        <small>{ticketOrderRef(o.ref_no)} · {o.method ? tc(TICKET_METHOD_LABELS[o.method]) : ""} · {t("sv.reference")}: <strong>{o.reference}</strong>{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</small>
        <div className="row"><button type="button" onClick={() => void decide(o, true)}>✅ {t("sv.got_money")}</button><button type="button" className="secondary" onClick={() => void decide(o, false)}>❌ {t("sv.not_received")}</button></div>
      </article>)}
      {reserved.length > 0 && <details className="card"><summary><strong>⏳ {t("sv.ev_unpaid_res", { n: reserved.length })}</strong></summary>
        {reserved.map(o => <p key={o.id} style={{ margin: "6px 0" }}>{o.buyer_name} — {o.quantity} × {o.type_name} · {formatPrice(o.total)}{o.pay_by ? " · " + t("sv.ev_pay_by", { date: eventDateIn(o.pay_by, lang) }) : ""}</p>)}</details>}
      {p.orders.some(o => o.status === "confirmed") && <details className="card"><summary><strong>✅ {t("sv.ev_confirmed_buyers")}</strong></summary>
        {p.orders.filter(o => o.status === "confirmed").map(o => <p key={o.id} style={{ margin: "6px 0" }}>{o.buyer_name} — {o.quantity} × {o.type_name}{o.buyer_phone ? ` · 📞 ${o.buyer_phone}` : ""}</p>)}</details>}
    </section>
    <section className="card stack" style={{ gap: 8 }} aria-labelledby="comissao">
      <h2 id="comissao" style={{ margin: 0 }}>🧾 {t("sv.ev_fee_title", { pct: p.fee_pct })}</h2>
      <span>{t("sv.total")}: {formatPrice(p.fee_total)} · {t("sv.to_pay")}: <strong>{formatPrice(p.fee_due)}</strong></span>
      {p.fee_pending && <span>⏳ {t("sv.pay_sent_waiting")}</span>}
      {p.fee_due > 0 && !p.fee_pending && (open === "fee" ? <PlatformPayBox eventId={id} uid={uid} kind="fee" amount={p.fee_due} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen("fee")}>{t("sv.ev_pay_fee")}</button>)}
      <small>{t("sv.ev_pay_fee_hint")}</small>
    </section>
    {active && <section className="card stack" style={{ gap: 8 }} aria-labelledby="destaque">
      <h2 id="destaque" style={{ margin: 0 }}>⭐ {t("sv.ev_boost")}</h2>
      <span>{t("sv.ev_boost_text", { price: formatPrice(p.boost_price_kz), days: p.boost_days })}</span>
      {featured && <span className="ok">⭐ {t("sv.featured_until_on", { date: formatDateIn(e.featured_until!, lang) })}</span>}
      {p.boost_pending ? <span>⏳ {t("sv.ev_boost_pending")}</span> : open === "boost"
        ? <PlatformPayBox eventId={id} uid={uid} kind="boost" amount={p.boost_price_kz} settings={settings} onDone={done} onClose={() => setOpen("")} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen("boost")}>{featured ? "⭐ " + t("sv.ev_more_days") : "⭐ " + t("sv.ev_boost_btn")}</button>}
    </section>}
    {p.payments.length > 0 && <details className="card"><summary><strong>{t("sv.ev_payments_ho")}</strong></summary>
      {p.payments.map(x => <p key={x.id} style={{ margin: "6px 0" }}>P-{x.ref_no} · {x.kind === "boost" ? t("sv.ev_boost_days", { n: x.days ?? 0 }) : t("sv.commission")} · {formatPrice(x.amount)} · {x.status === "pending" ? "⏳ " + t("sv.waiting") : x.status === "confirmed" ? t("sv.ve_pay_confirmed") : t("sv.ve_pay_rejected") + (x.admin_note ? ": " + x.admin_note : "")}</p>)}</details>}
    {e.status === "published" && <section className="card stack" style={{ gap: 8 }}>
      {open === "cancel" ? <>
        <label>{t("sv.ev_cancel_reason")}<input value={reason} onChange={ev => setReason(ev.target.value)} maxLength={300} /></label>
        <div className="row"><button type="button" className="danger" disabled={busy || !reason.trim()} onClick={() => void doCancel()}>{t("sv.ev_cancel")}</button><button type="button" className="secondary" onClick={() => setOpen("")}>{t("common.back")}</button></div>
      </> : <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => setOpen("cancel")}>❌ {t("sv.ev_cancel")}</button>}
    </section>}
  </main>;
}

function TicketQr({ code }: { code: string }) {
  const { t } = useT();
  const q = qrSvgPath(ticketVerifyUrl(SITE_URL, code));
  return <svg role="img" aria-label={t("sv.ev_ticket_qr", { code })} viewBox={`-2 -2 ${q.size + 4} ${q.size + 4}`} width={180} height={180} style={{ background: "#fff", borderRadius: 8 }} shapeRendering="crispEdges">
    <path d={q.d} fill="#000" />
  </svg>;
}

/** Os meus bilhetes (comprador). */
export function MyTickets() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyTicketOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myTicketOrders(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🎟️ {t("sv.ev_my_tickets")}</h1><a className="btn" href="/conta/login?voltar=/bilhetes">{t("sv.ev_login_tickets")}</a></main>;
  const fresh = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("novo") : null;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/eventos">← {t("sv.events")}</a>
    <h1 style={{ margin: 0 }}>🎟️ {t("sv.ev_my_tickets")}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.ev_no_tickets_mine")} <a href="/eventos">{t("sv.ev_see_events")}</a>.</p> :
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

/** Página aberta ao ler o QR do bilhete: diz se é verdadeiro; o organizador deixa entrar aqui. */
export function TicketVerify({ code }: { code: string }) {
  const [v, setV] = useState<TicketView | null>(null); const [msg, setMsg] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await ticketByCode(supabase(), code); if (r.error) setError(friendlyError(r.error)); setV(r.data ?? { result: "invalid" }); }
  useEffect(() => { void load(); }, [code]);
  if (!v) return <main><p>A verificar…</p></main>;
  if (v.result !== "ok") return <main className="stack" style={{ maxWidth: 640 }}>
    <h1 style={{ margin: 0 }}>❌ Bilhete não reconhecido</h1>
    <p className="error" role="alert" style={{ fontSize: 20 }}>Este QR não é de nenhum bilhete do Huambo Online. Não deixe entrar.</p>
    <a href="/eventos">← Eventos</a>
  </main>;
  const usable = v.status === "valid" && v.event_status !== "cancelled";
  async function letIn() {
    if (!v?.event_id || !v.code) return;
    setBusy(true); const r = await checkInTicketFn(supabase(), v.event_id, v.code); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setMsg(CHECKIN_TEXT[r.data?.result ?? "invalid"]); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 640 }}>
    <a href={"/eventos/" + v.event_id}>← {v.event_title}</a>
    <h1 style={{ margin: 0 }}>{v.status === "used" ? "⚠️ Bilhete JÁ USADO" : usable ? "✅ Bilhete verdadeiro" : "❌ Bilhete sem efeito"}</h1>
    <p className={usable ? "ok" : "error"} role="status" style={{ fontSize: 20, margin: 0 }}>{v.code} · {v.event_title}{v.starts_at ? " · " + fmtDate(v.starts_at) : ""}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {msg && <p className="ok" role="status">{msg}</p>}
    {v.role === "other" && <p className="card" style={{ margin: 0 }}>Este bilhete existe no Huambo Online. Só o organizador, com a sua conta, vê o nome e deixa entrar. <a href={"/conta/login?voltar=/eventos/bilhete/" + encodeURIComponent(code)}>Entrar</a></p>}
    {v.role !== "other" && <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)", overflowWrap: "anywhere" }}>
      {v.holder && <><dt>Nome</dt><dd>{v.holder}</dd></>}
      {v.type && <><dt>Bilhete</dt><dd>{v.type}</dd></>}
      {v.venue && <><dt>Local</dt><dd>{v.venue}</dd></>}
      {v.checked_in_at && <><dt>Entrou</dt><dd>{fmtDate(v.checked_in_at)}</dd></>}
    </dl>}
    {(v.role === "organizer") && usable && <button type="button" disabled={busy} style={{ fontSize: 22, justifySelf: "start" }} onClick={() => void letIn()}>🚪 Deixar entrar</button>}
  </main>;
}
