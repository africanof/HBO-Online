import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminRole = "user" | "moderator" | "admin";
export type AdminStats = {
  users: number; users_7d: number; users_suspended: number; listings_published: number; listings_total: number;
  listings_7d: number; reports_open: number; conversations: number; messages_7d: number;
  products_active?: number; providers?: number; businesses?: number; orders_30d?: number; orders_completed_30d?: number; sales_value_30d?: number;
  services_30d?: number; services_done_30d?: number; deals_30d?: number; reviews_30d?: number; verifications_pending?: number;
  disputes_open?: number; disputes_escalated?: number; refunds_30d?: number;
  plans_trial?: number; plans_paid?: number; plans_expired?: number; plan_payments_pending?: number; plan_revenue_30d?: number;
};
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";
export type UserStatus = "active" | "suspended" | "banned";

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = { open: "Aberta", reviewing: "Em análise", resolved: "Resolvida", dismissed: "Rejeitada" };
export const USER_STATUS_LABELS: Record<UserStatus, string> = { active: "Ativo", suspended: "Suspenso", banned: "Banido" };
export const ROLE_LABELS: Record<AdminRole, string> = { user: "Utilizador", moderator: "Moderador", admin: "Administrador" };

export const ADMIN_STAT_LABELS: [keyof AdminStats, string][] = [
  ["users", "Utilizadores"], ["users_7d", "Novos (7 dias)"], ["users_suspended", "Suspensos"],
  ["listings_published", "Anúncios publicados"], ["listings_total", "Anúncios (total)"], ["listings_7d", "Anúncios novos (7 dias)"],
  ["reports_open", "Denúncias por tratar"], ["verifications_pending", "Verificações por analisar"], ["plan_payments_pending", "Pagamentos de mensalidade por confirmar"], ["disputes_escalated", "Disputas para decidir"], ["disputes_open", "Devoluções e reembolsos abertos"], ["conversations", "Conversas"], ["messages_7d", "Mensagens (7 dias)"],
  ["products_active", "Produtos na loja"], ["providers", "Profissionais"], ["businesses", "Empresas"],
  ["orders_30d", "Encomendas (30 dias)"], ["orders_completed_30d", "Encomendas concluídas (30 dias)"], ["sales_value_30d", "Vendas concluídas em Kz (30 dias)"],
  ["services_30d", "Pedidos de serviço (30 dias)"], ["services_done_30d", "Serviços prestados (30 dias)"], ["deals_30d", "Negócios em anúncios (30 dias)"], ["reviews_30d", "Avaliações (30 dias)"], ["refunds_30d", "Reembolsado em Kz (30 dias)"], ["plans_trial", "Perfis no mês grátis"], ["plans_paid", "Perfis com mensalidade paga"], ["plans_expired", "Perfis sem pagamento (escondidos)"], ["plan_revenue_30d", "Mensalidades recebidas em Kz (30 dias)"]
];

export function canModerate(role: string | null | undefined) { return role === "moderator" || role === "admin"; }
/** Administradores e moderadores podem mudar papéis (os moderadores só entre utilizador e moderador). */
export function canManageRoles(role: string | null | undefined) { return canModerate(role); }
/** Papéis que esta pessoa pode dar a outra conta. */
export function assignableRoles(myRole: string | null | undefined): AdminRole[] {
  return myRole === "admin" ? ["user", "moderator", "admin"] : myRole === "moderator" ? ["user", "moderator"] : [];
}
/** Só um administrador pode suspender, banir, reativar ou mudar o papel de uma conta de administrador. */
export function canManageAccount(myRole: string | null | undefined, targetRole: string | null | undefined) {
  if (!canModerate(myRole)) return false;
  return targetRole !== "admin" || myRole === "admin";
}

export async function getMyAdminRole(client: SupabaseClient): Promise<AdminRole> {
  const { data, error } = await client.rpc("my_admin_role");
  if (error || typeof data !== "string") return "user";
  return (["user", "moderator", "admin"].includes(data) ? data : "user") as AdminRole;
}
export async function getAdminStats(client: SupabaseClient) { return client.rpc("admin_stats").returns<AdminStats>(); }
export async function listReports(client: SupabaseClient, status?: ReportStatus) { return client.rpc("admin_list_reports", { p_status: status ?? null }); }
export async function resolveReport(client: SupabaseClient, reportId: string, status: ReportStatus) { return client.rpc("admin_resolve_report", { p_report_id: reportId, p_status: status }); }
export async function listListingsForModeration(client: SupabaseClient, status?: string, query = "") { return client.rpc("admin_list_listings", { p_status: status || null, p_query: query }); }
export async function moderateListing(client: SupabaseClient, listingId: string, status: string | null, featured: boolean | null = null) {
  return client.rpc("admin_moderate_listing", { p_listing_id: listingId, p_status: status, p_featured: featured });
}
export async function listUsersForAdmin(client: SupabaseClient, query = "") { return client.rpc("admin_list_users", { p_query: query }); }
export async function setUserStatus(client: SupabaseClient, userId: string, status: UserStatus) { return client.rpc("admin_set_user_status", { p_user_id: userId, p_status: status }); }
export async function setUserRole(client: SupabaseClient, userId: string, role: AdminRole) { return client.rpc("admin_set_user_role", { p_user_id: userId, p_role: role }); }

export function slugify(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export const CATEGORY_TYPES = ["classified", "product", "service", "professional", "business"] as const;
export const CATEGORY_TYPE_LABELS: Record<(typeof CATEGORY_TYPES)[number], string> = {
  classified: "Classificados", product: "Produtos", service: "Serviços", professional: "Profissionais", business: "Empresas"
};
export async function listAllCategories(client: SupabaseClient) { return client.from("categories").select("id,name,slug,type,active").order("type").order("name"); }
export async function createCategory(client: SupabaseClient, name: string, type: string) {
  if (!name.trim()) return { data: null, error: new Error("Indique o nome da categoria.") };
  return client.from("categories").insert({ name: name.trim(), slug: slugify(name), type, active: true }).select().single();
}
export async function setCategoryActive(client: SupabaseClient, id: string, active: boolean) { return client.from("categories").update({ active }).eq("id", id); }
