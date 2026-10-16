"use client";
import { useEffect, useState } from "react";
import { venueFeed, venueDetail, myVenues, saveVenue, listVenueItems, saveVenueItem, setVenueItemAvailable, deleteVenueItem, reserveVenue, submitVenuePayment,
  decideVenuePayment, completeVenueOrder, cancelVenueOrder, venueOrderByToken, myVenueOrders, venuePanel, submitVenueFee, listVenuesForAdmin, setVenueStatus,
  listVenuePaymentsForAdmin, decideVenueFee, listVenueOrdersForAdmin, listMyBusinesses, validateVenue, validateVenueItem, validateVenueReserve, venueKindFromSlug,
  venueOrderKinds, venuePriceText, venueAvailabilityText, venueFeedBadge, venueOrderSummary, venueFeeBreakdown, venueFeeNotice, venueOwnerFeeNotice, venueVerifyUrl,
  venueTransferNote, venueShareMessage, venueRef, venueOrderRef, nightsBetween, nightsText, dateText, luandaToday, addDays, luandaDateTimeToIso,
  uploadClassifiedMedia, uploadPaymentProof, paymentProofUrl, validateDocument, sha256Hex, getPlatformSettings, qrSvgPath, holdText, formatPrice, friendlyErrorIn, LANG_TAGS,
  whatsappLink, whatsappShareUrl, loadWithCache, isOfflineError, VENUE_KINDS, VENUE_KIND_LIST, VENUE_SUBTYPE_LABELS, VENUE_ORDER_KIND_LABELS, VENUE_METHOD_LABELS,
  VENUE_STATUS_LABELS, VENUE_ORDER_STATUS_LABELS, VENUE_COMPLETE_LABELS, VENUE_ACTIVE_ORDER, VENUE_MAX_PHOTOS, PLAN_METHOD_LABELS,
  type VenueKind, type VenueSubtype, type VenueFeedRow, type VenueDetail, type VenueItem, type VenueOrderKind, type VenueMethod, type VenueStatus, type VenueOrderStatus,
  type MyVenue, type MyVenueOrder, type VenueOrder, type VenuePanel, type VenueOrderView, type VenueCompleteResult, type AdminVenue, type AdminVenuePayment,
  type AdminVenueOrder, type VenueInput, type VenueItemInput, type VenueCartLine, type VenueReserveInput, type PlatformSettings, type PaymentMethodPlan } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { SITE_URL } from "../lib/site";
import { compressPhoto } from "../lib/image";
import { PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";
import { OfflineBanner } from "./Offline";
import { browserStore } from "./Engage";
import { LiteImg } from "./LiteImg";

/** «1 500,5» → 1500.5 */
const toNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));
const box = { width: 24, height: 24, flex: "none" } as const;
const PAYMENT_STATUS_KEYS: Record<string, string> = { pending: "sv.ve_pay_pending", confirmed: "sv.ve_pay_confirmed", rejected: "sv.ve_pay_rejected" };
const LIVE: VenueOrderStatus[] = ["reserved", "submitted", "paid"];

/** QR único do pedido: leva ao site, que confirma se é verdadeiro. Por baixo, o código para escrever à mão. */
function VenueCode({ code, token }: { code: string; token?: string | null }) {
  const { t } = useT();
  const q = qrSvgPath(token ? venueVerifyUrl(SITE_URL, token) : code);
  return <div className="card" style={{ justifyItems: "center", textAlign: "center", gap: 6 }}>
    <svg role="img" aria-label={t("sv.fu_qr_code", { code })} viewBox={`-2 -2 ${q.size + 4} ${q.size + 4}`} width={170} height={170} style={{ background: "#fff", borderRadius: 8 }} shapeRendering="crispEdges"><path d={q.d} fill="#000" /></svg>
    <strong style={{ fontSize: 26, letterSpacing: 3 }}>{code}</strong>
    <small>{t("sv.ve_qr_show")}</small>
  </div>;
}
async function openProof(path: string, onError: (m: string) => void, failMsg: string) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) window.open(r.data, "_blank", "noopener"); else onError(failMsg);
}
async function uploadPhotos(uid: string, files: File[], failMsg: string): Promise<string[]> {
  const urls: string[] = [];
  for (const f of files) {
    const small = await compressPhoto(f);
    const r = await uploadClassifiedMedia(supabase(), small, uid, small.name, small.type || "image/jpeg");
    if (r.error || !r.data) throw r.error ?? new Error(failMsg);
    urls.push(r.data);
  }
  return urls;
}
function Choice<T extends string>({ value, options, label, onChange }: { value: T; options: [T, string][]; label: string; onChange: (v: T) => void }) {
  return <div className="row" role="radiogroup" aria-label={label}>{options.map(([k, l]) =>
    <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? "" : "secondary"} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

// --- Lista pública -----------------------------------------------------------------------------
export function VenueList() {
  const { lang, t, tc } = useT();
  const [kind, setKind] = useState<VenueKind | null>(null); const [query, setQuery] = useState(""); const [municipalityId, setMunicipalityId] = useState("");
  const { municipalities } = useTerritory(); const [rows, setRows] = useState<VenueFeedRow[] | null>(null); const [error, setError] = useState("");
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  useEffect(() => { setKind(venueKindFromSlug(new URLSearchParams(window.location.search).get("tipo")) ?? "hotel"); }, []);
  async function load(k: VenueKind, q = query) {
    setRows(null);
    // Guarda a última lista para a mostrar sem rede (com o aviso de que pode ter mudado).
    const r = await loadWithCache<VenueFeedRow[]>(browserStore, `reservas:${k}:${municipalityId}:${q.trim()}`, () => venueFeed(supabase(), k, { municipalityId, query: q }));
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: r.fromCache ? r.savedAt : null });
    if (r.error && !r.data) { if (!isOfflineError(r.error)) setError(friendlyErrorIn(r.error, lang)); setRows([]); } else { setError(""); setRows(r.data); }
  }
  useEffect(() => { if (kind) void load(kind); }, [kind, municipalityId]);
  function pick(k: VenueKind) { setKind(k); try { window.history.replaceState(null, "", "/reservas?tipo=" + VENUE_KINDS[k].slug); } catch { /* sem histórico */ } }
  const K = kind ? VENUE_KINDS[kind] : null;
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>🛎️ {t("nav.bookings")}</h1>
      <div className="row"><a className="btn secondary" href="/reservas/minhas">🛎️ {t("sv.fu_my_orders")}</a><a className="btn secondary" href="/reservas/painel">🏨 {t("sv.ve_register_manage")}</a></div>
    </div>
    <p className="muted" style={{ margin: 0 }}>{t("sv.ve_intro")}</p>
    <div className="row" role="tablist" aria-label={t("sv.type")}>{VENUE_KIND_LIST.map(k =>
      <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "" : "secondary"} style={{ flex: "1 1 180px", fontSize: 18 }} onClick={() => pick(k)}>{VENUE_KINDS[k].icon} {tc(VENUE_KINDS[k].label)}</button>)}</div>
    <form className="row" style={{ alignItems: "end" }} onSubmit={e => { e.preventDefault(); if (kind) void load(kind); }}>
      <label style={{ flex: 2, minWidth: 200 }}>{t("nav.search")}<input value={query} onChange={e => setQuery(e.target.value)} placeholder={t("sv.ve_search_ph")} /></label>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.municipality")}<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">{t("sv.all")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button type="submit">🔎 {t("nav.search")}</button>
    </form>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    {error && <p className="error" role="alert">{error}</p>}
    {rows === null || !K ? <p>{t("common.loading")}</p> : rows.length === 0 ? <p className="card">{t("sv.ve_none_here", { kind: tc(K.label).toLowerCase() })} <a href="/reservas/painel">{t("sv.ve_register_it")}</a>.</p> :
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>{rows.map(r => <a key={r.id} href={"/reservas/" + r.id} className="card" style={{ color: "inherit", textDecoration: "none", gap: 6, fontWeight: 400 }}>
        {(r.photo || r.logo_url) ? <LiteImg src={(r.photo || r.logo_url)!} alt="" loading="lazy" placeholder={K.icon} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }} />
          : <span aria-hidden style={{ height: 110, borderRadius: 12, background: "var(--surface)", display: "grid", placeItems: "center", fontSize: 48 }}>{K.icon}</span>}
        <strong style={{ fontSize: 19 }}>{r.name}{r.verified ? " ✔️" : ""}</strong>
        <small>{tc(VENUE_SUBTYPE_LABELS[r.subtype])}{r.municipality_name ? " · " + r.municipality_name : ""}</small>
        <span style={{ fontWeight: 700 }}>{tc(venueFeedBadge(r))}</span>
        {r.price_from != null && <span className="price" style={{ fontSize: 18 }}>{t("sv.from_price", { price: formatPrice(r.price_from) })}</span>}
      </a>)}</div>}
  </main>;
}

// --- Página do estabelecimento ------------------------------------------------------------------
export function VenuePage({ id }: { id: string }) {
  const { lang, t, tc } = useT();
  const today = luandaToday();
  const [from, setFrom] = useState(today); const [to, setTo] = useState(addDays(today, 1));
  const [v, setV] = useState<VenueDetail | null | undefined>(undefined); const [uid, setUid] = useState<string | null>(null); const [error, setError] = useState("");
  const [room, setRoom] = useState(""); const [cart, setCart] = useState<Record<string, string>>({}); const [orderKind, setOrderKind] = useState<VenueOrderKind | null>(null);
  async function load() { const r = await venueDetail(supabase(), id, from, to); if (r.error) setError(friendlyErrorIn(r.error, lang)); else setError(""); setV(r.data); }
  useEffect(() => { void load(); }, [id, from, to]);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  if (v === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!v) return <main className="stack"><h1>{t("sv.ve_not_found")}</h1>{error && <p className="error">{error}</p>}<a href="/reservas">← {t("nav.bookings")}</a></main>;
  const K = VENUE_KINDS[v.kind]; const b = v.business; const mine = uid === v.owner_id;
  const kinds = venueOrderKinds(v.kind); const ok = orderKind && kinds.includes(orderKind) ? orderKind : kinds[0];
  const canOrder = v.status === "approved" && v.accepts_reservations && !mine;
  const nights = nightsBetween(from, to);
  const lines: VenueCartLine[] = v.kind === "hotel"
    ? v.items.filter(i => i.id === room).map(i => ({ item: i, qty: Math.max(1, Math.floor(toNum(cart[i.id] ?? "1")) || 1) }))
    : v.items.filter(i => toNum(cart[i.id] ?? "") > 0).map(i => ({ item: i, qty: toNum(cart[i.id]) }));
  const sections = Array.from(new Set(v.items.map(i => i.section?.trim() || "")));
  const wa = whatsappLink(b.whatsapp, t("sv.wa_saw", { name: b.name }));
  const setQty = (itemId: string, q: string) => setCart(c => ({ ...c, [itemId]: q }));
  function changeFrom(d: string) { if (!d) return; setFrom(d); if (to <= d) setTo(addDays(d, 1)); }
  return <main className="stack" style={{ maxWidth: 960 }}>
    <a href={"/reservas?tipo=" + K.slug}>← {tc(K.label)}</a>
    <div className="row" style={{ alignItems: "center", gap: 14, flexWrap: "nowrap" }}>
      {b.logo_url && <img className="profile-pic" src={b.logo_url} alt={t("sv.logo_of", { name: b.name })} />}
      <h1 style={{ margin: 0, overflowWrap: "anywhere" }}>{K.icon} {b.name}{b.verified ? " ✔️" : ""}</h1>
    </div>
    <small className="muted">{tc(VENUE_SUBTYPE_LABELS[v.subtype])} · {venueRef(v.ref_no)}{b.municipality_name ? " · " + b.municipality_name : ""}{b.address_text ? " · " + b.address_text : ""}</small>
    {v.status !== "approved" && <p className="banner yellow" style={{ margin: 0, padding: 14 }}>{v.status === "pending" ? "⏳ " + t("sv.fu_pending_public") : "⛔ " + t("sv.ve_suspended_now")}</p>}
    {mine && <a className="btn" href={`/reservas/${id}/gerir`} style={{ justifySelf: "start" }}>⚙️ {t("sv.ve_manage_mine")}</a>}
    {b.description && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{b.description}</p>}
    <div className="row">
      {b.phone && <a className="btn secondary" href={"tel:" + b.phone.replace(/\s/g, "")}>📞 {t("common.call")}</a>}
      {wa && <a className="btn secondary" href={wa} target="_blank" rel="noopener">WhatsApp</a>}
      <a className="btn secondary" href={whatsappShareUrl(tc(venueShareMessage(typeof window === "undefined" ? SITE_URL : window.location.origin, { id: v.id, name: b.name, kind: v.kind, municipality_name: b.municipality_name })))} target="_blank" rel="noopener">📲 {t("common.share")}</a>
      <a className="btn secondary" href={"/empresas/" + b.id}>⭐ {t("sv.ve_portfolio_reviews")}</a>
    </div>
    {(v.opening_hours || v.check_in_time || v.check_out_time || v.policies) && <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)", overflowWrap: "anywhere" }}>
      {v.opening_hours && <><dt>🕒 {t("sv.mk_hours")}</dt><dd>{v.opening_hours}</dd></>}
      {v.check_in_time && <><dt>{t("sv.ve_check_in")}</dt><dd>{t("sv.ve_from_time", { time: v.check_in_time.slice(0, 5) })}</dd></>}
      {v.check_out_time && <><dt>{t("sv.ve_check_out")}</dt><dd>{t("sv.ve_until_time", { time: v.check_out_time.slice(0, 5) })}</dd></>}
      {v.policies && <><dt>📋 {t("sv.ve_rules")}</dt><dd style={{ whiteSpace: "pre-wrap", fontWeight: 400 }}>{v.policies}</dd></>}
    </dl>}
    <PlaceView directions={b.directions} lat={b.geo_lat} lng={b.geo_lng} />
    {v.kind === "hotel" && <section className="card stack" style={{ gap: 8 }} aria-labelledby="datas">
      <h2 id="datas" style={{ margin: 0, fontSize: 21 }}>📅 {t("sv.ve_which_days")}</h2>
      <div className="row">
        <label style={{ flex: 1, minWidth: 190 }}>{t("sv.ve_in")}<input type="date" value={from} min={today} onChange={e => changeFrom(e.target.value)} /></label>
        <label style={{ flex: 1, minWidth: 190 }}>{t("sv.ve_out")}<input type="date" value={to} min={addDays(from, 1)} onChange={e => e.target.value && setTo(e.target.value)} /></label>
      </div>
      <strong>{nights > 0 ? tc(nightsText(nights)) : t("sv.ve_out_after_in")}</strong>
    </section>}
    {v.kind === "restaurant" && canOrder && <Choice label={t("sv.ve_what_do")} value={ok} onChange={setOrderKind} options={[["table", "🍽️ " + t("sv.ve_book_table")], ["order", "🥡 " + t("sv.ve_order_pickup")]]} />}
    <h2 style={{ margin: 0 }}>{tc(K.items)}</h2>
    {v.items.length === 0 && <p className="card">{tc(K.empty)}</p>}
    {sections.map(sec => <section key={sec || "-"} className="stack" style={{ gap: 8 }} aria-label={sec || tc(K.items)}>
      {sec && <h3 style={{ margin: 0 }}>{sec}</h3>}
      {v.items.filter(i => (i.section?.trim() || "") === sec).map(i => <ItemCard key={i.id} i={i} kind={v.kind}>
        {canOrder && i.available && (v.kind === "hotel" ? (Number(i.free ?? 0) > 0 && <button type="button" className={room === i.id ? "" : "secondary"} aria-pressed={room === i.id} onClick={() => setRoom(room === i.id ? "" : i.id)}>{room === i.id ? "✅ " + t("sv.ve_chosen") : t("sv.ve_choose_room")}</button>)
          : v.kind === "restaurant" ? (i.free == null || i.free > 0) && <div className="row" style={{ alignItems: "center" }} role="group" aria-label={t("sv.ve_qty_of", { name: i.name })}>
              <button type="button" className="secondary" aria-label={t("sv.ve_less", { name: i.name })} onClick={() => setQty(i.id, String(Math.max(0, (toNum(cart[i.id] ?? "") || 0) - 1)))}>−</button>
              <strong style={{ minWidth: 28, textAlign: "center", fontSize: 20 }}>{toNum(cart[i.id] ?? "") || 0}</strong>
              <button type="button" aria-label={t("sv.ve_more", { name: i.name })} onClick={() => setQty(i.id, String((toNum(cart[i.id] ?? "") || 0) + 1))}>+</button>
            </div>
          : (i.free == null || i.free > 0) && <label style={{ maxWidth: 220 }}>{t("sv.ve_quantity")}{i.unit ? ` (${i.unit})` : ""}<input value={cart[i.id] ?? ""} onChange={e => setQty(i.id, e.target.value)} inputMode="decimal" placeholder={t("sv.ve_min", { n: i.min_qty })} /></label>)}
      </ItemCard>)}
    </section>)}
    {!v.accepts_reservations && !mine && <p className="card">{t("sv.ve_no_reservations")}</p>}
    {canOrder && <ReserveForm v={v} uid={uid} kind={ok} lines={lines} from={from} to={to} nights={nights} setRooms={n => setQty(room, String(n))} />}
  </main>;
}

function ItemCard({ i, kind, children }: { i: VenueItem; kind: VenueKind; children?: React.ReactNode }) {
  const { t, tc } = useT();
  return <article className="card" style={{ display: "grid", gridTemplateColumns: i.photos.length ? "minmax(0, 110px) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: 12, opacity: i.available ? 1 : 0.7 }}>
    {i.photos.length > 0 && <LiteImg src={i.photos[0]} alt="" loading="lazy" placeholder="🖼️" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10 }} />}
    <div className="stack" style={{ gap: 6, minWidth: 0 }}>
      <strong style={{ fontSize: 19, overflowWrap: "anywhere" }}>{i.name}</strong>
      {i.description && <span style={{ overflowWrap: "anywhere" }}>{i.description}</span>}
      <span className="price" style={{ fontSize: 19 }}>{tc(venuePriceText(i, kind))}</span>
      {kind === "hotel" && i.capacity && <small>👥 {t(i.capacity === 1 ? "sv.ve_cap_one" : "sv.ve_cap_many", { n: i.capacity })}</small>}
      {kind === "warehouse" && i.min_qty > 1 && <small>{t("sv.ve_min_order")}: {i.min_qty}{i.unit ? " " + i.unit : ""}</small>}
      <span style={{ fontWeight: 700 }}>{tc(venueAvailabilityText(i, kind))}</span>
      {i.photos.length > 1 && <div className="row" style={{ gap: 6 }}>{i.photos.slice(1).map(p => <a key={p} href={p} target="_blank" rel="noopener"><LiteImg src={p} alt={t("sv.ve_more_photo", { name: i.name })} loading="lazy" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} /></a>)}</div>}
      {children}
    </div>
  </article>;
}

function ReserveForm({ v, uid, kind, lines, from, to, nights, setRooms }: { v: VenueDetail; uid: string | null; kind: VenueOrderKind; lines: VenueCartLine[]; from: string; to: string; nights: number; setRooms: (n: number) => void }) {
  const { lang, t, tc } = useT();
  const methods = (["at_place", "prepaid"] as VenueMethod[]).filter(m => m === "at_place" ? v.accepts_pay_at_place : v.accepts_prepay);
  const [method, setMethod] = useState<VenueMethod>(methods[0] ?? "at_place"); const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [note, setNote] = useState("");
  const [guests, setGuests] = useState(v.kind === "hotel" ? "1" : "2"); const [date, setDate] = useState(luandaToday()); const [time, setTime] = useState("");
  const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  if (!uid) return <a className="btn" style={{ justifySelf: "start", fontSize: 20 }} href={"/conta/login?voltar=/reservas/" + v.id}>{t("sv.fu_login_reserve")}</a>;
  const sum = venueFeeBreakdown(lines.map(l => ({ price: l.item.price, qty: l.qty })), v.client_fee_pct, v.business_fee_pct, kind === "stay" ? nights : 1);
  const room = kind === "stay" ? lines[0] : undefined;
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const input: VenueReserveInput = { kind, method, name, phone, note, lines, checkIn: from, checkOut: to, guests: kind === "order" ? undefined : Number(guests) || 0,
      slotAt: kind === "stay" ? null : luandaDateTimeToIso(date, time) };
    const bad = validateVenueReserve(v, input); if (bad) { setError(tc(bad)); return; }
    if (!agree) { setError(t("sv.fu_confirm_fee")); return; }
    setBusy(true); setError("");
    const r = await reserveVenue(supabase(), v.id, input); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else window.location.href = "/reservas/minhas";
  }
  return <form className="card stack" style={{ gap: 10 }} onSubmit={send} aria-labelledby="reservar">
    <h2 id="reservar" style={{ margin: 0 }}>{tc(VENUE_ORDER_KIND_LABELS[kind])}</h2>
    {kind === "stay" && (room ? <>
      <strong>{room.item.name} · {dateText(from)} → {dateText(to)} ({tc(nightsText(nights))})</strong>
      <div className="row">
        <div className="stack" style={{ flex: 1, minWidth: 140, gap: 4 }}><strong>{t("sv.ve_how_many_rooms")}</strong>
          <span className="row" style={{ alignItems: "center" }} role="group" aria-label={t("sv.ve_how_many_rooms")}>
            <button type="button" className="secondary" aria-label={t("sv.ve_one_less_room")} disabled={room.qty <= 1} onClick={() => setRooms(room.qty - 1)}>−</button>
            <strong style={{ minWidth: 28, textAlign: "center", fontSize: 20 }}>{room.qty}</strong>
            <button type="button" aria-label={t("sv.ve_one_more_room")} disabled={room.qty >= Number(room.item.free ?? 1)} onClick={() => setRooms(room.qty + 1)}>+</button>
          </span></div>
        <label style={{ flex: 1, minWidth: 140 }}>{t("sv.ve_how_many_people")}<input value={guests} onChange={e => setGuests(e.target.value)} inputMode="numeric" /></label>
      </div>
    </> : <p style={{ margin: 0 }}>👆 {t("sv.ve_choose_room_first")}</p>)}
    {kind !== "stay" && <>
      {lines.length > 0 ? <ul style={{ margin: 0, paddingLeft: 20 }}>{lines.map(l => <li key={l.item.id}>{l.qty} × {l.item.name} — {formatPrice(Math.round(l.item.price * l.qty))}</li>)}</ul>
        : <p style={{ margin: 0 }}>{kind === "table" ? t("sv.ve_dishes_opt") : "👆 " + t("sv.ve_choose_order")}</p>}
      {kind === "table" && <label>{t("sv.ve_table_for")}<input value={guests} onChange={e => setGuests(e.target.value)} inputMode="numeric" /></label>}
      <div className="row">
        <label style={{ flex: 1, minWidth: 190 }}>{kind === "table" ? t("sv.ve_day") : t("sv.ve_pickup_day")}<input type="date" value={date} min={luandaToday()} onChange={e => setDate(e.target.value)} /></label>
        <label style={{ flex: 1, minWidth: 150 }}>{t("sv.ve_time")}<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
      </div>
    </>}
    <label>{t("sv.your_name")}<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
    <label>{t("auth.phone")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} autoComplete="tel" /></label>
    <label>{t("sv.ve_note")}<textarea rows={2} value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder={kind === "stay" ? t("sv.ve_note_ph_stay") : kind === "table" ? t("sv.ve_note_ph_table") : t("sv.ve_note_ph_order")} /></label>
    {methods.length > 1 ? <Choice label={t("sv.fu_how_pay")} value={method} onChange={setMethod} options={methods.map(m => [m, tc(VENUE_METHOD_LABELS[m])] as [VenueMethod, string])} />
      : <strong>💳 {tc(VENUE_METHOD_LABELS[method])}</strong>}
    {sum.subtotal > 0 && <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, 1fr) auto" }} aria-label={t("sv.fu_sums")}>
      <dt>{kind === "stay" ? t("sv.ve_rooms_nights", { nights: tc(nightsText(nights)) }) : t("sv.mk_products")}</dt><dd>{formatPrice(sum.subtotal)}</dd>
      <dt>{t("sv.fu_fee_line", { pct: v.client_fee_pct })}</dt><dd>{formatPrice(sum.clientFee)}</dd>
      <dt><strong>{t("sv.ve_total_venue")}</strong></dt><dd><strong>{formatPrice(sum.total)}</strong></dd>
    </dl>}
    <label className="row" style={{ alignItems: "flex-start", gap: 8, fontWeight: 400 }}><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={box} />
      <span>{tc(venueFeeNotice(v.client_fee_pct))} {t("sv.fu_agree")}</span></label>
    <small>{method === "at_place" ? t("sv.ve_at_place_hint", { h: (Math.round(v.hold_minutes / 60 * 10) / 10).toLocaleString(LANG_TAGS[lang]) })
      : t("sv.ve_prepaid_hint")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="submit" disabled={busy} style={{ justifySelf: "start", fontSize: 20 }}>{busy ? t("sv.fu_reserving") : kind === "order" ? "✅ " + t("sv.ve_order") : "✅ " + t("sv.fu_reserve")}</button>
  </form>;
}
// --- As minhas reservas -------------------------------------------------------------------------
export function MyVenueOrders() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyVenueOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myVenueOrders(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🛎️ {t("sv.fu_my_orders")}</h1><a className="btn" style={{ justifySelf: "start" }} href="/conta/login?voltar=/reservas/minhas">{t("auth.login")}</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/reservas">← {t("nav.bookings")}</a>
    <h1 style={{ margin: 0 }}>🛎️ {t("sv.fu_my_orders")}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.fu_no_orders")} <a href="/reservas">{t("sv.ve_see_all_kinds")}</a>.</p> :
      items.map(o => <MyOrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </main>;
}
function MyOrderCard({ o, onDone, onError }: { o: MyVenueOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  async function pay() {
    if (!file) { onError(t("sv.fu_need_proof")); return; }
    const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { onError(tc(bad)); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError(t("sv.fu_need_ref")); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(t("sv.login_needed"));
      const hash = sha256Hex(await file.arrayBuffer());
      const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail"));
      const r = await submitVenuePayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone(t("sv.ve_proof_sent"));
    } catch (e) { onError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  async function cancel() { if (!confirm(t("sv.fu_cancel_q"))) return; const r = await cancelVenueOrder(supabase(), o.id); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(t("sv.fu_cancelled")); }
  const payNow = o.method === "prepaid" && (o.status === "awaiting_payment" || o.status === "rejected");
  return <article className="card stack" style={{ gap: 8 }}>
    <a href={"/reservas/" + o.venue_id} style={{ fontWeight: 800, fontSize: 19 }}>{VENUE_KINDS[o.venue_kind].icon} {o.venue_name}</a>
    <small>{venueOrderRef(o.ref_no)} · {tc(VENUE_ORDER_KIND_LABELS[o.kind])} · {tc(VENUE_METHOD_LABELS[o.method]).split(" (")[0].split("（")[0]}</small>
    <span style={{ overflowWrap: "anywhere" }}>{tc(venueOrderSummary(o))}</span>
    {o.total > 0 && <span><strong>{formatPrice(o.total)}</strong>{o.client_fee > 0 ? " " + t("sv.fu_fee_paren", { sub: formatPrice(o.subtotal), fee: formatPrice(o.client_fee) }) : ""}</span>}
    <strong>{tc(VENUE_ORDER_STATUS_LABELS[o.status])}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · " + t("sv.ve_held") + " " + tc(holdText(o.hold_until)) : ""}</strong>
    {o.note && (o.status === "rejected" || o.status === "cancelled") && <span className="error">{t("sv.reason")}: {o.note}</span>}
    {o.code && LIVE.includes(o.status) && <VenueCode code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <small>{t("sv.ve_submitted_hint")}</small>}
    {o.status === "reserved" && o.method === "at_place" && <small>{t("sv.ve_pay_on_arrival")}</small>}
    {(o.address_text || o.phone) && <small>{o.address_text ? "📍 " + o.address_text : ""}{o.address_text && o.phone ? " · " : ""}{o.phone ? <a href={"tel:" + o.phone.replace(/\s/g, "")}>📞 {o.phone}</a> : null}</small>}
    {payNow && <div className="stack" style={{ gap: 8 }}>
      <strong>1. {t("sv.ve_pay_step", { total: formatPrice(o.total) })}{o.pay_by ? " " + tc(holdText(o.pay_by)) : ""}</strong>
      <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)" }}>
        {o.pay_holder && <><dt>{t("sv.holder")}</dt><dd>{o.pay_holder}</dd></>}
        {o.pay_iban && <><dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{o.pay_iban}</strong></dd></>}
        {o.pay_express && <><dt>Multicaixa Express</dt><dd><strong>{o.pay_express}</strong></dd></>}
      </dl>
      {o.pay_note && <span>{o.pay_note}</span>}
      <p className="banner yellow" style={{ margin: 0, padding: 12, display: "block" }}>✍️ {tc(venueTransferNote(o.ref_no))}<br />⚠️ {t("sv.ve_pay_warn")}</p>
      <strong>2. {t("sv.fu_send_proof")}</strong>
      <Choice label={t("sv.how_paid")} value={method} onChange={setMethod} options={(["multicaixa_express", "bank_transfer"] as const).map(m => [m, tc(PLAN_METHOD_LABELS[m])] as ["multicaixa_express" | "bank_transfer", string])} />
      <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
      <label>{t("sv.fu_proof_required")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button type="button" disabled={busy} onClick={() => void pay()} style={{ justifySelf: "start" }}>{busy ? t("sv.sending") : "✅ " + t("sv.fu_paid_send")}</button>
    </div>}
    {(o.status === "reserved" || o.status === "awaiting_payment" || o.status === "rejected") && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void cancel()}>{t("sv.fu_cancel_btn")}</button>}
  </article>;
}

// --- Registar / editar o estabelecimento ---------------------------------------------------------
type BizOption = { id: string; name: string };
function VenueForm({ uid, businesses, existing, onSaved }: { uid: string; businesses: BizOption[]; existing?: MyVenue; onSaved: (id: string, msg: string) => void }) {
  const [businessId, setBusinessId] = useState(existing?.business_id ?? businesses[0]?.id ?? ""); const [kind, setKind] = useState<VenueKind>(existing?.kind ?? "hotel");
  const [subtype, setSubtype] = useState<VenueSubtype>(existing?.subtype ?? "hotel"); const [reserv, setReserv] = useState(existing?.accepts_reservations ?? true);
  const [atPlace, setAtPlace] = useState(existing?.accepts_pay_at_place ?? true); const [prepay, setPrepay] = useState(existing?.accepts_prepay ?? false);
  const [hold, setHold] = useState(String(existing?.hold_minutes ?? 120)); const [checkIn, setCheckIn] = useState(existing?.check_in_time?.slice(0, 5) ?? "");
  const [checkOut, setCheckOut] = useState(existing?.check_out_time?.slice(0, 5) ?? ""); const [hours, setHours] = useState(existing?.opening_hours ?? "");
  const [policies, setPolicies] = useState(existing?.policies ?? "");
  const [pay, setPay] = useState({ holder: existing?.pay?.holder ?? "", iban: existing?.pay?.iban ?? "", express: existing?.pay?.express ?? "", note: existing?.pay?.note ?? "" });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const input: VenueInput = { businessId, kind, subtype, acceptsReservations: reserv, acceptsPayAtPlace: atPlace, acceptsPrepay: prepay, holdMinutes: Number(hold),
      checkInTime: kind === "hotel" ? checkIn : "", checkOutTime: kind === "hotel" ? checkOut : "", openingHours: hours, policies, pay };
    const bad = validateVenue(input); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    const r = await saveVenue(supabase(), uid, input, existing?.id); setBusy(false);
    if (r.error || !r.data) setError(friendlyError(r.error)); else onSaved(r.data.id, existing ? "Guardado." : "Registado! A administração vai confirmar antes de aparecer ao público.");
  }
  return <form className="card stack" onSubmit={save}>
    {existing ? <p className="muted" style={{ margin: 0 }}>⚠️ Se mudar a conta para pagamentos, o estabelecimento volta a ficar à espera de aprovação da administração (para evitar burlas).</p>
      : <p className="muted" style={{ margin: 0 }}>A administração confirma o estabelecimento antes de aparecer ao público (para evitar estabelecimentos falsos). O nome, a morada, as fotografias e as avaliações vêm da sua empresa.</p>}
    {!existing && <label>A sua empresa<select value={businessId} onChange={e => setBusinessId(e.target.value)}>{businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
    {!existing && <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}><legend style={{ fontWeight: 700, marginBottom: 6 }}>O que é?</legend>
      <Choice label="O que é" value={kind} onChange={k => { setKind(k); setSubtype(VENUE_KINDS[k].subtypes[0]); }} options={VENUE_KIND_LIST.map(k => [k, `${VENUE_KINDS[k].icon} ${VENUE_KINDS[k].label}`] as [VenueKind, string])} />
    </fieldset>}
    <div className="chips" role="radiogroup" aria-label="Tipo de estabelecimento">{VENUE_KINDS[kind].subtypes.map(s =>
      <button key={s} type="button" role="radio" aria-checked={subtype === s} className={"chip" + (subtype === s ? " on" : "")} onClick={() => setSubtype(s)}>{VENUE_SUBTYPE_LABELS[s]}</button>)}</div>
    <label>Horário (opcional)<input value={hours} onChange={e => setHours(e.target.value)} maxLength={120} placeholder={kind === "hotel" ? "Ex.: Receção 24 horas" : "Ex.: Seg. a Sáb., 8h–22h"} /></label>
    {kind === "hotel" && <div className="row">
      <label style={{ flex: 1, minWidth: 140 }}>Hora de entrada (check-in)<input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} /></label>
      <label style={{ flex: 1, minWidth: 140 }}>Hora de saída (check-out)<input type="time" value={checkOut} onChange={e => setCheckOut(e.target.value)} /></label>
    </div>}
    <label>Regras (opcional)<textarea rows={3} value={policies} onChange={e => setPolicies(e.target.value)} maxLength={600} placeholder="Ex.: Não se aceitam animais. Cancelamento grátis até 24 h antes." /></label>
    <fieldset className="card stack" style={{ gap: 8 }}><legend style={{ fontWeight: 700 }}>🛎️ Reservas e pagamentos</legend>
      <label className="row" style={{ alignItems: "center", fontWeight: 400 }}><input type="checkbox" checked={reserv} onChange={e => setReserv(e.target.checked)} style={box} /> Aceito reservas e encomendas pelo Huambo Online</label>
      <label className="row" style={{ alignItems: "center", fontWeight: 400 }}><input type="checkbox" checked={atPlace} onChange={e => setAtPlace(e.target.checked)} style={box} /> O cliente pode pagar no local</label>
      <label className="row" style={{ alignItems: "center", fontWeight: 400 }}><input type="checkbox" checked={prepay} onChange={e => setPrepay(e.target.checked)} style={box} /> Aceito pagamento adiantado (Multicaixa Express ou transferência)</label>
      <label>Tempo de tolerância (minutos depois da hora marcada)<input value={hold} onChange={e => setHold(e.target.value)} inputMode="numeric" /></label>
      {prepay && <>
        <label>Titular da conta<input value={pay.holder} onChange={e => setPay({ ...pay, holder: e.target.value })} maxLength={80} /></label>
        <label>IBAN<input value={pay.iban} onChange={e => setPay({ ...pay, iban: e.target.value })} maxLength={40} placeholder="AO06 …" /></label>
        <label>Multicaixa Express<input value={pay.express} onChange={e => setPay({ ...pay, express: e.target.value })} inputMode="tel" maxLength={20} /></label>
        <label>Nota para quem paga (opcional)<input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} maxLength={200} /></label>
      </>}
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="submit" disabled={busy} style={{ justifySelf: "start", fontSize: 20 }}>{busy ? "A gravar…" : existing ? "💾 Guardar" : "✅ Registar estabelecimento"}</button>
  </form>;
}

/** Os meus estabelecimentos + registar um novo. */
export function VenueDashboard() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [venues, setVenues] = useState<MyVenue[] | null>(null); const [biz, setBiz] = useState<BizOption[]>([]);
  const [open, setOpen] = useState(false); const [error, setError] = useState("");
  async function load(u: string) {
    const [a, b] = await Promise.all([myVenues(supabase()), listMyBusinesses(supabase(), u)]);
    if (a.error || b.error) setError(friendlyError(a.error ?? b.error));
    setVenues(a.data); setBiz(((b.data ?? []) as BizOption[]).map(x => ({ id: x.id, name: x.name })));
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(u); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🏨 O meu estabelecimento</h1><p>Hotel, hospedaria, restaurante ou armazém? Mostre o que tem e receba reservas e encomendas.</p><a className="btn" style={{ justifySelf: "start" }} href="/conta/login?voltar=/reservas/painel">Entrar</a></main>;
  const free = biz.filter(b => !venues?.some(v => v.business_id === b.id));
  return <main className="stack" style={{ maxWidth: 860 }}>
    <a href="/reservas">← Reservas</a>
    <h1 style={{ margin: 0 }}>🏨 Os meus estabelecimentos</h1>
    <p className="muted" style={{ margin: 0 }}>Registar é grátis. Em cada pedido concluído, o cliente paga mais 5% e o estabelecimento dá 5% do seu preço: entrega os 10% ao Huambo Online.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {venues === null ? <p>A carregar…</p> : venues.length === 0 ? <p className="card">Ainda não registou nenhum estabelecimento.</p> :
      venues.map(v => <a key={v.id} href={`/reservas/${v.id}/gerir`} className="card" style={{ color: "inherit", textDecoration: "none", gap: 4, fontWeight: 400 }}>
        <strong style={{ fontSize: 19 }}>{VENUE_KINDS[v.kind].icon} {v.business_name}</strong>
        <small>{venueRef(v.ref_no)} · {VENUE_SUBTYPE_LABELS[v.subtype]} · {VENUE_STATUS_LABELS[v.status]}</small>
        {v.admin_note && v.status !== "approved" && <small className="error">Nota da administração: {v.admin_note}</small>}
        <span className="btn secondary" style={{ justifySelf: "start" }}>⚙️ Gerir</span>
      </a>)}
    <h2 style={{ margin: 0 }}>➕ Registar estabelecimento</h2>
    {biz.length === 0 ? <div className="card stack" style={{ gap: 8 }}>
      <span>Primeiro registe a sua empresa (nome, morada, telefone, fotografias). O estabelecimento fica ligado a ela, com o portfólio e as avaliações.</span>
      <a className="btn" style={{ justifySelf: "start" }} href="/conta/empresas">🏢 Registar a minha empresa</a>
    </div> : free.length === 0 ? <p className="card">Todas as suas empresas já têm estabelecimento. Para outro, <a href="/conta/empresas">registe outra empresa</a>.</p>
      : open ? <VenueForm uid={uid} businesses={free} onSaved={id => { window.location.href = `/reservas/${id}/gerir`; }} />
      : <button type="button" style={{ justifySelf: "start", fontSize: 20 }} onClick={() => setOpen(true)}>🏨 Registar hotel, restaurante ou armazém</button>}
  </main>;
}

// --- Painel do dono -------------------------------------------------------------------------------
export function VenueManage({ id }: { id: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [venue, setVenue] = useState<MyVenue | null | undefined>(undefined);
  const [panel, setPanel] = useState<VenuePanel | null>(null); const [items, setItems] = useState<VenueItem[]>([]); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [code, setCode] = useState(""); const [check, setCheck] = useState<VenueCompleteResult | null>(null); const [filter, setFilter] = useState<"active" | "all">("active");
  const [payOpen, setPayOpen] = useState(false); const [editOpen, setEditOpen] = useState(false); const [itemForm, setItemForm] = useState<VenueItem | "new" | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c, s] = await Promise.all([myVenues(supabase()), venuePanel(supabase(), id), listVenueItems(supabase(), id), getPlatformSettings(supabase())]);
    setVenue(a.data.find(x => x.id === id) ?? null); setItems(c.data); setSettings(s.data);
    if (b.error) setError(friendlyError(b.error)); else setPanel(b.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><a className="btn" style={{ justifySelf: "start" }} href={`/conta/login?voltar=/reservas/${id}/gerir`}>Entrar</a></main>;
  if (venue === null) return <main className="stack"><p className="error">Este estabelecimento não é seu ou não existe.</p><a href="/reservas/painel">← Os meus estabelecimentos</a></main>;
  if (!venue || !panel) return <main className="stack"><p className={error ? "error" : ""}>{error || "A carregar…"}</p><a href="/reservas/painel">← Os meus estabelecimentos</a></main>;
  const K = VENUE_KINDS[venue.kind];
  const done = (m: string) => { setNotice(m); setError(""); void load(); };
  async function doCheck(e: React.FormEvent) {
    e.preventDefault(); if (!code.trim()) return; setCheck(null);
    const r = await completeVenueOrder(supabase(), id, code);
    if (r.error) setError(friendlyError(r.error)); else { setError(""); setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: VenueOrder, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (o cliente vai ler)") ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirma que recebeu ${formatPrice(o.total)} de ${o.buyer_name}?`)) return;
    const r = await decideVenuePayment(supabase(), o.id, ok, note); if (r.error) setError(friendlyError(r.error)); else done(ok ? "Pagamento confirmado." : "Pagamento recusado.");
  }
  async function cancel(o: VenueOrder) {
    const why = prompt("Porque cancela? (o cliente vai ler)") ?? ""; if (!why.trim()) return;
    const r = await cancelVenueOrder(supabase(), o.id, why); if (r.error) setError(friendlyError(r.error)); else done("Pedido cancelado. Se o cliente já pagou, devolva o dinheiro.");
  }
  const waiting = panel.orders.filter(o => o.status === "submitted");
  const shown = filter === "active" ? panel.orders.filter(o => VENUE_ACTIVE_ORDER.includes(o.status)) : panel.orders;
  const checkSummary = check?.result === "ok" && check.kind ? venueOrderSummary({ kind: check.kind, guests: check.guests ?? null, check_in: check.check_in ?? null, check_out: check.check_out ?? null, slot_at: check.slot_at ?? null, lines: check.lines ?? [] }) : "";
  return <main className="stack" style={{ maxWidth: 960 }}>
    <a href="/reservas/painel">← Os meus estabelecimentos</a>
    <h1 style={{ margin: 0 }}>⚙️ {K.icon} {venue.business_name}</h1>
    <small>{venueRef(venue.ref_no)} · {VENUE_SUBTYPE_LABELS[venue.subtype]} · {VENUE_STATUS_LABELS[venue.status]}</small>
    {venue.status !== "approved" && <p className="banner yellow" style={{ margin: 0, padding: 14, display: "block" }}>
      {venue.status === "pending" ? "⏳ À espera de aprovação da administração. Entretanto, junte já os " + K.items.toLowerCase() + " com fotografias." : "⛔ Suspenso: não aparece ao público nem recebe pedidos."}
      {venue.admin_note ? <><br />Nota da administração: <strong>{venue.admin_note}</strong></> : null}</p>}
    <div className="row"><a className="btn secondary" href={`/reservas/${id}`}>👁️ Ver a página</a><a className="btn secondary" href={`/empresas/${venue.business_id}`}>🏢 Página da empresa</a>
      <button type="button" className="secondary" aria-expanded={editOpen} onClick={() => setEditOpen(!editOpen)}>✏️ Mudar dados e conta</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {editOpen && <VenueForm uid={uid} businesses={[]} existing={venue} onSaved={(_, m) => { setEditOpen(false); done(m); }} />}

    <section className="card stack" style={{ gap: 8 }} aria-labelledby="entrada">
      <h2 id="entrada" style={{ margin: 0 }}>🔳 Confirmar entrada / entrega</h2>
      <small>Leia o QR do cliente com a câmara do telemóvel (abre a página que confirma se é verdadeiro) ou escreva aqui o código.</small>
      <form className="row" onSubmit={doCheck}>
        <input aria-label="Código do pedido" value={code} onChange={e => setCode(e.target.value)} placeholder="RV-XXXXXX" autoCapitalize="characters" style={{ flex: 1, minWidth: 180, fontSize: 22, letterSpacing: 2 }} />
        <button type="submit">Confirmar</button>
      </form>
      {check && <p role="status" className={check.result === "ok" ? "ok" : "error"} style={{ fontSize: 22, margin: 0, fontWeight: 800 }}>{VENUE_COMPLETE_LABELS[check.result] ?? check.result}
        {check.buyer ? <><br /><span style={{ fontSize: 18 }}>{check.buyer}{checkSummary ? " · " + checkSummary : ""}</span></> : null}
        {check.result === "ok" && check.total != null ? <><br /><span style={{ fontSize: 18 }}>{check.method === "prepaid" ? "JÁ PAGO" : `Cobrar ${formatPrice(check.total)} (inclui a taxa do APP)`}</span></> : null}</p>}
    </section>

    {waiting.length > 0 && <section className="stack" style={{ gap: 8 }}><h2 style={{ margin: 0 }}>💳 Pagamentos por confirmar ({waiting.length})</h2>
      {waiting.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
        <strong>{o.buyer_name} — {formatPrice(o.total)}</strong>
        <small>{venueOrderRef(o.ref_no)} · {o.pay_method ? PLAN_METHOD_LABELS[o.pay_method as PaymentMethodPlan] : ""} · Ref.: <strong>{o.reference}</strong>{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</small>
        <span>{venueOrderSummary(o)}</span>
        <small>Veja na sua conta se entrou {formatPrice(o.total)} com o descritivo {venueOrderRef(o.ref_no)}. Inclui {formatPrice(o.client_fee)} de taxa do APP.</small>
        <div className="row">{o.proof_path && <button type="button" className="secondary" onClick={() => void openProof(o.proof_path!, setError)}>📄 Ver comprovativo</button>}
          <button type="button" onClick={() => void decide(o, true)}>✅ Recebi o dinheiro</button><button type="button" className="secondary" onClick={() => void decide(o, false)}>❌ Não recebi</button></div>
      </article>)}</section>}

    <section className="stack" style={{ gap: 8 }} aria-labelledby="pedidos">
      <h2 id="pedidos" style={{ margin: 0 }}>🧾 Reservas e encomendas</h2>
      <div className="chips" role="group" aria-label="Mostrar">{([["active", "Ativas"], ["all", "Todas"]] as const).map(([k, l]) =>
        <button key={k} type="button" className={"chip" + (filter === k ? " on" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {shown.length === 0 && <p className="muted" style={{ margin: 0 }}>Sem pedidos nesta lista.</p>}
      {shown.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
        <strong>{VENUE_ORDER_KIND_LABELS[o.kind]} · {o.buyer_name}{o.buyer_phone ? <> · <a href={"tel:" + o.buyer_phone.replace(/\s/g, "")}>📞 {o.buyer_phone}</a></> : null}</strong>
        <span style={{ overflowWrap: "anywhere" }}>{venueOrderSummary(o)}</span>
        <small>{venueOrderRef(o.ref_no)} · {formatPrice(o.total)} · {o.method === "prepaid" ? "adiantado" : "paga no local"} · {VENUE_ORDER_STATUS_LABELS[o.status].split(" —")[0]}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · guardado " + holdText(o.hold_until) : ""}</small>
        {o.buyer_note && <small>📝 {o.buyer_note}</small>}
        {o.note && <small className="muted">Motivo: {o.note}</small>}
        {VENUE_ACTIVE_ORDER.includes(o.status) && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void cancel(o)}>Cancelar</button>}
      </article>)}
    </section>

    <section className="stack" style={{ gap: 8 }} aria-labelledby="itens">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 id="itens" style={{ margin: 0 }}>{K.items} ({items.length})</h2>
        {itemForm === null && <button type="button" onClick={() => setItemForm("new")}>➕ Juntar {K.item.toLowerCase()}</button>}</div>
      <small>Marque «Há» ou «Não há» sempre que mudar: os clientes veem logo.</small>
      {itemForm !== null && <ItemForm uid={uid} venueId={id} kind={venue.kind} item={itemForm === "new" ? null : itemForm} onClose={() => setItemForm(null)} onSaved={m => { setItemForm(null); done(m); }} />}
      {items.length === 0 && itemForm === null && <p className="card">{K.empty}</p>}
      {items.map(i => <ItemControl key={i.id} i={i} kind={venue.kind} onEdit={() => setItemForm(i)} onSaved={done} onError={setError} />)}
    </section>

    <section className="stats" aria-label="Resumo">
      <div className="stat"><strong>{formatPrice(panel.completed_total)}</strong><span>Pedidos concluídos</span></div>
      <div className="stat"><strong>{formatPrice(panel.fee_due)}</strong><span>Taxa por entregar</span></div>
    </section>
    <section className="card stack" style={{ gap: 8 }} aria-labelledby="taxa">
      <h2 id="taxa" style={{ margin: 0 }}>🧾 Taxa do Huambo Online</h2>
      <small>{venueOwnerFeeNotice(panel.client_fee_pct, panel.business_fee_pct)}</small>
      <span>Total: {formatPrice(panel.fee_total)} · Por pagar: <strong>{formatPrice(panel.fee_due)}</strong></span>
      {panel.fee_overdue && <p className="error" style={{ margin: 0, fontSize: 19 }}>⚠️ Taxa em atraso há mais de 7 dias: as novas reservas estão paradas até entregar.</p>}
      {panel.fee_pending && <span>⏳ Pagamento enviado, à espera de confirmação.</span>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <VenueFeePayBox venueId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setPayOpen(true)}>Entregar a taxa do APP</button>)}
      <small>Pague até 7 dias depois de concluir o pedido. Depois disso, as reservas ficam paradas.</small>
      {panel.payments.length > 0 && <details><summary><strong>Pagamentos feitos ({panel.payments.length})</strong></summary>
        {panel.payments.map(p => <div key={p.id} style={{ padding: "6px 0" }}>{formatPrice(p.amount)} · {new Date(p.created_at).toLocaleDateString("pt-AO")} · {PAYMENT_STATUS_LABELS[p.status] ?? p.status}{p.admin_note ? " · " + p.admin_note : ""}</div>)}
      </details>}
    </section>
  </main>;
}

/** Uma linha de quarto / prato / produto no painel: «Há / Não há» e quantidade em 1 toque. */
function ItemControl({ i, kind, onEdit, onSaved, onError }: { i: VenueItem; kind: VenueKind; onEdit: () => void; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [qty, setQty] = useState(i.qty_total == null ? "" : String(i.qty_total)); const [busy, setBusy] = useState(false);
  async function set(available: boolean, withQty = false) {
    const q = qty.trim() ? toNum(qty) : null;
    if (withQty && q != null && !(q >= 0)) { onError("Quantidade inválida."); return; }
    if (withQty && kind === "hotel" && !(q != null && Number.isInteger(q))) { onError("Quantos quartos deste tipo tem? (número inteiro)"); return; }
    setBusy(true); const r = await setVenueItemAvailable(supabase(), i.id, available, withQty ? q : undefined); setBusy(false);
    if (r.error) onError(friendlyError(r.error)); else onSaved(`${i.name}: ${withQty ? "quantidade guardada" : available ? "🟢 Há" : "🔴 Não há"}.`);
  }
  async function remove() {
    if (!confirm(`Apagar «${i.name}»?`)) return;
    const r = await deleteVenueItem(supabase(), i.id); if (r.error) onError(friendlyError(r.error)); else onSaved("Feito. Se já tinha pedidos, ficou só marcado «Não há».");
  }
  return <article className="card" style={{ display: "grid", gridTemplateColumns: i.photos.length ? "72px minmax(0,1fr)" : "minmax(0,1fr)", gap: 12 }}>
    {i.photos.length > 0 && <img src={i.photos[0]} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 10 }} />}
    <div className="stack" style={{ gap: 6, minWidth: 0 }}>
      <strong style={{ fontSize: 18, overflowWrap: "anywhere" }}>{i.name}{i.section ? <small className="muted"> · {i.section}</small> : null}</strong>
      <span>{venuePriceText(i, kind)} · <strong style={{ color: i.available ? "var(--ok)" : "var(--danger)" }}>{i.available ? "🟢 Há" : "🔴 Não há"}</strong></span>
      <div className="row" role="group" aria-label={"Há ou não há " + i.name}>
        <button type="button" disabled={busy} className={i.available ? "" : "secondary"} aria-pressed={i.available} onClick={() => void set(true)}>🟢 Há</button>
        <button type="button" disabled={busy} className={i.available ? "secondary" : "danger"} aria-pressed={!i.available} onClick={() => void set(false)}>🔴 Não há</button>
      </div>
      <div className="row" style={{ alignItems: "end" }}>
        <label style={{ flex: 1, minWidth: 140 }}>{kind === "hotel" ? "Quantos quartos deste tipo" : kind === "warehouse" ? `Stock${i.unit ? " (" + i.unit + ")" : ""}` : "Quantidade (vazio = sem limite)"}
          <input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" /></label>
        <button type="button" className="secondary" disabled={busy} onClick={() => void set(i.available, true)}>💾 Guardar</button>
      </div>
      <div className="row"><button type="button" className="secondary" onClick={onEdit}>✏️ Editar</button><button type="button" className="danger" onClick={() => void remove()}>Apagar</button></div>
    </div>
  </article>;
}

function ItemForm({ uid, venueId, kind, item, onClose, onSaved }: { uid: string; venueId: string; kind: VenueKind; item: VenueItem | null; onClose: () => void; onSaved: (m: string) => void }) {
  const K = VENUE_KINDS[kind];
  const [f, setF] = useState({ name: item?.name ?? "", description: item?.description ?? "", section: item?.section ?? "", price: item ? String(item.price) : "", unit: item?.unit ?? "",
    capacity: String(item?.capacity ?? 2), qty: item?.qty_total == null ? "" : String(item.qty_total), minQty: String(item?.min_qty ?? 1), available: item?.available ?? true });
  const [photos, setPhotos] = useState<string[]>(item?.photos ?? []); const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const total = photos.length + files.length;
  function input(list: string[]): VenueItemInput {
    return { name: f.name, description: f.description, section: f.section, photos: list, price: f.price.trim() ? toNum(f.price) : NaN, unit: f.unit,
      capacity: kind === "hotel" ? Number(f.capacity) : null, qtyTotal: f.qty.trim() ? toNum(f.qty) : null, minQty: kind === "warehouse" ? toNum(f.minQty) || 1 : undefined, available: f.available };
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const bad = validateVenueItem(kind, input([...photos, ...files.map(x => x.name)])); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    try {
      const up = await uploadPhotos(uid, files);
      const r = await saveVenueItem(supabase(), venueId, kind, input([...photos, ...up]), item?.id); if (r.error) throw r.error;
      onSaved(item ? "Guardado." : "Juntado.");
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }
  return <form className="card stack" onSubmit={save}>
    <h3 style={{ margin: 0 }}>{item ? "✏️ Editar" : "➕ " + K.item}</h3>
    <label>{kind === "hotel" ? "Tipo de quarto" : "Nome"}<input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} maxLength={100} placeholder={kind === "hotel" ? "Ex.: Quarto duplo" : kind === "restaurant" ? "Ex.: Muamba de galinha" : "Ex.: Arroz 25 kg"} /></label>
    <label>Secção (opcional)<input value={f.section} onChange={e => setF({ ...f, section: e.target.value })} maxLength={60} placeholder={kind === "hotel" ? "Ex.: Suites" : kind === "restaurant" ? "Ex.: Pratos do dia, Bebidas" : "Ex.: Cereais"} /></label>
    <label>Descrição (opcional)<textarea rows={2} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} maxLength={600} /></label>
    <div className="row">
      <label style={{ flex: 1, minWidth: 140 }}>Preço (Kz)<input value={f.price} onChange={e => setF({ ...f, price: e.target.value })} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 140 }}>Por (opcional)<input value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} maxLength={30} placeholder={kind === "hotel" ? "noite" : kind === "warehouse" ? "saco, caixa…" : "prato"} /></label>
    </div>
    <div className="row">
      {kind === "hotel" && <label style={{ flex: 1, minWidth: 140 }}>Pessoas por quarto<input value={f.capacity} onChange={e => setF({ ...f, capacity: e.target.value })} inputMode="numeric" /></label>}
      <label style={{ flex: 1, minWidth: 140 }}>{kind === "hotel" ? "Quantos quartos deste tipo" : kind === "warehouse" ? "Stock (vazio = sem limite)" : "Quantidade (vazio = sem limite)"}<input value={f.qty} onChange={e => setF({ ...f, qty: e.target.value })} inputMode="decimal" /></label>
      {kind === "warehouse" && <label style={{ flex: 1, minWidth: 140 }}>Mínimo por pedido<input value={f.minQty} onChange={e => setF({ ...f, minQty: e.target.value })} inputMode="decimal" /></label>}
    </div>
    <label className="row" style={{ alignItems: "center", fontWeight: 400 }}><input type="checkbox" checked={f.available} onChange={e => setF({ ...f, available: e.target.checked })} style={box} /> Há (disponível agora)</label>
    <label>Fotografias ({total}/{VENUE_MAX_PHOTOS})<input type="file" accept="image/*" multiple disabled={total >= VENUE_MAX_PHOTOS} onChange={e => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, VENUE_MAX_PHOTOS - photos.length))} /></label>
    {total > 0 && <div className="row" style={{ gap: 8 }}>
      {photos.map(u => <span key={u} className="stack" style={{ gap: 4 }}><img src={u} alt="" width={80} height={80} style={{ objectFit: "cover", borderRadius: 10 }} /><button type="button" className="secondary" onClick={() => setPhotos(photos.filter(x => x !== u))}>Tirar</button></span>)}
      {files.map((x, i) => <span key={i} className="badge">📷 {x.name} <button type="button" className="secondary" aria-label={"Tirar " + x.name} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✖</button></span>)}
    </div>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" disabled={busy}>{busy ? "A enviar…" : item ? "💾 Guardar" : "✅ Juntar"}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></div>
  </form>;
}

function VenueFeePayBox({ venueId, uid, amount, settings, onDone, onClose }: { venueId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !file) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitVenueFee(supabase(), venueId, { method, reference, proofPath: proof }); if (r.error) throw r.error;
      onDone("Pagamento da taxa enviado. A administração vai confirmar.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 10 }}>
    <strong>Valor a pagar: {formatPrice(amount)}</strong>
    <strong>1. Pague ao Huambo Online para estes dados</strong>
    <PaymentDetails s={settings} />
    <strong>2. Diga-nos como pagou</strong>
    <Choice label="Como pagou" value={method} onChange={setMethod} options={(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => [m, PLAN_METHOD_LABELS[m]] as [PaymentMethodPlan, string])} />
    <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
    <label>Comprovativo (opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" disabled={busy} onClick={() => void send()}>{busy ? "A enviar…" : "Enviar pagamento"}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></div>
  </div>;
}

// --- Administração --------------------------------------------------------------------------------
export function AdminVenues() {
  const [status, setStatus] = useState<VenueStatus>("pending"); const [venues, setVenues] = useState<AdminVenue[]>([]); const [payments, setPayments] = useState<AdminVenuePayment[]>([]);
  const [orderStatus, setOrderStatus] = useState<VenueOrderStatus | "">("submitted"); const [orders, setOrders] = useState<AdminVenueOrder[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c] = await Promise.all([listVenuesForAdmin(supabase(), status), listVenuePaymentsForAdmin(supabase(), "pending"), listVenueOrdersForAdmin(supabase(), orderStatus)]);
    setVenues(a.data); setPayments(b.data); setOrders(c.data); if (a.error || b.error || c.error) setError(friendlyError(a.error ?? b.error ?? c.error));
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: AdminVenue, to: VenueStatus) {
    const note = to === "suspended" ? prompt("Porque suspende? (o dono vai ler)") ?? "" : "";
    if (to === "suspended" && !note.trim()) return;
    const r = await setVenueStatus(supabase(), x.id, to, note); if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice(to === "approved" ? "Aprovado: já aparece ao público." : "Feito."); await load(); }
  }
  async function decide(p: AdminVenuePayment, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma?") ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirmar ${formatPrice(p.amount)} de ${p.venue_name}?`)) return;
    const r = await decideVenueFee(supabase(), p.id, ok, note); if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Feito."); await load(); }
  }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>🏨 Reservas (hotéis, restaurantes, armazéns)</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <div className="chips" role="group" aria-label="Estabelecimentos">{([["pending", "⏳ Por aprovar"], ["approved", "✅ Aprovados"], ["suspended", "⛔ Suspensos"]] as const).map(([k, l]) =>
      <button key={k} type="button" className={"chip" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}</div>
    {venues.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum estabelecimento nesta lista.</p>}
    {venues.map(x => <article key={x.id} className="card" style={{ gap: 6 }}>
      <a href={"/reservas/" + x.id}><strong>{VENUE_KINDS[x.kind].icon} {x.name}{x.verified ? " ✔️" : ""}</strong></a>
      <small>{venueRef(x.ref_no)} · {VENUE_SUBTYPE_LABELS[x.subtype]} · dono: {x.owner_name}{x.phone ? " · 📞 " + x.phone : ""}{x.address_text ? " · " + x.address_text : ""} · <a href={"/empresas/" + x.business_id}>empresa</a></small>
      {x.pay && (x.pay.holder || x.pay.iban || x.pay.express) ? <small style={{ overflowWrap: "anywhere" }}>💳 Conta para adiantados: {[x.pay.holder, x.pay.iban && "IBAN " + x.pay.iban, x.pay.express && "Express " + x.pay.express, x.pay.note].filter(Boolean).join(" · ")}</small>
        : <small className="muted">Sem conta para pagamentos adiantados.</small>}
      {x.fee_due > 0 && <small className={x.fee_overdue ? "error" : ""}>Taxa por pagar: {formatPrice(x.fee_due)}{x.fee_overdue ? " (em atraso)" : ""}</small>}
      {x.admin_note && <small>Nota: {x.admin_note}</small>}
      <div className="row">
        {x.status !== "approved" && <button type="button" onClick={() => void setSt(x, "approved")}>✅ Aprovar</button>}
        {x.status !== "suspended" && <button type="button" className="secondary" onClick={() => void setSt(x, "suspended")}>⛔ Suspender</button>}
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>🧾 Taxas por confirmar ({payments.length})</h3>
    {payments.map(p => <article key={p.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(p.amount)} · {p.venue_name}</strong>
      <small>{venueRef(p.venue_ref)} · {p.owner_name} · {PLAN_METHOD_LABELS[p.method as PaymentMethodPlan] ?? p.method}{p.reference ? " · Ref.: " + p.reference : ""} · {new Date(p.created_at).toLocaleDateString("pt-AO")}</small>
      <div className="row">{p.proof_path && <button type="button" className="secondary" onClick={() => void openProof(p.proof_path!, setError)}>📄 Comprovativo</button>}
        <button type="button" onClick={() => void decide(p, true)}>✅ Confirmar</button><button type="button" className="secondary" onClick={() => void decide(p, false)}>❌ Recusar</button></div>
    </article>)}
    <h3 style={{ margin: 0 }}>🔎 Pagamentos adiantados de clientes (comprovativos)</h3>
    <small>Para vigiar burlas: cada comprovativo e cada referência só podem ser usados uma vez.</small>
    <div className="chips" role="group" aria-label="Pagamentos de clientes">{([["submitted", "⏳ Por confirmar"], ["paid", "✅ Confirmados"], ["rejected", "❌ Recusados"], ["", "Todos"]] as const).map(([k, l]) =>
      <button key={k || "all"} type="button" className={"chip" + (orderStatus === k ? " on" : "")} aria-pressed={orderStatus === k} onClick={() => setOrderStatus(k)}>{l}</button>)}</div>
    {orders.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum pagamento nesta lista.</p>}
    {orders.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(o.total)} · {o.venue_name} · {o.buyer_name}</strong>
      <small>{venueOrderRef(o.ref_no)} · {venueRef(o.venue_ref)} · {VENUE_ORDER_KIND_LABELS[o.kind]} · taxa {formatPrice(o.client_fee + o.business_fee)}{o.reference ? " · Ref.: " + o.reference : ""} · {VENUE_ORDER_STATUS_LABELS[o.status]}</small>
      <div className="row">{o.proof_path && <button type="button" className="secondary" onClick={() => void openProof(o.proof_path!, setError)}>📄 Comprovativo</button>}
        <a className="btn secondary" href={"/reservas/v/" + o.qr_token}>🔳 Ver pelo QR</a></div>
    </article>)}
  </section>;
}

// --- Página do QR --------------------------------------------------------------------------------
export function VenueVerify({ token }: { token: string }) {
  const [v, setV] = useState<VenueOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await venueOrderByToken(supabase(), token); if (r.error) setError(friendlyError(r.error)); setV(r.data ?? { result: "invalid" }); }
  useEffect(() => { void load(); }, [token]);
  if (!v) return <main><p>A verificar…</p></main>;
  if (v.result !== "ok") return <main className="stack" style={{ maxWidth: 640 }}>
    <h1 style={{ margin: 0 }}>❌ QR não reconhecido</h1>
    <p className="error" role="alert" style={{ fontSize: 20 }}>Este QR não é de nenhuma reserva do Huambo Online. Não aceite.</p>
    <a href="/reservas">← Reservas</a>
  </main>;
  const live = !!v.status && LIVE.includes(v.status);
  const summary = v.kind && v.lines ? venueOrderSummary({ kind: v.kind, guests: v.guests ?? null, check_in: v.check_in ?? null, check_out: v.check_out ?? null, slot_at: v.slot_at ?? null, lines: v.lines }) : "";
  async function complete() {
    if (!v?.code || !v.venue_id) return;
    if (!confirm(`Confirmar a entrada / entrega de ${v.buyer_name}?`)) return;
    setBusy(true); const r = await completeVenueOrder(supabase(), v.venue_id, v.code); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(VENUE_COMPLETE_LABELS[r.data?.result ?? ""] ?? String(r.data?.result)); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    const note = ok ? "" : prompt("Porque não confirma? (o cliente vai ler)") ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirma que recebeu ${formatPrice(v.total ?? 0)} na conta do estabelecimento?`)) return;
    setBusy(true); const r = await decideVenuePayment(supabase(), v.id, ok, note); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Pagamento confirmado. Já pode atender." : "Pagamento recusado."); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 680 }}>
    <a href="/reservas">← Reservas</a>
    <h1 style={{ margin: 0 }}>{v.status === "completed" ? "⚠️ QR JÁ USADO" : live ? "✅ QR verdadeiro" : "❌ Pedido sem efeito"}</h1>
    <p className={live ? "ok" : "error"} role="status" style={{ fontSize: 20, margin: 0 }}>
      {venueOrderRef(v.ref_no)} · {v.venue_name}{v.kind ? " · " + VENUE_ORDER_KIND_LABELS[v.kind] : ""}<br />{v.status ? VENUE_ORDER_STATUS_LABELS[v.status] : ""}
    </p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status" style={{ fontSize: 20 }}>{notice}</p>}
    {v.role === "other" && <p className="card" style={{ margin: 0 }}>Este pedido existe no Huambo Online. Só {v.venue_name ?? "o estabelecimento"}, com a sua conta, vê os dados e pode confirmar a entrada. <a href={"/conta/login?voltar=/reservas/v/" + token}>Entrar</a></p>}
    {v.role !== "other" && <>
      <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)", overflowWrap: "anywhere" }}>
        <dt>Cliente</dt><dd><strong>{v.buyer_name}</strong>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}</dd>
        {summary && <><dt>Pedido</dt><dd>{summary}</dd></>}
        {v.buyer_note && <><dt>Nota</dt><dd>{v.buyer_note}</dd></>}
        <dt>Valor</dt><dd>{formatPrice(v.subtotal ?? 0)}</dd>
        <dt>Taxa do APP{v.client_fee_pct ? ` (${v.client_fee_pct}%)` : ""}</dt><dd>{formatPrice(v.client_fee ?? 0)}</dd>
        <dt>Total</dt><dd><strong>{formatPrice(v.total ?? 0)}</strong> · {v.method === "prepaid" ? "pago adiantado" : "paga no local"}</dd>
        {v.reference && <><dt>Referência do pagamento</dt><dd><strong>{v.reference}</strong></dd></>}
        {v.code && <><dt>Código</dt><dd><strong>{v.code}</strong></dd></>}
      </dl>
      {v.proof_path && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void openProof(v.proof_path!, setError)}>📄 Ver comprovativo</button>}
      {v.role === "venue" && v.status === "submitted" && <div className="card stack" style={{ gap: 8 }}>
        <strong>Veja na conta do estabelecimento se entrou {formatPrice(v.total ?? 0)} com o descritivo {venueOrderRef(v.ref_no)}.</strong>
        <div className="row"><button type="button" disabled={busy} onClick={() => void decide(true)}>✅ Recebi o dinheiro</button><button type="button" className="secondary" disabled={busy} onClick={() => void decide(false)}>❌ Não recebi</button></div>
      </div>}
      {v.role === "venue" && (v.status === "reserved" || v.status === "paid") && <button type="button" disabled={busy} style={{ fontSize: 22 }} onClick={() => void complete()}>
        {v.status === "reserved" && v.method !== "prepaid" ? `✅ Cobrar ${formatPrice(v.total ?? 0)} e confirmar entrada` : "✅ Já pago — confirmar entrada / entrega"}</button>}
    </>}
  </main>;
}
