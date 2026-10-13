import type { MetadataRoute } from "next";
import { createSupabaseClient } from "@huambo-online/supabase";
import { SITE_URL } from "../lib/site";

export const revalidate = 3600; // atualiza o mapa do site de hora a hora

const STATIC = ["/", "/explorar", "/loja", "/profissionais", "/empresas", "/pracas", "/procura-se", "/trocas", "/classificados/publicar", "/ajuda", "/seguranca", "/agente", "/agricultura", "/eventos", "/videos", "/termos", "/privacidade", "/devolucoes", "/apagar-conta"];

/** Mapa do site para o Google: páginas principais + anúncios, produtos, profissionais, empresas e praças públicos. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = STATIC.map(p => ({ url: SITE_URL + p, lastModified: now, changeFrequency: "daily", priority: p === "/" ? 1 : 0.8 }));
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(); const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !key) return out;
  try {
    const c = createSupabaseClient(url, key);
    const [l, p, pr, b, m, ev] = await Promise.all([
      c.from("classified_listings").select("id,updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(2000),
      c.from("products").select("id,updated_at").eq("active", true).limit(2000),
      c.from("provider_profiles").select("user_id,updated_at").eq("active", true).limit(1000),
      c.from("businesses").select("id,updated_at").eq("active", true).limit(1000),
      c.from("markets").select("id").eq("status", "active").limit(200),
      c.from("events").select("id,updated_at").eq("status", "published").gte("starts_at", new Date(Date.now() - 86400000).toISOString()).limit(500)
    ]);
    const add = (rows: any[] | null, base: string, idKey = "id") => (rows ?? []).forEach(r => out.push({ url: SITE_URL + base + r[idKey], lastModified: r.updated_at ? new Date(r.updated_at) : now, changeFrequency: "weekly", priority: 0.6 }));
    add(l.data, "/classificados/"); add(p.data, "/loja/"); add(pr.data, "/profissionais/", "user_id"); add(b.data, "/empresas/"); add(m.data, "/pracas/"); add(ev.data, "/eventos/");
  } catch { /* sem ligação: fica só com as páginas principais */ }
  return out;
}
