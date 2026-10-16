"use client";
import { useEffect, useState } from "react";
import { listMyRentalRequests, respondRentalRequest, cancelRentalRequest, getPlatformSettings, commissionFor, formatPrice, friendlyErrorIn, RENTAL_STATUS_LABELS, type RentalStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";
import { useT, formatDateIn } from "../../lib/i18n";

export default function Alugueres() {
  const { lang, t, tc } = useT();
  const d = (s: string) => formatDateIn(s, lang);
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [pct, setPct] = useState(5);
  useEffect(() => { void getPlatformSettings(supabase()).then(r => { if (r.data?.listing_commission_pct != null) setPct(Number(r.data.listing_commission_pct)); }); }, []);
  const [role, setRole] = useState<"renter" | "owner">(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("recebidos") ? "owner" : "renter");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(r = role) { const res = await listMyRentalRequests(supabase(), r); if (res.error) setError(friendlyErrorIn(res.error, lang)); else setItems((res.data as any[]) ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) { setError(""); setNotice(""); const r = await fn(); if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(msg); await load(); } }
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>{t("ft.rentals")}</h1><p><a href="/conta/login?voltar=/alugueres">{t("ls.sign_in")}</a>.</p></main>;
  return <main className="stack">
    <a href="/conta">← {t("nav.account_short")}</a>
    <h1>{t("ft.rentals")}</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={role === "renter"} className={role === "renter" ? "" : "secondary"} onClick={() => { setRole("renter"); void load("renter"); }}>{t("ls.requests_made")}</button>
      <button role="tab" aria-selected={role === "owner"} className={role === "owner" ? "" : "secondary"} onClick={() => { setRole("owner"); void load("owner"); }}>{t("ls.requests_received")}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>{t("ls.no_requests_short")}</p>}
    {items.map(r => <article key={r.id} className="card">
      <strong><a href={"/classificados/" + r.listing_id}>{r.listing_title}</a></strong>
      <span>{d(r.starts_at)} → {d(r.ends_at)} · {formatPrice(r.proposed_price)} · <span className="badge">{tc(RENTAL_STATUS_LABELS[r.status as RentalStatus] ?? r.status)}</span></span>
      <span>{role === "owner" ? t("ls.request_from") : t("ls.owner")}: {r.other_name}</span>
      {r.message && <span>«{r.message}»</span>}
      <div className="row">
        {role === "owner" && r.status === "pending" && <><small style={{ flexBasis: "100%" }}>{t("ls.rental_fee_note", { pct, amount: formatPrice(commissionFor(r.proposed_price, pct)) })}</small><button onClick={() => act(() => respondRentalRequest(supabase(), r.id, true), t("ls.rental_accepted"))}>{t("ls.accept")}</button><button className="danger" onClick={() => act(() => respondRentalRequest(supabase(), r.id, false), t("ls.request_declined"))}>{t("ls.decline")}</button></>}
        {role === "renter" && ["pending", "accepted"].includes(r.status) && <button className="secondary" onClick={() => { if (confirm(t("ls.cancel_request_q"))) void act(() => cancelRentalRequest(supabase(), r.id), t("ls.request_cancelled")); }}>{t("common.cancel")}</button>}
      </div>
    </article>)}
  </main>;
}
