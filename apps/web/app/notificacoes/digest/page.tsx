"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@huambo-online/supabase";
import { listClassifiedListingsByIds, friendlyErrorIn, PURPOSE_LABELS, LISTING_TYPE_LABELS } from "@huambo-online/core";
import { useT } from "../../../lib/i18n";

function DigestResults() {
  const { lang, t, tc } = useT();
  const p = useSearchParams();
  const ids = (p.get("ids") ?? "").split(",").filter(Boolean);
  const [items, setItems] = useState<any[]>([]); const [error, setError] = useState("");
  useEffect(() => { (async () => {
    const c = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
    const r = await listClassifiedListingsByIds(c, ids);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data ?? []);
  })(); }, [p]);
  return <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
    <a href="/notificacoes">← {t("nav.notifications")}</a>
    <h1>{t("ls.alert_results")}</h1>
    {error && <p>{error}</p>}
    {!error && !items.length && <p>{t("ls.alert_listings_gone")}</p>}
    <div style={{ display: "grid", gap: 12 }}>{items.map(x => <a key={x.id} href={"/classificados/" + x.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, textDecoration: "none", color: "inherit" }}>
      <strong>{x.title}</strong><p>{x.price ?? t("ls.price_on_request")} {x.currency ?? ""}</p>
      <small>{tc((PURPOSE_LABELS as Record<string, string>)[x.purpose] ?? x.purpose)} · {tc((LISTING_TYPE_LABELS as Record<string, string>)[x.listing_type] ?? x.listing_type)}</small></a>)}</div>
  </main>;
}
function Loading() { const { t } = useT(); return <main style={{ padding: 32 }}>{t("ls.loading_results")}</main>; }
function Page() { return <Suspense fallback={<Loading />}><DigestResults /></Suspense>; }
export default Page;
