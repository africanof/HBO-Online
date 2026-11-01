import type { SupabaseClient } from "@supabase/supabase-js";

// Pedidos mediados pela equipa: encomendas, reservas, bilhetes, pedidos de serviço, propostas e
// alugueres chegam primeiro à equipa (administradores e moderadores), que os reencaminha a quem
// os vai tratar (podendo partilhar o telefone e a morada do comprador) ou os recusa com um motivo.
export const TEAM_REQUEST_KINDS = ["orders", "venue_orders", "fuel_orders", "event_orders", "service_requests", "listing_offers", "rental_requests"] as const;
export type TeamRequestKind = (typeof TEAM_REQUEST_KINDS)[number];
export type TeamRequest = {
  kind: TeamRequestKind; id: string; ref_no: number | null; created_at: string; status: string;
  requester_id: string; requester_name: string; counterpart_id: string | null; counterpart_name: string;
  title: string; amount: number | null; details: string | null;
  phone: string | null; delivery_text: string | null; delivery_lat: number | null; delivery_lng: number | null;
  forwarded_at: string | null; declined_at: string | null; shared_contact: boolean; team_note: string | null;
};

export async function listTeamRequests(client: SupabaseClient, pendingOnly = true, limit = 100) {
  const r = await client.rpc("admin_list_team_requests", { p_pending_only: pendingOnly, p_limit: limit });
  const data = ((r.data ?? []) as any[]).map(x => ({ ...x, amount: x.amount == null ? null : Number(x.amount), ref_no: x.ref_no == null ? null : Number(x.ref_no),
    delivery_lat: x.delivery_lat == null ? null : Number(x.delivery_lat), delivery_lng: x.delivery_lng == null ? null : Number(x.delivery_lng) })) as TeamRequest[];
  return { data, error: r.error };
}
export async function pendingRequestsCount(client: SupabaseClient): Promise<number> {
  const r = await client.rpc("admin_pending_requests_count"); return Number(r.data ?? 0);
}
/** Reencaminha o pedido; com shareContact, quem o trata passa a ver o telefone e a morada do comprador. */
export async function forwardTeamRequest(client: SupabaseClient, kind: TeamRequestKind, id: string, note = "", shareContact = false) {
  return client.rpc("team_forward_request", { p_kind: kind, p_id: id, p_note: note.trim() || null, p_share_contact: shareContact });
}
/** Recusa o pedido sem o reencaminhar; quem pediu recebe o motivo. */
export async function declineTeamRequest(client: SupabaseClient, kind: TeamRequestKind, id: string, reason: string) {
  if (!reason.trim()) return { data: null, error: new Error("REASON_REQUIRED") };
  return client.rpc("team_decline_request", { p_kind: kind, p_id: id, p_reason: reason.trim() });
}
/** Estado do pedido do ponto de vista da equipa. */
export function teamRequestState(r: Pick<TeamRequest, "forwarded_at" | "declined_at">): "pending" | "forwarded" | "declined" {
  return r.declined_at ? "declined" : r.forwarded_at ? "forwarded" : "pending";
}
