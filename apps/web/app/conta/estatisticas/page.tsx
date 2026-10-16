"use client";
import { useEffect, useState } from "react";
import { getMyStats, statsTotals, contactsBreakdown, sortStats, barHeights, statsTips, contactsOf, contactRateText, statsItemHref, periodLabel, shortDay, friendlyErrorIn,
  STATS_PERIODS, STATS_KIND_LABELS, type ItemStats, type DayStats } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";
import { useT } from "../../../lib/i18n";

export default function Estatisticas() {
  const { lang, t, tc } = useT();
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [days, setDays] = useState<number>(30);
  const [items, setItems] = useState<ItemStats[]>([]); const [daily, setDaily] = useState<DayStats[]>([]); const [followers, setFollowers] = useState(0);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    void getMyStats(supabase(), days).then(r => {
      setLoading(false); setError(r.error ? friendlyErrorIn(r.error, lang) : "");
      setItems(r.items); setDaily(r.daily); setFollowers(r.followers);
    });
  }, [uid, days]);
  if (uid === undefined) return <main><p>{t("common.loading")}</p></main>;
  if (!uid) return <main><h1>{t("sh.st.title")}</h1><p><a href="/conta/login?voltar=/conta/estatisticas">{t("sh.sign_in")}</a> {t("sh.st.to_see")}</p></main>;
  const tot = statsTotals(items), heights = barHeights(daily), rate = contactRateText(tot.views, tot.contacts);
  const followersAll = followers + items.reduce((n, s) => n + s.followers, 0);
  return <main className="stack" style={{ maxWidth: 960 }}>
    <a href="/conta">← {t("sh.your_account")}</a>
    <h1>📊 {t("sh.st.title")}</h1>
    <p style={{ margin: 0 }}>{t("sh.st.intro")}</p>
    <div className="row" role="radiogroup" aria-label={t("sh.st.period")}>{STATS_PERIODS.map(d => <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? "" : "secondary"} onClick={() => setDays(d)}>{tc(periodLabel(d))}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p>{t("common.loading")}</p> : <>
      <section className="stats" aria-label={t("sh.st.summary")}>
        <div className="stat"><strong>{tot.views}</strong><span>👁 {t("sh.st.views")}</span></div>
        <div className="stat"><strong>{tot.saves}</strong><span>♥ {t("sh.st.saves")}</span></div>
        <div className="stat"><strong>{tot.contacts}</strong><span>💬 {t("sh.st.contacts")}</span></div>
        <div className="stat"><strong>{followersAll}</strong><span>👥 {t("sh.st.followers")}</span></div>
        <p className="stats-foot" style={{ margin: 0 }}>{t("sh.st.breakdown")}: {tc(contactsBreakdown(tot))}</p>
      </section>
      {rate && <p className="ok" style={{ margin: 0 }}>{tc(rate)}</p>}
      {daily.length > 0 && <section className="card">
        <h2 style={{ margin: 0 }}>{t("sh.st.per_day")}</h2>
        <div className="stats-chart" role="img" aria-label={t("sh.st.chart", { views: tot.views, contacts: tot.contacts })}>
          {daily.map((d, i) => <div key={d.day} className="stats-bar" title={t("sh.st.bar", { day: shortDay(d.day), views: d.views, contacts: d.contacts })}><span style={{ height: Math.max(heights[i], d.views ? 4 : 1) + "%" }} /></div>)}
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}><small>{shortDay(daily[0].day)}</small><small>{t("sh.st.today")}</small></div>
      </section>}
      {statsTips(items, days).map(tip => <p key={tip} className="banner yellow" style={{ margin: 0 }}>💡 {tc(tip)}</p>)}
      <h2 style={{ margin: "8px 0 0" }}>{t("sh.st.per_item")}</h2>
      {items.length === 0 && <p>{t("sh.st.none")} <a href="/classificados/publicar">{t("sh.st.first")}</a>.</p>}
      {sortStats(items).map(s => <article key={s.kind + s.item_id} className="card" style={{ gap: 6 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><a href={statsItemHref(s.kind, s.item_id)}><strong>{s.title}</strong></a><small>{tc(STATS_KIND_LABELS[s.kind])}</small></div>
        <div className="row" style={{ gap: 14 }}>
          <span>👁 {t("sh.st.n_views", { n: s.views })}</span><span>♥ {s.saves}</span><span>💬 {t("sh.st.n_contacts", { n: contactsOf(s) })}</span>
          {s.whatsapp > 0 && <span>📲 {s.whatsapp} WhatsApp</span>}{s.calls > 0 && <span>📞 {s.calls}</span>}{s.followers > 0 && <span>👥 {s.followers}</span>}
        </div>
        <small>{t("sh.st.all_time", { n: s.views_total })}</small>
      </article>)}
    </>}
  </main>;
}
