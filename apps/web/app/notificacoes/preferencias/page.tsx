"use client";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { getNotificationPreferences, saveNotificationPreferences, friendlyErrorIn } from "@huambo-online/core";
import { useT } from "../../../lib/i18n";

const u = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", k = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const labels = [["saved_search", "ls.np_saved_search"], ["messages", "nav.messages"], ["rentals", "ls.np_rentals"], ["auctions", "ls.np_auctions"], ["marketplace", "ls.np_marketplace"], ["reviews", "acct.l.reviews"]];

export default function NotificationPreferences() {
  const { lang, t } = useT();
  const [p, setP] = useState<any>(null), [err, setErr] = useState("");
  useEffect(() => { void (async () => {
    const c = createSupabaseClient(u, k);
    const r = await getNotificationPreferences(c);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setP(r.data ?? { enabled: true, saved_search: true, messages: true, rentals: true, auctions: true, marketplace: true, reviews: true, system: true });
  })(); }, []);
  async function save(next: any) {
    setP(next);
    const c = createSupabaseClient(u, k);
    const r = await saveNotificationPreferences(c, next);
    if (r.error) setErr(friendlyErrorIn(r.error, lang)); else setP(r.data);
  }
  if (!p) return <main style={{ padding: 32 }}><p>{err || t("ls.loading_prefs")}</p></main>;
  return <main style={{ maxWidth: 760, margin: "0 auto", padding: 32 }}>
    <a href="/notificacoes">← {t("nav.notifications")}</a>
    <h1>{t("ls.notif_prefs")}</h1>
    <p>{t("ls.notif_prefs_intro")}</p>
    {err && <p>{err}</p>}
    <label><input type="checkbox" checked={p.enabled} onChange={e => void save({ ...p, enabled: e.target.checked })} /> {t("ls.notif_enabled")}</label>
    {labels.map(([key, label]) => <label key={key} style={{ display: "block", padding: "14px 0", borderBottom: "1px solid #ddd" }}><input type="checkbox" disabled={!p.enabled} checked={!!p[key]} onChange={e => void save({ ...p, [key]: e.target.checked })} /> {t(label)}</label>)}
    <label style={{ display: "block", padding: "14px 0" }}><input type="checkbox" disabled={!p.enabled} checked={!!p.system} onChange={e => void save({ ...p, system: e.target.checked })} /> {t("ls.np_system")}</label>
  </main>;
}
