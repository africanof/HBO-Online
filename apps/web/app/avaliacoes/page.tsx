"use client";
import { useEffect, useState } from "react";
import { listPendingReviews, friendlyError, type PendingReview } from "@huambo-online/core";
import { currentUserId, supabase } from "../../lib/supabase";
import { DealReviewForm } from "../../components/Reputation";

export default function Avaliacoes() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<PendingReview[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listPendingReviews(supabase()); if (r.error) setError(friendlyError(r.error)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>Avaliações</h1><p><a href="/conta/login?voltar=/avaliacoes">Inicie sessão</a> para avaliar os seus negócios.</p></main>;
  return <main className="stack">
    <a href="/conta">← A sua conta</a>
    <h1>⭐ Avaliações por fazer</h1>
    <p>Depois de um negócio concluído, o vendedor e o comprador avaliam-se um ao outro. Só quem fez o negócio pode avaliar.</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && !error && <p>A carregar…</p>}
    {items?.length === 0 && <p>Não tem avaliações por fazer. 👍</p>}
    {items?.map(it => <DealReviewForm key={it.kind + it.ref_id} item={it} onDone={() => { setNotice("Obrigado! A sua avaliação foi publicada."); void load(); }} />)}
    <p><a href={"/vendedor/" + uid}>Ver as avaliações que recebi →</a></p>
  </main>;
}
