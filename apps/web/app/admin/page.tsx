"use client";
import { useEffect, useState } from "react";
import { getMyAdminRole, getAdminStats, listReports, resolveReport, listListingsForModeration, moderateListing, listUsersForAdmin,
  setUserStatus, setUserRole, listAllCategories, createCategory, setCategoryActive, canModerate, canManageRoles, friendlyError, formatPrice,
  ADMIN_STAT_LABELS, REPORT_STATUS_LABELS, USER_STATUS_LABELS, ROLE_LABELS, STATUS_LABELS, CATEGORY_TYPES, CATEGORY_TYPE_LABELS,
  type AdminRole, type AdminStats, type ReportStatus, type UserStatus } from "@huambo-online/core";
import { supabase } from "../../lib/supabase";

type Tab = "stats" | "reports" | "listings" | "users" | "categories";
const tabs: [Tab, string][] = [["stats", "Estatísticas"], ["reports", "Denúncias"], ["listings", "Anúncios"], ["users", "Utilizadores"], ["categories", "Categorias"]];

export default function AdminPage() {
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
    const c = supabase();
    const r: any = t === "stats" ? await getAdminStats(c) : t === "reports" ? await listReports(c, reportFilter || undefined)
      : t === "listings" ? await listListingsForModeration(c, listingFilter, listingQuery) : t === "users" ? await listUsersForAdmin(c, userQuery) : await listAllCategories(c);
    if (r.error) { setError(friendlyError(r.error)); return; }
    if (t === "stats") setStats(r.data); else if (t === "reports") setReports(r.data ?? []); else if (t === "listings") setListings(r.data ?? []);
    else if (t === "users") setUsers(r.data ?? []); else setCategories(r.data ?? []);
  }
  async function act(fn: () => PromiseLike<{ error: any }>, ok: string) {
    setError(""); setNotice("");
    const r = await fn();
    if (r.error) setError(friendlyError(r.error)); else { setNotice(ok); await load(tab); }
  }

  if (role === null) return <main><p>A carregar…</p></main>;
  if (!canModerate(role)) return <main><a href="/">← Huambo Online</a><h1>Administração</h1><p className="error">Acesso reservado à administração.</p></main>;

  return <main className="stack" style={{ maxWidth: 1100 }}>
    <a href="/">← Huambo Online</a>
    <h1>Administração</h1>
    <p>Papel: <strong>{ROLE_LABELS[role]}</strong></p>
    <nav className="row" role="tablist">{tabs.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "" : "secondary"} onClick={() => setTab(t)}>{l}</button>)}</nav>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="ok" role="status">{notice}</p>}

    {tab === "stats" && stats && <section className="grid">{ADMIN_STAT_LABELS.map(([k, l]) => <div key={k} className="card"><span>{l}</span><strong style={{ fontSize: 32 }}>{stats[k]}</strong></div>)}</section>}

    {tab === "reports" && <section className="stack">
      <label style={{ maxWidth: 260 }}>Estado<select value={reportFilter} onChange={e => { setReportFilter(e.target.value as any); }}><option value="">Todas</option>{Object.entries(REPORT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <button className="secondary" style={{ maxWidth: 200 }} onClick={() => load("reports")}>Atualizar</button>
      {reports.length === 0 && <p>Sem denúncias.</p>}
      {reports.map(r => <article key={r.id} className="card">
        <strong>{r.listing_title ?? r.target_type}</strong>
        <span>Motivo: {r.reason}{r.details ? " — " + r.details : ""}</span>
        <span>Denunciado por {r.reporter_name || "utilizador"} · {new Date(r.created_at).toLocaleString("pt-AO")} · <span className="badge">{REPORT_STATUS_LABELS[r.status as ReportStatus]}</span></span>
        <div className="row">
          {r.target_type === "classified_listing" && <a className="btn secondary" href={"/classificados/" + r.target_id} target="_blank">Ver anúncio</a>}
          {r.target_type === "classified_listing" && r.listing_status !== "cancelled" && <button className="danger" onClick={() => act(async () => { const a = await moderateListing(supabase(), r.target_id, "cancelled"); return a.error ? a : resolveReport(supabase(), r.id, "resolved"); }, "Anúncio retirado e denúncia resolvida.")}>Retirar anúncio</button>}
          {r.status !== "resolved" && <button onClick={() => act(() => resolveReport(supabase(), r.id, "resolved"), "Denúncia resolvida.")}>Resolvida</button>}
          {r.status !== "dismissed" && <button className="secondary" onClick={() => act(() => resolveReport(supabase(), r.id, "dismissed"), "Denúncia rejeitada.")}>Rejeitar</button>}
        </div>
      </article>)}
    </section>}

    {tab === "listings" && <section className="stack">
      <form className="row" onSubmit={e => { e.preventDefault(); void load("listings"); }}>
        <input value={listingQuery} onChange={e => setListingQuery(e.target.value)} placeholder="Pesquisar título" style={{ maxWidth: 300 }} />
        <select value={listingFilter} onChange={e => setListingFilter(e.target.value)} style={{ maxWidth: 200 }}><option value="">Todos os estados</option>{Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button>Pesquisar</button>
      </form>
      {listings.map(l => <article key={l.id} className="card">
        <strong>{l.featured ? "⭐ " : ""}{l.title}</strong>
        <span>{formatPrice(l.price, l.currency)} · <span className="badge">{STATUS_LABELS[l.status as keyof typeof STATUS_LABELS] ?? l.status}</span> · {l.owner_name || "—"} · {l.reports > 0 ? `${l.reports} denúncia(s)` : "sem denúncias"}</span>
        <div className="row">
          <a className="btn secondary" href={"/classificados/" + l.id} target="_blank">Ver</a>
          {l.status === "published" ? <button className="danger" onClick={() => act(() => moderateListing(supabase(), l.id, "cancelled"), "Anúncio retirado.")}>Retirar</button>
            : <button onClick={() => act(() => moderateListing(supabase(), l.id, "published"), "Anúncio publicado.")}>Publicar</button>}
          <button className="secondary" onClick={() => act(() => moderateListing(supabase(), l.id, null, !l.featured), l.featured ? "Destaque removido." : "Anúncio em destaque.")}>{l.featured ? "Tirar destaque" : "Destacar"}</button>
        </div>
      </article>)}
    </section>}

    {tab === "users" && <section className="stack">
      <form className="row" onSubmit={e => { e.preventDefault(); void load("users"); }}>
        <input value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Nome ou email" style={{ maxWidth: 300 }} />
        <button>Pesquisar</button>
      </form>
      {users.map(u => <article key={u.id} className="card">
        <strong>{u.full_name || "(sem nome)"} — {u.email}</strong>
        <span><span className="badge">{USER_STATUS_LABELS[u.status as UserStatus] ?? u.status}</span> · {ROLE_LABELS[u.role as AdminRole] ?? u.role} · {u.listings} anúncio(s) · desde {new Date(u.created_at).toLocaleDateString("pt-AO")}</span>
        <div className="row">
          {u.status === "active" ? <button className="danger" onClick={() => { if (confirm("Suspender este utilizador? Os anúncios dele ficam pausados.")) void act(() => setUserStatus(supabase(), u.id, "suspended"), "Utilizador suspenso."); }}>Suspender</button>
            : <button onClick={() => act(() => setUserStatus(supabase(), u.id, "active"), "Utilizador reativado.")}>Reativar</button>}
          {canManageRoles(role) && <select value={u.role} onChange={e => act(() => setUserRole(supabase(), u.id, e.target.value as AdminRole), "Papel atualizado.")} style={{ maxWidth: 220 }} aria-label="Papel">
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>}
        </div>
      </article>)}
    </section>}

    {tab === "categories" && <section className="stack">
      <form className="row" onSubmit={e => { e.preventDefault(); void act(() => createCategory(supabase(), catName, catType), "Categoria criada.").then(() => setCatName("")); }}>
        <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Nova categoria" style={{ maxWidth: 300 }} />
        <select value={catType} onChange={e => setCatType(e.target.value)} style={{ maxWidth: 200 }}>{CATEGORY_TYPES.map(t => <option key={t} value={t}>{CATEGORY_TYPE_LABELS[t]}</option>)}</select>
        <button>Criar</button>
      </form>
      {categories.map(c => <div key={c.id} className="row card" style={{ justifyContent: "space-between" }}>
        <span><strong>{c.name}</strong> · {CATEGORY_TYPE_LABELS[c.type as keyof typeof CATEGORY_TYPE_LABELS] ?? c.type} {c.active ? "" : "· (desativada)"}</span>
        <button className="secondary" onClick={() => act(() => setCategoryActive(supabase(), c.id, !c.active), c.active ? "Categoria desativada." : "Categoria ativada.")}>{c.active ? "Desativar" : "Ativar"}</button>
      </div>)}
    </section>}
  </main>;
}
