import type { SupabaseClient } from "@supabase/supabase-js";
import { formatEventDate } from "./events";

/**
 * 🏅 Selo «Inspecionado»: a administração foi ao local e confirmou que o profissional, a loja,
 * a empresa ou a fábrica existe mesmo. É diferente do ✔ (documento verificado). Vale um tempo e pode ser retirado.
 */
export type InspectionKind = "provider" | "business" | "store";
export type InspectionStatus = "requested" | "scheduled" | "approved" | "rejected" | "cancelled" | "revoked";
export const INSPECTION_KIND_LABELS: Record<InspectionKind, string> = { provider: "👷 Profissional", business: "🏢 Empresa ou fábrica", store: "🛍️ Loja" };
export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  requested: "⏳ Pedido enviado", scheduled: "📅 Visita marcada", approved: "🏅 Inspecionado", rejected: "❌ Não aprovado", cancelled: "Cancelado", revoked: "⛔ Selo retirado"
};
export const INSPECTION_CHECKLIST: { key: string; label: string; required?: boolean }[] = [
  { key: "exists", label: "Existe mesmo no local indicado", required: true },
  { key: "address", label: "A morada e o «como chegar» estão certos" },
  { key: "activity", label: "Faz mesmo o trabalho ou vende o que anuncia" },
  { key: "owner", label: "Falámos com o dono ou responsável" },
  { key: "documents", label: "Vimos documentos (alvará, NIF ou outro)" }
];
export const INSPECTION_BADGE = "🏅 Inspecionado";
export const INSPECTION_EXPLAINED = "A equipa do Huambo Online visitou o local e confirmou que existe e trabalha de verdade.";

export type MyInspection = { id: string; ref_no: number; kind: InspectionKind; target_id: string; target_name: string | null; status: InspectionStatus; address: string | null;
  phone: string | null; preferred_time: string | null; note: string | null; scheduled_for: string | null; admin_note: string | null; inspected_at: string | null;
  valid_until: string | null; created_at: string };
export type AdminInspection = MyInspection & { owner_id: string; owner_name: string; category_slug: string | null; inspector_name: string | null; checklist: Record<string, boolean> };
export type InspectedInfo = { inspected_at: string | null; valid_until: string };

export function inspectionRef(n: number | null | undefined) { return n ? `I-${n}` : ""; }
export function isInspected(info: InspectedInfo | null | undefined, now = Date.now()): boolean { return !!info && Date.parse(info.valid_until) > now; }
/** «Visitado pela administração em 12/10/2026 · válido até 12/10/2027» */
export function inspectionBadgeText(info: InspectedInfo | null | undefined): string {
  if (!info) return "";
  const day = (iso: string) => new Date(iso).toLocaleDateString("pt-AO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Africa/Luanda" });
  return [info.inspected_at ? `Visitado pela administração em ${day(info.inspected_at)}` : "", `válido até ${day(info.valid_until)}`].filter(Boolean).join(" · ");
}
export function inspectionKindFor(kind: "providers" | "businesses"): InspectionKind { return kind === "providers" ? "provider" : "business"; }
export function scheduledText(iso: string | null | undefined): string { return iso ? formatEventDate(iso) : ""; }
export function validateInspectionRequest(i: { address: string; phone: string }): string | null {
  if (i.address.trim().length < 5) return "Escreva a morada ou o ponto de referência para a visita.";
  if (i.phone.replace(/\D/g, "").length < 9) return "Escreva um telefone para combinar a visita.";
  return null;
}

/** Quem tem o selo válido, por id (para listas e páginas). */
export async function inspectedMap(client: SupabaseClient, kind: InspectionKind, ids: (string | null | undefined)[]): Promise<Record<string, InspectedInfo>> {
  const list = [...new Set(ids.filter((x): x is string => !!x))].slice(0, 200);
  if (!list.length) return {};
  const r = await client.rpc("inspected_targets", { p_kind: kind, p_ids: list });
  const out: Record<string, InspectedInfo> = {};
  for (const x of (r.data ?? []) as { target_id: string; inspected_at: string | null; valid_until: string }[]) out[x.target_id] = { inspected_at: x.inspected_at, valid_until: x.valid_until };
  return out;
}
export function requestInspection(client: SupabaseClient, kind: InspectionKind, targetId: string, i: { address: string; phone: string; preferredTime?: string; note?: string }) {
  const bad = validateInspectionRequest(i);
  if (bad) return Promise.resolve({ data: null, error: new Error(bad) });
  return client.rpc("request_inspection", { p_kind: kind, p_target: targetId, p_address: i.address.trim(), p_phone: i.phone.trim(),
    p_preferred_time: i.preferredTime?.trim() || null, p_note: i.note?.trim() || null });
}
export function cancelInspection(client: SupabaseClient, id: string) { return client.rpc("cancel_inspection", { p_id: id }); }
export async function myInspections(client: SupabaseClient) {
  const r = await client.rpc("my_inspections");
  return { data: (r.data ?? []) as MyInspection[], error: r.error };
}
export async function listInspectionsForAdmin(client: SupabaseClient, status: InspectionStatus | "" = "requested") {
  const r = await client.rpc("admin_list_inspections", { p_status: status || null });
  return { data: (r.data ?? []) as AdminInspection[], error: r.error };
}
export function scheduleInspection(client: SupabaseClient, id: string, when: string, inspector?: string, note?: string) {
  const t = Date.parse(when);
  if (!Number.isFinite(t)) return Promise.resolve({ data: null, error: new Error("Escolha o dia e a hora da visita.") });
  return client.rpc("admin_schedule_inspection", { p_id: id, p_when: new Date(t).toISOString(), p_inspector: inspector?.trim() || null, p_note: note?.trim() || null });
}
export function decideInspection(client: SupabaseClient, id: string, approve: boolean, checklist: Record<string, boolean>, note?: string) {
  if (approve && !checklist.exists) return Promise.resolve({ data: null, error: new Error("Só pode aprovar se confirmou que existe mesmo no local.") });
  if (!approve && !note?.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (o dono vai ler).") });
  return client.rpc("admin_decide_inspection", { p_id: id, p_approve: approve, p_note: note?.trim() || null, p_checklist: checklist });
}
export function revokeInspection(client: SupabaseClient, id: string, note: string) {
  if (!note.trim()) return Promise.resolve({ data: null, error: new Error("Escreva o motivo (o dono vai ler).") });
  return client.rpc("admin_revoke_inspection", { p_id: id, p_note: note.trim() });
}
/** A pessoa tem loja (produtos à venda)? */
export async function hasStore(client: SupabaseClient, userId: string): Promise<boolean> {
  const r = await client.from("products").select("id", { count: "exact", head: true }).eq("seller_id", userId);
  return (r.count ?? 0) > 0;
}
