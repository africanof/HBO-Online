import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Número curto de cada artigo (igual no Site e na APP): anúncios A-1001, produtos P-1001, encomendas E-1001.
 * Escrever o número na pesquisa leva diretamente ao artigo.
 */
export type RefKind = "listing" | "product" | "order";
const PREFIX: Record<RefKind, string> = { listing: "A", product: "P", order: "E" };
const KIND: Record<string, RefKind> = { A: "listing", P: "product", E: "order" };
export const REF_LABELS: Record<RefKind, string> = { listing: "Anúncio", product: "Produto", order: "Encomenda" };

export function formatRef(kind: RefKind, n: number | string | null | undefined): string {
  return n == null || n === "" ? "" : `${PREFIX[kind]}-${n}`;
}
/** «A-1001», «a1001», «P 1001», «e-001001» → { kind, n }. Outra coisa → null. */
export function parseRef(text: string): { kind: RefKind; n: number; code: string } | null {
  const m = /^\s*(?:n\.?\s*º?\s*)?([APE])[\s-]*0*(\d{1,12})\s*$/i.exec(text ?? "");
  if (!m) return null;
  const letter = m[1].toUpperCase();
  return { kind: KIND[letter], n: Number(m[2]), code: `${letter}-${Number(m[2])}` };
}
export function refHref(kind: RefKind, id: string): string {
  return kind === "listing" ? "/classificados/" + id : kind === "product" ? "/loja/" + id : "/encomendas#encomenda-" + id;
}
export async function findByRef(client: SupabaseClient, code: string) {
  const r = await client.rpc("find_by_ref", { p_ref: code });
  const row = (Array.isArray(r.data) ? r.data[0] : r.data) as { kind: RefKind; id: string } | undefined;
  return { data: row ?? null, error: r.error };
}
