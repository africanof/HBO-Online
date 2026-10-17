"use client";
import { useEffect, useState } from "react";
import { fuelFeed, getStation, listMyStations, listStationProducts, getStationPay, saveStation, updateFuelProduct, reportFuel, listMyFuelAlerts, addFuelAlert,
  removeFuelAlert, reserveFuel, submitFuelPayment, decideFuelPayment, collectFuel, cancelFuelOrder, myFuelOrders, stationPanel, submitFuelFee, listStationsForAdmin,
  setStationStatus, listFuelPaymentsForAdmin, fuelOrderByToken, listFuelOrdersForAdmin, fuelFeeBreakdown, fuelFeeNotice, fuelVerifyUrl, fuelTransferNote, sha256Hex, decideFuelFee, getPlatformSettings, updatePlatformSettings, paymentProofUrl, uploadPaymentProof, validateDocument,
  fuelQuantityText, fuelPriceText, minutesAgoText, fuelIsStale, fuelStatusLine, fuelReportsText, fuelShareMessage, validateStation, validateFuelReserve, stationRef,
  fuelOrderRef, holdText, qrSvgPath, formatPrice, friendlyErrorIn, whatsappShareUrl, whatsappLink, pointFrom, FUEL_PRODUCTS, FUEL_PRODUCT_LIST, FUEL_KIND_LABELS, FUEL_STATUS_LABELS,
  FUEL_QUEUE_LABELS, FUEL_METHOD_LABELS, FUEL_ORDER_STATUS_LABELS, FUEL_COLLECT_LABELS, FUEL_ACTIVE_ORDER, PLAN_METHOD_LABELS, LANG_TAGS,
  type FuelProduct, type FuelRow, type FuelStation, type FuelProductRow, type FuelKind, type FuelMethod, type FuelStatus, type FuelQueue, type MyFuelOrder,
  type StationPanel, type StationOrder, type FuelOrderView, type AdminFuelOrder, type FuelOrderStatus, type AdminFuelPayment, type FuelCollectResult, type PlatformSettings, type PaymentMethodPlan, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT } from "../lib/i18n";
import { SITE_URL } from "../lib/site";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";
import { getPublic } from "../lib/public-api";
import { OfflineBanner } from "./Offline";
import { browserStore } from "./Engage";
import { loadWithCache, isOfflineError } from "@huambo-online/core";
import { fuelFeedCached } from "@huambo-online/core";
import { ProfileQr } from "./ProfileQr";

const STATUS_COLORS: Record<FuelStatus, string> = { available: "var(--ok)", low: "var(--gold-text)", out: "var(--danger)", unknown: "var(--muted)" };
function StatusBadge({ s }: { s: FuelStatus }) {
  const { tc } = useT();
  return <span className="badge" style={{ borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s], fontWeight: 800 }}>{tc(FUEL_STATUS_LABELS[s])}</span>;
}
/** QR único do pedido: leva ao site, que confirma se é verdadeiro. Por baixo, o código para escrever à mão. */
function Code({ code, token }: { code: string; token?: string | null }) {
  const { t } = useT();
  const q = qrSvgPath(token ? fuelVerifyUrl(SITE_URL, token) : code);
  return <div className="card" style={{ justifyItems: "center", textAlign: "center", gap: 6 }}>
    <svg role="img" aria-label={t("sv.fu_qr_code", { code })} viewBox={`-2 -2 ${q.size + 4} ${q.size + 4}`} width={170} height={170} style={{ background: "#fff", borderRadius: 8 }} shapeRendering="crispEdges"><path d={q.d} fill="#000" /></svg>
    <strong style={{ fontSize: 26, letterSpacing: 3 }}>{code}</strong>
    <small>{t("sv.fu_qr_show")}</small>
  </div>;
}
async function openProof(path: string, onError: (m: string) => void, failMsg: string) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) window.open(r.data, "_blank", "noopener"); else onError(failMsg);
}

/** Lista pública: onde há combustível e gás. */
export function FuelList() {
  const { lang, t, tc } = useT();
  const [product, setProduct] = useState<FuelProduct | "">(""); const [municipalityId, setMunicipalityId] = useState(""); const { municipalities } = useTerritory();
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; product: FuelProduct; municipality_id: string | null }[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [offline, setOffline] = useState<{ on: boolean; at: number | null }>({ on: false, at: null });
  async function load() {
    // Guarda a última lista para a mostrar sem rede (com o aviso de que pode ter mudado).
    const r = await loadWithCache<FuelRow[]>(browserStore, `combustivel:${product}:${municipalityId}`, () => fuelFeedCached(getPublic, () => fuelFeed(supabase(), { product, municipalityId }), { product, municipalityId }));
    setOffline({ on: r.fromCache || isOfflineError(r.error), at: r.fromCache ? r.savedAt : null });
    if (r.error && !r.data) { if (!isOfflineError(r.error)) setError(friendlyErrorIn(r.error, lang)); } else { setError(""); setRows(r.data); }
  }
  useEffect(() => { void load(); }, [product, municipalityId]);
  useEffect(() => { void currentUserId().then(async u => { setUid(u); if (u) setAlerts((await listMyFuelAlerts(supabase())).data); }); }, []);
  const alert = product ? alerts.find(a => a.product === product && (a.municipality_id ?? "") === municipalityId) : undefined;
  async function toggleAlert() {
    if (!uid) { window.location.href = "/conta/login?voltar=/combustivel"; return; }
    if (!product) return;
    const r = alert ? await removeFuelAlert(supabase(), alert.id) : await addFuelAlert(supabase(), uid, product, municipalityId || null);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    setNotice(alert ? t("sv.fu_alert_off") : t(municipalityId ? "sv.fu_alert_on_mun" : "sv.fu_alert_on", { product: tc(FUEL_PRODUCTS[product].label).toLowerCase() }));
    setAlerts((await listMyFuelAlerts(supabase())).data);
  }
  const has = rows?.filter(r => r.status === "available" || r.status === "low").length ?? 0;
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>⛽ {t("sv.fu_title")}</h1>
      <div className="row"><a className="btn secondary" href="/combustivel/pedidos">🧾 {t("sv.fu_my_orders")}</a><a className="btn secondary" href="/combustivel/meus">⛽ {t("sv.fu_have_station")}</a></div>
    </div>
    <p className="muted" style={{ margin: 0 }}>{t("sv.fu_intro")}</p>
    <div className="chips" role="group" aria-label={t("sv.fu_product")}>
      <button type="button" className={"chip" + (product === "" ? " on" : "")} aria-pressed={product === ""} onClick={() => setProduct("")}>{t("sv.all")}</button>
      {FUEL_PRODUCT_LIST.map(p => <button key={p} type="button" className={"chip" + (product === p ? " on" : "")} aria-pressed={product === p} onClick={() => setProduct(p)}>{FUEL_PRODUCTS[p].icon} {tc(FUEL_PRODUCTS[p].short)}</button>)}
    </div>
    <div className="row" style={{ alignItems: "end" }}>
      <label style={{ flex: 1, minWidth: 200 }}>{t("sv.municipality")}<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">{t("sv.all")}</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {product && <button type="button" className={alert ? "secondary" : ""} aria-pressed={!!alert} onClick={() => void toggleAlert()}>{alert ? "🔕 " + t("sv.fu_alert_off_btn") : "🔔 " + t("sv.fu_alert_btn", { product: tc(FUEL_PRODUCTS[product].short).toLowerCase() })}</button>}
    </div>
    <OfflineBanner show={offline.on} savedAt={offline.at} />
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {rows !== null && <p role="status" style={{ margin: 0, fontWeight: 700 }}>{has ? "🟢 " + t(has === 1 ? "sv.fu_has_one" : "sv.fu_has_many", { n: has, product: product ? tc(FUEL_PRODUCTS[product].label).toLowerCase() : t("sv.fu_fuel_or_gas") }) : "🔴 " + t("sv.fu_has_none")}</p>}
    {rows === null ? <p>{t("common.loading")}</p> : rows.length === 0 ? <p className="card">{t("sv.fu_no_stations")} <a href="/combustivel/registar">{t("sv.fu_register_free")}</a>.</p> :
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>{rows.map(r => <a key={r.product_id} href={"/combustivel/" + r.station_id} className="card" style={{ color: "inherit", textDecoration: "none", gap: 6 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 18 }}>{FUEL_PRODUCTS[r.product].icon} {tc(FUEL_PRODUCTS[r.product].label)}</strong><StatusBadge s={r.status} /></div>
        <span><strong>{r.station_name}</strong>{r.municipality_name ? " · " + r.municipality_name : ""}</span>
        <small>{tc(fuelStatusLine(r))}{fuelIsStale(r.status_at) && r.status !== "unknown" ? " · ⚠️ " + t("sv.fu_may_changed") : ""}</small>
        {r.price != null && <span className="price" style={{ fontSize: 18 }}>{tc(fuelPriceText(r.product, r.price))}</span>}
        {(r.yes_2h > 0 || r.no_2h > 0) && <small>{tc(fuelReportsText(r.yes_2h, r.no_2h))}</small>}
        {r.accepts_reservations && r.reservable_left > 0 && (r.status === "available" || r.status === "low") && <small className="ok">🧾 {t("sv.fu_can_reserve", { qty: tc(fuelQuantityText(r.product, r.reservable_left)) })}</small>}
      </a>)}</div>}
  </main>;
}

/** Página do posto: produtos, confirmar «há / acabou», reservar. */
export function StationPage({ id }: { id: string }) {
  const { lang, t, tc } = useT();
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [st, setSt] = useState<FuelStation | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const [a, b] = await Promise.all([fuelFeed(supabase(), { stationId: id }), getStation(supabase(), id)]); setRows(a.data); setSt(b.data); }
  useEffect(() => { void load(); void currentUserId().then(setUid); }, [id]);
  if (rows === null) return <main><p>{t("common.loading")}</p></main>;
  if (!st) return <main className="stack"><h1>{t("sv.fu_not_found")}</h1><a href="/combustivel">← {t("sv.fu_title")}</a></main>;
  const mine = uid === st.owner_id; const first = rows[0];
  async function report(r: FuelRow, has: boolean) {
    if (!uid) { window.location.href = "/conta/login?voltar=/combustivel/" + id; return; }
    const x = await reportFuel(supabase(), r.product_id, has);
    if (x.error) { setError(friendlyErrorIn(x.error, lang)); setNotice(""); } else { setError(""); setNotice(t("sv.fu_report_thanks")); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/combustivel">← {t("sv.fu_title")}</a>
    <h1 style={{ margin: 0 }}>{st.name}</h1>
    <small className="muted">{tc(FUEL_KIND_LABELS[st.kind])} · {stationRef(st.ref_no)}{first?.municipality_name ? " · " + first.municipality_name : ""}</small>
    {st.status !== "approved" && <p className="banner yellow" style={{ margin: 0 }}>{st.status === "pending" ? "⏳ " + t("sv.fu_pending_public") : "⛔ " + t("sv.fu_suspended") + (st.admin_note ? ": " + st.admin_note : "")}</p>}
    {mine && <div className="row"><a className="btn" href={`/combustivel/${id}/gerir`}>⚙️ {t("sv.fu_manage")}</a><a className="btn secondary" href={`/combustivel/${id}/editar`}>✏️ {t("common.edit")}</a></div>}
    {(st.address || st.opening_hours) && <p style={{ margin: 0 }}>{st.address}{st.address && st.opening_hours ? " · " : ""}{st.opening_hours ? "🕒 " + st.opening_hours : ""}</p>}
    <div className="row">
      {st.phone && <a className="btn secondary" href={"tel:" + st.phone}>📞 {t("common.call")}</a>}
      {whatsappLink(st.whatsapp, t("sv.wa_saw", { name: st.name })) && <a className="btn secondary" href={whatsappLink(st.whatsapp, t("sv.wa_saw", { name: st.name }))!} target="_blank" rel="noopener">WhatsApp</a>}
      {first && <a className="btn secondary" href={whatsappShareUrl(tc(fuelShareMessage(typeof window === "undefined" ? "" : window.location.origin, first)))} target="_blank" rel="noopener">📲 {t("common.share")}</a>}
      <ProfileQr kind="combustivel" id={st.id} name={st.name} />
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {rows.length === 0 && <p className="card">{t("sv.fu_no_products")}</p>}
    {rows.map(r => <section key={r.product_id} className="card stack" style={{ gap: 8 }} aria-labelledby={"p-" + r.product_id}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 id={"p-" + r.product_id} style={{ margin: 0, fontSize: 21 }}>{FUEL_PRODUCTS[r.product].icon} {tc(FUEL_PRODUCTS[r.product].label)}</h2><StatusBadge s={r.status} /></div>
      <span>{tc(fuelStatusLine(r))}{fuelIsStale(r.status_at) && r.status !== "unknown" ? " · ⚠️ " + t("sv.fu_may_changed") : ""}</span>
      <strong className="price" style={{ fontSize: 20 }}>{tc(fuelPriceText(r.product, r.price))}</strong>
      {r.note && <span>{r.note}</span>}
      {(r.yes_2h > 0 || r.no_2h > 0) && <small>{tc(fuelReportsText(r.yes_2h, r.no_2h))}</small>}
      {!mine && <div className="row"><span style={{ alignSelf: "center" }}>{t("sv.fu_passed")}</span>
        <button type="button" className="secondary" onClick={() => void report(r, true)}>👍 {t("sv.fu_has")}</button>
        <button type="button" className="secondary" onClick={() => void report(r, false)}>👎 {t("sv.fu_gone")}</button></div>}
      {!mine && r.accepts_reservations && (r.status === "available" || r.status === "low") && r.reservable_left > 0 && r.price != null && (open === r.product_id
        ? <ReserveForm r={r} uid={uid} onClose={() => setOpen(null)} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen(r.product_id)}>🧾 {t("sv.fu_reserve_left", { qty: tc(fuelQuantityText(r.product, r.reservable_left)) })}</button>)}
    </section>)}
    <PlaceView directions={st.directions} lat={st.geo_lat} lng={st.geo_lng} />
    <p className="muted" style={{ margin: 0 }}>{t("sv.fu_info_note")}</p>
  </main>;
}

function ReserveForm({ r, uid, onClose }: { r: FuelRow; uid: string | null; onClose: () => void }) {
  const { lang, t, tc } = useT();
  const gas = FUEL_PRODUCTS[r.product].gas;
  const [method, setMethod] = useState<FuelMethod>("at_station"); const [qty, setQty] = useState(gas ? "1" : "20"); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [feePct, setFeePct] = useState<number | null>(null); const [agree, setAgree] = useState(false);
  useEffect(() => { void getPlatformSettings(supabase()).then(s => setFeePct(Number(s.data?.fuel_fee_pct ?? 10))); }, []);
  if (!uid) return <a className="btn" href={"/conta/login?voltar=/combustivel/" + r.station_id}>{t("sv.fu_login_reserve")}</a>;
  const q = Number(qty.replace(",", "."));
  const sum = q > 0 && r.price != null && feePct != null ? fuelFeeBreakdown(r.price, q, feePct) : null;
  async function send(e: React.FormEvent) {
    e.preventDefault(); const bad = validateFuelReserve(r, q, name); if (bad) { setError(tc(bad)); return; }
    if (!agree) { setError(t("sv.fu_confirm_fee")); return; }
    setBusy(true); setError("");
    const x = await reserveFuel(supabase(), r.product_id, q, method, name, phone, plate); setBusy(false);
    if (x.error) setError(friendlyErrorIn(x.error, lang)); else window.location.href = "/combustivel/pedidos";
  }
  return <form className="card stack" style={{ gap: 8 }} onSubmit={send}>
    {r.accepts_prepay && <div className="row" role="radiogroup" aria-label={t("sv.fu_how_pay")}>{(["at_station", "prepaid"] as FuelMethod[]).map(m =>
      <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(FUEL_METHOD_LABELS[m])}</button>)}</div>}
    <label>{gas ? t("sv.fu_how_many_bottles") : t("sv.fu_how_many_litres")}<input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" /></label>
    <small>{t("sv.fu_max_person")}: {tc(fuelQuantityText(r.product, r.max_per_order))}.</small>
    <label>{t("sv.your_name")}<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
    <label>{t("sv.phone_opt")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} /></label>
    {!gas && <label>{t("sv.fu_plate")}<input value={plate} onChange={e => setPlate(e.target.value)} maxLength={20} placeholder="LD-12-34-AB" autoCapitalize="characters" /></label>}
    {sum && <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, 1fr) auto" }} aria-label={t("sv.fu_sums")}>
      <dt>{tc(FUEL_PRODUCTS[r.product].label)}</dt><dd>{formatPrice(sum.subtotal)}</dd>
      <dt>{t("sv.fu_fee_line", { pct: feePct ?? 0 })}</dt><dd>{formatPrice(sum.fee)}</dd>
      <dt><strong>{t("sv.fu_total_station")}</strong></dt><dd><strong>{formatPrice(sum.total)}</strong></dd>
    </dl>}
    <label className="row" style={{ alignItems: "flex-start", gap: 8, fontWeight: 400 }}><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ width: 24, height: 24, flex: "none" }} />
      <span>{tc(fuelFeeNotice(feePct))} {t("sv.fu_agree")}</span></label>
    <small>{method === "at_station" ? t("sv.fu_at_station_hint", { h: (Math.round(r.hold_minutes / 60 * 10) / 10).toLocaleString(LANG_TAGS[lang]) }) : t("sv.fu_prepaid_hint")}</small>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" disabled={busy}>{busy ? t("sv.fu_reserving") : "✅ " + t("sv.fu_reserve")}</button><button type="button" className="secondary" onClick={onClose}>{t("common.cancel")}</button></div>
  </form>;
}

/** As minhas reservas. */
export function MyFuelOrders() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyFuelOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myFuelOrders(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>🧾 {t("sv.fu_my_orders")}</h1><a className="btn" href="/conta/login?voltar=/combustivel/pedidos">{t("auth.login")}</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/combustivel">← {t("sv.fu_title")}</a>
    <h1 style={{ margin: 0 }}>🧾 {t("sv.fu_my_orders")}</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.fu_no_orders")} <a href="/combustivel">{t("sv.fu_see_where")}</a>.</p> :
      items.map(o => <OrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </main>;
}
function OrderCard({ o, onDone, onError }: { o: MyFuelOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  async function pay() {
    if (!file) { onError(t("sv.fu_need_proof")); return; }
    const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { onError(tc(bad)); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError(t("sv.fu_need_ref")); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(t("sv.login_needed"));
      const hash = sha256Hex(await file.arrayBuffer());
      const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail"));
      const r = await submitFuelPayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone(t("sv.fu_proof_sent"));
    } catch (e) { onError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  async function cancel() { if (!confirm(t("sv.fu_cancel_q"))) return; const r = await cancelFuelOrder(supabase(), o.id); if (r.error) onError(friendlyErrorIn(r.error, lang)); else onDone(t("sv.fu_cancelled")); }
  const active = FUEL_ACTIVE_ORDER.includes(o.status);
  return <article className="card stack" style={{ gap: 8 }}>
    <a href={"/combustivel/" + o.station_id} style={{ fontWeight: 800, fontSize: 19 }}>{FUEL_PRODUCTS[o.product].icon} {o.station_name}</a>
    <small>{fuelOrderRef(o.ref_no)} · {tc(FUEL_PRODUCTS[o.product].label)} · {tc(fuelQuantityText(o.product, o.quantity))}{o.plate ? " · " + o.plate : ""} · <strong>{formatPrice(o.total)}</strong>
      {o.fee_amount > 0 ? " " + t("sv.fu_fee_paren", { sub: formatPrice(o.subtotal), fee: formatPrice(o.fee_amount) }) : ""}</small>
    <span>{tc(FUEL_ORDER_STATUS_LABELS[o.status])}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · " + t("sv.fu_collect") + " " + tc(holdText(o.hold_until)) : ""}</span>
    {o.note && (o.status === "rejected" || o.status === "cancelled") && <span className="error">{t("sv.reason")}: {o.note}</span>}
    {o.code && (o.status === "reserved" || o.status === "paid" || o.status === "submitted") && <Code code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <small>{t("sv.fu_submitted_hint")}</small>}
    {o.status === "reserved" && <small>{t("sv.fu_pay_at_station")}</small>}
    {o.status === "awaiting_payment" && <div className="stack" style={{ gap: 8 }}>
      <strong>1. {t("sv.fu_pay_step", { total: formatPrice(o.total) })}{o.pay_by ? " " + tc(holdText(o.pay_by)) : ""}</strong>
      <dl className="facts card" style={{ margin: 0 }}>
        {o.pay_holder && <><dt>{t("sv.holder")}</dt><dd>{o.pay_holder}</dd></>}
        {o.pay_iban && <><dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{o.pay_iban}</strong></dd></>}
        {o.pay_express && <><dt>Multicaixa Express</dt><dd><strong>{o.pay_express}</strong></dd></>}
      </dl>
      {o.pay_note && <span>{o.pay_note}</span>}
      <p className="banner yellow" style={{ margin: 0, padding: 12, display: "block" }}>✍️ {tc(fuelTransferNote(o.ref_no))}<br />⚠️ {t("sv.fu_pay_warn")}</p>
      <strong>2. {t("sv.fu_send_proof")}</strong>
      <div className="row" role="radiogroup" aria-label={t("sv.how_paid")}>{(["multicaixa_express", "bank_transfer"] as const).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
      <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
      <label>{t("sv.fu_proof_required")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button type="button" disabled={busy} onClick={() => void pay()} style={{ justifySelf: "start" }}>{busy ? t("sv.sending") : "✅ " + t("sv.fu_paid_send")}</button>
    </div>}
    {active && (o.status === "reserved" || o.status === "awaiting_payment") && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void cancel()}>{t("sv.fu_cancel_btn")}</button>}
  </article>;
}

/** Os meus postos. */
export function MyStations() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<FuelStation[] | null>(null);
  useEffect(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyStations(supabase(), u)).data); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>⛽ {t("sv.fu_have_station")}</h1><p>{t("sv.fu_have_station_intro")}</p><a className="btn" href="/conta/login?voltar=/combustivel/meus">{t("auth.login")}</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/combustivel">← {t("sv.fu_title")}</a>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h1 style={{ margin: 0 }}>⛽ {t("sv.fu_my_stations")}</h1><a className="btn" href="/combustivel/registar">➕ {t("sv.fu_register")}</a></div>
    <p className="muted" style={{ margin: 0 }}>{t("sv.fu_my_stations_intro")}</p>
    {items === null ? <p>{t("common.loading")}</p> : items.length === 0 ? <p className="card">{t("sv.fu_none_registered")}</p> :
      items.map(s => <a key={s.id} href={`/combustivel/${s.id}/gerir`} className="card" style={{ color: "inherit", textDecoration: "none", gap: 4 }}>
        <strong>{s.name}</strong>
        <small>{stationRef(s.ref_no)} · {tc(FUEL_KIND_LABELS[s.kind])} · {s.status === "approved" ? "✅ " + t("sv.fu_approved") : s.status === "pending" ? "⏳ " + t("sv.fu_pending") : "⛔ " + t("sv.fu_suspended")}</small>
      </a>)}
  </main>;
}

/** Registar ou editar posto. */
export function StationForm({ id }: { id?: string }) {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const { municipalities } = useTerritory();
  const [name, setName] = useState(""); const [kind, setKind] = useState<FuelKind>("fuel"); const [municipalityId, setMunicipalityId] = useState(""); const [address, setAddress] = useState("");
  const [directions, setDirections] = useState(""); const [point, setPoint] = useState<GeoPoint | null>(null); const [phone, setPhone] = useState(""); const [whatsapp, setWhatsapp] = useState("");
  const [hours, setHours] = useState(""); const [reserv, setReserv] = useState(true); const [prepay, setPrepay] = useState(false); const [hold, setHold] = useState("120");
  const [pay, setPay] = useState({ holder: "", iban: "", express: "", note: "" }); const [products, setProducts] = useState<FuelProduct[]>(["gasolina", "gasoleo"]);
  const [existing, setExisting] = useState<FuelProductRow[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loaded, setLoaded] = useState(!id);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => { if (!id) return; void (async () => {
    const [a, b, c] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), getStationPay(supabase(), id)]);
    const s = a.data; if (!s) { setError(t("sv.fu_not_found") + "."); return; }
    setName(s.name); setKind(s.kind); setMunicipalityId(s.municipality_id ?? ""); setAddress(s.address ?? ""); setDirections(s.directions ?? ""); setPoint(pointFrom(s.geo_lat, s.geo_lng));
    setPhone(s.phone ?? ""); setWhatsapp(s.whatsapp ?? ""); setHours(s.opening_hours ?? ""); setReserv(s.accepts_reservations); setPrepay(s.accepts_prepay); setHold(String(s.hold_minutes));
    setPay(c); setExisting(b.data); setProducts(b.data.map(p => p.product)); setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <main><p>{error || t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><h1>⛽ {t("sv.fu_register")}</h1><a className="btn" href="/conta/login?voltar=/combustivel/registar">{t("auth.login")}</a></main>;
  const input = { name, kind, municipalityId, address, directions, point, phone, whatsapp, openingHours: hours, acceptsReservations: reserv, acceptsPrepay: prepay, holdMinutes: Number(hold), pay, products };
  const allowed = FUEL_PRODUCT_LIST.filter(p => kind === "both" || (kind === "gas") === FUEL_PRODUCTS[p].gas);
  async function save(e: React.FormEvent) {
    e.preventDefault(); const bad = validateStation(input); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    const r = await saveStation(supabase(), uid!, input, id, existing); setBusy(false);
    if (r.error || !r.data) setError(friendlyErrorIn(r.error, lang)); else window.location.href = `/combustivel/${r.data.id}/gerir`;
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href={id ? `/combustivel/${id}/gerir` : "/combustivel/meus"}>← {t("common.back")}</a>
    <h1 style={{ margin: 0 }}>{id ? "✏️ " + t("sv.fu_edit") : "⛽ " + t("sv.fu_register")}</h1>
    <p className="muted" style={{ margin: 0 }}>{id ? "⚠️ " + t("sv.fu_edit_warn") : t("sv.fu_register_note")}</p>
    <form className="stack" onSubmit={save}>
      <label>{t("sv.f_name")}<input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder={t("sv.fu_name_ph")} /></label>
      <div className="row" role="radiogroup" aria-label={t("sv.fu_what_sell")}>{(Object.keys(FUEL_KIND_LABELS) as FuelKind[]).map(k =>
        <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "" : "secondary"} onClick={() => { setKind(k); setProducts(ps => ps.filter(p => k === "both" || (k === "gas") === FUEL_PRODUCTS[p].gas)); }}>{tc(FUEL_KIND_LABELS[k])}</button>)}</div>
      <fieldset className="card stack" style={{ gap: 6 }}><legend style={{ fontWeight: 700 }}>{t("sv.fu_products_sold")}</legend>
        {allowed.map(p => <label key={p} className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={products.includes(p)} onChange={e => setProducts(ps => e.target.checked ? [...ps, p] : ps.filter(x => x !== p))} style={{ width: 22, height: 22 }} /> {FUEL_PRODUCTS[p].icon} {tc(FUEL_PRODUCTS[p].label)}</label>)}
      </fieldset>
      <label>{t("sv.municipality")}<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">— {t("sv.f_choose")} —</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>{t("sv.fu_address")}<input value={address} onChange={e => setAddress(e.target.value)} maxLength={200} placeholder={t("sv.fu_address_ph")} /></label>
      <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint={t("sv.fu_place_hint")} />
      <div className="row">
        <label style={{ flex: 1, minWidth: 180 }}>{t("auth.phone")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} /></label>
        <label style={{ flex: 1, minWidth: 180 }}>WhatsApp<input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} inputMode="tel" maxLength={20} /></label>
      </div>
      <label>{t("sv.fu_hours")}<input value={hours} onChange={e => setHours(e.target.value)} maxLength={120} placeholder={t("sv.fu_hours_ph")} /></label>
      <fieldset className="card stack" style={{ gap: 8 }}><legend style={{ fontWeight: 700 }}>🧾 {t("nav.bookings")}</legend>
        <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={reserv} onChange={e => setReserv(e.target.checked)} style={{ width: 22, height: 22 }} /> {t("sv.fu_accept_res")}</label>
        <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={prepay} onChange={e => setPrepay(e.target.checked)} style={{ width: 22, height: 22 }} /> {t("sv.fu_accept_prepay")}</label>
        <label>{t("sv.fu_hold")}<input value={hold} onChange={e => setHold(e.target.value)} inputMode="numeric" /></label>
        {prepay && <>
          <label>{t("sv.account_holder")}<input value={pay.holder} onChange={e => setPay({ ...pay, holder: e.target.value })} maxLength={80} /></label>
          <label>IBAN<input value={pay.iban} onChange={e => setPay({ ...pay, iban: e.target.value })} maxLength={40} placeholder="AO06 …" /></label>
          <label>Multicaixa Express<input value={pay.express} onChange={e => setPay({ ...pay, express: e.target.value })} inputMode="tel" maxLength={20} /></label>
          <label>{t("sv.payer_note")}<input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} maxLength={200} /></label>
        </>}
        <small>{t("sv.fu_qty_later")}</small>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? t("sv.saving") : id ? t("common.save") : "✅ " + t("sv.fu_register")}</button>
    </form>
  </main>;
}

/** Linha de um produto no painel: marcar há / a acabar / esgotou em 1 toque. */
function ProductControl({ p, onSaved, onError }: { p: FuelProductRow; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const { lang, t, tc } = useT();
  const [price, setPrice] = useState(p.price == null ? "" : String(p.price)); const [qty, setQty] = useState(String(p.reservable_qty)); const [max, setMax] = useState(String(p.max_per_order));
  const [queue, setQueue] = useState<FuelQueue | "">(p.queue ?? ""); const [note, setNote] = useState(p.note ?? ""); const [busy, setBusy] = useState(false);
  async function save(status?: FuelStatus) {
    setBusy(true);
    const r = await updateFuelProduct(supabase(), p.id, { ...(status ? { status } : {}), price: price.trim() ? Number(price.replace(/\s/g, "").replace(",", ".")) : null,
      reservable_qty: Number(qty.replace(",", ".")) || 0, max_per_order: Number(max.replace(",", ".")) || 1, queue: queue || null, note: note.trim() || null });
    setBusy(false);
    if (r.error) onError(friendlyErrorIn(r.error, lang)); else onSaved(status ? `${tc(FUEL_PRODUCTS[p.product].label)}: ${tc(FUEL_STATUS_LABELS[status])}` : t("sv.saved"));
  }
  return <article className="card stack" style={{ gap: 8 }}>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 19 }}>{FUEL_PRODUCTS[p.product].icon} {tc(FUEL_PRODUCTS[p.product].label)}</strong><StatusBadge s={p.status} /></div>
    <small>{t("sv.fu_updated")} {tc(minutesAgoText(p.status_at))}</small>
    <div className="row" role="group" aria-label={t("sv.fu_state_of", { product: tc(FUEL_PRODUCTS[p.product].label) })}>
      <button type="button" disabled={busy} onClick={() => void save("available")}>🟢 {t("sv.fu_has")}</button>
      <button type="button" disabled={busy} className="secondary" onClick={() => void save("low")}>🟡 {t("sv.fu_low")}</button>
      <button type="button" disabled={busy} className="danger" onClick={() => void save("out")}>🔴 {t("sv.fu_out")}</button>
    </div>
    <div className="row">
      <label style={{ flex: 1, minWidth: 130 }}>{t("sv.fu_price_unit", { unit: tc(FUEL_PRODUCTS[p.product].unit) })}<input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 130 }}>{FUEL_PRODUCTS[p.product].gas ? t("sv.fu_for_res_bottles") : t("sv.fu_for_res_litres")}<input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 130 }}>{t("sv.fu_max_person")}<input value={max} onChange={e => setMax(e.target.value)} inputMode="decimal" /></label>
    </div>
    <div className="chips" role="group" aria-label={t("sv.fu_queue")}>{(Object.keys(FUEL_QUEUE_LABELS) as FuelQueue[]).map(q =>
      <button key={q} type="button" className={"chip" + (queue === q ? " on" : "")} aria-pressed={queue === q} onClick={() => setQueue(queue === q ? "" : q)}>{tc(FUEL_QUEUE_LABELS[q])}</button>)}</div>
    <label>{t("sv.note_opt")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={160} placeholder={t("sv.fu_note_ph")} /></label>
    <button type="button" className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void save()}>💾 {t("sv.fu_save_price")}</button>
  </article>;
}

/** Painel do posto. */
export function StationManage({ id }: { id: string }) {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [st, setSt] = useState<FuelStation | null>(null); const [products, setProducts] = useState<FuelProductRow[]>([]);
  const [panel, setPanel] = useState<StationPanel | null>(null); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [code, setCode] = useState(""); const [check, setCheck] = useState<FuelCollectResult | null>(null); const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c, s] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), stationPanel(supabase(), id), getPlatformSettings(supabase())]);
    setSt(a.data); setProducts(b.data); setSettings(s.data); if (c.error) setError(friendlyErrorIn(c.error, lang)); else setPanel(c.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main className="stack"><a className="btn" href={`/conta/login?voltar=/combustivel/${id}/gerir`}>{t("auth.login")}</a></main>;
  if (!st || !panel) return <main className="stack"><p className={error ? "error" : ""}>{error || t("common.loading")}</p><a href="/combustivel/meus">← {t("sv.fu_my_stations")}</a></main>;
  const done = (m: string) => { setNotice(m); setError(""); void load(); };
  async function doCheck(e: React.FormEvent) {
    e.preventDefault(); if (!code.trim()) return; setCheck(null);
    const r = await collectFuel(supabase(), id, code);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: StationOrder, ok: boolean) {
    const note = ok ? "" : prompt(t("sv.why_not_confirm_client")) ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(t("sv.fu_confirm_received", { amount: formatPrice(o.total), name: o.buyer_name }))) return;
    const r = await decideFuelPayment(supabase(), o.id, ok, note); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(ok ? t("sv.fu_pay_confirmed_code") : t("sv.pay_refused"));
  }
  async function cancel(o: StationOrder) {
    const why = prompt(t("sv.why_cancel_client")) ?? ""; if (!why.trim()) return;
    const r = await cancelFuelOrder(supabase(), o.id, why); if (r.error) setError(friendlyErrorIn(r.error, lang)); else done(t("sv.fu_cancelled_refund"));
  }
  const waiting = panel.orders.filter(o => o.status === "submitted"); const active = panel.orders.filter(o => o.status === "reserved" || o.status === "paid" || o.status === "awaiting_payment");
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/combustivel/meus">← {t("sv.fu_my_stations")}</a>
    <h1 style={{ margin: 0 }}>⚙️ {st.name}</h1>
    <small>{stationRef(st.ref_no)} · {st.status === "approved" ? "✅ " + t("sv.fu_approved") : st.status === "pending" ? "⏳ " + t("sv.fu_pending") : "⛔ " + t("sv.fu_suspended") + (st.admin_note ? ": " + st.admin_note : "")}</small>
    <div className="row"><a className="btn secondary" href={`/combustivel/${id}`}>👁️ {t("sv.see_page")}</a><a className="btn secondary" href={`/combustivel/${id}/editar`}>✏️ {t("common.edit")}</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <section className="stack" aria-labelledby="produtos" style={{ gap: 8 }}>
      <h2 id="produtos" style={{ margin: 0 }}>{t("sv.fu_has_or_not")}</h2>
      <small>{t("sv.fu_has_or_not_hint")}</small>
      {products.map(p => <ProductControl key={p.id} p={p} onSaved={done} onError={setError} />)}
    </section>
    {(st.accepts_reservations || active.length > 0) && <section className="card stack" style={{ gap: 8 }} aria-labelledby="levantar">
      <h2 id="levantar" style={{ margin: 0 }}>🧾 {t("sv.fu_client_qr")}</h2>
      <small>{t("sv.fu_client_qr_hint")}</small>
      <form className="row" onSubmit={doCheck}>
        <input aria-label={t("sv.fu_order_code")} value={code} onChange={e => setCode(e.target.value)} placeholder="CB-XXXXXX" autoCapitalize="characters" style={{ flex: 1, minWidth: 180, fontSize: 22, letterSpacing: 2 }} />
        <button type="submit">{t("sv.validate")}</button>
      </form>
      {check && <p role="status" className={check.result === "ok" ? "ok" : "error"} style={{ fontSize: 20, margin: 0 }}>{tc(FUEL_COLLECT_LABELS[check.result] ?? check.result)}
        {check.result === "ok" && check.product ? ` · ${tc(fuelQuantityText(check.product, Number(check.quantity)))} ${tc(FUEL_PRODUCTS[check.product].label).toLowerCase()} · ${check.buyer}${check.plate ? " · " + check.plate : ""} · ${check.method === "prepaid" ? t("sv.fu_already_paid") : t("sv.fu_charge", { total: formatPrice(Number(check.total)), fee: formatPrice(Number(check.fee ?? 0)) })}` : check.buyer ? " · " + check.buyer : ""}</p>}
    </section>}
    {waiting.length > 0 && <section className="stack" style={{ gap: 8 }}><h2 style={{ margin: 0 }}>💳 {t("sv.fu_pay_to_confirm", { n: waiting.length })}</h2>
      {waiting.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
        <strong>{o.buyer_name} — {tc(fuelQuantityText(o.product, o.quantity))} {tc(FUEL_PRODUCTS[o.product].label).toLowerCase()} = {formatPrice(o.total)}</strong>
        <small>{fuelOrderRef(o.ref_no)} · {o.pay_method ? tc(PLAN_METHOD_LABELS[o.pay_method as PaymentMethodPlan]) : ""} · {t("sv.ref_short")}: <strong>{o.reference}</strong>{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</small>
        <small>{t("sv.fu_check_bank", { total: formatPrice(o.total), ref: fuelOrderRef(o.ref_no), fee: formatPrice(o.fee_amount) })}</small>
        <div className="row">{o.proof_path && <button type="button" className="secondary" onClick={() => void openProof(o.proof_path!, setError, t("sv.proof_open_fail"))}>📄 {t("sv.see_proof")}</button>}<button type="button" onClick={() => void decide(o, true)}>✅ {t("sv.got_money")}</button><button type="button" className="secondary" onClick={() => void decide(o, false)}>❌ {t("sv.not_received")}</button></div>
      </article>)}</section>}
    {active.length > 0 && <details className="card"><summary><strong>🧾 {t("sv.fu_active", { n: active.length })}</strong></summary>
      {active.map(o => <div key={o.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
        <span>{fuelOrderRef(o.ref_no)} · {o.buyer_name} · {tc(fuelQuantityText(o.product, o.quantity))} {tc(FUEL_PRODUCTS[o.product].short).toLowerCase()} · {tc(FUEL_ORDER_STATUS_LABELS[o.status]).split("—")[0]}{o.hold_until ? " · " + tc(holdText(o.hold_until)) : ""}</span>
        <button type="button" className="secondary" onClick={() => void cancel(o)}>{t("common.cancel")}</button>
      </div>)}</details>}
    <section className="stats" aria-label={t("sv.summary")}>
      <div className="stat"><strong>{formatPrice(panel.collected_today)}</strong><span>{t("sv.fu_collected_today")}</span></div>
      <div className="stat"><strong>{formatPrice(panel.collected_total)}</strong><span>{t("sv.fu_collected_total")}</span></div>
    </section>
    <section className="card stack" style={{ gap: 8 }} aria-labelledby="comissao">
      <h2 id="comissao" style={{ margin: 0 }}>🧾 {t("sv.fu_fee_title", { pct: panel.fee_pct })}</h2>
      <small>{t("sv.fu_fee_explain")}</small>
      <span>{t("sv.total")}: {formatPrice(panel.fee_total)} · {t("sv.to_pay")}: <strong>{formatPrice(panel.fee_due)}</strong></span>
      {panel.fee_overdue && <p className="error" style={{ margin: 0 }}>{t("sv.fu_fee_overdue")}</p>}
      {panel.fee_pending && <span>⏳ {t("sv.pay_sent_waiting")}</span>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <FeePayBox stationId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setPayOpen(true)}>{t("sv.fu_pay_fee")}</button>)}
      <small>{t("sv.fu_pay_fee_hint")}</small>
    </section>
  </main>;
}

function FeePayBox({ stationId, uid, amount, settings, onDone, onClose }: { stationId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
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
      const r = await submitFuelFee(supabase(), stationId, { method, reference, proofPath: proof }); if (r.error) throw r.error;
      onDone(t("sv.fu_fee_sent"));
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="card stack" style={{ gap: 10 }}>
    <strong>{t("sv.amount_to_pay")}: {formatPrice(amount)}</strong>
    <strong>1. {t("sv.pay_ho_details")}</strong>
    <PaymentDetails s={settings} />
    <strong>2. {t("sv.tell_how_paid")}</strong>
    <div className="row" role="radiogroup" aria-label={t("sv.how_paid")}>{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
    <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
    <label>{t("sv.proof_opt")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" disabled={busy} onClick={() => void send()}>{busy ? t("sv.sending") : t("sv.send_payment")}</button><button type="button" className="secondary" onClick={onClose}>{t("common.cancel")}</button></div>
  </div>;
}

/** Administração: aprovar postos, comissões e regras. */
export function AdminFuel() {
  const { lang, t, tc } = useT();
  const [stations, setStations] = useState<(FuelStation & { municipalities?: { name: string } | null })[]>([]); const [status, setStatus] = useState<"pending" | "approved" | "suspended">("pending");
  const [payments, setPayments] = useState<AdminFuelPayment[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [orderStatus, setOrderStatus] = useState<FuelOrderStatus | "">("submitted"); const [orders, setOrders] = useState<AdminFuelOrder[]>([]);
  async function load() {
    const [a, b, c, d] = await Promise.all([listStationsForAdmin(supabase(), status), listFuelPaymentsForAdmin(supabase(), "pending"), getPlatformSettings(supabase()),
      listFuelOrdersForAdmin(supabase(), orderStatus)]);
    setStations(a.data); setPayments(b.data); setS(c.data); setOrders(d.data); if (a.error || b.error || d.error) setError(friendlyErrorIn(a.error ?? b.error ?? d.error, lang));
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: FuelStation, to: "approved" | "suspended" | "pending") {
    const note = to === "suspended" ? prompt(t("sv.why_suspend")) ?? "" : "";
    if (to === "suspended" && !note.trim()) return;
    const r = await setStationStatus(supabase(), x.id, to, note); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(to === "approved" ? t("sv.fu_station_approved") : t("sv.done")); await load(); }
  }
  async function decide(p: AdminFuelPayment, ok: boolean) {
    const note = ok ? "" : prompt(t("sv.why_not_confirm")) ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(t("sv.confirm_amount_from", { amount: formatPrice(p.amount), name: p.station_name }))) return;
    const r = await decideFuelFee(supabase(), p.id, ok, note); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("sv.done")); await load(); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const pct = Number(s.fuel_fee_pct), mins = Number(s.fuel_pay_minutes);
    if (!(pct >= 0 && pct <= 30) || !Number.isInteger(mins) || mins < 10 || mins > 1440) { setError(t("sv.fu_check_pct")); return; }
    const r = await updatePlatformSettings(supabase(), { fuel_fee_pct: pct, fuel_pay_minutes: mins }); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setError(""); setNotice(t("sv.rules_saved")); }
  }
  async function openProof(path: string) { const { data } = await paymentProofUrl(supabase(), path); if (data) window.open(data, "_blank", "noopener"); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>⛽ {t("sv.fu_title")}</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card row" style={{ alignItems: "end" }} onSubmit={save}>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.fu_adm_fee")}<input value={String(s.fuel_fee_pct ?? "")} onChange={e => setS({ ...s, fuel_fee_pct: e.target.value })} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 160 }}>{t("sv.fu_adm_minutes")}<input value={String(s.fuel_pay_minutes ?? "")} onChange={e => setS({ ...s, fuel_pay_minutes: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      <button type="submit">{t("common.save")}</button>
    </form>}
    <div className="chips" role="group" aria-label={t("sv.fu_stations")}>{([["pending", "⏳ " + t("sv.to_approve")], ["approved", "✅ " + t("sv.approved_pl")], ["suspended", "⛔ " + t("sv.suspended_pl")]] as const).map(([k, l]) =>
      <button key={k} type="button" className={"chip" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}</div>
    {stations.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("sv.fu_none_list")}</p>}
    {stations.map(x => <article key={x.id} className="card" style={{ gap: 6 }}>
      <a href={"/combustivel/" + x.id}><strong>{x.name}</strong></a>
      <small>{stationRef(x.ref_no)} · {tc(FUEL_KIND_LABELS[x.kind])} · {x.municipalities?.name ?? "—"}{x.phone ? " · 📞 " + x.phone : ""}{x.address ? " · " + x.address : ""}</small>
      <div className="row">
        {x.status !== "approved" && <button type="button" onClick={() => void setSt(x, "approved")}>✅ {t("sv.approve")}</button>}
        {x.status !== "suspended" && <button type="button" className="secondary" onClick={() => void setSt(x, "suspended")}>⛔ {t("sv.suspend")}</button>}
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>🧾 {t("sv.fu_comm_to_confirm", { n: payments.length })}</h3>
    {payments.map(p => <article key={p.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(p.amount)} · {p.station_name}</strong>
      <small>{stationRef(p.station_ref)} · {p.owner_name} · {tc(PLAN_METHOD_LABELS[p.method as PaymentMethodPlan])}{p.reference ? " · " + t("sv.ref_short") + ": " + p.reference : ""}</small>
      <div className="row">{p.proof_path && <button type="button" className="secondary" onClick={() => void openProof(p.proof_path!)}>📄 {t("sv.proof")}</button>}
        <button type="button" onClick={() => void decide(p, true)}>✅ {t("common.confirm")}</button><button type="button" className="secondary" onClick={() => void decide(p, false)}>❌ {t("sv.refuse")}</button></div>
    </article>)}
    <h3 style={{ margin: 0 }}>🔎 {t("sv.fu_adm_prepaid")}</h3>
    <small>{t("sv.fu_adm_prepaid_hint")}</small>
    <div className="chips" role="group" aria-label={t("sv.fu_client_payments")}>{([["submitted", "⏳ " + t("sv.fu_to_confirm_station")], ["paid", "✅ " + t("sv.confirmed_pl")], ["rejected", "❌ " + t("sv.refused_pl")], ["", t("sv.all")]] as const).map(([k, l]) =>
      <button key={k || "all"} type="button" className={"chip" + (orderStatus === k ? " on" : "")} aria-pressed={orderStatus === k} onClick={() => setOrderStatus(k)}>{l}</button>)}</div>
    {orders.length === 0 && <p className="muted" style={{ margin: 0 }}>{t("sv.no_payments_list")}</p>}
    {orders.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(o.total)} · {o.station_name} · {o.buyer_name}</strong>
      <small>{fuelOrderRef(o.ref_no)} · {stationRef(o.station_ref)} · {tc(fuelQuantityText(o.product, o.quantity))} {tc(FUEL_PRODUCTS[o.product].short).toLowerCase()} · {t("sv.fee")} {formatPrice(o.fee_amount)}{o.reference ? " · " + t("sv.ref_short") + ": " + o.reference : ""} · {tc(FUEL_ORDER_STATUS_LABELS[o.status])}</small>
      <div className="row">{o.proof_path && <button type="button" className="secondary" onClick={() => void openProof(o.proof_path!)}>📄 {t("sv.proof")}</button>}
        <a className="btn secondary" href={"/combustivel/v/" + o.qr_token}>🔳 {t("sv.see_by_qr")}</a></div>
    </article>)}
  </section>;
}

/** Página aberta ao ler o QR: confirma se o pedido é verdadeiro; o posto confirma o pagamento e entrega aqui. */
export function FuelVerify({ token }: { token: string }) {
  const { lang, t, tc } = useT();
  const [v, setV] = useState<FuelOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await fuelOrderByToken(supabase(), token); if (r.error) setError(friendlyErrorIn(r.error, lang)); setV(r.data ?? { result: "invalid" }); }
  useEffect(() => { void load(); }, [token]);
  if (!v) return <main><p>{t("sv.checking")}</p></main>;
  if (v.result !== "ok") return <main className="stack" style={{ maxWidth: 640 }}>
    <h1 style={{ margin: 0 }}>❌ {t("sv.qr_unknown")}</h1>
    <p className="error" role="alert" style={{ fontSize: 20 }}>{t("sv.fu_qr_unknown_text")}</p>
    <a href="/combustivel">← {t("sv.fu_title")}</a>
  </main>;
  const live = v.status === "reserved" || v.status === "paid" || v.status === "submitted";
  async function deliver() {
    if (!v?.code || !v.station_id) return;
    if (!confirm(t("sv.fu_deliver_q", { qty: tc(fuelQuantityText(v.product!, v.quantity!)), name: v.buyer_name ?? "" }))) return;
    setBusy(true); const r = await collectFuel(supabase(), v.station_id, v.code); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(tc(FUEL_COLLECT_LABELS[r.data?.result ?? ""] ?? String(r.data?.result))); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    const note = ok ? "" : prompt(t("sv.why_not_confirm_client")) ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(t("sv.fu_confirm_station_acc", { amount: formatPrice(v.total ?? 0) }))) return;
    setBusy(true); const r = await decideFuelPayment(supabase(), v.id, ok, note); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok ? t("sv.pay_confirmed_deliver") : t("sv.pay_refused")); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 680 }}>
    <a href="/combustivel">← {t("sv.fu_title")}</a>
    <h1 style={{ margin: 0 }}>{v.status === "collected" ? "⚠️ " + t("sv.qr_used") : live ? "✅ " + t("sv.qr_genuine") : "❌ " + t("sv.order_void")}</h1>
    <p className={live ? "ok" : "error"} role="status" style={{ fontSize: 20, margin: 0 }}>
      {fuelOrderRef(v.ref_no)} · {v.station_name} · {v.product ? tc(FUEL_PRODUCTS[v.product].label) : ""} · {v.product ? tc(fuelQuantityText(v.product, v.quantity ?? 0)) : ""}<br />{v.status ? tc(FUEL_ORDER_STATUS_LABELS[v.status]) : ""}
    </p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {v.role === "other" && <p className="card" style={{ margin: 0 }}>{t("sv.fu_other_role", { name: v.station_name ?? "" })} <a href={"/conta/login?voltar=/combustivel/v/" + token}>{t("auth.login")}</a></p>}
    {v.role !== "other" && <>
      <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)", overflowWrap: "anywhere" }}>
        <dt>{t("sv.client")}</dt><dd><strong>{v.buyer_name}</strong>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}{v.plate ? " · " + v.plate : ""}</dd>
        <dt>{t("sv.fu_fuel_gas")}</dt><dd>{formatPrice(v.subtotal ?? 0)}</dd>
        <dt>{t("sv.app_fee")}{v.fee_pct ? ` (${v.fee_pct}%)` : ""}</dt><dd>{formatPrice(v.fee_amount ?? 0)}</dd>
        <dt>{t("sv.total")}</dt><dd><strong>{formatPrice(v.total ?? 0)}</strong> · {v.method === "prepaid" ? t("sv.fu_paid_ahead") : t("sv.fu_pays_station")}</dd>
        {v.reference && <><dt>{t("sv.pay_ref")}</dt><dd><strong>{v.reference}</strong></dd></>}
        {v.code && <><dt>{t("sv.code")}</dt><dd><strong>{v.code}</strong></dd></>}
      </dl>
      {v.proof_path && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void openProof(v.proof_path!, setError, t("sv.proof_open_fail"))}>📄 {t("sv.see_proof")}</button>}
      {v.role === "station" && v.status === "submitted" && <div className="card stack" style={{ gap: 8 }}>
        <strong>1. {t("sv.fu_check_station_acc", { total: formatPrice(v.total ?? 0), ref: fuelOrderRef(v.ref_no) })}</strong>
        <div className="row"><button type="button" disabled={busy} onClick={() => void decide(true)}>✅ {t("sv.got_money")}</button><button type="button" className="secondary" disabled={busy} onClick={() => void decide(false)}>❌ {t("sv.not_received")}</button></div>
      </div>}
      {v.role === "station" && (v.status === "reserved" || v.status === "paid") && <button type="button" disabled={busy} style={{ fontSize: 22 }} onClick={() => void deliver()}>
        {v.status === "reserved" ? "⛽ " + t("sv.fu_charge_deliver", { total: formatPrice(v.total ?? 0) }) : "⛽ " + t("sv.fu_paid_deliver")}</button>}
    </>}
  </main>;
}
