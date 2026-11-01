import { useEffect, useState } from "react";
import { jobQueueStats, jobQueueText } from "@huambo-online/core";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { getMyAdminRole, getAdminStats, listReports, resolveReport, listListingsForModeration, moderateListing, listUsersForAdmin,
  setUserStatus, setUserRole, listAllCategories, createCategory, setCategoryActive, canModerate, canManageRoles, assignableRoles, canManageAccount, friendlyErrorIn, formatPrice,
  ADMIN_STAT_LABELS, REPORT_STATUS_LABELS, USER_STATUS_LABELS, ROLE_LABELS, STATUS_LABELS, CATEGORY_TYPES, CATEGORY_TYPE_LABELS,
  listReportsV2, setTargetActive, reportTargetHref, REPORT_TARGET_LABELS, type ReportTargetType,
  type AdminRole, type AdminStats, type ReportStatus, type UserStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { formatDateTimeIn, useT } from "../lib/i18n";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";
import { AdminCouriers } from "../components/AdminCouriers";
import { AdminMessages } from "../components/AdminMessages";
import { AdminMarkets } from "../components/AdminMarkets";
import { AdminVerifications, AdminAudit } from "../components/AdminTrust";
import { AdminDisputes } from "../components/Disputes";
import { AdminListingClaims } from "../components/Conformity";
import { AdminPlans, AdminRevenue } from "../components/Plans";
import { AdminProtected } from "../components/ProtectedPayment";
import { AdminSafeSpots } from "../components/Safety";
import { AdminAgents } from "../components/Agents";
import { AdminEvents } from "../components/Events";
import { AdminPromos } from "../components/Promo";
import { AdminFuel } from "../components/Fuel";
import { AdminVenues } from "../components/Venues";
import { AdminInspections } from "../components/Inspection";
import { MfaPrompt, useMfaCheck } from "../components/Mfa";

type Tab = "stats" | "messages" | "reports" | "revenue" | "protected" | "plans" | "safety" | "agents" | "events" | "videos" | "fuel" | "venues" | "inspections" | "disputes" | "verifications" | "listings" | "users" | "categories" | "couriers" | "markets" | "audit";
const TABS: Tab[] = ["stats", "messages", "reports", "revenue", "protected", "plans", "safety", "agents", "events", "videos", "fuel", "venues", "inspections", "disputes", "verifications", "listings",
  "users", "categories", "couriers", "markets", "audit"];

export default function Admin() {
  const router = useRouter();
  const { lang, t: tr, tc } = useT();
  const tabOptions = TABS.map(value => ({ value, label: tr("ad.tab." + value) }));
  const [role, setRole] = useState<AdminRole | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<any[]>([]); const [reportFilter, setReportFilter] = useState<ReportStatus | "">("open");
  const [listings, setListings] = useState<any[]>([]); const [listingQuery, setListingQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]); const [userQuery, setUserQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]); const [catName, setCatName] = useState(""); const [catType, setCatType] = useState<string>("classified");

  // Com a APP autenticadora ligada, a administração só funciona depois do código (sessão aal2).
  const [mfa, mfaOk] = useMfaCheck();
  useEffect(() => { if (mfa === "ok") void getMyAdminRole(supabase()).then(setRole); }, [mfa]);
  useEffect(() => { if (canModerate(role)) void load(tab); }, [role, tab, reportFilter]);

  async function load(t: Tab) {
    setError("");
    if (t === "messages") return;
    if (t === "couriers" || t === "markets" || t === "verifications" || t === "audit" || t === "disputes" || t === "plans" || t === "safety" || t === "agents" || t === "events" || t === "videos" || t === "fuel" || t === "venues" || t === "inspections" || t === "revenue" || t === "protected") return;
    const c = supabase();
    const r: any = t === "stats" ? await getAdminStats(c) : t === "reports" ? await listReportsV2(c, reportFilter || undefined)
      : t === "listings" ? await listListingsForModeration(c, "", listingQuery) : t === "users" ? await listUsersForAdmin(c, userQuery) : await listAllCategories(c);
    if (r.error) { setError(friendlyErrorIn(r.error, lang)); return; }
    if (t === "stats") setStats(r.data); else if (t === "reports") setReports(r.data ?? []); else if (t === "listings") setListings(r.data ?? []);
    else if (t === "users") setUsers(r.data ?? []); else setCategories(r.data ?? []);
  }
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyErrorIn(r.error, lang)); else { setNotice(ok); await load(tab); }
  }

  if (mfa === "need") return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{tr("ad.title")}</Text>
    <Text style={ui.text}>{tr("ad.mfa_intro")}</Text>
    <MfaPrompt onDone={mfaOk} onCancel={() => router.replace("/")} cancelLabel={tr("ad.back_home")} />
  </ScrollView>;
  if (role === null) return <View style={ui.screen}><Text style={ui.text}>{tr("common.loading")}</Text></View>;
  if (!canModerate(role)) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.h1}>{tr("ad.title")}</Text><Text style={ui.error}>{tr("ad.restricted")}</Text></View>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>{tr("ad.title")}</Text>
    <Text style={ui.text}>{tr("ad.role", { role: tc(ROLE_LABELS[role]) })}</Text>
    <Chips options={tabOptions} value={tab} onChange={setTab} />
    <Message error={error} ok={notice} />

    {tab === "messages" && <AdminMessages />}
    {tab === "couriers" && <AdminCouriers />}
    {tab === "markets" && <AdminMarkets />}
    {tab === "verifications" && <AdminVerifications />}
    {tab === "disputes" && <><AdminDisputes /><AdminListingClaims /></>}
    {tab === "plans" && <AdminPlans />}
    {tab === "revenue" && <AdminRevenue />}
    {tab === "protected" && <AdminProtected />}
    {tab === "safety" && <AdminSafeSpots />}
    {tab === "agents" && <AdminAgents />}
    {tab === "events" && <AdminEvents />}
    {tab === "videos" && <AdminPromos />}
    {tab === "fuel" && <AdminFuel />}
    {tab === "venues" && <AdminVenues />}
    {tab === "inspections" && <AdminInspections />}
    {tab === "audit" && <AdminAudit />}
    {tab === "stats" && <JobQueueLine />}
    {tab === "stats" && stats && ADMIN_STAT_LABELS.map(([k, l]) => <View key={k} style={ui.card}><Text style={ui.text}>{tc(l)}</Text><Text style={ui.h1}>{stats[k]}</Text></View>)}

    {tab === "reports" && <View style={{ gap: 12 }}>
      <Chips options={[{ value: "" as const, label: tr("ad.all_f") }, ...Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => ({ value: value as ReportStatus, label: tc(label) }))]} value={reportFilter} onChange={setReportFilter} />
      {reports.length === 0 && <Text style={ui.text}>{tr("ad.no_reports")}</Text>}
      {reports.map(r => <View key={r.id} style={ui.card}>
        <Text style={ui.h2}>{tc(REPORT_TARGET_LABELS[r.target_type as ReportTargetType] ?? r.target_type)}: {r.target_title ?? tr("ad.gone")}{r.target_active === false ? " · " + tr("ad.hidden") : ""}</Text>
        <Text style={ui.text}>{tr("ad.reason", { reason: r.reason + (r.details ? " — " + r.details : "") })}</Text>
        <Text style={ui.muted}>{r.reporter_name || tr("ad.user_fallback")} · {formatDateTimeIn(r.created_at, lang)} · {tc(REPORT_STATUS_LABELS[r.status as ReportStatus])}</Text>
        <Button title={tr("ad.view")} variant="secondary" onPress={() => router.push(reportTargetHref(r.target_type, r.target_id, r.target_owner) as any)} />
        {r.target_type === "classified_listing" && r.target_active && <Button title={tr("ad.remove_listing")} variant="danger" onPress={() => void act(async () => { const a = await moderateListing(supabase(), r.target_id, "cancelled"); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, tr("ad.ok.listing_removed_resolved"))} />}
        {["product", "business", "provider"].includes(r.target_type) && r.target_active && <Button title={tr("ad.hide")} variant="danger" onPress={() => void act(async () => { const a = await setTargetActive(supabase(), r.target_type, r.target_id, false); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, tr("ad.ok.hidden_resolved"))} />}
        {["product", "business", "provider"].includes(r.target_type) && r.target_active === false && <Button title={tr("ad.show_again")} variant="secondary" onPress={() => void act(() => setTargetActive(supabase(), r.target_type, r.target_id, true), tr("ad.ok.shown_again"))} />}
        {r.target_type === "user" && r.target_active && <Button title={tr("ad.suspend_account")} variant="danger" onPress={() => Alert.alert(tr("ad.suspend_account"), tr("ad.are_you_sure"), [{ text: tr("ad.no"), style: "cancel" }, { text: tr("ad.suspend"), style: "destructive", onPress: () => void act(async () => { const a = await setUserStatus(supabase(), r.target_id, "suspended"); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, tr("ad.ok.account_suspended_resolved")) }])} />}
        {r.status !== "resolved" && <Button title={tr("ad.resolved")} onPress={() => void act(() => resolveReport(supabase(), r.id, "resolved"), tr("ad.ok.report_resolved"))} />}
        {r.status !== "dismissed" && <Button title={tr("ad.reject")} variant="secondary" onPress={() => void act(() => resolveReport(supabase(), r.id, "dismissed"), tr("ad.ok.report_dismissed"))} />}
      </View>)}
    </View>}

    {tab === "listings" && <View style={{ gap: 12 }}>
      <TextInput style={ui.input} value={listingQuery} onChangeText={setListingQuery} placeholder={tr("ad.search_title")} returnKeyType="search" onSubmitEditing={() => void load("listings")} />
      <Button title={tr("ad.search")} onPress={() => void load("listings")} />
      {listings.map(l => <View key={l.id} style={ui.card}>
        <Text style={ui.h2}>{l.featured ? "⭐ " : ""}{l.title}</Text>
        <Text style={ui.text}>{formatPrice(l.price, l.currency)} · {tc(STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status)} · {l.owner_name || "—"} · {tr("ad.reports_count", { n: l.reports })}</Text>
        <Button title={tr("ad.view")} variant="secondary" onPress={() => router.push(("/classificados/" + l.id) as any)} />
        {l.status === "published" ? <Button title={tr("ad.remove")} variant="danger" onPress={() => void act(() => moderateListing(supabase(), l.id, "cancelled"), tr("ad.ok.listing_removed"))} />
          : <Button title={tr("ad.publish")} onPress={() => void act(() => moderateListing(supabase(), l.id, "published"), tr("ad.ok.listing_published"))} />}
        <Button title={l.featured ? tr("ad.unfeature") : tr("ad.feature")} variant="secondary" onPress={() => void act(() => moderateListing(supabase(), l.id, null, !l.featured), tr("ad.ok.featured"))} />
      </View>)}
    </View>}

    {tab === "users" && <View style={{ gap: 12 }}>
      <TextInput style={ui.input} value={userQuery} onChangeText={setUserQuery} placeholder={tr("ad.name_or_email")} autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => void load("users")} />
      <Button title={tr("ad.search")} onPress={() => void load("users")} />
      {users.map(u => <View key={u.id} style={ui.card}>
        <Text style={ui.h2}>{u.full_name || tr("ad.no_name")}</Text>
        <Text style={ui.text}>{u.email}</Text>
        <Text style={ui.muted}>{tc(USER_STATUS_LABELS[u.status as UserStatus] ?? u.status)} · {tc(ROLE_LABELS[u.role as AdminRole] ?? u.role)} · {tr("ad.listings_count", { n: u.listings })}</Text>
        {!canManageAccount(role, u.role) ? <Text style={ui.muted}>🔒 {tr("ad.protected_admin")}</Text> : <>
        {u.status === "active"
          ? <Button title={tr("ad.suspend")} variant="danger" onPress={() => Alert.alert(tr("ad.suspend_user"), tr("ad.suspend_user_msg"), [{ text: tr("common.cancel"), style: "cancel" }, { text: tr("ad.suspend"), style: "destructive", onPress: () => void act(() => setUserStatus(supabase(), u.id, "suspended"), tr("ad.ok.user_suspended")) }])} />
          : <Button title={tr("ad.reactivate")} onPress={() => void act(() => setUserStatus(supabase(), u.id, "active"), tr("ad.ok.user_reactivated"))} />}
        {canManageRoles(role) && <Chips options={assignableRoles(role).map(value => ({ value, label: tc(ROLE_LABELS[value]) }))} value={u.role as AdminRole} onChange={v => void act(() => setUserRole(supabase(), u.id, v), tr("ad.ok.role_updated"))} />}
        </>}
      </View>)}
    </View>}

    {tab === "categories" && <View style={{ gap: 12 }}>
      <TextInput style={ui.input} value={catName} onChangeText={setCatName} placeholder={tr("ad.new_category")} />
      <Chips options={CATEGORY_TYPES.map(t => ({ value: t as string, label: tc(CATEGORY_TYPE_LABELS[t]) }))} value={catType} onChange={setCatType} />
      <Button title={tr("ad.create_category")} onPress={() => void act(() => createCategory(supabase(), catName, catType), tr("ad.ok.category_created")).then(() => setCatName(""))} />
      {categories.map(c => <View key={c.id} style={ui.card}>
        <Text style={ui.h2}>{c.name}</Text>
        <Text style={ui.muted}>{tc(CATEGORY_TYPE_LABELS[c.type as keyof typeof CATEGORY_TYPE_LABELS] ?? c.type)}{c.active ? "" : " · " + tr("ad.disabled_f")}</Text>
        <Button title={c.active ? tr("ad.deactivate") : tr("ad.activate")} variant="secondary" onPress={() => void act(() => setCategoryActive(supabase(), c.id, !c.active), tr("ad.ok.category_updated"))} />
      </View>)}
    </View>}
  </ScrollView>;
}

/** Estado da fila de avisos (seguidores, pesquisas guardadas, «Procura-se», combustível). */
function JobQueueLine() {
  const { tc } = useT();
  const [t, setT] = useState("");
  useEffect(() => { void jobQueueStats(supabase()).then(r => setT(jobQueueText(r.data))); }, []);
  return t ? <View style={ui.card}><Text style={ui.text}>{tc(t)}</Text></View> : null;
}
