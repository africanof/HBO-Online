"use client";
import { useEffect, useState } from "react";
import { fuelFeed, getStation, listMyStations, listStationProducts, getStationPay, saveStation, updateFuelProduct, reportFuel, listMyFuelAlerts, addFuelAlert,
  removeFuelAlert, reserveFuel, submitFuelPayment, decideFuelPayment, collectFuel, cancelFuelOrder, myFuelOrders, stationPanel, submitFuelFee, listStationsForAdmin,
  setStationStatus, listFuelPaymentsForAdmin, fuelOrderByToken, listFuelOrdersForAdmin, fuelFeeBreakdown, fuelFeeNotice, fuelVerifyUrl, fuelTransferNote, sha256Hex, decideFuelFee, getPlatformSettings, updatePlatformSettings, paymentProofUrl, uploadPaymentProof, validateDocument,
  fuelQuantityText, fuelPriceText, minutesAgoText, fuelIsStale, fuelStatusLine, fuelReportsText, fuelShareMessage, validateStation, validateFuelReserve, stationRef,
  fuelOrderRef, holdText, qrSvgPath, formatPrice, friendlyError, whatsappShareUrl, whatsappLink, pointFrom, FUEL_PRODUCTS, FUEL_PRODUCT_LIST, FUEL_KIND_LABELS, FUEL_STATUS_LABELS,
  FUEL_QUEUE_LABELS, FUEL_METHOD_LABELS, FUEL_ORDER_STATUS_LABELS, FUEL_COLLECT_LABELS, FUEL_ACTIVE_ORDER, PLAN_METHOD_LABELS,
  type FuelProduct, type FuelRow, type FuelStation, type FuelProductRow, type FuelKind, type FuelMethod, type FuelStatus, type FuelQueue, type MyFuelOrder,
  type StationPanel, type StationOrder, type FuelOrderView, type AdminFuelOrder, type FuelOrderStatus, type AdminFuelPayment, type FuelCollectResult, type PlatformSettings, type PaymentMethodPlan, type GeoPoint } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { SITE_URL } from "../lib/site";
import { PlaceFields, PlaceView } from "./Place";
import { PaymentDetails } from "./Plans";
import { useTerritory } from "./Directory";

const STATUS_COLORS: Record<FuelStatus, string> = { available: "var(--ok)", low: "var(--gold-text)", out: "var(--danger)", unknown: "var(--muted)" };
function StatusBadge({ s }: { s: FuelStatus }) {
  return <span className="badge" style={{ borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s], fontWeight: 800 }}>{FUEL_STATUS_LABELS[s]}</span>;
}
/** QR único do pedido: leva ao site, que confirma se é verdadeiro. Por baixo, o código para escrever à mão. */
function Code({ code, token }: { code: string; token?: string | null }) {
  const q = qrSvgPath(token ? fuelVerifyUrl(SITE_URL, token) : code);
  return <div className="card" style={{ justifyItems: "center", textAlign: "center", gap: 6 }}>
    <svg role="img" aria-label={"Código QR " + code} viewBox={`-2 -2 ${q.size + 4} ${q.size + 4}`} width={170} height={170} style={{ background: "#fff", borderRadius: 8 }} shapeRendering="crispEdges"><path d={q.d} fill="#000" /></svg>
    <strong style={{ fontSize: 26, letterSpacing: 3 }}>{code}</strong>
    <small>Mostre este QR no posto. O posto lê com a câmara e o site confirma que é verdadeiro.</small>
  </div>;
}
async function openProof(path: string, onError: (m: string) => void) {
  const r = await paymentProofUrl(supabase(), path);
  if (r.data) window.open(r.data, "_blank", "noopener"); else onError("Não foi possível abrir o comprovativo.");
}

/** Lista pública: onde há combustível e gás. */
export function FuelList() {
  const [product, setProduct] = useState<FuelProduct | "">(""); const [municipalityId, setMunicipalityId] = useState(""); const { municipalities } = useTerritory();
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; product: FuelProduct; municipality_id: string | null }[]>([]);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await fuelFeed(supabase(), { product, municipalityId }); if (r.error) setError(friendlyError(r.error)); else { setError(""); setRows(r.data); } }
  useEffect(() => { void load(); }, [product, municipalityId]);
  useEffect(() => { void currentUserId().then(async u => { setUid(u); if (u) setAlerts((await listMyFuelAlerts(supabase())).data); }); }, []);
  const alert = product ? alerts.find(a => a.product === product && (a.municipality_id ?? "") === municipalityId) : undefined;
  async function toggleAlert() {
    if (!uid) { window.location.href = "/conta/login?voltar=/combustivel"; return; }
    if (!product) return;
    const r = alert ? await removeFuelAlert(supabase(), alert.id) : await addFuelAlert(supabase(), uid, product, municipalityId || null);
    if (r.error) { setError(friendlyError(r.error)); return; }
    setNotice(alert ? "Aviso desligado." : `Pronto! Avisamos quando houver ${FUEL_PRODUCTS[product].label.toLowerCase()}${municipalityId ? " neste município" : ""}.`);
    setAlerts((await listMyFuelAlerts(supabase())).data);
  }
  const has = rows?.filter(r => r.status === "available" || r.status === "low").length ?? 0;
  return <main className="stack">
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h1 style={{ margin: 0 }}>⛽ Combustível e gás</h1>
      <div className="row"><a className="btn secondary" href="/combustivel/pedidos">🧾 As minhas reservas</a><a className="btn secondary" href="/combustivel/meus">⛽ Tenho um posto</a></div>
    </div>
    <p className="muted" style={{ margin: 0 }}>Veja onde há gasolina, gasóleo, petróleo e gás agora. Os postos marcam quando há, e quem passa confirma.</p>
    <div className="chips" role="group" aria-label="Produto">
      <button type="button" className={"chip" + (product === "" ? " on" : "")} aria-pressed={product === ""} onClick={() => setProduct("")}>Todos</button>
      {FUEL_PRODUCT_LIST.map(p => <button key={p} type="button" className={"chip" + (product === p ? " on" : "")} aria-pressed={product === p} onClick={() => setProduct(p)}>{FUEL_PRODUCTS[p].icon} {FUEL_PRODUCTS[p].short}</button>)}
    </div>
    <div className="row" style={{ alignItems: "end" }}>
      <label style={{ flex: 1, minWidth: 200 }}>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">Todos</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      {product && <button type="button" className={alert ? "secondary" : ""} aria-pressed={!!alert} onClick={() => void toggleAlert()}>{alert ? "🔕 Desligar aviso" : `🔔 Avisar-me quando houver ${FUEL_PRODUCTS[product].short.toLowerCase()}`}</button>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {rows !== null && <p role="status" style={{ margin: 0, fontWeight: 700 }}>{has ? `🟢 ${has} ${has === 1 ? "sítio com" : "sítios com"} ${product ? FUEL_PRODUCTS[product].label.toLowerCase() : "combustível ou gás"} agora` : "🔴 Neste momento ninguém marcou que há. Peça um aviso!"}</p>}
    {rows === null ? <p>A carregar…</p> : rows.length === 0 ? <p className="card">Ainda não há postos registados aqui. Tem um posto ou vende gás? <a href="/combustivel/registar">Registe-o grátis</a>.</p> :
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>{rows.map(r => <a key={r.product_id} href={"/combustivel/" + r.station_id} className="card" style={{ color: "inherit", textDecoration: "none", gap: 6 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 18 }}>{FUEL_PRODUCTS[r.product].icon} {FUEL_PRODUCTS[r.product].label}</strong><StatusBadge s={r.status} /></div>
        <span><strong>{r.station_name}</strong>{r.municipality_name ? " · " + r.municipality_name : ""}</span>
        <small>{fuelStatusLine(r)}{fuelIsStale(r.status_at) && r.status !== "unknown" ? " · ⚠️ pode ter mudado" : ""}</small>
        {r.price != null && <span className="price" style={{ fontSize: 18 }}>{fuelPriceText(r.product, r.price)}</span>}
        {(r.yes_2h > 0 || r.no_2h > 0) && <small>{fuelReportsText(r.yes_2h, r.no_2h)}</small>}
        {r.accepts_reservations && r.reservable_left > 0 && (r.status === "available" || r.status === "low") && <small className="ok">🧾 Pode reservar ({fuelQuantityText(r.product, r.reservable_left)} disponíveis)</small>}
      </a>)}</div>}
  </main>;
}

/** Página do posto: produtos, confirmar «há / acabou», reservar. */
export function StationPage({ id }: { id: string }) {
  const [rows, setRows] = useState<FuelRow[] | null>(null); const [st, setSt] = useState<FuelStation | null>(null); const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const [a, b] = await Promise.all([fuelFeed(supabase(), { stationId: id }), getStation(supabase(), id)]); setRows(a.data); setSt(b.data); }
  useEffect(() => { void load(); void currentUserId().then(setUid); }, [id]);
  if (rows === null) return <main><p>A carregar…</p></main>;
  if (!st) return <main className="stack"><h1>Posto não encontrado</h1><a href="/combustivel">← Combustível e gás</a></main>;
  const mine = uid === st.owner_id; const first = rows[0];
  async function report(r: FuelRow, has: boolean) {
    if (!uid) { window.location.href = "/conta/login?voltar=/combustivel/" + id; return; }
    const x = await reportFuel(supabase(), r.product_id, has);
    if (x.error) { setError(friendlyError(x.error)); setNotice(""); } else { setError(""); setNotice("Obrigado! A sua informação ajuda outras pessoas."); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/combustivel">← Combustível e gás</a>
    <h1 style={{ margin: 0 }}>{st.name}</h1>
    <small className="muted">{FUEL_KIND_LABELS[st.kind]} · {stationRef(st.ref_no)}{first?.municipality_name ? " · " + first.municipality_name : ""}</small>
    {st.status !== "approved" && <p className="banner yellow" style={{ margin: 0 }}>{st.status === "pending" ? "⏳ À espera de aprovação da administração: ainda não aparece ao público." : "⛔ Suspenso" + (st.admin_note ? ": " + st.admin_note : "")}</p>}
    {mine && <div className="row"><a className="btn" href={`/combustivel/${id}/gerir`}>⚙️ Gerir o posto</a><a className="btn secondary" href={`/combustivel/${id}/editar`}>✏️ Editar</a></div>}
    {(st.address || st.opening_hours) && <p style={{ margin: 0 }}>{st.address}{st.address && st.opening_hours ? " · " : ""}{st.opening_hours ? "🕒 " + st.opening_hours : ""}</p>}
    <div className="row">
      {st.phone && <a className="btn secondary" href={"tel:" + st.phone}>📞 Ligar</a>}
      {whatsappLink(st.whatsapp, `Olá, vi o ${st.name} no Huambo Online.`) && <a className="btn secondary" href={whatsappLink(st.whatsapp, `Olá, vi o ${st.name} no Huambo Online.`)!} target="_blank" rel="noopener">WhatsApp</a>}
      {first && <a className="btn secondary" href={whatsappShareUrl(fuelShareMessage(typeof window === "undefined" ? "" : window.location.origin, first))} target="_blank" rel="noopener">📲 Partilhar</a>}
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {rows.length === 0 && <p className="card">Este posto ainda não indicou produtos.</p>}
    {rows.map(r => <section key={r.product_id} className="card stack" style={{ gap: 8 }} aria-labelledby={"p-" + r.product_id}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h2 id={"p-" + r.product_id} style={{ margin: 0, fontSize: 21 }}>{FUEL_PRODUCTS[r.product].icon} {FUEL_PRODUCTS[r.product].label}</h2><StatusBadge s={r.status} /></div>
      <span>{fuelStatusLine(r)}{fuelIsStale(r.status_at) && r.status !== "unknown" ? " · ⚠️ pode ter mudado" : ""}</span>
      <strong className="price" style={{ fontSize: 20 }}>{fuelPriceText(r.product, r.price)}</strong>
      {r.note && <span>{r.note}</span>}
      {(r.yes_2h > 0 || r.no_2h > 0) && <small>{fuelReportsText(r.yes_2h, r.no_2h)}</small>}
      {!mine && <div className="row"><span style={{ alignSelf: "center" }}>Passou por aqui?</span>
        <button type="button" className="secondary" onClick={() => void report(r, true)}>👍 Há</button>
        <button type="button" className="secondary" onClick={() => void report(r, false)}>👎 Já acabou</button></div>}
      {!mine && r.accepts_reservations && (r.status === "available" || r.status === "low") && r.reservable_left > 0 && r.price != null && (open === r.product_id
        ? <ReserveForm r={r} uid={uid} onClose={() => setOpen(null)} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setOpen(r.product_id)}>🧾 Reservar ({fuelQuantityText(r.product, r.reservable_left)} disponíveis)</button>)}
    </section>)}
    <PlaceView directions={st.directions} lat={st.geo_lat} lng={st.geo_lng} />
    <p className="muted" style={{ margin: 0 }}>A informação é dada pelo posto e por quem passa. Antes de fazer uma viagem longa, ligue para o posto.</p>
  </main>;
}

function ReserveForm({ r, uid, onClose }: { r: FuelRow; uid: string | null; onClose: () => void }) {
  const gas = FUEL_PRODUCTS[r.product].gas;
  const [method, setMethod] = useState<FuelMethod>("at_station"); const [qty, setQty] = useState(gas ? "1" : "20"); const [name, setName] = useState(""); const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [feePct, setFeePct] = useState<number | null>(null); const [agree, setAgree] = useState(false);
  useEffect(() => { void getPlatformSettings(supabase()).then(s => setFeePct(Number(s.data?.fuel_fee_pct ?? 10))); }, []);
  if (!uid) return <a className="btn" href={"/conta/login?voltar=/combustivel/" + r.station_id}>Entrar para reservar</a>;
  const q = Number(qty.replace(",", "."));
  const sum = q > 0 && r.price != null && feePct != null ? fuelFeeBreakdown(r.price, q, feePct) : null;
  async function send(e: React.FormEvent) {
    e.preventDefault(); const bad = validateFuelReserve(r, q, name); if (bad) { setError(bad); return; }
    if (!agree) { setError("Confirme que percebeu a taxa de serviço do APP."); return; }
    setBusy(true); setError("");
    const x = await reserveFuel(supabase(), r.product_id, q, method, name, phone, plate); setBusy(false);
    if (x.error) setError(friendlyError(x.error)); else window.location.href = "/combustivel/pedidos";
  }
  return <form className="card stack" style={{ gap: 8 }} onSubmit={send}>
    {r.accepts_prepay && <div className="row" role="radiogroup" aria-label="Como quer pagar">{(["at_station", "prepaid"] as FuelMethod[]).map(m =>
      <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{FUEL_METHOD_LABELS[m]}</button>)}</div>}
    <label>{gas ? "Quantas botijas?" : "Quantos litros?"}<input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" /></label>
    <small>Máximo por pessoa: {fuelQuantityText(r.product, r.max_per_order)}.</small>
    <label>O seu nome<input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
    <label>Telefone (opcional)<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} /></label>
    {!gas && <label>Matrícula (opcional)<input value={plate} onChange={e => setPlate(e.target.value)} maxLength={20} placeholder="LD-12-34-AB" autoCapitalize="characters" /></label>}
    {sum && <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, 1fr) auto" }} aria-label="Contas">
      <dt>{FUEL_PRODUCTS[r.product].label}</dt><dd>{formatPrice(sum.subtotal)}</dd>
      <dt>Taxa de serviço do APP ({feePct}%)</dt><dd>{formatPrice(sum.fee)}</dd>
      <dt><strong>Total a pagar ao posto</strong></dt><dd><strong>{formatPrice(sum.total)}</strong></dd>
    </dl>}
    <label className="row" style={{ alignItems: "flex-start", gap: 8, fontWeight: 400 }}><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ width: 24, height: 24, flex: "none" }} />
      <span>{fuelFeeNotice(feePct)} Percebi e aceito.</span></label>
    <small>{method === "at_station" ? `Recebe já um QR único. Vá ao posto em até ${Math.round(r.hold_minutes / 60 * 10) / 10} h, mostre o QR e pague lá.` : "Depois de reservar, paga para a conta do posto e envia a fotografia do comprovativo. Recebe logo um QR único; o posto confirma o pagamento."}</small>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="submit" disabled={busy}>{busy ? "A reservar…" : "✅ Reservar"}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></div>
  </form>;
}

/** As minhas reservas. */
export function MyFuelOrders() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<MyFuelOrder[] | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await myFuelOrders(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>🧾 As minhas reservas</h1><a className="btn" href="/conta/login?voltar=/combustivel/pedidos">Entrar</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/combustivel">← Combustível e gás</a>
    <h1 style={{ margin: 0 }}>🧾 As minhas reservas</h1>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não fez reservas. <a href="/combustivel">Ver onde há</a>.</p> :
      items.map(o => <OrderCard key={o.id} o={o} onDone={m => { setError(""); setNotice(m); void load(); }} onError={m => { setNotice(""); setError(m); }} />)}
  </main>;
}
function OrderCard({ o, onDone, onError }: { o: MyFuelOrder; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">(o.pay_express ? "multicaixa_express" : "bank_transfer"); const [reference, setReference] = useState(""); const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  async function pay() {
    if (!file) { onError("Junte a fotografia do comprovativo de pagamento."); return; }
    const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { onError(bad); return; }
    if (reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { onError("Escreva a referência ou o número da operação (como está no comprovativo)."); return; }
    setBusy(true);
    try {
      const uid = await currentUserId(); if (!uid) throw new Error("Entre na sua conta.");
      const hash = sha256Hex(await file.arrayBuffer());
      const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo.");
      const r = await submitFuelPayment(supabase(), o.id, { method, reference, proofPath: up.data, proofHash: hash }); if (r.error) throw r.error;
      onDone("Comprovativo enviado. O seu QR já está pronto; o posto vai confirmar o pagamento.");
    } catch (e) { onError(friendlyError(e)); } finally { setBusy(false); }
  }
  async function cancel() { if (!confirm("Cancelar esta reserva?")) return; const r = await cancelFuelOrder(supabase(), o.id); if (r.error) onError(friendlyError(r.error)); else onDone("Reserva cancelada."); }
  const active = FUEL_ACTIVE_ORDER.includes(o.status);
  return <article className="card stack" style={{ gap: 8 }}>
    <a href={"/combustivel/" + o.station_id} style={{ fontWeight: 800, fontSize: 19 }}>{FUEL_PRODUCTS[o.product].icon} {o.station_name}</a>
    <small>{fuelOrderRef(o.ref_no)} · {FUEL_PRODUCTS[o.product].label} · {fuelQuantityText(o.product, o.quantity)}{o.plate ? " · " + o.plate : ""} · <strong>{formatPrice(o.total)}</strong>
      {o.fee_amount > 0 ? ` (${formatPrice(o.subtotal)} + ${formatPrice(o.fee_amount)} de taxa do APP)` : ""}</small>
    <span>{FUEL_ORDER_STATUS_LABELS[o.status]}{o.hold_until && (o.status === "reserved" || o.status === "paid") ? " · levantar " + holdText(o.hold_until) : ""}</span>
    {o.note && (o.status === "rejected" || o.status === "cancelled") && <span className="error">Motivo: {o.note}</span>}
    {o.code && (o.status === "reserved" || o.status === "paid" || o.status === "submitted") && <Code code={o.code} token={o.qr_token} />}
    {o.status === "submitted" && <small>O posto está a confirmar o pagamento na conta dele. Pode ir ao posto: lá verificam o QR e o comprovativo.</small>}
    {o.status === "reserved" && <small>Pague no posto, ao abastecer.</small>}
    {o.status === "awaiting_payment" && <div className="stack" style={{ gap: 8 }}>
      <strong>1. Pague {formatPrice(o.total)} ao posto{o.pay_by ? " " + holdText(o.pay_by) : ""}</strong>
      <dl className="facts card" style={{ margin: 0 }}>
        {o.pay_holder && <><dt>Titular</dt><dd>{o.pay_holder}</dd></>}
        {o.pay_iban && <><dt>IBAN</dt><dd><strong style={{ overflowWrap: "anywhere" }}>{o.pay_iban}</strong></dd></>}
        {o.pay_express && <><dt>Multicaixa Express</dt><dd><strong>{o.pay_express}</strong></dd></>}
      </dl>
      {o.pay_note && <span>{o.pay_note}</span>}
      <p className="banner yellow" style={{ margin: 0, padding: 12, display: "block" }}>✍️ {fuelTransferNote(o.ref_no)}<br />⚠️ Pague só para a conta do posto mostrada aqui. Nunca pague a quem lhe ligar a pedir outra conta.</p>
      <strong>2. Envie o comprovativo</strong>
      <div className="row" role="radiogroup" aria-label="Como pagou">{(["multicaixa_express", "bank_transfer"] as const).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PLAN_METHOD_LABELS[m]}</button>)}</div>
      <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
      <label>Fotografia ou PDF do comprovativo (obrigatório)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <button type="button" disabled={busy} onClick={() => void pay()} style={{ justifySelf: "start" }}>{busy ? "A enviar…" : "✅ Já paguei — enviar comprovativo"}</button>
    </div>}
    {active && (o.status === "reserved" || o.status === "awaiting_payment") && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void cancel()}>Cancelar reserva</button>}
  </article>;
}

/** Os meus postos. */
export function MyStations() {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [items, setItems] = useState<FuelStation[] | null>(null);
  useEffect(() => { void currentUserId().then(async u => { setUid(u); if (u) setItems((await listMyStations(supabase(), u)).data); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><h1>⛽ Tenho um posto</h1><p>Registe o seu posto de combustível ou ponto de venda de gás e marque quando há. É grátis.</p><a className="btn" href="/conta/login?voltar=/combustivel/meus">Entrar</a></main>;
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href="/combustivel">← Combustível e gás</a>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><h1 style={{ margin: 0 }}>⛽ Os meus postos</h1><a className="btn" href="/combustivel/registar">➕ Registar posto</a></div>
    <p className="muted" style={{ margin: 0 }}>Registar e marcar quando há é grátis. Nas reservas, o cliente paga ao posto o combustível mais a taxa do APP; o posto entrega essa taxa ao Huambo Online.</p>
    {items === null ? <p>A carregar…</p> : items.length === 0 ? <p className="card">Ainda não registou nenhum posto.</p> :
      items.map(s => <a key={s.id} href={`/combustivel/${s.id}/gerir`} className="card" style={{ color: "inherit", textDecoration: "none", gap: 4 }}>
        <strong>{s.name}</strong>
        <small>{stationRef(s.ref_no)} · {FUEL_KIND_LABELS[s.kind]} · {s.status === "approved" ? "✅ Aprovado" : s.status === "pending" ? "⏳ À espera de aprovação" : "⛔ Suspenso"}</small>
      </a>)}
  </main>;
}

/** Registar ou editar posto. */
export function StationForm({ id }: { id?: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const { municipalities } = useTerritory();
  const [name, setName] = useState(""); const [kind, setKind] = useState<FuelKind>("fuel"); const [municipalityId, setMunicipalityId] = useState(""); const [address, setAddress] = useState("");
  const [directions, setDirections] = useState(""); const [point, setPoint] = useState<GeoPoint | null>(null); const [phone, setPhone] = useState(""); const [whatsapp, setWhatsapp] = useState("");
  const [hours, setHours] = useState(""); const [reserv, setReserv] = useState(true); const [prepay, setPrepay] = useState(false); const [hold, setHold] = useState("120");
  const [pay, setPay] = useState({ holder: "", iban: "", express: "", note: "" }); const [products, setProducts] = useState<FuelProduct[]>(["gasolina", "gasoleo"]);
  const [existing, setExisting] = useState<FuelProductRow[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [loaded, setLoaded] = useState(!id);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => { if (!id) return; void (async () => {
    const [a, b, c] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), getStationPay(supabase(), id)]);
    const s = a.data; if (!s) { setError("Posto não encontrado."); return; }
    setName(s.name); setKind(s.kind); setMunicipalityId(s.municipality_id ?? ""); setAddress(s.address ?? ""); setDirections(s.directions ?? ""); setPoint(pointFrom(s.geo_lat, s.geo_lng));
    setPhone(s.phone ?? ""); setWhatsapp(s.whatsapp ?? ""); setHours(s.opening_hours ?? ""); setReserv(s.accepts_reservations); setPrepay(s.accepts_prepay); setHold(String(s.hold_minutes));
    setPay(c); setExisting(b.data); setProducts(b.data.map(p => p.product)); setLoaded(true);
  })(); }, [id]);
  if (uid === undefined || !loaded) return <main><p>{error || "A carregar…"}</p></main>;
  if (!uid) return <main className="stack"><h1>⛽ Registar posto</h1><a className="btn" href="/conta/login?voltar=/combustivel/registar">Entrar</a></main>;
  const input = { name, kind, municipalityId, address, directions, point, phone, whatsapp, openingHours: hours, acceptsReservations: reserv, acceptsPrepay: prepay, holdMinutes: Number(hold), pay, products };
  const allowed = FUEL_PRODUCT_LIST.filter(p => kind === "both" || (kind === "gas") === FUEL_PRODUCTS[p].gas);
  async function save(e: React.FormEvent) {
    e.preventDefault(); const bad = validateStation(input); if (bad) { setError(bad); return; }
    setBusy(true); setError("");
    const r = await saveStation(supabase(), uid!, input, id, existing); setBusy(false);
    if (r.error || !r.data) setError(friendlyError(r.error)); else window.location.href = `/combustivel/${r.data.id}/gerir`;
  }
  return <main className="stack" style={{ maxWidth: 820 }}>
    <a href={id ? `/combustivel/${id}/gerir` : "/combustivel/meus"}>← Voltar</a>
    <h1 style={{ margin: 0 }}>{id ? "✏️ Editar posto" : "⛽ Registar posto"}</h1>
    <p className="muted" style={{ margin: 0 }}>{id ? "⚠️ Se mudar o nome, o local ou a conta para pagamentos, o posto volta a ficar à espera de aprovação da administração (para evitar burlas)." : "A administração confirma o posto antes de aparecer ao público (para evitar postos falsos)."}</p>
    <form className="stack" onSubmit={save}>
      <label>Nome<input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Ex.: Posto Sonangol do Kapango" /></label>
      <div className="row" role="radiogroup" aria-label="O que vende">{(Object.keys(FUEL_KIND_LABELS) as FuelKind[]).map(k =>
        <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "" : "secondary"} onClick={() => { setKind(k); setProducts(ps => ps.filter(p => k === "both" || (k === "gas") === FUEL_PRODUCTS[p].gas)); }}>{FUEL_KIND_LABELS[k]}</button>)}</div>
      <fieldset className="card stack" style={{ gap: 6 }}><legend style={{ fontWeight: 700 }}>Produtos que vende</legend>
        {allowed.map(p => <label key={p} className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={products.includes(p)} onChange={e => setProducts(ps => e.target.checked ? [...ps, p] : ps.filter(x => x !== p))} style={{ width: 22, height: 22 }} /> {FUEL_PRODUCTS[p].icon} {FUEL_PRODUCTS[p].label}</label>)}
      </fieldset>
      <label>Município<select value={municipalityId} onChange={e => setMunicipalityId(e.target.value)}><option value="">— Escolha —</option>{municipalities.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label>Endereço (opcional)<input value={address} onChange={e => setAddress(e.target.value)} maxLength={200} placeholder="Ex.: Estrada do Kapango, junto à rotunda" /></label>
      <PlaceFields directions={directions} point={point} onDirections={setDirections} onPoint={setPoint} hint="Marque a entrada do posto para as pessoas chegarem sem se perderem." />
      <div className="row">
        <label style={{ flex: 1, minWidth: 180 }}>Telefone<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" maxLength={20} /></label>
        <label style={{ flex: 1, minWidth: 180 }}>WhatsApp<input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} inputMode="tel" maxLength={20} /></label>
      </div>
      <label>Horário (opcional)<input value={hours} onChange={e => setHours(e.target.value)} maxLength={120} placeholder="Ex.: Todos os dias, 6h–22h" /></label>
      <fieldset className="card stack" style={{ gap: 8 }}><legend style={{ fontWeight: 700 }}>🧾 Reservas</legend>
        <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={reserv} onChange={e => setReserv(e.target.checked)} style={{ width: 22, height: 22 }} /> Aceito reservas (o cliente paga no posto)</label>
        <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={prepay} onChange={e => setPrepay(e.target.checked)} style={{ width: 22, height: 22 }} /> Aceito pagamento adiantado (Multicaixa Express ou transferência)</label>
        <label>Tempo para levantar (minutos)<input value={hold} onChange={e => setHold(e.target.value)} inputMode="numeric" /></label>
        {prepay && <>
          <label>Titular da conta<input value={pay.holder} onChange={e => setPay({ ...pay, holder: e.target.value })} maxLength={80} /></label>
          <label>IBAN<input value={pay.iban} onChange={e => setPay({ ...pay, iban: e.target.value })} maxLength={40} placeholder="AO06 …" /></label>
          <label>Multicaixa Express<input value={pay.express} onChange={e => setPay({ ...pay, express: e.target.value })} inputMode="tel" maxLength={20} /></label>
          <label>Nota para quem paga (opcional)<input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} maxLength={200} /></label>
        </>}
        <small>A quantidade que aceita reservar marca-se depois, no painel, produto a produto.</small>
      </fieldset>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy} style={{ justifySelf: "start" }}>{busy ? "A gravar…" : id ? "Guardar" : "✅ Registar posto"}</button>
    </form>
  </main>;
}

/** Linha de um produto no painel: marcar há / a acabar / esgotou em 1 toque. */
function ProductControl({ p, onSaved, onError }: { p: FuelProductRow; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const [price, setPrice] = useState(p.price == null ? "" : String(p.price)); const [qty, setQty] = useState(String(p.reservable_qty)); const [max, setMax] = useState(String(p.max_per_order));
  const [queue, setQueue] = useState<FuelQueue | "">(p.queue ?? ""); const [note, setNote] = useState(p.note ?? ""); const [busy, setBusy] = useState(false);
  async function save(status?: FuelStatus) {
    setBusy(true);
    const r = await updateFuelProduct(supabase(), p.id, { ...(status ? { status } : {}), price: price.trim() ? Number(price.replace(/\s/g, "").replace(",", ".")) : null,
      reservable_qty: Number(qty.replace(",", ".")) || 0, max_per_order: Number(max.replace(",", ".")) || 1, queue: queue || null, note: note.trim() || null });
    setBusy(false);
    if (r.error) onError(friendlyError(r.error)); else onSaved(status ? `${FUEL_PRODUCTS[p.product].label}: ${FUEL_STATUS_LABELS[status]}` : "Guardado.");
  }
  return <article className="card stack" style={{ gap: 8 }}>
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}><strong style={{ fontSize: 19 }}>{FUEL_PRODUCTS[p.product].icon} {FUEL_PRODUCTS[p.product].label}</strong><StatusBadge s={p.status} /></div>
    <small>Atualizado {minutesAgoText(p.status_at)}</small>
    <div className="row" role="group" aria-label={"Estado de " + FUEL_PRODUCTS[p.product].label}>
      <button type="button" disabled={busy} onClick={() => void save("available")}>🟢 Há</button>
      <button type="button" disabled={busy} className="secondary" onClick={() => void save("low")}>🟡 A acabar</button>
      <button type="button" disabled={busy} className="danger" onClick={() => void save("out")}>🔴 Esgotou</button>
    </div>
    <div className="row">
      <label style={{ flex: 1, minWidth: 130 }}>Preço (Kz/{FUEL_PRODUCTS[p.product].unit})<input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 130 }}>Para reservas ({FUEL_PRODUCTS[p.product].gas ? "botijas" : "litros"})<input value={qty} onChange={e => setQty(e.target.value)} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 130 }}>Máximo por pessoa<input value={max} onChange={e => setMax(e.target.value)} inputMode="decimal" /></label>
    </div>
    <div className="chips" role="group" aria-label="Fila">{(Object.keys(FUEL_QUEUE_LABELS) as FuelQueue[]).map(q =>
      <button key={q} type="button" className={"chip" + (queue === q ? " on" : "")} aria-pressed={queue === q} onClick={() => setQueue(queue === q ? "" : q)}>{FUEL_QUEUE_LABELS[q]}</button>)}</div>
    <label>Nota (opcional)<input value={note} onChange={e => setNote(e.target.value)} maxLength={160} placeholder="Ex.: Só até às 18h" /></label>
    <button type="button" className="secondary" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void save()}>💾 Guardar preço e quantidades</button>
  </article>;
}

/** Painel do posto. */
export function StationManage({ id }: { id: string }) {
  const [uid, setUid] = useState<string | null | undefined>(undefined); const [st, setSt] = useState<FuelStation | null>(null); const [products, setProducts] = useState<FuelProductRow[]>([]);
  const [panel, setPanel] = useState<StationPanel | null>(null); const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [code, setCode] = useState(""); const [check, setCheck] = useState<FuelCollectResult | null>(null); const [payOpen, setPayOpen] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() {
    const [a, b, c, s] = await Promise.all([getStation(supabase(), id), listStationProducts(supabase(), id), stationPanel(supabase(), id), getPlatformSettings(supabase())]);
    setSt(a.data); setProducts(b.data); setSettings(s.data); if (c.error) setError(friendlyError(c.error)); else setPanel(c.data);
  }
  useEffect(() => { void currentUserId().then(u => { setUid(u); if (u) void load(); }); }, [id]);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main className="stack"><a className="btn" href={`/conta/login?voltar=/combustivel/${id}/gerir`}>Entrar</a></main>;
  if (!st || !panel) return <main className="stack"><p className={error ? "error" : ""}>{error || "A carregar…"}</p><a href="/combustivel/meus">← Os meus postos</a></main>;
  const done = (m: string) => { setNotice(m); setError(""); void load(); };
  async function doCheck(e: React.FormEvent) {
    e.preventDefault(); if (!code.trim()) return; setCheck(null);
    const r = await collectFuel(supabase(), id, code);
    if (r.error) setError(friendlyError(r.error)); else { setCheck(r.data); setCode(""); if (r.data?.result === "ok") void load(); }
  }
  async function decide(o: StationOrder, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma? (o cliente vai ler)") ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirma que recebeu ${formatPrice(o.total)} de ${o.buyer_name}?`)) return;
    const r = await decideFuelPayment(supabase(), o.id, ok, note); if (r.error) setError(friendlyError(r.error)); else done(ok ? "Pagamento confirmado: o cliente recebeu o código." : "Pagamento recusado.");
  }
  async function cancel(o: StationOrder) {
    const why = prompt("Porque cancela? (o cliente vai ler)") ?? ""; if (!why.trim()) return;
    const r = await cancelFuelOrder(supabase(), o.id, why); if (r.error) setError(friendlyError(r.error)); else done("Reserva cancelada. Se o cliente já pagou, devolva o dinheiro.");
  }
  const waiting = panel.orders.filter(o => o.status === "submitted"); const active = panel.orders.filter(o => o.status === "reserved" || o.status === "paid" || o.status === "awaiting_payment");
  return <main className="stack" style={{ maxWidth: 900 }}>
    <a href="/combustivel/meus">← Os meus postos</a>
    <h1 style={{ margin: 0 }}>⚙️ {st.name}</h1>
    <small>{stationRef(st.ref_no)} · {st.status === "approved" ? "✅ Aprovado" : st.status === "pending" ? "⏳ À espera de aprovação" : "⛔ Suspenso" + (st.admin_note ? ": " + st.admin_note : "")}</small>
    <div className="row"><a className="btn secondary" href={`/combustivel/${id}`}>👁️ Ver a página</a><a className="btn secondary" href={`/combustivel/${id}/editar`}>✏️ Editar</a></div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <section className="stack" aria-labelledby="produtos" style={{ gap: 8 }}>
      <h2 id="produtos" style={{ margin: 0 }}>Há ou não há?</h2>
      <small>Carregue num botão sempre que mudar. Quem pediu aviso recebe logo uma notificação quando marcar «Há».</small>
      {products.map(p => <ProductControl key={p.id} p={p} onSaved={done} onError={setError} />)}
    </section>
    {(st.accepts_reservations || active.length > 0) && <section className="card stack" style={{ gap: 8 }} aria-labelledby="levantar">
      <h2 id="levantar" style={{ margin: 0 }}>🧾 Cliente com QR ou código</h2>
      <small>Leia o QR do cliente com a câmara do telemóvel: abre a página que confirma se é verdadeiro e mostra o comprovativo. Ou escreva o código.</small>
      <form className="row" onSubmit={doCheck}>
        <input aria-label="Código da reserva" value={code} onChange={e => setCode(e.target.value)} placeholder="CB-XXXXXX" autoCapitalize="characters" style={{ flex: 1, minWidth: 180, fontSize: 22, letterSpacing: 2 }} />
        <button type="submit">Validar</button>
      </form>
      {check && <p role="status" className={check.result === "ok" ? "ok" : "error"} style={{ fontSize: 20, margin: 0 }}>{FUEL_COLLECT_LABELS[check.result] ?? check.result}
        {check.result === "ok" && check.product ? ` · ${fuelQuantityText(check.product, Number(check.quantity))} ${FUEL_PRODUCTS[check.product].label.toLowerCase()} · ${check.buyer}${check.plate ? " · " + check.plate : ""} · ${check.method === "prepaid" ? "JÁ PAGO" : "cobrar " + formatPrice(Number(check.total)) + " (inclui taxa do APP " + formatPrice(Number(check.fee ?? 0)) + ")"}` : check.buyer ? " · " + check.buyer : ""}</p>}
    </section>}
    {waiting.length > 0 && <section className="stack" style={{ gap: 8 }}><h2 style={{ margin: 0 }}>💳 Pagamentos por confirmar ({waiting.length})</h2>
      {waiting.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
        <strong>{o.buyer_name} — {fuelQuantityText(o.product, o.quantity)} {FUEL_PRODUCTS[o.product].label.toLowerCase()} = {formatPrice(o.total)}</strong>
        <small>{fuelOrderRef(o.ref_no)} · {o.pay_method ? PLAN_METHOD_LABELS[o.pay_method as PaymentMethodPlan] : ""} · Ref.: <strong>{o.reference}</strong>{o.buyer_phone ? " · 📞 " + o.buyer_phone : ""}</small>
        <small>Veja na sua conta bancária se entrou {formatPrice(o.total)} com o descritivo {fuelOrderRef(o.ref_no)}. Inclui {formatPrice(o.fee_amount)} de taxa do APP.</small>
        <div className="row">{o.proof_path && <button type="button" className="secondary" onClick={() => void openProof(o.proof_path!, setError)}>📄 Ver comprovativo</button>}<button type="button" onClick={() => void decide(o, true)}>✅ Recebi o dinheiro</button><button type="button" className="secondary" onClick={() => void decide(o, false)}>❌ Não recebi</button></div>
      </article>)}</section>}
    {active.length > 0 && <details className="card"><summary><strong>🧾 Reservas ativas ({active.length})</strong></summary>
      {active.map(o => <div key={o.id} className="row" style={{ justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
        <span>{fuelOrderRef(o.ref_no)} · {o.buyer_name} · {fuelQuantityText(o.product, o.quantity)} {FUEL_PRODUCTS[o.product].short.toLowerCase()} · {FUEL_ORDER_STATUS_LABELS[o.status].split("—")[0]}{o.hold_until ? " · " + holdText(o.hold_until) : ""}</span>
        <button type="button" className="secondary" onClick={() => void cancel(o)}>Cancelar</button>
      </div>)}</details>}
    <section className="stats" aria-label="Resumo">
      <div className="stat"><strong>{formatPrice(panel.collected_today)}</strong><span>Levantado hoje</span></div>
      <div className="stat"><strong>{formatPrice(panel.collected_total)}</strong><span>Levantado no total</span></div>
    </section>
    <section className="card stack" style={{ gap: 8 }} aria-labelledby="comissao">
      <h2 id="comissao" style={{ margin: 0 }}>🧾 Taxa do Huambo Online ({panel.fee_pct}%, já paga pelos clientes)</h2>
      <small>Os clientes pagam ao posto o combustível mais a taxa do APP. Depois de levantarem, o posto entrega a taxa ao Huambo Online.</small>
      <span>Total: {formatPrice(panel.fee_total)} · Por pagar: <strong>{formatPrice(panel.fee_due)}</strong></span>
      {panel.fee_overdue && <p className="error" style={{ margin: 0 }}>Taxa do APP em atraso: as reservas estão paradas até entregar.</p>}
      {panel.fee_pending && <span>⏳ Pagamento enviado, à espera de confirmação.</span>}
      {panel.fee_due > 0 && !panel.fee_pending && (payOpen ? <FeePayBox stationId={id} uid={uid} amount={panel.fee_due} settings={settings} onDone={m => { setPayOpen(false); done(m); }} onClose={() => setPayOpen(false)} />
        : <button type="button" style={{ justifySelf: "start" }} onClick={() => setPayOpen(true)}>Entregar a taxa do APP</button>)}
      <small>Pague até 7 dias depois do levantamento. Marcar «Há» e registar o posto é sempre grátis.</small>
    </section>
  </main>;
}

function FeePayBox({ stationId, uid, amount, settings, onDone, onClose }: { stationId: string; uid: string; amount: number; settings: PlatformSettings | null; onDone: (m: string) => void; onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethodPlan>("multicaixa_express"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    if (!reference.trim() && !file) { setError("Escreva a referência do pagamento ou junte o comprovativo."); return; }
    if (file) { const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(bad); return; } }
    setBusy(true); setError("");
    try {
      let proof: string | null = null;
      if (file) { const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error("Não foi possível enviar o comprovativo."); proof = up.data; }
      const r = await submitFuelFee(supabase(), stationId, { method, reference, proofPath: proof }); if (r.error) throw r.error;
      onDone("Pagamento da taxa enviado. A administração vai confirmar.");
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); }
  }
  return <div className="card stack" style={{ gap: 10 }}>
    <strong>Valor a pagar: {formatPrice(amount)}</strong>
    <strong>1. Pague ao Huambo Online para estes dados</strong>
    <PaymentDetails s={settings} />
    <strong>2. Diga-nos como pagou</strong>
    <div className="row" role="radiogroup" aria-label="Como pagou">{(Object.keys(PLAN_METHOD_LABELS) as PaymentMethodPlan[]).map(m => <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{PLAN_METHOD_LABELS[m]}</button>)}</div>
    <label>Referência ou número da operação<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
    <label>Comprovativo (opcional se escreveu a referência)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row"><button type="button" disabled={busy} onClick={() => void send()}>{busy ? "A enviar…" : "Enviar pagamento"}</button><button type="button" className="secondary" onClick={onClose}>Cancelar</button></div>
  </div>;
}

/** Administração: aprovar postos, comissões e regras. */
export function AdminFuel() {
  const [stations, setStations] = useState<(FuelStation & { municipalities?: { name: string } | null })[]>([]); const [status, setStatus] = useState<"pending" | "approved" | "suspended">("pending");
  const [payments, setPayments] = useState<AdminFuelPayment[]>([]); const [s, setS] = useState<PlatformSettings | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [orderStatus, setOrderStatus] = useState<FuelOrderStatus | "">("submitted"); const [orders, setOrders] = useState<AdminFuelOrder[]>([]);
  async function load() {
    const [a, b, c, d] = await Promise.all([listStationsForAdmin(supabase(), status), listFuelPaymentsForAdmin(supabase(), "pending"), getPlatformSettings(supabase()),
      listFuelOrdersForAdmin(supabase(), orderStatus)]);
    setStations(a.data); setPayments(b.data); setS(c.data); setOrders(d.data); if (a.error || b.error || d.error) setError(friendlyError(a.error ?? b.error ?? d.error));
  }
  useEffect(() => { void load(); }, [status, orderStatus]);
  async function setSt(x: FuelStation, to: "approved" | "suspended" | "pending") {
    const note = to === "suspended" ? prompt("Porque suspende? (o dono vai ler)") ?? "" : "";
    if (to === "suspended" && !note.trim()) return;
    const r = await setStationStatus(supabase(), x.id, to, note); if (r.error) setError(friendlyError(r.error)); else { setNotice(to === "approved" ? "Posto aprovado: já aparece ao público." : "Feito."); await load(); }
  }
  async function decide(p: AdminFuelPayment, ok: boolean) {
    const note = ok ? "" : prompt("Porque não confirma?") ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirmar ${formatPrice(p.amount)} de ${p.station_name}?`)) return;
    const r = await decideFuelFee(supabase(), p.id, ok, note); if (r.error) setError(friendlyError(r.error)); else { setNotice("Feito."); await load(); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const pct = Number(s.fuel_fee_pct), mins = Number(s.fuel_pay_minutes);
    if (!(pct >= 0 && pct <= 30) || !Number.isInteger(mins) || mins < 10 || mins > 1440) { setError("Verifique a percentagem e os minutos."); return; }
    const r = await updatePlatformSettings(supabase(), { fuel_fee_pct: pct, fuel_pay_minutes: mins }); if (r.error) setError(friendlyError(r.error)); else { setError(""); setNotice("Regras guardadas."); }
  }
  async function openProof(path: string) { const { data } = await paymentProofUrl(supabase(), path); if (data) window.open(data, "_blank", "noopener"); }
  return <section className="stack">
    <h2 style={{ margin: 0 }}>⛽ Combustível e gás</h2>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {s && <form className="card row" style={{ alignItems: "end" }} onSubmit={save}>
      <label style={{ flex: 1, minWidth: 160 }}>Taxa do APP paga pelo comprador (%)<input value={String(s.fuel_fee_pct ?? "")} onChange={e => setS({ ...s, fuel_fee_pct: e.target.value })} inputMode="decimal" /></label>
      <label style={{ flex: 1, minWidth: 160 }}>Minutos para pagar adiantado<input value={String(s.fuel_pay_minutes ?? "")} onChange={e => setS({ ...s, fuel_pay_minutes: Number(e.target.value) || 0 })} inputMode="numeric" /></label>
      <button type="submit">Guardar</button>
    </form>}
    <div className="chips" role="group" aria-label="Postos">{([["pending", "⏳ Por aprovar"], ["approved", "✅ Aprovados"], ["suspended", "⛔ Suspensos"]] as const).map(([k, l]) =>
      <button key={k} type="button" className={"chip" + (status === k ? " on" : "")} aria-pressed={status === k} onClick={() => setStatus(k)}>{l}</button>)}</div>
    {stations.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum posto nesta lista.</p>}
    {stations.map(x => <article key={x.id} className="card" style={{ gap: 6 }}>
      <a href={"/combustivel/" + x.id}><strong>{x.name}</strong></a>
      <small>{stationRef(x.ref_no)} · {FUEL_KIND_LABELS[x.kind]} · {x.municipalities?.name ?? "—"}{x.phone ? " · 📞 " + x.phone : ""}{x.address ? " · " + x.address : ""}</small>
      <div className="row">
        {x.status !== "approved" && <button type="button" onClick={() => void setSt(x, "approved")}>✅ Aprovar</button>}
        {x.status !== "suspended" && <button type="button" className="secondary" onClick={() => void setSt(x, "suspended")}>⛔ Suspender</button>}
      </div>
    </article>)}
    <h3 style={{ margin: 0 }}>🧾 Comissões por confirmar ({payments.length})</h3>
    {payments.map(p => <article key={p.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(p.amount)} · {p.station_name}</strong>
      <small>{stationRef(p.station_ref)} · {p.owner_name} · {PLAN_METHOD_LABELS[p.method as PaymentMethodPlan]}{p.reference ? " · Ref.: " + p.reference : ""}</small>
      <div className="row">{p.proof_path && <button type="button" className="secondary" onClick={() => void openProof(p.proof_path!)}>📄 Comprovativo</button>}
        <button type="button" onClick={() => void decide(p, true)}>✅ Confirmar</button><button type="button" className="secondary" onClick={() => void decide(p, false)}>❌ Recusar</button></div>
    </article>)}
    <h3 style={{ margin: 0 }}>🔎 Pagamentos adiantados de clientes (comprovativos)</h3>
    <small>Para vigiar burlas: cada comprovativo e cada referência só podem ser usados uma vez.</small>
    <div className="chips" role="group" aria-label="Pagamentos de clientes">{([["submitted", "⏳ Por confirmar pelo posto"], ["paid", "✅ Confirmados"], ["rejected", "❌ Recusados"], ["", "Todos"]] as const).map(([k, l]) =>
      <button key={k || "all"} type="button" className={"chip" + (orderStatus === k ? " on" : "")} aria-pressed={orderStatus === k} onClick={() => setOrderStatus(k)}>{l}</button>)}</div>
    {orders.length === 0 && <p className="muted" style={{ margin: 0 }}>Nenhum pagamento nesta lista.</p>}
    {orders.map(o => <article key={o.id} className="card" style={{ gap: 6 }}>
      <strong>{formatPrice(o.total)} · {o.station_name} · {o.buyer_name}</strong>
      <small>{fuelOrderRef(o.ref_no)} · {stationRef(o.station_ref)} · {fuelQuantityText(o.product, o.quantity)} {FUEL_PRODUCTS[o.product].short.toLowerCase()} · taxa {formatPrice(o.fee_amount)}{o.reference ? " · Ref.: " + o.reference : ""} · {FUEL_ORDER_STATUS_LABELS[o.status]}</small>
      <div className="row">{o.proof_path && <button type="button" className="secondary" onClick={() => void openProof(o.proof_path!)}>📄 Comprovativo</button>}
        <a className="btn secondary" href={"/combustivel/v/" + o.qr_token}>🔳 Ver pelo QR</a></div>
    </article>)}
  </section>;
}

/** Página aberta ao ler o QR: confirma se o pedido é verdadeiro; o posto confirma o pagamento e entrega aqui. */
export function FuelVerify({ token }: { token: string }) {
  const [v, setV] = useState<FuelOrderView | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  async function load() { const r = await fuelOrderByToken(supabase(), token); if (r.error) setError(friendlyError(r.error)); setV(r.data ?? { result: "invalid" }); }
  useEffect(() => { void load(); }, [token]);
  if (!v) return <main><p>A verificar…</p></main>;
  if (v.result !== "ok") return <main className="stack" style={{ maxWidth: 640 }}>
    <h1 style={{ margin: 0 }}>❌ QR não reconhecido</h1>
    <p className="error" role="alert" style={{ fontSize: 20 }}>Este QR não é de nenhum pedido do Huambo Online. Não entregue combustível nem gás.</p>
    <a href="/combustivel">← Combustível e gás</a>
  </main>;
  const live = v.status === "reserved" || v.status === "paid" || v.status === "submitted";
  async function deliver() {
    if (!v?.code || !v.station_id) return;
    if (!confirm(`Entregar ${fuelQuantityText(v.product!, v.quantity!)} a ${v.buyer_name}?`)) return;
    setBusy(true); const r = await collectFuel(supabase(), v.station_id, v.code); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(FUEL_COLLECT_LABELS[r.data?.result ?? ""] ?? String(r.data?.result)); await load(); }
  }
  async function decide(ok: boolean) {
    if (!v?.id) return;
    const note = ok ? "" : prompt("Porque não confirma? (o cliente vai ler)") ?? ""; if (!ok && !note.trim()) return;
    if (ok && !confirm(`Confirma que recebeu ${formatPrice(v.total ?? 0)} na conta do posto?`)) return;
    setBusy(true); const r = await decideFuelPayment(supabase(), v.id, ok, note); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok ? "Pagamento confirmado. Já pode entregar." : "Pagamento recusado."); await load(); }
  }
  return <main className="stack" style={{ maxWidth: 680 }}>
    <a href="/combustivel">← Combustível e gás</a>
    <h1 style={{ margin: 0 }}>{v.status === "collected" ? "⚠️ QR JÁ USADO" : live ? "✅ QR verdadeiro" : "❌ Pedido sem efeito"}</h1>
    <p className={live ? "ok" : "error"} role="status" style={{ fontSize: 20, margin: 0 }}>
      {fuelOrderRef(v.ref_no)} · {v.station_name} · {v.product ? FUEL_PRODUCTS[v.product].label : ""} · {v.product ? fuelQuantityText(v.product, v.quantity ?? 0) : ""}<br />{v.status ? FUEL_ORDER_STATUS_LABELS[v.status] : ""}
    </p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {v.role === "other" && <p className="card" style={{ margin: 0 }}>Este pedido existe no Huambo Online. Só o posto {v.station_name}, com a sua conta, vê os dados e pode entregar. <a href={"/conta/login?voltar=/combustivel/v/" + token}>Entrar</a></p>}
    {v.role !== "other" && <>
      <dl className="facts card" style={{ margin: 0, gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)", overflowWrap: "anywhere" }}>
        <dt>Cliente</dt><dd><strong>{v.buyer_name}</strong>{v.buyer_phone ? " · 📞 " + v.buyer_phone : ""}{v.plate ? " · " + v.plate : ""}</dd>
        <dt>Combustível/gás</dt><dd>{formatPrice(v.subtotal ?? 0)}</dd>
        <dt>Taxa do APP{v.fee_pct ? ` (${v.fee_pct}%)` : ""}</dt><dd>{formatPrice(v.fee_amount ?? 0)}</dd>
        <dt>Total</dt><dd><strong>{formatPrice(v.total ?? 0)}</strong> · {v.method === "prepaid" ? "pago adiantado" : "paga no posto"}</dd>
        {v.reference && <><dt>Referência do pagamento</dt><dd><strong>{v.reference}</strong></dd></>}
        {v.code && <><dt>Código</dt><dd><strong>{v.code}</strong></dd></>}
      </dl>
      {v.proof_path && <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => void openProof(v.proof_path!, setError)}>📄 Ver comprovativo</button>}
      {v.role === "station" && v.status === "submitted" && <div className="card stack" style={{ gap: 8 }}>
        <strong>1. Veja na conta do posto se entrou {formatPrice(v.total ?? 0)} com o descritivo {fuelOrderRef(v.ref_no)}.</strong>
        <div className="row"><button type="button" disabled={busy} onClick={() => void decide(true)}>✅ Recebi o dinheiro</button><button type="button" className="secondary" disabled={busy} onClick={() => void decide(false)}>❌ Não recebi</button></div>
      </div>}
      {v.role === "station" && (v.status === "reserved" || v.status === "paid") && <button type="button" disabled={busy} style={{ fontSize: 22 }} onClick={() => void deliver()}>
        {v.status === "reserved" ? `⛽ Cobrar ${formatPrice(v.total ?? 0)} e entregar` : "⛽ Já pago — entregar"}</button>}
    </>}
  </main>;
}
