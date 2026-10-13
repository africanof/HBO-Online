import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPrice } from "./classified-listings";
import { listingPriceLabel } from "./wanted";

/** Título, descrição e fotografia de cada página pública (Google e pré-visualização no WhatsApp/Facebook). */
export type PageSeo = { title: string; description: string; image?: string; noindex?: boolean };
export type SeoKind = "listing" | "product" | "provider" | "business" | "market" | "seller" | "event" | "video";

const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
const first = (media: unknown): string | undefined => Array.isArray(media) ? media.find((m): m is string => typeof m === "string" && /^https:\/\//.test(m)) : undefined;
const https = (u: unknown) => typeof u === "string" && /^https:\/\//.test(u) ? u : undefined;
const PURPOSE: Record<string, string> = { sale: "À venda", rent: "Para arrendar", lease: "Para alugar", auction: "Leilão", wanted: "Procura-se", service: "Serviço" };

/** Monta o título e a descrição a partir dos dados (sem rede: fácil de testar). */
export function buildSeo(kind: SeoKind, row: any): PageSeo {
  if (!row) return { title: "Não encontrado", description: "Esta página já não está disponível no Huambo Online.", noindex: true };
  switch (kind) {
    case "listing": {
      const price = listingPriceLabel(row);
      const lead = [PURPOSE[row.purpose] ?? "Anúncio", price].filter(Boolean).join(" · ");
      return { title: clip(`${row.title} — ${price}`, 70), description: clip(`${lead}. ${row.description ?? ""}`, 160), image: first(row.media), noindex: row.status !== "published" };
    }
    case "product":
      return { title: clip(`${row.name} — ${formatPrice(row.price, row.currency)}`, 70), description: clip(`Na Loja do Huambo Online. ${row.description ?? ""}`, 160), image: first(row.media), noindex: !row.active };
    case "provider":
      return { title: clip([row.display_name, row.categories?.name ?? row.custom_category].filter(Boolean).join(" — "), 70),
        description: clip([row.headline, row.bio].filter(Boolean).join(". ") || "Profissional no Huambo. Peça um serviço pelo Huambo Online.", 160), image: https(row.avatar_url), noindex: !row.active };
    case "business":
      return { title: clip([row.name, row.categories?.name ?? row.custom_category].filter(Boolean).join(" — "), 70),
        description: clip(row.description || "Empresa no Huambo. Contactos, avaliações e serviços no Huambo Online.", 160), image: https(row.logo_url), noindex: !row.active };
    case "market":
      return { title: clip(`${row.name} — praça do Huambo`, 70), description: clip(row.description || `Vendedores e produtos da ${row.name}.`, 160), image: https(row.photo_url), noindex: row.status !== "active" };
    case "event": {
      const d = new Date(Date.parse(row.starts_at) + 3600_000); const when = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
      return { title: clip(`${row.title} — ${when}`, 70), description: clip(`Evento em ${row.venue}, ${when}. Compre o bilhete no Huambo Online. ${row.description ?? ""}`, 160),
        image: https(row.cover_url), noindex: row.status !== "published" };
    }
    case "video":
      return { title: clip(`${row.title} — ${row.subject_name}`, 70), description: clip(`${row.kind === "live" ? "Live" : "Vídeo"} de ${row.subject_name} no Huambo Online. ${row.description ?? ""}`, 160),
        image: https(row.cover_url), noindex: row.status !== "published" };
    case "seller":
      return { title: clip(`${row.full_name || "Vendedor"} — anúncios e avaliações`, 70), description: clip(`Anúncios, produtos e avaliações de ${row.full_name || "este vendedor"} no Huambo Online.`, 160), image: https(row.avatar_url) };
  }
}

/** Vai buscar os dados públicos e devolve o SEO da página. */
export async function fetchSeo(client: SupabaseClient, kind: SeoKind, id: string): Promise<PageSeo> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return buildSeo(kind, null);
  const q = kind === "listing" ? client.from("classified_listings").select("title,description,price,currency,purpose,budget_min,budget_max,media,status").eq("id", id).maybeSingle()
    : kind === "product" ? client.from("products").select("name,description,price,currency,media,active").eq("id", id).maybeSingle()
    : kind === "provider" ? client.from("provider_profiles").select("display_name,headline,bio,avatar_url,active,custom_category,categories(name)").eq("user_id", id).maybeSingle()
    : kind === "business" ? client.from("businesses").select("name,description,logo_url,active,custom_category,categories(name)").eq("id", id).maybeSingle()
    : kind === "market" ? client.from("markets").select("name,description,photo_url,status").eq("id", id).maybeSingle()
    : kind === "video" ? client.rpc("get_promo_post", { p_id: id }).maybeSingle()
    : kind === "event" ? client.from("events").select("title,description,venue,starts_at,cover_url,status").eq("id", id).maybeSingle()
    : client.rpc("public_seller", { p_user_id: id }).maybeSingle();
  const { data } = await q;
  return buildSeo(kind, data);
}
