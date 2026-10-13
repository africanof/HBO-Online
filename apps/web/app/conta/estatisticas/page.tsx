"use client";
import { useEffect, useState } from "react";
import { getMyStats, statsTotals, contactsBreakdown, sortStats, barHeights, statsTips, contactsOf, contactRateText, statsItemHref, periodLabel, shortDay, friendlyError,
  STATS_PERIODS, STATS_KIND_LABELS, type ItemStats, type DayStats } from "@huambo-online/core";
import { supabase, currentUserId } from "../../../lib/supabase";

export default function Estatisticas() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [days, setDays] = useState<number>(30);
  const [items, setItems] = useState<ItemStats[]>([]); const [daily, setDaily] = useState<DayStats[]>([]); const [followers, setFollowers] = useState(0);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => { void currentUserId().then(setUid); }, []);
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    void getMyStats(supabase(), days).then(r => {
      setLoading(false); setError(r.error ? friendlyError(r.error) : "");
      setItems(r.items); setDaily(r.daily); setFollowers(r.followers);
    });
  }, [uid, days]);
  if (uid === undefined) return <main><p>A carregar…</p></main>;
  if (!uid) return <main><h1>Estatísticas</h1><p><a href="/conta/login?voltar=/conta/estatisticas">Inicie sessão</a> para ver as suas estatísticas.</p></main>;
  const t = statsTotals(items), heights = barHeights(daily), rate = contactRateText(t.views, t.contacts);
  const followersAll = followers + items.reduce((n, s) => n + s.followers, 0);
  return <main className="stack" style={{ maxWidth: 960 }}>
    <a href="/conta">← A sua conta</a>
    <h1>📊 Estatísticas</h1>
    <p style={{ margin: 0 }}>Quantas pessoas viram, guardaram e contactaram os seus anúncios, produtos, empresas e perfil profissional. Só contamos números: nunca mostramos quem viu.</p>
    <div className="row" role="radiogroup" aria-label="Período">{STATS_PERIODS.map(d => <button key={d} type="button" role="radio" aria-checked={days === d} className={days === d ? "" : "secondary"} onClick={() => setDays(d)}>{periodLabel(d)}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <p>A carregar…</p> : <>
      <section className="stats" aria-label="Resumo">
        <div className="stat"><strong>{t.views}</strong><span>👁 Vistas</span></div>
        <div className="stat"><strong>{t.saves}</strong><span>♥ Guardados (total)</span></div>
        <div className="stat"><strong>{t.contacts}</strong><span>💬 Contactos</span></div>
        <div className="stat"><strong>{followersAll}</strong><span>👥 Seguidores</span></div>
        <p className="stats-foot" style={{ margin: 0 }}>Contactos e partilhas: {contactsBreakdown(t)}</p>
      </section>
      {rate && <p className="ok" style={{ margin: 0 }}>{rate}</p>}
      {daily.length > 0 && <section className="card">
        <h2 style={{ margin: 0 }}>Vistas por dia</h2>
        <div className="stats-chart" role="img" aria-label={`Gráfico das vistas por dia: no total ${t.views} vistas e ${t.contacts} contactos.`}>
          {daily.map((d, i) => <div key={d.day} className="stats-bar" title={`${shortDay(d.day)}: ${d.views} vistas, ${d.contacts} contactos`}><span style={{ height: Math.max(heights[i], d.views ? 4 : 1) + "%" }} /></div>)}
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}><small>{shortDay(daily[0].day)}</small><small>Hoje</small></div>
      </section>}
      {statsTips(items, days).map(tip => <p key={tip} className="banner yellow" style={{ margin: 0 }}>💡 {tip}</p>)}
      <h2 style={{ margin: "8px 0 0" }}>Por anúncio, produto e perfil</h2>
      {items.length === 0 && <p>Ainda não tem anúncios, produtos, empresas nem perfil profissional. <a href="/classificados/publicar">Publique o primeiro anúncio</a>.</p>}
      {sortStats(items).map(s => <article key={s.kind + s.item_id} className="card" style={{ gap: 6 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><a href={statsItemHref(s.kind, s.item_id)}><strong>{s.title}</strong></a><small>{STATS_KIND_LABELS[s.kind]}</small></div>
        <div className="row" style={{ gap: 14 }}>
          <span>👁 {s.views} vistas</span><span>♥ {s.saves}</span><span>💬 {contactsOf(s)} contactos</span>
          {s.whatsapp > 0 && <span>📲 {s.whatsapp} WhatsApp</span>}{s.calls > 0 && <span>📞 {s.calls}</span>}{s.followers > 0 && <span>👥 {s.followers}</span>}
        </div>
        <small>Desde sempre: {s.views_total} vistas</small>
      </article>)}
    </>}
  </main>;
}
