import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";
import { listingPriceLabel } from "./wanted";

/** Título, descrição e fotografia de cada página pública (Google e pré-visualização no WhatsApp/Facebook). */
export type PageSeo = { title: string; description: string; image?: string; noindex?: boolean; slug?: string; jsonLd?: Record<string, unknown> };

/** Parte legível do endereço a partir do título («Toyota Hilux 2018» → «toyota-hilux-2018»). */
export function urlSlug(text: string | null | undefined, max = 60): string {
  const s = String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s.length > max ? s.slice(0, max).replace(/-+[^-]*$/, "").replace(/-+$/, "") || s.slice(0, max) : s;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
/** Endereço com o nome: «/classificados/<id>-toyota-hilux-2018» (o id continua a bastar). */
export function prettyPath(base: string, id: string, title?: string | null): string {
  const slug = urlSlug(title);
  return base + id + (slug ? "-" + slug : "");
}
/** Tira o id do início de «<id>-nome-do-artigo» (ou devolve o que veio, se não houver id). */
export function idFromParam(param: string | null | undefined): string {
  const v = decodeURIComponent(String(param ?? ""));
  return UUID.exec(v)?.[0] ?? v;
}

const PLACE_HUAMBO = { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: "Huambo", addressCountry: "AO" } };
const offer = (price: unknown, currency: unknown, available: boolean) => Number(price) > 0
  ? { "@type": "Offer", price: Number(price), priceCurrency: currency === "USD" || currency === "EUR" ? currency : "AOA",
      availability: available ? "https://schema.org/InStock" : "https://schema.org/SoldOut", areaServed: "Huambo, Angola" }
  : undefined;
export type SeoKind = "listing" | "product" | "provider" | "business" | "market" | "seller" | "event" | "video";

const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const first = (media: unknown): string | undefined => Array.isArray(media) ? media.find((m): m is string => typeof m === "string" && /^https:\/\//.test(m)) : undefined;
const https = (u: unknown) => typeof u === "string" && /^https:\/\//.test(u) ? u : undefined;
const PURPOSE: Record<string, string> = { sale: "À venda", rent: "Para arrendar", lease: "Para alugar", auction: "Leilão", wanted: "Procura-se", service: "Serviço" };

/** Anúncio, produto, perfil ou evento de exemplo (o nome acaba em «(exemplo)»). */
export const isExampleName = (name: unknown) => typeof name === "string" && /\(exemplo\)\s*$/i.test(name);

/** Monta o título e a descrição a partir dos dados (sem rede: fácil de testar). */
export function buildSeo(kind: SeoKind, row: any): PageSeo {
  if (!row) return { title: "Não encontrado", description: "Esta página já não está disponível no Huambo Online.", noindex: true };
  switch (kind) {
    case "listing": {
      const price = listingPriceLabel(row);
      const lead = [PURPOSE[row.purpose] ?? "Anúncio", price].filter(Boolean).join(" · ");
      const o = row.purpose === "wanted" ? undefined : offer(row.price, row.currency, row.status === "published");
      return { title: clip(`${row.title} — ${price}`, 70), description: clip(`${lead}. ${row.description ?? ""}`, 160), image: first(row.media), noindex: row.status !== "published",
        slug: urlSlug(row.title),
        jsonLd: o ? { "@context": "https://schema.org", "@type": "Product", name: row.title, description: clip(row.description ?? row.title, 500), image: first(row.media), offers: o } : undefined };
    }
    case "product":
      return { title: clip(`${row.name} — ${formatPrice(row.price, row.currency)}`, 70), description: clip(`Na Loja do Huambo Online. ${row.description ?? ""}`, 160), image: first(row.media), noindex: !row.active,
        slug: urlSlug(row.name),
        jsonLd: { "@context": "https://schema.org", "@type": "Product", name: row.name, description: clip(row.description ?? row.name, 500), image: first(row.media),
          offers: offer(row.price, row.currency, !!row.active && (row.stock == null || row.stock > 0)) } };
    case "provider":
      return { title: clip([row.display_name, row.categories?.name ?? row.custom_category].filter(Boolean).join(" — "), 70),
        description: clip([row.headline, row.bio].filter(Boolean).join(". ") || "Profissional no Huambo. Peça um serviço pelo Huambo Online.", 160), image: https(row.avatar_url), noindex: !row.active,
        jsonLd: { "@context": "https://schema.org", "@type": "ProfessionalService", name: row.display_name, description: clip([row.headline, row.bio].filter(Boolean).join(". ") || row.display_name, 500),
          image: https(row.avatar_url), areaServed: "Huambo, Angola", address: PLACE_HUAMBO.address } };
    case "business":
      return { title: clip([row.name, row.categories?.name ?? row.custom_category].filter(Boolean).join(" — "), 70),
        description: clip(row.description || "Empresa no Huambo. Contactos, avaliações e serviços no Huambo Online.", 160), image: https(row.logo_url), noindex: !row.active,
        jsonLd: { "@context": "https://schema.org", "@type": "LocalBusiness", name: row.name, description: clip(row.description || row.name, 500), image: https(row.logo_url),
          address: PLACE_HUAMBO.address } };
    case "market":
      return { title: clip(`${row.name} — praça do Huambo`, 70), description: clip(row.description || `Vendedores e produtos da ${row.name}.`, 160), image: https(row.photo_url), noindex: row.status !== "active",
        jsonLd: { "@context": "https://schema.org", "@type": "Place", name: row.name, description: clip(row.description || row.name, 500), image: https(row.photo_url), address: PLACE_HUAMBO.address } };
    case "event": {
      const d = new Date(Date.parse(row.starts_at) + 3600_000); const when = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
      return { title: clip(`${row.title} — ${when}`, 70), description: clip(`Evento em ${row.venue}, ${when}. Compre o bilhete no Huambo Online. ${row.description ?? ""}`, 160),
        image: https(row.cover_url), noindex: row.status !== "published",
        jsonLd: { "@context": "https://schema.org", "@type": "Event", name: row.title, description: clip(row.description || row.title, 500), image: https(row.cover_url),
          startDate: row.starts_at, endDate: row.ends_at || undefined, eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          eventStatus: row.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
          location: { ...PLACE_HUAMBO, name: row.venue } } };
    }
    case "video":
      return { title: clip(`${row.title} — ${row.subject_name}`, 70), description: clip(`${row.kind === "live" ? "Live" : "Vídeo"} de ${row.subject_name} no Huambo Online. ${row.description ?? ""}`, 160),
        image: https(row.cover_url), noindex: row.status !== "published" };
    case "seller":
      return { title: clip(`${row.full_name || "Vendedor"} — anúncios e avaliações`, 70), description: clip(`Anúncios, produtos e avaliações de ${row.full_name || "este vendedor"} no Huambo Online.`, 160), image: https(row.avatar_url) };
  }
}

/** Vai buscar os dados públicos e devolve o SEO da página. */
export async function fetchSeo(client: SupabaseClient, kind: SeoKind, rawId: string): Promise<PageSeo> {
  const id = idFromParam(rawId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return buildSeo(kind, null);
  const q = kind === "listing" ? client.from("classified_listings").select("title,description,price,currency,purpose,budget_min,budget_max,media,status").eq("id", id).maybeSingle()
    : kind === "product" ? client.from("products").select("name,description,price,currency,media,active,stock").eq("id", id).maybeSingle()
    : kind === "provider" ? client.from("provider_profiles").select("display_name,headline,bio,avatar_url,active,custom_category,categories(name)").eq("user_id", id).maybeSingle()
    : kind === "business" ? client.from("businesses").select("name,description,logo_url,active,custom_category,categories(name)").eq("id", id).maybeSingle()
    : kind === "market" ? client.from("markets").select("name,description,photo_url,status").eq("id", id).maybeSingle()
    : kind === "video" ? client.rpc("get_promo_post", { p_id: id }).maybeSingle()
    : kind === "event" ? client.from("events").select("title,description,venue,starts_at,ends_at,cover_url,status").eq("id", id).maybeSingle()
    : client.rpc("public_seller", { p_user_id: id }).maybeSingle();
  const { data } = await q;
  const seo = buildSeo(kind, data);
  // Exemplos da equipa («… (exemplo)»): aparecem no Site, mas não no Google.
  const d = data as Record<string, unknown> | null;
  return d && isExampleName(d.title ?? d.name ?? d.display_name) ? { ...seo, noindex: true, jsonLd: undefined } : seo;
}
