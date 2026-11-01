import type { SupabaseClient } from "@supabase/supabase-js";
import { JOB_CATEGORY_SLUGS } from "./chat-media";
import { formatPrice } from "./classified-listings";

// Emprego e estágios: anúncios das categorias «Emprego e recrutamento», «Estágios remunerados»
// e «Estágios não remunerados». Os candidatos enviam o CV pelas Mensagens (passam pela equipa).
export type JobCategorySlug = (typeof JOB_CATEGORY_SLUGS)[number];
export type JobCategory = { id: string; name: string; slug: JobCategorySlug };

export function isJobCategorySlug(slug: string | null | undefined): slug is JobCategorySlug {
  return (JOB_CATEGORY_SLUGS as readonly string[]).includes(slug ?? "");
}
/** As três categorias de emprego, pela ordem: emprego, estágios remunerados, estágios não remunerados. */
export async function listJobCategories(client: SupabaseClient) {
  const r = await client.from("categories").select("id,name,slug").in("slug", [...JOB_CATEGORY_SLUGS]).eq("active", true);
  const data = ((r.data ?? []) as JobCategory[]).sort((a, b) => JOB_CATEGORY_SLUGS.indexOf(a.slug) - JOB_CATEGORY_SLUGS.indexOf(b.slug));
  return { data, error: r.error };
}
/** Vagas publicadas (de uma categoria de emprego, ou das três), mais recentes primeiro. */
export async function listJobListings(client: SupabaseClient, categories: JobCategory[], f: { slug?: JobCategorySlug | ""; query?: string; limit?: number } = {}) {
  const ids = categories.filter(c => !f.slug || c.slug === f.slug).map(c => c.id);
  if (!ids.length) return { data: [] as any[], error: null };
  let q = client.from("classified_listings").select("id,ref_no,title,description,price,currency,media,category_id,created_at,featured,video_url")
    .eq("status", "published").in("category_id", ids).order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(f.limit ?? 60);
  const text = (f.query ?? "").trim().replace(/[%,()]/g, " ").slice(0, 80);
  if (text) q = q.or(`title.ilike.%${text}%,description.ilike.%${text}%`);
  const r = await q;
  return { data: (r.data ?? []) as any[], error: r.error };
}
/** A categoria de um anúncio é de emprego? Devolve a categoria (ou null). */
export async function jobCategoryOf(client: SupabaseClient, categoryId: string | null | undefined): Promise<JobCategory | null> {
  if (!categoryId) return null;
  const r = await client.from("categories").select("id,name,slug").eq("id", categoryId).maybeSingle();
  const c = r.data as JobCategory | null;
  return c && isJobCategorySlug(c.slug) ? c : null;
}
/** «150 000 Kz» ou «Salário a combinar»; nos estágios não remunerados, «Não remunerado». */
export function salaryLabel(price: number | string | null | undefined, slug?: string | null, currency = "AOA"): string {
  if (slug === "estagios-nao-remunerados") return "Não remunerado";
  return price == null || price === "" || Number(price) <= 0 ? "Salário a combinar" : formatPrice(price, currency);
}
