"use client";
import { useEffect, useState } from "react";
import { jobQueueStats, jobQueueText, listTotpFactors } from "@huambo-online/core";
import { getMyAdminRole, getAdminStats, listReports, resolveReport, listListingsForModeration, moderateListing, listUsersForAdmin,
  setUserStatus, setUserRole, listAllCategories, createCategory, setCategoryActive, canModerate, canManageRoles, friendlyErrorIn, formatPrice, LANG_TAGS,
  ADMIN_STAT_LABELS, REPORT_STATUS_LABELS, USER_STATUS_LABELS, ROLE_LABELS, STATUS_LABELS, CATEGORY_TYPES, CATEGORY_TYPE_LABELS,
  listReportsV2, setTargetActive, reportTargetHref, REPORT_TARGET_LABELS, type ReportTargetType,
  type AdminRole, type AdminStats, type ReportStatus, type UserStatus } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";
import { useT, formatDateIn } from "../../lib/i18n";
import { AdminCouriers } from "../../components/AdminCouriers";
import { AdminMarkets } from "../../components/AdminMarkets";
import { AdminVerifications, AdminAudit } from "../../components/AdminTrust";
import { AdminDisputes } from "../../components/Disputes";
import { AdminListingClaims } from "../../components/Conformity";
import { AdminPlans, AdminRevenue } from "../../components/Plans";
import { AdminProtected } from "../../components/ProtectedPayment";
import { AdminSafeSpots } from "../../components/Safety";
import { AdminAgents } from "../../components/Agents";
import { AdminEvents } from "../../components/Events";
import { AdminPromos } from "../../components/Promo";
import { AdminFuel } from "../../components/Fuel";
import { AdminVenues } from "../../components/Venues";
import { AdminInspections } from "../../components/Inspection";
import { MfaGate } from "../../components/Mfa";

type Tab = "stats" | "reports" | "revenue" | "protected" | "plans" | "safety" | "agents" | "events" | "videos" | "fuel" | "venues" | "inspections" | "disputes" | "verifications" | "listings" | "users" | "categories" | "couriers" | "markets" | "audit";
/** Separadores (o texto vem do dicionário: ad.tab.<separador>). */
const tabs: Tab[] = ["stats", "reports", "revenue", "protected", "plans", "safety", "agents", "events", "videos", "fuel", "venues", "inspections", "disputes", "verifications", "listings", "users", "categories", "couriers", "markets", "audit"];

// Com a entrada em dois passos ligada, as funções da administração só respondem depois do código (sessão aal2).
export default function AdminPage() {
  const { t } = useT();
  return <MfaGate intro={t("ad.mfa_intro")}><AdminContent /></MfaGate>;
}

/** Aviso no topo da administração: entrada em dois passos ligada ou recomendada. */
function MfaStatusLine() {
  const { t } = useT();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { void listTotpFactors(supabase()).then(r => setOn(r.data.some(f => f.status === "verified"))); }, []);
  if (on === null) return null;
  return on ? <p style={{ margin: 0 }}>🔐 {t("ad.mfa_on_label")} <strong>{t("ad.mfa_on")}</strong> · <a href="/conta/seguranca">{t("ad.mfa_manage")}</a></p>
    : <p className="scam-warn" style={{ margin: 0 }}><span>🔐 <strong>{t("ad.mfa_off_title")}</strong> — {t("ad.mfa_off_text")}</span> <a href="/conta/seguranca">{t("ad.mfa_turn_on")}</a></p>;
}

function AdminContent() {
  const { lang, t: tr, tc } = useT();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<any[]>([]); const [reportFilter, setReportFilter] = useState<ReportStatus | "">("open");
  const [listings, setListings] = useState<any[]>([]); const [listingFilter, setListingFilter] = useState(""); const [listingQuery, setListingQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]); const [userQuery, setUserQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]); const [catName, setCatName] = useState(""); const [catType, setCatType] = useState<string>("classified");

  useEffect(() => { void getMyAdminRole(supabase()).then(setRole); }, []);
  useEffect(() => { if (canModerate(role)) void load(tab); }, [role, tab]);

  async function load(t: Tab) {
    setError("");
    if (t === "couriers" || t === "markets" || t === "verifications" || t === "audit" || t === "protected" || t === "plans" || t === "safety" || t === "agents" || t === "events" || t === "videos" || t === "fuel" || t === "venues" || t === "inspections" || t === "revenue" || t === "disputes") return;
    const c = supabase();
    const r: any = t === "stats" ? await getAdminStats(c) : t === "reports" ? await listReportsV2(c, reportFilter || undefined)
      : t === "listings" ? await listListingsForModeration(c, listingFilter, listingQuery) : t === "users" ? await listUsersForAdmin(c, userQuery) : await listAllCategories(c);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    if (t === "stats") setStats(r.data); else if (t === "reports") setReports(r.data ?? []); else if (t === "listings") setListings(r.data ?? []);
    else if (t === "users") setUsers(r.data ?? []); else setCategories(r.data ?? []);
  }
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); await load(tab); }
  }

  if (role === null) return <main><p>{tr("common.loading")}</p></main>;
  if (!canModerate(role)) return <main><a href="/">← Huambo Online</a><h1>{tr("nav.admin")}</h1><p className="error">{tr("ad.no_access")}</p></main>;

  return <main className="stack" style={{ maxWidth: 1100 }}>
    <a href="/">← Huambo Online</a>
    <h1>{tr("nav.admin")}</h1>
    <p>{tr("ad.role")}: <strong>{tc(ROLE_LABELS[role])}</strong></p>
    <MfaStatusLine />
    <nav className="row" role="tablist">{tabs.map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "" : "secondary"} onClick={() => setTab(t)}>{tr("ad.tab." + t)}</button>)}</nav>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}

    {tab === "couriers" && <AdminCouriers />}
    {tab === "markets" && <AdminMarkets />}
    {tab === "verifications" && <AdminVerifications />}
    {tab === "disputes" && <><AdminDisputes /><AdminListingClaims /></>}
    {tab === "plans" && <AdminPlans />}
    {tab === "protected" && <AdminProtected />}
    {tab === "safety" && <AdminSafeSpots />}
    {tab === "agents" && <AdminAgents />}
    {tab === "events" && <AdminEvents />}
    {tab === "videos" && <AdminPromos />}
    {tab === "fuel" && <AdminFuel />}
    {tab === "venues" && <AdminVenues />}
    {tab === "inspections" && <AdminInspections />}
    {tab === "revenue" && <AdminRevenue />}
    {tab === "audit" && <AdminAudit />}
    {tab === "stats" && <JobQueueLine />}
    {tab === "stats" && stats && <section className="grid">{ADMIN_STAT_LABELS.map(([k, l]) => <div key={k} className="card"><span>{tc(l)}</span><strong style={{ fontSize: 32 }}>{stats[k]}</strong></div>)}</section>}

    {tab === "reports" && <section className="stack">
      <label style={{ maxWidth: 260 }}>{tr("ad.status")}<select value={reportFilter} onChange={e => { setReportFilter(e.target.value as any); }}><option value="">{tr("ad.all_f")}</option>{Object.entries(REPORT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select></label>
      <button className="secondary" style={{ maxWidth: 200 }} onClick={() => load("reports")}>{tr("ad.refresh")}</button>
      {reports.length === 0 && <p>{tr("ad.no_reports")}</p>}
      {reports.map(r => <article key={r.id} className="card">
        <strong>{tc(REPORT_TARGET_LABELS[r.target_type as ReportTargetType] ?? r.target_type)}: {r.target_title ?? tr("ad.gone")}{r.target_active === false ? " · " + tr("ad.hidden") : ""}</strong>
        <span>{tr("ad.reason")}: {tc(r.reason)}{r.details ? " — " + r.details : ""}</span>
        <span>{tr("ad.reported_by", { name: r.reporter_name || tr("ad.a_user") })} · {new Date(r.created_at).toLocaleString(LANG_TAGS[lang])} · <span className="badge">{tc(REPORT_STATUS_LABELS[r.status as ReportStatus])}</span></span>
        <div className="row">
          <a className="btn secondary" href={reportTargetHref(r.target_type, r.target_id, r.target_owner)} target="_blank">{tr("ad.view")}</a>
          {r.target_type === "classified_listing" && r.target_active && <button className="danger" onClick={() => act(async () => { const a = await moderateListing(supabase(), r.target_id, "cancelled"); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, tr("ad.ok_listing_removed_resolved"))}>{tr("ad.remove_listing")}</button>}
          {["product", "business", "provider"].includes(r.target_type) && (r.target_active
            ? <button className="danger" onClick={() => act(async () => { const a = await setTargetActive(supabase(), r.target_type, r.target_id, false); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, tr("ad.ok_hidden_resolved"))}>{tr("ad.hide")}</button>
            : r.target_active === false && <button className="secondary" onClick={() => act(() => setTargetActive(supabase(), r.target_type, r.target_id, true), tr("ad.ok_shown_again"))}>{tr("ad.show_again")}</button>)}
          {r.target_type === "user" && r.target_active && <button className="danger" onClick={() => { if (confirm(tr("ad.confirm_suspend_account"))) void act(async () => { const a = await setUserStatus(supabase(), r.target_id, "suspended"); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, tr("ad.ok_account_suspended_resolved")); }}>{tr("ad.suspend_account")}</button>}
          {r.status !== "resolved" && <button onClick={() => act(() => resolveReport(supabase(), r.id, "resolved"), tr("ad.ok_report_resolved"))}>{tr("ad.resolved")}</button>}
          {r.status !== "dismissed" && <button className="secondary" onClick={() => act(() => resolveReport(supabase(), r.id, "dismissed"), tr("ad.ok_report_dismissed"))}>{tr("ad.dismiss")}</button>}
        </div>
      </article>)}
    </section>}

    {tab === "listings" && <section className="stack">
      <form className="row" onSubmit={e => { e.preventDefault(); void load("listings"); }}>
        <input value={listingQuery} onChange={e => setListingQuery(e.target.value)} placeholder={tr("ad.search_title")} style={{ maxWidth: 300 }} />
        <select value={listingFilter} onChange={e => setListingFilter(e.target.value)} style={{ maxWidth: 200 }}><option value="">{tr("ad.all_statuses")}</option>{Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}</select>
        <button>{tr("ad.search")}</button>
      </form>
      {listings.map(l => <article key={l.id} className="card">
        <strong>{l.featured ? "⭐ " : ""}{l.title}</strong>
        <span>{formatPrice(l.price, l.currency)} · <span className="badge">{tc(STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status)}</span> · {l.owner_name || "—"} · {l.reports > 0 ? tr(l.reports === 1 ? "ad.reports_one" : "ad.reports_many", { n: l.reports }) : tr("ad.reports_none")}</span>
        <div className="row">
          <a className="btn secondary" href={"/classificados/" + l.id} target="_blank">{tr("ad.view")}</a>
          {l.status === "published" ? <button className="danger" onClick={() => act(() => moderateListing(supabase(), l.id, "cancelled"), tr("ad.ok_listing_removed"))}>{tr("ad.remove")}</button>
            : <button onClick={() => act(() => moderateListing(supabase(), l.id, "published"), tr("ad.ok_listing_published"))}>{tr("ad.publish")}</button>}
          <button className="secondary" onClick={() => act(() => moderateListing(supabase(), l.id, null, !l.featured), l.featured ? tr("ad.ok_unfeatured") : tr("ad.ok_featured"))}>{l.featured ? tr("ad.unfeature") : tr("ad.feature")}</button>
        </div>
      </article>)}
    </section>}

    {tab === "users" && <section className="stack">
      <form className="row" onSubmit={e => { e.preventDefault(); void load("users"); }}>
        <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder={tr("ad.name_or_email")} style={{ maxWidth: 300 }} />
        <button>{tr("ad.search")}</button>
      </form>
      {users.map(u => <article key={u.id} className="card">
        <strong>{u.full_name || tr("ad.no_name")} — {u.email}</strong>
        <span><span className="badge">{tc(USER_STATUS_LABELS[u.status as UserStatus] ?? u.status)}</span> · {tc(ROLE_LABELS[u.role as AdminRole] ?? u.role)} · {tr(Number(u.listings) === 1 ? "ad.listings_one" : "ad.listings_many", { n: u.listings ?? 0 })} · {tr("ad.since", { date: formatDateIn(u.created_at, lang) })}</span>
        <div className="row">
          {u.status === "active" ? <button className="danger" onClick={() => { if (confirm(tr("ad.confirm_suspend_user"))) void act(() => setUserStatus(supabase(), u.id, "suspended"), tr("ad.ok_user_suspended")); }}>{tr("ad.suspend")}</button>
            : <button onClick={() => act(() => setUserStatus(supabase(), u.id, "active"), tr("ad.ok_user_reactivated"))}>{tr("ad.reactivate")}</button>}
          {canManageRoles(role) && <select value={u.role} onChange={e => act(() => setUserRole(supabase(), u.id, e.target.value as AdminRole), tr("ad.ok_role_updated"))} style={{ maxWidth: 220 }} aria-label={tr("ad.role")}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{tc(l)}</option>)}
          </select>}
        </div>
      </article>)}
    </section>}

    {tab === "categories" && <section className="stack">
      <form className="row" onSubmit={e => { e.preventDefault(); void act(() => createCategory(supabase(), catName, catType), tr("ad.ok_category_created")).then(() => setCatName("")); }}>
        <input value={catName} onChange={e => setCatName(e.target.value)} placeholder={tr("ad.new_category")} style={{ maxWidth: 300 }} />
        <select value={catType} onChange={e => setCatType(e.target.value)} style={{ maxWidth: 200 }}>{CATEGORY_TYPES.map(t => <option key={t} value={t}>{tc(CATEGORY_TYPE_LABELS[t])}</option>)}</select>
        <button>{tr("ad.create")}</button>
      </form>
      {categories.map(c => <div key={c.id} className="row card" style={{ justifyContent: "space-between" }}>
        <span><strong>{c.name}</strong> · {tc(CATEGORY_TYPE_LABELS[c.type as keyof typeof CATEGORY_TYPE_LABELS] ?? c.type)} {c.active ? "" : "· " + tr("ad.deactivated_f")}</span>
        <button className="secondary" onClick={() => act(() => setCategoryActive(supabase(), c.id, !c.active), c.active ? tr("ad.ok_category_off") : tr("ad.ok_category_on"))}>{c.active ? tr("ad.deactivate") : tr("ad.activate")}</button>
      </div>)}
    </section>}
  </main>;
}

/** Estado da fila de avisos (seguidores, pesquisas guardadas, «Procura-se», combustível). */
function JobQueueLine() {
  const { tc } = useT();
  const [t, setT] = useState("");
  useEffect(() => { void jobQueueStats(supabase()).then(r => setT(jobQueueText(r.data))); }, []);
  return t ? <p className="card" role="status" style={{ margin: 0 }}>{tc(t)}</p> : null;
}
