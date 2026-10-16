"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseClient } from "@huambo-online/supabase";
import { listSavedClassifiedSearches, updateSavedClassifiedSearch, deleteSavedClassifiedSearch, friendlyErrorIn } from "@huambo-online/core";
import { useT } from "../../lib/i18n";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

function SavedSearchesContent() {
  const { lang, t } = useT();
  const params = useSearchParams();
  const focus = params.get("search");
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState("");
  async function load() {
    const c = createSupabaseClient(url, key);
    const u = await c.auth.getUser();
    if (!u.data.user) { setError(t("ls.login_to_manage_searches")); return; }
    const r = await listSavedClassifiedSearches(c);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(r.data ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function patch(x: any, p: any) {
    setError("");
    const c = createSupabaseClient(url, key);
    const r = await updateSavedClassifiedSearch(c, x.id, p);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(a => a.map(i => i.id === x.id ? { ...i, ...r.data } : i));
  }
  async function remove(x: any) {
    if (!confirm(t("ls.delete_search_q"))) return;
    const c = createSupabaseClient(url, key);
    const r = await deleteSavedClassifiedSearch(c, x.id);
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else setItems(a => a.filter(i => i.id !== x.id));
  }
  return <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
    <a href="/explorar">← {t("nav.explore")}</a>
    <h1>{t("ft.saved_searches")}</h1>
    <p>{t("ls.saved_searches_intro")}</p>
    {error && <p>{error}</p>}
    {items.map(x => <section key={x.id} id={focus === x.id ? "pesquisa-" + x.id : undefined} style={{ border: focus === x.id ? "2px solid #111" : "1px solid #ddd", borderRadius: 12, padding: 18, marginTop: 12, scrollMarginTop: 20 }}>
      {focus === x.id && <strong>⭐ {t("ls.search_origin")}</strong>}
      <input defaultValue={x.name} onBlur={e => e.target.value !== x.name && void patch(x, { name: e.target.value.trim() })} style={{ fontSize: 20, fontWeight: 700, width: "100%" }} aria-label={t("ls.search_name")} />
      <p>{x.active ? "🟢 " + t("ls.active") : "⏸️ " + t("ls.paused")}</p>
      <label>{t("ls.alerts")} <select value={x.notification_frequency ?? "immediate"} onChange={e => void patch(x, { notification_frequency: e.target.value })}>
        <option value="immediate">{t("ls.alerts_immediate")}</option><option value="daily">{t("ls.alerts_daily")}</option></select></label>
      <div style={{ marginTop: 10 }}><label>{t("ls.mute_alerts")} <select value={x.notification_quiet_until ? ((new Date(x.notification_quiet_until).getTime() > Date.now()) ? "muted" : "none") : "none"} onChange={e => {
        const v = e.target.value;
        void patch(x, { notification_quiet_until: v === "1h" ? new Date(Date.now() + 3600000).toISOString() : v === "tomorrow" ? new Date(new Date().setHours(8, 0, 0, 0) + 86400000).toISOString() : null });
      }}><option value="none">{t("ls.dont_mute")}</option><option value="1h">{t("ls.one_hour")}</option><option value="tomorrow">{t("ls.until_tomorrow_8")}</option></select></label></div>
      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => void patch(x, { active: !x.active })}>{x.active ? t("ls.pause") : t("ls.activate")}</button>
        <button onClick={() => void remove(x)}>{t("ls.delete")}</button>
      </div>
    </section>)}
  </main>;
}

function Loading() { const { t } = useT(); return <main style={{ padding: 32 }}>{t("ls.loading_saved_searches")}</main>; }
function Page() { return <Suspense fallback={<Loading />}><SavedSearchesContent /></Suspense>; }
export default Page;
