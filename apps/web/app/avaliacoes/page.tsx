"use client";
import { useEffect, useState } from "react";
import { listPendingReviews, friendlyErrorIn, type PendingReview } from "@huambo-online/core";
import { currentUserId, supabase } from "../../lib/supabase";
import { DealReviewForm } from "../../components/Reputation";
import { useT } from "../../lib/i18n";

export default function Avaliacoes() {
  const { lang, t } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [items, setItems] = useState<PendingReview[] | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const r = await listPendingReviews(supabase()); if (r.error) setError(friendlyErrorIn(r.error, lang)); setItems(r.data); }
  useEffect(() => { void currentUserId().then(id => { setUid(id); if (id) void load(); }); }, []);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><a href="/">← Huambo Online</a><h1>{t("acct.l.reviews")}</h1><p><a href="/conta/login?voltar=/avaliacoes">{t("ls.sign_in")}</a> {t("ls.to_review_deals")}</p></main>;
  return <main className="stack">
    <a href="/conta">← {t("acct.yours")}</a>
    <h1>⭐ {t("ls.reviews_todo")}</h1>
    <p>{t("ls.reviews_intro")}</p>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <p>{t("ls.reviews_none")} 👍</p>}
    {items?.map(it => <DealReviewForm key={it.kind + it.ref_id} item={it} onDone={() => { setNotice(t("ls.review_published")); void load(); }} />)}
    <p><a href={"/vendedor/" + uid}>{t("ls.see_my_reviews")} →</a></p>
  </main>;
}
