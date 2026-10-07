import { useEffect, useState } from "react";
import { Link, useRouter } from "expo-router";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { getMyAdminRole, getAdminStats, listReports, resolveReport, listListingsForModeration, moderateListing, listUsersForAdmin,
  setUserStatus, setUserRole, listAllCategories, createCategory, setCategoryActive, canModerate, canManageRoles, friendlyError, formatPrice,
  ADMIN_STAT_LABELS, REPORT_STATUS_LABELS, USER_STATUS_LABELS, ROLE_LABELS, STATUS_LABELS, CATEGORY_TYPES, CATEGORY_TYPE_LABELS,
  type AdminRole, type AdminStats, type ReportStatus, type UserStatus } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button, Chips, Message } from "../components/Ui";

type Tab = "stats" | "reports" | "listings" | "users" | "categories";
const tabOptions: { value: Tab; label: string }[] = [
  { value: "stats", label: "Estatísticas" }, { value: "reports", label: "Denúncias" }, { value: "listings", label: "Anúncios" },
  { value: "users", label: "Utilizadores" }, { value: "categories", label: "Categorias" }
];

export default function Admin() {
  const router = useRouter();
  const [role, setRole] = useState<AdminRole | null>(null);
  const [tab, setTab] = useState<Tab>("stats");
  const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<any[]>([]); const [reportFilter, setReportFilter] = useState<ReportStatus | "">("open");
  const [listings, setListings] = useState<any[]>([]); const [listingQuery, setListingQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]); const [userQuery, setUserQuery] = useState("");
  const [categories, setCategories] = useState<any[]>([]); const [catName, setCatName] = useState(""); const [catType, setCatType] = useState<string>("classified");

  useEffect(() => { void getMyAdminRole(supabase()).then(setRole); }, []);
  useEffect(() => { if (canModerate(role)) void load(tab); }, [role, tab, reportFilter]);

  async function load(t: Tab) {
    setError("");
    const c = supabase();
    const r: any = t === "stats" ? await getAdminStats(c) : t === "reports" ? await listReports(c, reportFilter || undefined)
      : t === "listings" ? await listListingsForModeration(c, "", listingQuery) : t === "users" ? await listUsersForAdmin(c, userQuery) : await listAllCategories(c);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (t === "stats") setStats(r.data); else if (t === "reports") setReports(r.data ?? []); else if (t === "listings") setListings(r.data ?? []);
    else if (t === "users") setUsers(r.data ?? []); else setCategories(r.data ?? []);
  }
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); await load(tab); }
  }

  if (role === null) return <View style={ui.screen}><Text style={ui.text}>A carregar…</Text></View>;
  if (!canModerate(role)) return <View style={ui.screen}><Link href="/" style={ui.link}>← Huambo Online</Link><Text style={ui.h1}>Administração</Text><Text style={ui.error}>Acesso reservado à administração.</Text></View>;

  return <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
    <Link href="/" style={ui.link}>← Huambo Online</Link>
    <Text style={ui.h1}>Administração</Text>
    <Text style={ui.text}>Papel: {ROLE_LABELS[role]}</Text>
    <Chips options={tabOptions} value={tab} onChange={setTab} />
    <Message error={error} ok={notice} />

    {tab === "stats" && stats && ADMIN_STAT_LABELS.map(([k, l]) => <View key={k} style={ui.card}><Text style={ui.text}>{l}</Text><Text style={ui.h1}>{stats[k]}</Text></View>)}

    {tab === "reports" && <View style={{ gap: 12 }}>
      <Chips options={[{ value: "" as const, label: "Todas" }, ...Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => ({ value: value as ReportStatus, label }))]} value={reportFilter} onChange={setReportFilter} />
      {reports.length === 0 && <Text style={ui.text}>Sem denúncias.</Text>}
      {reports.map(r => <View key={r.id} style={ui.card}>
        <Text style={ui.h2}>{r.listing_title ?? r.target_type}</Text>
        <Text style={ui.text}>Motivo: {r.reason}{r.details ? " — " + r.details : ""}</Text>
        <Text style={ui.muted}>{r.reporter_name || "utilizador"} · {new Date(r.created_at).toLocaleString("pt-AO")} · {REPORT_STATUS_LABELS[r.status as ReportStatus]}</Text>
        {r.target_type === "classified_listing" && <Button title="Ver anúncio" variant="secondary" onPress={() => router.push(("/classificados/" + r.target_id) as any)} />}
        {r.target_type === "classified_listing" && r.listing_status !== "cancelled" && <Button title="Retirar anúncio" variant="danger" onPress={() => void act(async () => { const a = await moderateListing(supabase(), r.target_id, "cancelled"); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, "Anúncio retirado e denúncia resolvida.")} />}
        {r.status !== "resolved" && <Button title="Resolvida" onPress={() => void act(() => resolveReport(supabase(), r.id, "resolved"), "Denúncia resolvida.")} />}
        {r.status !== "dismissed" && <Button title="Rejeitar" variant="secondary" onPress={() => void act(() => resolveReport(supabase(), r.id, "dismissed"), "Denúncia rejeitada.")} />}
      </View>)}
    </View>}

    {tab === "listings" && <View style={{ gap: 12 }}>
      <TextInput style={ui.input} value={listingQuery} onChangeText={setListingQuery} placeholder="Pesquisar título" returnKeyType="search" onSubmitEditing={() => void load("listings")} />
      <Button title="Pesquisar" onPress={() => void load("listings")} />
      {listings.map(l => <View key={l.id} style={ui.card}>
        <Text style={ui.h2}>{l.featured ? "⭐ " : ""}{l.title}</Text>
        <Text style={ui.text}>{formatPrice(l.price, l.currency)} · {STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status} · {l.owner_name || "—"} · {l.reports} denúncia(s)</Text>
        <Button title="Ver" variant="secondary" onPress={() => router.push(("/classificados/" + l.id) as any)} />
        {l.status === "published" ? <Button title="Retirar" variant="danger" onPress={() => void act(() => moderateListing(supabase(), l.id, "cancelled"), "Anúncio retirado.")} />
          : <Button title="Publicar" onPress={() => void act(() => moderateListing(supabase(), l.id, "published"), "Anúncio publicado.")} />}
        <Button title={l.featured ? "Tirar destaque" : "Destacar"} variant="secondary" onPress={() => void act(() => moderateListing(supabase(), l.id, null, !l.featured), "Destaque atualizado.")} />
      </View>)}
    </View>}

    {tab === "users" && <View style={{ gap: 12 }}>
      <TextInput style={ui.input} value={userQuery} onChangeText={setUserQuery} placeholder="Nome ou email" autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => void load("users")} />
      <Button title="Pesquisar" onPress={() => void load("users")} />
      {users.map(u => <View key={u.id} style={ui.card}>
        <Text style={ui.h2}>{u.full_name || "(sem nome)"}</Text>
        <Text style={ui.text}>{u.email}</Text>
        <Text style={ui.muted}>{USER_STATUS_LABELS[u.status as UserStatus] ?? u.status} · {ROLE_LABELS[u.role as AdminRole] ?? u.role} · {u.listings} anúncio(s)</Text>
        {u.status === "active"
          ? <Button title="Suspender" variant="danger" onPress={() => Alert.alert("Suspender utilizador", "Os anúncios dele ficam pausados.", [{ text: "Cancelar", style: "cancel" }, { text: "Suspender", style: "destructive", onPress: () => void act(() => setUserStatus(supabase(), u.id, "suspended"), "Utilizador suspenso.") }])} />
          : <Button title="Reativar" onPress={() => void act(() => setUserStatus(supabase(), u.id, "active"), "Utilizador reativado.")} />}
        {canManageRoles(role) && <Chips options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value: value as AdminRole, label }))} value={u.role} onChange={v => void act(() => setUserRole(supabase(), u.id, v), "Papel atualizado.")} />}
      </View>)}
    </View>}

    {tab === "categories" && <View style={{ gap: 12 }}>
      <TextInput style={ui.input} value={catName} onChangeText={setCatName} placeholder="Nova categoria" />
      <Chips options={CATEGORY_TYPES.map(t => ({ value: t as string, label: CATEGORY_TYPE_LABELS[t] }))} value={catType} onChange={setCatType} />
      <Button title="Criar categoria" onPress={() => void act(() => createCategory(supabase(), catName, catType), "Categoria criada.").then(() => setCatName(""))} />
      {categories.map(c => <View key={c.id} style={ui.card}>
        <Text style={ui.h2}>{c.name}</Text>
        <Text style={ui.muted}>{CATEGORY_TYPE_LABELS[c.type as keyof typeof CATEGORY_TYPE_LABELS] ?? c.type}{c.active ? "" : " · desativada"}</Text>
        <Button title={c.active ? "Desativar" : "Ativar"} variant="secondary" onPress={() => void act(() => setCategoryActive(supabase(), c.id, !c.active), "Categoria atualizada.")} />
      </View>)}
    </View>}
  </ScrollView>;
}
