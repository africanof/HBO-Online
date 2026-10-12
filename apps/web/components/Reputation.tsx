"use client";
import { useEffect, useState } from "react";
import { getUserStats, requestService, validateServiceRequest, sellerBadge, friendlyError, validateReview, submitDealReview, listDealCandidates, setListingDeal,
  closeListing, getPlatformSettings, commissionFor, parsePrice, formatPrice, finalDealStatus, DEAL_ROLE_LABELS, type UserStats, type PendingReview, type DealCandidate } from "@huambo-online/core";

const DEAL_BUTTON = { sold: "Marcar vendido", rented: "Marcar arrendado", closed: "Fechar" } as const;
import { supabase } from "../lib/supabase";

/** Quadro de números do perfil (vendas, compras, serviços…). */
export function StatsBlock({ rows, footer }: { rows: { label: string; value: string }[]; footer?: string }) {
  if (rows.length === 0) return null;
  return <section className="stats" aria-label="Números do perfil">
    {rows.map(r => <div key={r.label} className="stat"><strong>{r.value}</strong><span>{r.label}</span></div>)}
    {footer && <small className="stats-foot">{footer}</small>}
  </section>;
}

/** Escolher de 1 a 5 estrelas (botões grandes). */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return <div className="row" role="radiogroup" aria-label="Estrelas">
    {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" role="radio" aria-checked={n === value} className={n <= value ? "star on" : "star"} aria-label={`${n} estrela(s)`} onClick={() => onChange(n)}>★</button>)}
  </div>;
}
export const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));

/** «★ 4,8 (12) · 23 vendas» ao lado do nome do vendedor. */
export function SellerBadge({ userId }: { userId?: string | null }) {
  const [s, setS] = useState<UserStats | null>(null);
  useEffect(() => { if (userId) void getUserStats(supabase(), userId).then(r => setS(r.data)); }, [userId]);
  const text = sellerBadge(s);
  return text ? <span className="seller-badge">{text}</span> : null;
}

/** Caixa «Pedir serviço» nas páginas de profissionais e empresas. */
export function RequestServiceBox({ target, signedIn }: { target: { providerId?: string; businessId?: string }; signedIn: boolean }) {
  const [text, setText] = useState(""); const [date, setDate] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [done, setDone] = useState(false);
  async function send() {
    if (!signedIn) { setError("Inicie sessão para pedir um serviço."); return; }
    const v = validateServiceRequest(text); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await requestService(supabase(), target, text, date); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else { setDone(true); setText(""); setDate(""); }
  }
  return <section className="card">
    <h2 style={{ margin: 0 }}>🛠️ Pedir serviço</h2>
    {done ? <p className="ok" role="status">Pedido enviado! Acompanhe em <a href="/servicos">Pedidos de serviço</a>.</p> : <>
      <p style={{ margin: 0 }}>Diga o que precisa. Quando o serviço terminar, confirma e avalia — a avaliação fica marcada «✔ Serviço confirmado».</p>
      <textarea rows={3} value={text} onChange={e => setText(e.target.value)} placeholder="Ex.: Instalar 3 tomadas na sala, no bairro São João." />
      <label style={{ maxWidth: 260 }}>Para quando? (opcional)<input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={e => setDate(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy} onClick={send}>{busy ? "A enviar…" : "Enviar pedido de serviço"}</button>
    </>}
  </section>;
}

/** Formulário de avaliação de um negócio (encomenda ou anúncio). */
export function DealReviewForm({ item, onDone }: { item: PendingReview; onDone: () => void }) {
  const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function send() {
    const v = validateReview(rating, comment); if (v) { setError(v); return; }
    setBusy(true); setError("");
    const r = await submitDealReview(supabase(), item.kind, item.ref_id, rating, comment); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else onDone();
  }
  return <article className="card">
    <strong style={{ fontSize: 19 }}>{item.kind === "order" ? "📦 " : "🏷️ "}{item.title}</strong>
    <span>Avaliar <a href={"/vendedor/" + item.other_id}>{item.other_name}</a> como <strong>{DEAL_ROLE_LABELS[item.other_role]}</strong></span>
    <StarPicker value={rating} onChange={setRating} />
    <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Como correu o negócio? (opcional)" />
    {error && <p className="error" role="alert">{error}</p>}
    <button disabled={busy || !rating} onClick={send}>{busy ? "A enviar…" : "Publicar avaliação"}</button>
  </article>;
}

/** «Com quem fez negócio?» — fecha o anúncio e liga as duas pessoas para se avaliarem. */
export function DealCloser({ listing, onDone }: { listing: { id: string; purpose: string; status: string; deal_with?: string | null; price?: number | string | null }; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false); const [people, setPeople] = useState<DealCandidate[] | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(listing.price != null ? String(Number(listing.price)) : ""); const [pct, setPct] = useState(5);
  const final = finalDealStatus(listing.purpose);
  const charged = final === "sold" && listing.status === "published" && listing.purpose !== "auction";
  async function show() {
    setOpen(true); setError("");
    const [r, s] = await Promise.all([listDealCandidates(supabase(), listing.id), getPlatformSettings(supabase())]);
    if (r.error) setError(friendlyError(r.error)); setPeople(r.data); if (s.data?.listing_commission_pct != null) setPct(Number(s.data.listing_commission_pct));
  }
  async function pick(userId: string | null) {
    const sale = charged ? parsePrice(amount) ?? null : null;
    if (charged && (sale == null || sale <= 0)) { setError("Indique por quanto vendeu."); return; }
    setBusy(true); setError("");
    const r = userId ? await setListingDeal(supabase(), listing.id, final, userId, sale) : await closeListing(supabase(), listing.id, final, sale);
    setBusy(false);
    if (r.error) { setError(friendlyError(r.error)); return; }
    const fee = charged ? ` Comissão a pagar: ${formatPrice(commissionFor(sale, pct))} (em «Comissões»).` : "";
    setOpen(false); onDone((userId ? "Negócio registado. Já se podem avaliar um ao outro em «Avaliações»." : "Anúncio fechado.") + fee);
  }
  if (listing.deal_with) return null;
  if (!open) return <button className="secondary" onClick={show}>{listing.status === "published" ? DEAL_BUTTON[final] : "⭐ Com quem fez negócio?"}</button>;
  return <div className="card" style={{ background: "var(--surface)" }}>
    {charged && <div className="stack" style={{ gap: 6 }}>
      <label>Por quanto vendeu? (Kz)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <span>Comissão da plataforma ({pct}%): <strong>{formatPrice(commissionFor(parsePrice(amount), pct))}</strong> — paga em 7 dias em «Comissões».</span>
    </div>}
    <strong>Com quem fez negócio?</strong>
    <span>Escolha a pessoa para se avaliarem um ao outro.</span>
    {people === null && !error && <span>A carregar…</span>}
    {people?.length === 0 && <span>Ninguém lhe enviou mensagem sobre este anúncio.</span>}
    <div className="row">{people?.map(p => <button key={p.user_id} disabled={busy} onClick={() => pick(p.user_id)}>{p.full_name}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="row">
      {listing.status === "published" && <button className="secondary" disabled={busy} onClick={() => pick(null)}>Fechar sem indicar ninguém</button>}
      <button className="secondary" onClick={() => setOpen(false)}>Voltar</button>
    </div>
  </div>;
}
