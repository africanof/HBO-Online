import type { SupabaseClient } from "@supabase/supabase-js";

/** Pedidos de aluguer: tudo passa pelas funções do servidor (que validam datas e conflitos). */
export type RentalStatus = "pending" | "accepted" | "rejected" | "cancelled" | "expired";
export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  pending: "À espera de resposta", accepted: "Aceite", rejected: "Recusado", cancelled: "Cancelado", expired: "Expirado"
};

export function validateRentalRequest(input: { startsAt: string; endsAt: string; price?: number }, now = new Date()): string | null {
  const s = new Date(input.startsAt), e = new Date(input.endsAt);
  if (!input.startsAt || isNaN(s.getTime())) return "Escolha a data de início.";
  if (!input.endsAt || isNaN(e.getTime())) return "Escolha a data de fim.";
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  if (s < today) return "A data de início já passou.";
  if (e <= s) return "A data de fim tem de ser depois do início.";
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) return "Indique um valor válido.";
  return null;
}

export async function requestRental(client: SupabaseClient, input: { listingId: string; startsAt: string; endsAt: string; price: number; message?: string }) {
  const invalid = validateRentalRequest(input);
  if (invalid) return { data: null, error: new Error(invalid) };
  return client.rpc("request_classified_rental", {
    p_listing_id: input.listingId, p_starts_at: new Date(input.startsAt).toISOString(), p_ends_at: new Date(input.endsAt).toISOString(),
    p_price: input.price, p_message: input.message?.trim() || null
  });
}
export async function listMyRentalRequests(client: SupabaseClient, role: "renter" | "owner" = "renter") {
  return client.rpc("my_rental_requests", { p_role: role });
}
export async function respondRentalRequest(client: SupabaseClient, id: string, accept: boolean) {
  return client.rpc("respond_rental_request", { p_request_id: id, p_accept: accept });
}
export async function cancelRentalRequest(client: SupabaseClient, id: string) {
  return client.rpc("cancel_rental_request", { p_request_id: id });
}
