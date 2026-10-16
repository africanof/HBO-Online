"use client";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications, getNotificationListingId, getNotificationConversationId, getNotificationSavedSearchId, getNotificationLink, friendlyErrorIn, LANG_TAGS } from "@huambo-online/core";
import { useT } from "../../lib/i18n";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export default function NotificacoesPage() {
  const { lang, t, tc } = useT();
  const [items, setItems] = useState<any[]>([]); const [unread, setUnread] = useState(0); const [error, setError] = useState("");
  async function load() {
    try {
      const c = createSupabaseClient(url, key);
      const [a, b] = await Promise.all([listNotifications(c), countUnreadNotifications(c)]);
      if (a.error) throw a.error;
      setItems(a.data ?? []); setUnread(b.count);
    } catch (e) { setError(friendlyErrorIn(e, lang, t("ls.notif_load_failed"))); }
  }
  useEffect(() => { void load(); const c = createSupabaseClient(url, key); let stop = () => {}; void c.auth.getUser().then(({ data }) => { if (data.user) stop = subscribeToNotifications(c, data.user.id, () => { void load(); }); }); return () => stop(); }, []);
  return <main style={{ maxWidth: 900, margin: "0 auto", padding: 32 }}>
    <a href="/">← Huambo Online</a><p><a href="/notificacoes/preferencias">⚙️ {t("ls.notif_prefs")}</a></p><h1>{t("nav.notifications")} {unread > 0 && <small>({t("ls.n_new", { n: unread })})</small>}</h1>
    <button onClick={async () => { const c = createSupabaseClient(url, key); await markAllNotificationsRead(c); await load(); }}>{t("ls.mark_all_read")}</button>
    {error && <p>{error}</p>}
    <section style={{ marginTop: 24, display: "grid", gap: 12 }}>
      {items.map(n => <article key={n.id} style={{ border: "1px solid #ddd", borderRadius: 14, padding: 16, opacity: n.read_at ? .7 : 1, overflowWrap: "anywhere" }}>
        <strong>{tc(n.title)}</strong><p>{tc(n.body)}</p><small>{new Date(n.created_at).toLocaleString(LANG_TAGS[lang])}</small>
        {!n.read_at && <button onClick={async () => { const c = createSupabaseClient(url, key); await markNotificationRead(c, n.id); await load(); }}>{t("ls.mark_read")}</button>}
        {getNotificationConversationId(n) && <p><a href={"/mensagens?conversation=" + getNotificationConversationId(n)}>{t("ls.open_conversation")} →</a></p>}
        {getNotificationListingId(n) && <p><a href={"/classificados/" + getNotificationListingId(n)}>🔎 {t("ls.open_listing")} →</a></p>}
        {getNotificationSavedSearchId(n) && <p><a href={"/pesquisas-guardadas?search=" + getNotificationSavedSearchId(n)}>⭐ {t("ls.open_saved_search")} →</a></p>}
        {getNotificationLink(n) && <p><a href={getNotificationLink(n)!.href}>{tc(getNotificationLink(n)!.label)}</a></p>}
        {n.data?.digest && Array.isArray(n.data?.listing_ids) && n.data.listing_ids.length > 1 && <p><a href={"/notificacoes/digest?ids=" + n.data.listing_ids.join(",")}>📦 {t("ls.see_all_listings_n", { n: n.data.listing_ids.length })} →</a></p>}
      </article>)}
    </section>
  </main>;
}
