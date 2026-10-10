"use client";
import { useEffect, useState } from "react";
import { listMyRentalRequests, respondRentalRequest, cancelRentalRequest, formatPrice, friendlyError, RENTAL_STATUS_LABELS, type RentalStatus } from "@huambo-online/core";
import { supabase, currentUserId } from "../../lib/supabase";

const d = (s: string) => new Date(s).toLocaleDateString("pt-AO");

export default function Alugueres() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [role, setRole] = useState<"renter" | "owner">(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("recebidos") ? "owner" : "renter");
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load(r = role) { const res = await listMyRentalRequests(supabase(), r); if (res.error) setError(friendlyError(res.error)); else setItems((res.data as any[]) ?? []); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function act(fn: () => PromiseLike<{ error: any }>, msg: string) { setError(""); setNotice(""); const r = await fn(); if (r.error) setError(friendlyError(r.error)); else { setNotice(msg); await load(); } }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>Alugueres</h1><p><a href="/conta/login?voltar=/alugueres">Inicie sessão</a>.</p></main>;
  return <main className="stack">
    <a href="/conta">← Conta</a>
    <h1>Alugueres</h1>
    <div className="row" role="tablist">
      <button role="tab" aria-selected={role === "renter"} className={role === "renter" ? "" : "secondary"} onClick={() => { setRole("renter"); void load("renter"); }}>Pedidos que fiz</button>
      <button role="tab" aria-selected={role === "owner"} className={role === "owner" ? "" : "secondary"} onClick={() => { setRole("owner"); void load("owner"); }}>Pedidos recebidos</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items.length === 0 && <p>Sem pedidos.</p>}
    {items.map(r => <article key={r.id} className="card">
      <strong><a href={"/classificados/" + r.listing_id}>{r.listing_title}</a></strong>
      <span>{d(r.starts_at)} → {d(r.ends_at)} · {formatPrice(r.proposed_price)} · <span className="badge">{RENTAL_STATUS_LABELS[r.status as RentalStatus] ?? r.status}</span></span>
      <span>{role === "owner" ? "Pedido de" : "Dono"}: {r.other_name}</span>
      {r.message && <span>«{r.message}»</span>}
      <div className="row">
        {role === "owner" && r.status === "pending" && <><button onClick={() => act(() => respondRentalRequest(supabase(), r.id, true), "Pedido aceite.")}>Aceitar</button><button className="danger" onClick={() => act(() => respondRentalRequest(supabase(), r.id, false), "Pedido recusado.")}>Recusar</button></>}
        {role === "renter" && ["pending", "accepted"].includes(r.status) && <button className="secondary" onClick={() => { if (confirm("Cancelar este pedido?")) void act(() => cancelRentalRequest(supabase(), r.id), "Pedido cancelado."); }}>Cancelar</button>}
      </div>
    </article>)}
  </main>;
}
