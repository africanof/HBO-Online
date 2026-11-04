import type { MetadataRoute } from "next";
import { createSupabaseClient } from "@huambo-online/supabase";
import { SITE_URL } from "../lib/site";
import { prettyPath, allLocalPaths, isExampleName } from "@huambo-online/core";

export const revalidate = 3600; // atualiza o mapa do site de hora a hora

const STATIC = ["/", "/explorar", "/loja", "/profissionais", "/empresas", "/pracas", "/procura-se", "/trocas", "/classificados/publicar", "/ajuda", "/seguranca", "/agente", "/agricultura", "/emprego", "/viaturas", "/imoveis", "/eventos", "/videos", "/combustivel", "/reservas", "/termos", "/privacidade", "/devolucoes", "/apagar-conta", "/sobre"];

/** Mapa do site para o Google: páginas principais + anúncios, produtos, profissionais, empresas e praças públicos. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const out: MetadataRoute.Sitemap = STATIC.map(p => ({ url: SITE_URL + p, lastModified: now, changeFrequency: "daily", priority: p === "/" ? 1 : 0.8 }));
  // Páginas locais: «Casas à venda na Caála», «Emprego no Bailundo»…
  for (const p of allLocalPaths()) out.push({ url: SITE_URL + p, lastModified: now, changeFrequency: "daily", priority: p.split("/").length <= 3 ? 0.8 : 0.7 });
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(); const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !key) return out;
  try {
    const c = createSupabaseClient(url, key);
    const [l, p, pr, b, m, ev] = await Promise.all([
      c.from("classified_listings").select("id,title,updated_at").eq("status", "published").order("updated_at", { ascending: false }).limit(2000),
      c.from("products").select("id,name,updated_at").eq("active", true).limit(2000),
      c.from("provider_profiles").select("user_id,display_name,updated_at").eq("active", true).limit(1000),
      c.from("businesses").select("id,name,updated_at").eq("active", true).limit(1000),
      c.from("markets").select("id").eq("status", "active").limit(200),
      c.from("events").select("id,title,updated_at").eq("status", "published").gte("starts_at", new Date(Date.now() - 86400000).toISOString()).limit(500)
    ]);
    // Anúncios e produtos com o nome no endereço (o mesmo endereço oficial que a página indica ao Google).
    const add = (rows: any[] | null, base: string, idKey = "id", nameKey?: string) => (rows ?? []).filter(r => !isExampleName(r.title ?? r.name ?? r.display_name)).forEach(r => out.push({
      url: SITE_URL + (nameKey ? prettyPath(base, r[idKey], r[nameKey]) : base + r[idKey]),
      lastModified: r.updated_at ? new Date(r.updated_at) : now, changeFrequency: "weekly", priority: 0.6 }));
    add(l.data, "/classificados/", "id", "title"); add(p.data, "/loja/", "id", "name"); add(pr.data, "/profissionais/", "user_id"); add(b.data, "/empresas/"); add(m.data, "/pracas/"); add(ev.data, "/eventos/");
  } catch { /* sem ligação: fica só com as páginas principais */ }
  return out;
}
