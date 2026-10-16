"use client";
import { useEffect, useState } from "react";
import { getUserStats, requestService, validateServiceRequest, sellerBadge, friendlyErrorIn, validateReview, submitDealReview, listDealCandidates, setListingDeal,
  closeListing, getPlatformSettings, commissionFor, parsePrice, formatPrice, finalDealStatus, DEAL_ROLE_LABELS, type UserStats, type PendingReview, type DealCandidate } from "@huambo-online/core";

import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

const DEAL_BUTTON_KEY = { sold: "ls.deal_mark_sold", rented: "ls.deal_mark_rented", closed: "ls.deal_close" } as const;

/** Quadro de números do perfil (vendas, compras, serviços…). */
export function StatsBlock({ rows, footer }: { rows: { label: string; value: string }[]; footer?: string }) {
  const { t, tc } = useT();
  if (rows.length === 0) return null;
  return <section className="stats" aria-label={t("ls.profile_numbers")}>
    {rows.map(r => <div key={r.label} className="stat"><strong>{r.value}</strong><span>{tc(r.label)}</span></div>)}
    {footer && <small className="stats-foot">{tc(footer)}</small>}
  </section>;
}

/** Escolher de 1 a 5 estrelas (botões grandes). */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const { t } = useT();
  return <div className="row" role="radiogroup" aria-label={t("ls.stars")}>
    {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={n === value} className={n <= value ? "star on" : "star"} aria-label={t("ls.n_stars", { n })} onClick={() => onChange(n)}>★</button>)}
  </div>;
}
export const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** «★ 4,8 (12) · 23 vendas» ao lado do nome do vendedor. */
export function SellerBadge({ userId }: { userId?: string | null }) {
  const [s, setS] = useState<UserStats | null>(null);
  useEffect(() => { if (userId) void getUserStats(supabase(), userId).then(r => setS(r.data)); }, [userId]);
  const { tc } = useT();
  const text = sellerBadge(s);
  return text ? <span className="seller-badge">{tc(text)}</span> : null;
}

/** Caixa «Pedir serviço» nas páginas de profissionais e empresas. */
export function RequestServiceBox({ target, signedIn }: { target: { providerId?: string; businessId?: string }; signedIn: boolean }) {
  const { lang, t, tc } = useT();
  const [text, setText] = useState(""); const [date, setDate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!signedIn) { setError(t("ls.svc_login")); return; }
    const v = validateServiceRequest(text); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await requestService(supabase(), target, text, date); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setDone(true); setText(""); setDate(""); }
  }
  return <section className="card">
    <h2 style={{ margin: 0 }}>🛠️ {t("ls.svc_request")}</h2>
    {done ? <p className="ok" role="status">{t("ls.svc_sent")} <a href="/servicos">{t("acct.l.services")}</a>.</p> : <>
      <p style={{ margin: 0 }}>{t("ls.svc_intro")}</p>
      <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder={t("ls.svc_ph")} />
      <label style={{ maxWidth: 260 }}>{t("ls.svc_when")}<input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy} onClick={send}>{busy ? t("ls.sending") : t("ls.svc_send")}</button>
    </>}
  </section>;
}

/** Formulário de avaliação de um negócio (encomenda ou anúncio). */
export function DealReviewForm({ item, onDone }: { item: PendingReview; onDone: () => void }) {
  const { lang, t, tc } = useT();
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    const v = validateReview(rating, comment); if (v) { setError(tc(v)); return; }
    setBusy(true); setError("");
    const r = await submitDealReview(supabase(), item.kind, item.ref_id, rating, comment); setBusy(false);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else onDone();
  }
  return <article className="card">
    <strong style={{ fontSize: 19 }}>{item.kind === "order" ? "📦 " : "🏷️ "}{item.title}</strong>
    <span>{t("ls.rate")} <a href={"/vendedor/" + item.other_id}>{item.other_name}</a> {t("ls.as_role")} <strong>{tc(DEAL_ROLE_LABELS[item.other_role])}</strong></span>
    <StarPicker value={rating} onChange={setRating} />
    <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder={t("ls.review_ph")} />
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy || !rating} onClick={send}>{busy ? t("ls.sending") : t("ls.review_publish")}</button>
  </article>;
}

/** «Com quem fez negócio?» — fecha o anúncio e liga as duas pessoas para se avaliarem. */
export function DealCloser({ listing, onDone }: { listing: { id: string; purpose: string; status: string; deal_with?: string | null; price?: number | string | null }; onDone: (msg: string) => void }) {
  const { lang, t } = useT();
  const [open, setOpen] = useState(false); const [people, setPeople] = useState<DealCandidate[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(listing.price != null ? String(Number(listing.price)) : ""); const [pct, setPct] = useState(5);
  const final = finalDealStatus(listing.purpose);
  const charged = (final === "sold" || final === "rented") && listing.status === "published" && listing.purpose !== "auction";
  async function show() {
    setOpen(true); setError("");
    const [r, s] = await Promise.all([listDealCandidates(supabase(), listing.id), getPlatformSettings(supabase())]);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); setPeople(r.data); if (s.data?.listing_commission_pct != null) setPct(Number(s.data.listing_commission_pct));
  }
  async function pick(userId: string | null) {
    const sale = charged ? parsePrice(amount) ?? null : null;
    if (charged && (sale == null || sale <= 0)) { setError(final === "rented" ? t("ls.deal_need_rent") : t("ls.deal_need_sale")); return; }
    setBusy(true); setError("");
    const r = userId ? await setListingDeal(supabase(), listing.id, final, userId, sale) : await closeListing(supabase(), listing.id, final, sale);
    setBusy(false);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    const fee = charged ? " " + t("ls.deal_fee", { amount: formatPrice(commissionFor(sale, pct)) }) : "";
    setOpen(false); onDone((userId ? t("ls.deal_recorded") : t("ls.listing_closed")) + fee);
  }
  if (listing.deal_with) return null;
  if (!open) return <button className="secondary" onClick={show}>{listing.status === "published" ? t(DEAL_BUTTON_KEY[final]) : "⭐ " + t("ls.deal_with_whom")}</button>;
  return <div className="card" style={{ background: "var(--surface)" }}>
    {charged && <div className="stack" style={{ gap: 6 }}>
      <label>{final === "rented" ? t("ls.deal_rent_total") : t("ls.deal_sold_for")}<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <span>{t("ls.deal_platform_fee", { pct })} <strong>{formatPrice(commissionFor(parsePrice(amount), pct))}</strong> — {t("ls.deal_pay_7d")}</span>
    </div>}
    <strong>{t("ls.deal_with_whom")}</strong>
    <span>{t("ls.deal_pick_person")}</span>
    {people === null && !error && <span>{t("common.loading")}</span>}
    {people?.length === 0 && <span>{t("ls.deal_nobody")}</span>}
    <div className="row">{people?.map(p => <button key={p.user_id} disabled={busy} onClick={() => pick(p.user_id)}>{p.full_name}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row">
      {listing.status === "published" && <button className="secondary" disabled={busy} onClick={() => pick(null)}>{t("ls.deal_close_nobody")}</button>}
      <button className="secondary" onClick={() => setOpen(false)}>{t("common.back")}</button>
    </div>
  </div>;
}
