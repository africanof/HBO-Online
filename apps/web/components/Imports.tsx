"use client";
import { useEffect, useRef, useState } from "react";
import { listImportCatalog, saveImportCatalogItem, createImportRequest, myImportRequests, acceptImportQuote, cancelImportRequest, submitImportPayment,
  listImportRequestsForAdmin, submitImportResearchPayment, getImportResearchSettings, setImportResearchSettings, decideImportResearch, quoteImport, declineImport, decideImportPayment, advanceImport, suggestedImportFee, importRef, getPlatformSettings,
  uploadPaymentProof, uploadClassifiedMedia, paymentProofUrl, validateDocument, sha256Hex, formatPrice, friendlyErrorIn, IMPORT_ORIGINS, IMPORT_NEXT, PLAN_METHOD_LABELS,
  type ImportCatalogItem, type ImportRequest, type ImportResearchSettings, type ImportOrigin, type ImportStatus, type PlatformSettings } from "@huambo-online/core";
import { supabase, currentUserId } from "../lib/supabase";
import { useT, eventDateIn } from "../lib/i18n";
import { PaymentDetails } from "./Plans";

/** Página «Importação»: como funciona, catálogo, pedido e os meus pedidos. */
export function ImportsPage() {
  const { t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<ImportCatalogItem[]>([]);
  const [mine, setMine] = useState<ImportRequest[] | null>(null);
  const [pick, setPick] = useState<ImportCatalogItem | null>(null);
  const [research, setResearch] = useState<ImportResearchSettings | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  async function loadMine(u: string) { setMine((await myImportRequests(supabase(), u)).data); }
  useEffect(() => {
    void listImportCatalog(supabase()).then(r => setCatalog(r.data));
    void getImportResearchSettings(supabase()).then(setResearch);
    void currentUserId().then(u => { setUid(u); if (u) void loadMine(u); });
  }, []);
  function ask(c: ImportCatalogItem) { setPick(c); setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50); }

  return <main className="stack" style={{ maxWidth: 900 }}>
    <h1 style={{ margin: 0 }}>{t("im.title")}</h1>
    <p style={{ margin: 0 }}>{t("im.intro")}</p>
    <section className="card stack" style={{ gap: 6 }}>
      <h2 style={{ margin: 0 }}>{t("im.how")}</h2>
      {["im.how1", "im.how2", "im.how3", "im.how4"].map(k => <span key={k}>{t(k)}</span>)}
      {!!research?.fee && <strong>{t(research.deduct ? "im.how_fee" : "im.how_fee_nodeduct", { fee: formatPrice(research.fee) })}</strong>}
    </section>

    {uid && mine && mine.length > 0 && <section className="stack" style={{ gap: 10 }}>
      <h2 style={{ margin: 0 }}>{t("im.mine")}</h2>
      {mine.map(r => <MyImport key={r.id} r={r} onChange={() => void loadMine(uid)} />)}
    </section>}

    <section className="stack" style={{ gap: 10 }}>
      <h2 style={{ margin: 0 }}>{t("im.catalog")}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {catalog.map(c => <article key={c.id} className="card stack" style={{ gap: 6 }}>
          <strong style={{ fontSize: 18 }}>{c.icon} {c.title}</strong>
          {c.description && <small>{c.description}</small>}
          <small className="muted">{t("im.o." + c.origin)} · {t("im.days", { min: c.days_min, max: c.days_max })}</small>
          <button type="button" className="secondary" style={{ justifySelf: "start" }} onClick={() => ask(c)}>{t("im.ask_this")}</button>
        </article>)}
      </div>
    </section>

    <div ref={formRef}>
      {uid === null ? <p className="card">{t("im.login")} <a className="btn" href="/conta/login?voltar=/importacao">{t("auth.login")}</a></p>
        : uid ? <ImportForm key={pick?.id ?? "free"} uid={uid} pick={pick} onSent={() => { setPick(null); void loadMine(uid); }} /> : null}
    </div>
  </main>;
}

function ImportForm({ uid, pick, onSent }: { uid: string; pick: ImportCatalogItem | null; onSent: () => void }) {
  const { t, tc, lang } = useT();
  const [title, setTitle] = useState(""); const [details, setDetails] = useState(pick ? pick.title + ": " : ""); const [links, setLinks] = useState("");
  const [qty, setQty] = useState("1"); const [budget, setBudget] = useState(""); const [origin, setOrigin] = useState<ImportOrigin>(pick?.origin ?? "any");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup"); const [address, setAddress] = useState(""); const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function send() {
    setError(""); setNotice(""); setBusy(true);
    try {
      let photoUrl: string | null = null;
      if (photo) {
        const bad = validateDocument({ size: photo.size, type: photo.type }); if (bad) { setError(tc(bad)); return; }
        const up = await uploadClassifiedMedia(supabase(), photo, uid, photo.name, photo.type); if (up.error || !up.data) throw up.error ?? new Error("UPLOAD");
        photoUrl = up.data;
      }
      const r = await createImportRequest(supabase(), { title, details, links, quantity: Number(qty), budget: budget.trim() ? Number(budget.replace(/\D/g, "")) : null,
        origin, fulfillment, address, phone, catalogId: pick?.id ?? null, photoUrl });
      if (r.error) throw r.error;
      setNotice(t(r.data?.status === "research_payment" ? "im.r_sent" : "im.sent")); setTitle(""); setDetails(""); setLinks(""); setBudget(""); setPhoto(null); onSent();
    } catch (e: any) { setError(String(e?.message ?? "").startsWith("im.") ? t(e.message) : friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <section className="card stack" style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>{pick ? pick.icon + " " + pick.title : t("im.new")}</h2>
    <label>{t("im.f_title")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={140} placeholder={t("im.f_title_ph")} /></label>
    <label>{t("im.f_details")}<textarea value={details} onChange={e => setDetails(e.target.value)} maxLength={2000} rows={3} /></label>
    <label>{t("im.f_links")}<input value={links} onChange={e => setLinks(e.target.value)} maxLength={1000} inputMode="url" /></label>
    <label>{t("im.f_photo")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPhoto(e.target.files?.[0] ?? null)} /></label>
    <div className="row">
      <label style={{ flex: 1 }}>{t("im.f_qty")}<input value={qty} onChange={e => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
      <label style={{ flex: 2 }}>{t("im.f_budget")}<input value={budget} onChange={e => setBudget(e.target.value)} inputMode="numeric" /></label>
    </div>
    <label>{t("im.f_origin")}<select value={origin} onChange={e => setOrigin(e.target.value as ImportOrigin)}>{IMPORT_ORIGINS.map(o => <option key={o} value={o}>{t("im.o." + o)}</option>)}</select></label>
    <span>{t("im.f_receive")}</span>
    <div className="row" role="radiogroup">{(["pickup", "delivery"] as const).map(v => <button key={v} type="button" role="radio" aria-checked={fulfillment === v}
      className={fulfillment === v ? "" : "secondary"} onClick={() => setFulfillment(v)}>{t(v === "pickup" ? "im.f_pickup" : "im.f_delivery")}</button>)}</div>
    {fulfillment === "delivery" && <label>{t("im.f_address")}<input value={address} onChange={e => setAddress(e.target.value)} maxLength={300} /></label>}
    <label>{t("im.f_phone")}<input value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" maxLength={30} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    <button type="button" disabled={busy} onClick={() => void send()} style={{ justifySelf: "start" }}>{busy ? t("common.loading") : "✈️ " + t("im.send")}</button>
    <small>{t("im.protected")}</small>
  </section>;
}

function Quote({ r }: { r: ImportRequest }) {
  const { t, lang } = useT();
  return <dl className="facts card" style={{ margin: 0 }}>
    <dt>{t("im.q_product")}</dt><dd>{formatPrice(r.product_cost ?? 0)}</dd>
    <dt>{t("im.q_shipping")}</dt><dd>{formatPrice(r.shipping_cost ?? 0)}</dd>
    <dt>{t("im.q_fee")}</dt><dd>{formatPrice(r.service_fee ?? 0)}</dd>
    {r.research_credit > 0 && <><dt>{t("im.q_credit")}</dt><dd>− {formatPrice(r.research_credit)}</dd></>}
    <dt>{t("im.q_total")}</dt><dd style={{ fontSize: 20 }}>{formatPrice(r.total ?? 0)}</dd>
    {r.eta_days && <><dt>⏱️</dt><dd>{t("im.q_eta", { n: r.eta_days })}</dd></>}
    {r.quote_valid_until && r.status === "quoted" && <><dt>📅</dt><dd>{t("im.q_valid", { d: eventDateIn(r.quote_valid_until, lang) })}</dd></>}
  </dl>;
}

/** Transferência para o Huambo Online + comprovativo (usada na taxa de pesquisa e no pagamento da importação). */
function PayBox({ step, amount, until, refNo, onSubmit }: { step: string; amount: number; until: string | null; refNo: number;
  onSubmit: (i: { method: "bank_transfer" | "multicaixa_express"; reference: string; proofPath: string; proofHash: string }) => PromiseLike<{ error: any }>; }) {
  const { t, tc, lang } = useT();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [method, setMethod] = useState<"multicaixa_express" | "bank_transfer">("bank_transfer"); const [reference, setReference] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void getPlatformSettings(supabase()).then(x => setSettings(x.data)); }, []);
  async function pay() {
    if (!file || reference.replace(/[^A-Za-z0-9]/g, "").length < 4) { setError(t("im.err_proof")); return; }
    const bad = validateDocument({ size: file.size, type: file.type }); if (bad) { setError(tc(bad)); return; }
    setBusy(true); setError("");
    try {
      const uid = await currentUserId(); if (!uid) throw new Error(t("sv.login_needed"));
      const hash = sha256Hex(await file.arrayBuffer());
      const up = await uploadPaymentProof(supabase(), uid, file, file.name, file.type); if (up.error || !up.data) throw up.error ?? new Error(t("sv.proof_fail"));
      const x = await onSubmit({ method, reference, proofPath: up.data, proofHash: hash }); if (x.error) throw x.error;
    } catch (e) { setError(friendlyErrorIn(e, lang)); } finally { setBusy(false); }
  }
  return <div className="stack" style={{ gap: 8 }}>
    <strong>{t(step, { total: formatPrice(amount), fee: formatPrice(amount) })} {until ? t("im.pay_until", { d: eventDateIn(until, lang) }) : ""}</strong>
    <PaymentDetails s={settings} />
    <p className="banner yellow" style={{ margin: 0, padding: 12, display: "block" }}>✍️ {t("im.pay_desc", { ref: importRef(refNo) })}</p>
    <strong>{t("im.send_proof")}</strong>
    <div className="row" role="radiogroup">{(["multicaixa_express", "bank_transfer"] as const).map(m => <button key={m} type="button" role="radio" aria-checked={method === m}
      className={method === m ? "" : "secondary"} onClick={() => setMethod(m)}>{tc(PLAN_METHOD_LABELS[m])}</button>)}</div>
    <label>{t("sv.ref_label")}<input value={reference} onChange={e => setReference(e.target.value)} maxLength={120} /></label>
    <label>{t("sv.fu_proof_required")}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button type="button" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void pay()}>{busy ? t("sv.sending") : "✅ " + t("sv.fu_paid_send")}</button>
    <small>{t("im.protected")}</small>
  </div>;
}

function MyImport({ r, onChange }: { r: ImportRequest; onChange: () => void }) {
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const expired = (iso: string | null) => !!iso && new Date(iso).getTime() < Date.now();
  async function run(fn: () => PromiseLike<{ error: any }>, ok = "") {
    setBusy(true); setError(""); const x = await fn(); setBusy(false);
    if (x.error) setError(friendlyErrorIn(x.error, lang)); else { if (ok) setNotice(ok); onChange(); }
    return x;
  }
  return <article className="card stack" style={{ gap: 8 }}>
    <strong style={{ fontSize: 18 }}>{r.title}</strong>
    <small>{importRef(r.ref_no)} · {t("im.qty_n", { n: r.quantity })} · {t("im.o." + r.origin)} · {eventDateIn(r.created_at, lang)}</small>
    <span style={{ fontWeight: 800 }}>{t("im.s." + r.status)}</span>
    {r.tracking && <small>{t("im.tracking")}: <strong>{r.tracking}</strong></small>}
    {r.team_note && <small className={["declined", "refunded", "awaiting_payment", "research_payment"].includes(r.status) ? "error" : ""}>{t("im.team_note")}: {r.team_note}</small>}
    {r.status === "refunded" && <small>{t("im.refund_note")}</small>}
    {r.status === "research_payment" && (expired(r.research_pay_by) ? <small className="error">{t("im.pay_expired")}</small>
      : <PayBox step="im.r_pay_step" amount={r.research_fee} until={r.research_pay_by} refNo={r.ref_no}
        onSubmit={i => run(() => submitImportResearchPayment(supabase(), r.id, i), t("im.r_proof_sent"))} />)}
    {r.total != null && !["research_payment", "research_submitted", "requested", "declined", "cancelled"].includes(r.status) && <Quote r={r} />}
    {r.quote_note && r.status === "quoted" && <small>💬 {r.quote_note}</small>}
    {r.status === "quoted" && (expired(r.quote_valid_until) ? <small className="error">{t("im.q_expired")}</small>
      : <button type="button" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void run(() => acceptImportQuote(supabase(), r.id))}>{t("im.accept")}</button>)}
    {r.status === "awaiting_payment" && (expired(r.pay_by) ? <div className="stack" style={{ gap: 6 }}><small className="error">{t("im.pay_expired")}</small>
      {!expired(r.quote_valid_until) && <button type="button" disabled={busy} style={{ justifySelf: "start" }} onClick={() => void run(() => acceptImportQuote(supabase(), r.id))}>{t("im.accept")}</button>}</div>
      : <PayBox step="im.pay_step" amount={r.total ?? 0} until={r.pay_by} refNo={r.ref_no} onSubmit={i => run(() => submitImportPayment(supabase(), r.id, i), t("im.proof_sent"))} />)}
    {["research_payment", "requested", "quoted", "awaiting_payment"].includes(r.status) && <button type="button" className="secondary" disabled={busy} style={{ justifySelf: "start" }}
      onClick={() => { if (confirm(t("im.cancel_q"))) void run(() => cancelImportRequest(supabase(), r.id)); }}>{t("im.cancel")}</button>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
  </article>;
}

/** Equipa: pedidos (orçamento, pagamento, acompanhamento) e catálogo. */
export function AdminImports() {
  const { t, lang } = useT();
  const [filter, setFilter] = useState<"open" | "">("open");
  const [items, setItems] = useState<ImportRequest[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listImportRequestsForAdmin(supabase(), filter); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void load(); }, [filter]);
  async function run(fn: () => PromiseLike<{ error: any }>) {
    setError(""); setNotice(""); const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(t("pp.decided")); void load(); }
  }
  return <section className="stack" style={{ gap: 10 }}>
    <h2 style={{ margin: 0 }}>{t("im.a_title")}</h2>
    <div className="row">{(["open", ""] as const).map(f => <button key={f} type="button" className={filter === f ? "" : "secondary"} onClick={() => setFilter(f)}>{t(f ? "im.a_open" : "im.a_all")}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p className="muted">{t("pp.none_pending")}</p>}
    {items.map(r => <AdminImportCard key={r.id} r={r} run={run} />)}
    <AdminResearchFee />
    <AdminImportCatalog />
  </section>;
}

function AdminImportCard({ r, run }: { r: ImportRequest; run: (fn: () => PromiseLike<{ error: any }>) => Promise<void> }) {
  const { t, lang } = useT();
  const [product, setProduct] = useState(r.product_cost ? String(r.product_cost) : ""); const [shipping, setShipping] = useState(r.shipping_cost != null ? String(r.shipping_cost) : "");
  const [fee, setFee] = useState(r.service_fee != null ? String(r.service_fee) : ""); const [eta, setEta] = useState(r.eta_days ? String(r.eta_days) : "30"); const [note, setNote] = useState(r.quote_note ?? "");
  const n = (v: string) => Number(v.replace(/\D/g, "")) || 0;
  const hint = suggestedImportFee(n(product), n(shipping));
  async function openProof(path: string | null = r.proof_path) { if (!path) return; const u = await paymentProofUrl(supabase(), path); if (u.data) window.open(u.data, "_blank", "noopener"); }
  const canQuote = r.status === "requested" || r.status === "quoted" || r.status === "awaiting_payment";
  return <article className="card stack" style={{ gap: 8 }}>
    <strong>{importRef(r.ref_no)} · {r.title} · {t("im.qty_n", { n: r.quantity })}</strong>
    <small>{r.buyer_name ?? "—"} · 📞 <a href={"tel:" + r.phone}>{r.phone}</a> · {t("im.o." + r.origin)} · {t(r.fulfillment === "delivery" ? "im.f_delivery" : "im.f_pickup")}{r.address ? ": " + r.address : ""}</small>
    {r.details && <span>{r.details}</span>}
    {r.links && <small style={{ overflowWrap: "anywhere" }}>🔗 {r.links.split(/\s+/).map((l, i) => /^https?:\/\//.test(l) ? <a key={i} href={l} target="_blank" rel="noopener noreferrer nofollow">{l} </a> : l + " ")}</small>}
    {r.photo_url && <a href={r.photo_url} target="_blank" rel="noopener noreferrer"><img src={r.photo_url} alt="" style={{ maxWidth: 160, borderRadius: 12 }} /></a>}
    {r.budget && <small>{t("im.f_budget")}: {formatPrice(r.budget)}</small>}
    <span style={{ fontWeight: 800 }}>{t("im.s." + r.status)}{r.total != null ? " · " + formatPrice(r.total) : ""} · {eventDateIn(r.updated_at, lang)}</span>
    {r.team_note && <small>{t("im.team_note")}: {r.team_note}</small>}
    {canQuote && <div className="stack" style={{ gap: 6 }}>
      <div className="row">
        <label style={{ flex: 1 }}>{t("im.q_product")}<input value={product} onChange={e => setProduct(e.target.value)} inputMode="numeric" /></label>
        <label style={{ flex: 1 }}>{t("im.q_shipping")}<input value={shipping} onChange={e => setShipping(e.target.value)} inputMode="numeric" /></label>
        <label style={{ flex: 1 }}>{t("im.q_fee")}<input value={fee} onChange={e => setFee(e.target.value)} inputMode="numeric" placeholder={String(hint)} /></label>
        <label style={{ flex: 1 }}>{t("im.a_eta")}<input value={eta} onChange={e => setEta(e.target.value)} inputMode="numeric" /></label>
      </div>
      <small className="muted">{t("im.a_fee_hint", { fee: formatPrice(hint) })} · {t("im.q_total")}: <strong>{formatPrice(n(product) + n(shipping) + (fee.trim() ? n(fee) : hint))}</strong></small>
      <label>{t("im.a_note")}<input value={note} onChange={e => setNote(e.target.value)} maxLength={1000} /></label>
      <div className="row">
        <button type="button" onClick={() => void run(() => quoteImport(supabase(), r.id, { product: n(product), shipping: n(shipping), fee: fee.trim() ? n(fee) : hint, etaDays: n(eta), note }))}>
          {t(r.status === "requested" ? "im.a_quote" : "im.a_requote")}</button>
        <button type="button" className="danger" onClick={() => { const why = prompt(t("im.a_decline_q")) ?? ""; if (why.trim()) void run(() => declineImport(supabase(), r.id, why)); }}>{t("im.a_decline")}</button>
      </div>
    </div>}
    {r.status === "research_submitted" && <div className="stack" style={{ gap: 6 }}>
      <small>{t("im.a_research")}: <strong>{formatPrice(r.research_fee)}</strong> · {t("sv.reference")}: <strong>{r.research_reference}</strong></small>
      <div className="row">
        {r.research_proof_path && <button type="button" className="secondary" onClick={() => void openProof(r.research_proof_path)}>🧾 {t("im.a_proof")}</button>}
        <button type="button" onClick={() => void run(() => decideImportResearch(supabase(), r.id, true))}>{t("pp.confirm_pay")}</button>
        <button type="button" className="danger" onClick={() => { const why = prompt(t("pp.reject_why")) ?? ""; if (why.trim()) void run(() => decideImportResearch(supabase(), r.id, false, why)); }}>{t("pp.reject_pay")}</button>
      </div>
    </div>}
    {r.status === "research_payment" && <button type="button" className="danger" style={{ justifySelf: "start" }} onClick={() => { const why = prompt(t("im.a_decline_q")) ?? ""; if (why.trim()) void run(() => declineImport(supabase(), r.id, why)); }}>{t("im.a_decline")}</button>}
    {r.status === "submitted" && <div className="stack" style={{ gap: 6 }}>
      <small>{t("sv.reference")}: <strong>{r.reference}</strong> · {r.pay_method}</small>
      <div className="row">
        {r.proof_path && <button type="button" className="secondary" onClick={() => void openProof(r.proof_path)}>🧾 {t("im.a_proof")}</button>}
        <button type="button" onClick={() => void run(() => decideImportPayment(supabase(), r.id, true))}>{t("pp.confirm_pay")}</button>
        <button type="button" className="danger" onClick={() => { const why = prompt(t("pp.reject_why")) ?? ""; if (why.trim()) void run(() => decideImportPayment(supabase(), r.id, false, why)); }}>{t("pp.reject_pay")}</button>
      </div>
    </div>}
    {(IMPORT_NEXT[r.status] ?? []).length > 0 && <div className="row">{IMPORT_NEXT[r.status]!.map(s => <button key={s} type="button" className={s === "refunded" ? "danger" : ""}
      onClick={() => {
        if (s === "refunded") { const why = prompt(t("im.a_refund_q")) ?? ""; if (why.trim()) void run(() => advanceImport(supabase(), r.id, s, why)); return; }
        const tracking = s === "in_transit" ? prompt(t("im.a_tracking_q")) ?? "" : "";
        void run(() => advanceImport(supabase(), r.id, s as ImportStatus, null, tracking));
      }}>{t("im.a_mark", { s: t("im.s." + s) })}</button>)}</div>}
  </article>;
}

function AdminResearchFee() {
  const { t, lang } = useT();
  const [fee, setFee] = useState(""); const [deduct, setDeduct] = useState(true); const [msg, setMsg] = useState(""); const [error, setError] = useState("");
  useEffect(() => { void getImportResearchSettings(supabase()).then(s => { setFee(String(s.fee)); setDeduct(s.deduct); }); }, []);
  async function save() {
    setMsg(""); setError(""); const r = await setImportResearchSettings(supabase(), { fee: Number(fee.replace(/\D/g, "")) || 0, deduct });
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setMsg(t("pp.decided"));
  }
  return <div className="card stack" style={{ gap: 8 }}>
    <strong>💡 {t("im.a_research")}</strong>
    <label>{t("im.a_research_fee")}<input value={fee} onChange={e => setFee(e.target.value)} inputMode="numeric" /></label>
    <label className="row" style={{ alignItems: "center" }}><input type="checkbox" checked={deduct} onChange={e => setDeduct(e.target.checked)} style={{ width: 22, height: 22 }} /> {t("im.a_research_deduct")}</label>
    {error && <p className="error" role="alert">{error}</p>}
    {msg && <p className="ok" role="status">{msg}</p>}
    <button type="button" style={{ justifySelf: "start" }} onClick={() => void save()}>{t("im.a_save")}</button>
  </div>;
}

function AdminImportCatalog() {
  const { t, lang } = useT();
  const [items, setItems] = useState<ImportCatalogItem[]>([]); const [error, setError] = useState("");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [icon, setIcon] = useState("📦");
  const [origin, setOrigin] = useState<ImportOrigin>("any"); const [dMin, setDMin] = useState("15"); const [dMax, setDMax] = useState("45");
  async function load() { setItems((await listImportCatalog(supabase(), true)).data); }
  useEffect(() => { void load(); }, []);
  async function save(item: Partial<ImportCatalogItem> & { title: string }) {
    setError(""); const r = await saveImportCatalogItem(supabase(), item);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setTitle(""); setDescription(""); void load(); }
  }
  return <details className="card">
    <summary style={{ fontWeight: 800, cursor: "pointer" }}>{t("im.a_catalog")} ({items.length})</summary>
    <div className="stack" style={{ gap: 8, marginTop: 10 }}>
      {items.map(c => <div key={c.id} className="row" style={{ justifyContent: "space-between", opacity: c.active ? 1 : 0.5 }}>
        <span>{c.icon} {c.title} · {t("im.o." + c.origin)} · {t("im.days", { min: c.days_min, max: c.days_max })}</span>
        <button type="button" className="secondary" onClick={() => void save({ ...c, active: !c.active })}>{t(c.active ? "im.a_hide" : "im.a_show")}</button>
      </div>)}
      <div className="row">
        <label style={{ width: 70 }}>🙂<input value={icon} onChange={e => setIcon(e.target.value)} maxLength={8} /></label>
        <label style={{ flex: 1 }}>{t("im.f_title")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></label>
      </div>
      <label>{t("im.f_details")}<input value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} /></label>
      <div className="row">
        <label style={{ flex: 2 }}>{t("im.f_origin")}<select value={origin} onChange={e => setOrigin(e.target.value as ImportOrigin)}>{IMPORT_ORIGINS.map(o => <option key={o} value={o}>{t("im.o." + o)}</option>)}</select></label>
        <label style={{ flex: 1 }}>min<input value={dMin} onChange={e => setDMin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
        <label style={{ flex: 1 }}>max<input value={dMax} onChange={e => setDMax(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" style={{ justifySelf: "start" }} disabled={title.trim().length < 3}
        onClick={() => void save({ title, description, icon, origin, days_min: Number(dMin) || 15, days_max: Number(dMax) || 45 })}>{t("im.a_add")}</button>
    </div>
  </details>;
}
