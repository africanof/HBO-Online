import type { Metadata } from "next";
import { createSupabaseClient } from "@huambo-online/supabase";
import { fetchSeo, type SeoKind } from "@huambo-online/core";

/** Metadados de uma página pública (corre no servidor, com a chave pública). */
export async function seoMetadata(kind: SeoKind, id: string, path: string): Promise<Metadata> {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(); const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  if (!url || !key) return {};
  try {
    const s = await fetchSeo(createSupabaseClient(url, key), kind, id);
    const images = s.image ? [{ url: s.image }] : undefined;
    return {
      title: s.title, description: s.description, alternates: { canonical: path },
      robots: s.noindex ? { index: false, follow: true } : undefined,
      openGraph: { title: s.title, description: s.description, url: path, siteName: "Huambo Online", locale: "pt_AO", type: "website", images },
      twitter: { card: s.image ? "summary_large_image" : "summary", title: s.title, description: s.description, images: s.image ? [s.image] : undefined }
    };
  } catch { return {}; }
}
