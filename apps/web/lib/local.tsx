import { cache } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { fetchLocalListings, municipalityIdOf, listingPriceLabel, isFeatured, PURPOSE_LABELS, type LocalMunicipality, type LocalTopic } from "@huambo-online/core";
import { ItemCard, LISTING_ICON } from "../components/ItemCard";
import { SITE_URL } from "./site";

/** Ligação de leitura à base de dados (chave pública), no servidor. */
export function serverClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim(); const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
  return url && key ? createSupabaseClient(url, key) : null;
}

export const municipalityId = cache(async (m: LocalMunicipality) => {
  const c = serverClient(); if (!c) return null;
  try { return await municipalityIdOf(c, m); } catch { return null; }
});

export const localListings = cache(async (t: LocalTopic, mId: string | null, limit = 24) => {
  const c = serverClient(); if (!c) return [];
  try { return await fetchLocalListings(c, t, mId, limit); } catch { return []; }
});

/** Dados estruturados (schema.org), com «<» escapado. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** Caminho de navegação para o Google: Início › Huambo › Caála › Casas à venda. */
export function breadcrumbLd(items: [string, string][]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE_URL + path })) };
}

export function Breadcrumbs({ items }: { items: [string, string][] }) {
  return <nav aria-label="Caminho" style={{ fontSize: 15 }}>
    {items.map(([name, path], i) => <span key={path}>{i > 0 && " › "}{i < items.length - 1 ? <a href={path}>{name}</a> : <strong>{name}</strong>}</span>)}
  </nav>;
}

export function ListingGrid({ items }: { items: any[] }) {
  return <div className="results-grid">{items.map(x => <ItemCard key={x.id} href={"/classificados/" + x.id} media={x.media} title={x.title}
    price={listingPriceLabel(x)} icon={LISTING_ICON[x.listing_type] ?? "🏷️"} featured={isFeatured(x)} video={!!x.video_url}
    tag={x.purpose !== "sale" ? PURPOSE_LABELS[x.purpose as keyof typeof PURPOSE_LABELS] ?? undefined : undefined} />)}</div>;
}
