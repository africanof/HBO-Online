import { cache } from "react";
import type { Metadata } from "next";
import { createSupabaseClient } from "@huambo-online/supabase";
import { fetchSeo, idFromParam, type PageSeo, type SeoKind } from "@huambo-online/core";
import { DEFAULT_OG_IMAGES } from "./site";

/** Dados de SEO de uma página (lidos uma só vez por pedido: metadados + dados estruturados). */
const getSeo = cache(async (kind: SeoKind, rawId: string): Promise<PageSeo | null> => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(); const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !key) return null;
  try { return await fetchSeo(createSupabaseClient(url, key), kind, rawId); } catch { return null; }
});

/** Endereço oficial (canónico): com o nome do artigo quando existe, ex. «/classificados/<id>-toyota-hilux». */
function canonicalPath(base: string, rawId: string, s: PageSeo): string {
  const id = idFromParam(rawId);
  return base + id + (s.slug ? "-" + s.slug : "");
}

/** Metadados de uma página pública (corre no servidor, com a chave pública). «base» é o início do caminho, ex. «/loja/». */
export async function seoMetadata(kind: SeoKind, rawId: string, base: string): Promise<Metadata> {
  const s = await getSeo(kind, rawId);
  if (!s) return {};
  const path = canonicalPath(base, rawId, s);
  const images = s.image ? [{ url: s.image }] : DEFAULT_OG_IMAGES;
  return {
    title: s.title, description: s.description, alternates: { canonical: path },
    robots: s.noindex ? { index: false, follow: true } : undefined,
    openGraph: { title: s.title, description: s.description, url: path, siteName: "Huambo Online", locale: "pt_AO", type: "website", images },
    twitter: { card: "summary_large_image", title: s.title, description: s.description, images: [s.image || "/og-image.png"] }
  };
}

/** Dados estruturados (schema.org) para o Google: preço, evento, empresa… */
export async function SeoJsonLd({ kind, rawId, base }: { kind: SeoKind; rawId: string; base: string }) {
  const s = await getSeo(kind, rawId);
  if (!s?.jsonLd || s.noindex) return null;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://huamboonline.com").replace(/\/$/, "");
  const data = { ...s.jsonLd, url: site + canonicalPath(base, rawId, s) };
  // «<» escapado para o JSON nunca fechar a etiqueta <script>.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
