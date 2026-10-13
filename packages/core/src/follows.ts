import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seguir profissionais, empresas e lojas/vendedores (igual no Site e na APP).
 * Quem segue recebe um aviso quando há anúncio novo, produto novo na Loja ou trabalho novo no portfólio.
 */
export type FollowKind = "seller" | "provider" | "business";
export type FollowInfo = { followers: number; following: boolean };
export type MyFollow = { kind: FollowKind; id: string; name: string; picture: string | null; detail: string | null; created_at: string };

export const FOLLOW_KIND_LABELS: Record<FollowKind, string> = { seller: "Loja / vendedor", provider: "Profissional", business: "Empresa" };
export function followHref(kind: FollowKind, id: string): string {
  return kind === "provider" ? "/profissionais/" + id : kind === "business" ? "/empresas/" + id : "/vendedor/" + id;
}
/** «12 seguidores», «1 seguidor», «Sem seguidores». */
export function followersText(n: number): string {
  return n <= 0 ? "Sem seguidores" : n === 1 ? "1 seguidor" : `${n.toLocaleString("pt-AO").replace(/\s|\./g, " ")} seguidores`;
}
export function followButtonLabel(following: boolean): string { return following ? "✔ A seguir" : "➕ Seguir"; }

export async function getFollowInfo(client: SupabaseClient, kind: FollowKind, id: string) {
  const r = await client.rpc("follow_info", { p_kind: kind, p_id: id });
  const d = (r.data ?? {}) as Partial<FollowInfo>;
  return { data: { followers: Number(d.followers ?? 0), following: !!d.following } as FollowInfo, error: r.error };
}
/** Segue ou deixa de seguir. Devolve true se ficou a seguir. */
export async function toggleFollow(client: SupabaseClient, kind: FollowKind, id: string) {
  const r = await client.rpc("toggle_follow", { p_kind: kind, p_id: id });
  return { data: r.error ? null : !!r.data, error: r.error };
}
export async function listMyFollows(client: SupabaseClient) {
  const r = await client.rpc("my_follows");
  return { data: (r.data ?? []) as MyFollow[], error: r.error };
}
