"use client";
import { useEffect, useState } from "react";
import { listMyOffers, withdrawOffer, offerLabel, friendlyError, OFFER_STATUS_LABELS, type MyOffer } from "@huambo-online/core";
import { currentUserId, supabase } from "../../lib/supabase";

export default function Propostas() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<MyOffer[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listMyOffers(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  async function withdraw(id: string) {
    if (!confirm("Retirar esta proposta?")) return;
    const r = await withdrawOffer(supabase(), id);
    if (r.error) setError(friendlyError(r.error)); else { setNotice("Proposta retirada."); await load(); }
  }
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>As minhas propostas</h1><p><a href="/conta/login?voltar=/propostas">Inicie sessão</a>.</p></main>;
  return <main className="stack">
    <a href="/conta">← A sua conta</a>
    <h1>💬 As minhas propostas</h1>
    <p>Propostas de compra e de troca que fez a vendedores. Quando o vendedor responde, recebe uma notificação.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && !error && <p>A carregar…</p>}
    {items?.length === 0 && <p>Ainda não fez propostas. Procure anúncios com «Negociável», «Aceita propostas» ou «Troca».</p>}
    {items?.map(o => <article key={o.id} className="card">
      <strong style={{ fontSize: 19 }}><a href={"/classificados/" + o.listing_id}>{o.listing_title}</a></strong>
      <span>Ofereceu: <strong>{offerLabel(o)}</strong> · <span className="badge">{OFFER_STATUS_LABELS[o.status]}</span></span>
      {o.seller_note && <span>Resposta do vendedor: {o.seller_note}</span>}
      <small>{new Date(o.created_at).toLocaleString("pt-AO")}</small>
      {o.status === "pending" && <button className="secondary" style={{ justifySelf: "start" }} onClick={() => withdraw(o.id)}>Retirar proposta</button>}
    </article>)}
  </main>;
}
