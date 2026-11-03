import type { SupabaseClient } from "@supabase/supabase-js";
import { JOB_CATEGORY_SLUGS } from "./chat-media";

// Páginas locais para o Google: «Casas à venda na Caála», «Carros à venda no Bailundo», «Emprego no Huambo»…
// Uma página por município da província do Huambo e por tema, com texto próprio e os anúncios dessa zona.

export type LocalMunicipality = { slug: string; name: string; /** «na Caála», «no Bailundo», «em Ecunha» */ at: string; about: string };

/** Os 17 municípios da província do Huambo (nomes iguais aos da base de dados). */
export const HUAMBO_MUNICIPALITIES: LocalMunicipality[] = [
  { slug: "huambo", name: "Huambo", at: "no Huambo", about: "A cidade do Huambo é a capital da província e o maior centro de comércio, serviços, escolas e universidades da região, com bairros como a Cidade Baixa, São Pedro, Benfica, Kapango e Cacilhas." },
  { slug: "caala", name: "Caála", at: "na Caála", about: "A Caála fica a poucos quilómetros a oeste da cidade do Huambo, na linha do Caminho de Ferro de Benguela, e é conhecida pela agricultura e pelo comércio que liga o Huambo ao litoral." },
  { slug: "bailundo", name: "Bailundo", at: "no Bailundo", about: "O Bailundo, a norte da cidade do Huambo, é um dos municípios mais históricos de Angola, com forte atividade agrícola e comércio nas suas praças." },
  { slug: "londuimbali", name: "Londuimbali", at: "no Londuimbali", about: "O Londuimbali, no norte da província, vive sobretudo da agricultura e do comércio local." },
  { slug: "longonjo", name: "Longonjo", at: "no Longonjo", about: "O Longonjo, a oeste da Caála, fica na linha do Caminho de Ferro de Benguela e tem agricultura e comércio ao longo da estrada para Benguela." },
  { slug: "mungo", name: "Mungo", at: "no Mungo", about: "O Mungo, no nordeste da província, é uma zona agrícola com comércio nas praças locais." },
  { slug: "ucuma", name: "Ucuma", at: "no Ucuma", about: "O Ucuma, no noroeste da província, é uma zona agrícola ligada à cidade do Huambo e ao Bailundo." },
  { slug: "ecunha", name: "Ecunha", at: "em Ecunha", about: "A Ecunha fica perto da cidade do Huambo, com produção agrícola que abastece as praças da província." },
  { slug: "cachiungo", name: "Cachiungo", at: "no Cachiungo", about: "O Cachiungo, a leste da cidade do Huambo, tem agricultura e comércio ao longo da estrada para o Bié." },
  { slug: "chicala-choloanga", name: "Chicala Choloanga", at: "em Chicala Choloanga", about: "Chicala Choloanga, no leste da província, é uma zona agrícola com comércio nas praças locais." },
  { slug: "chinjenje", name: "Chinjenje", at: "em Chinjenje", about: "Chinjenje, no sudoeste da província, vive sobretudo da agricultura e da criação de gado." },
  { slug: "alto-hama", name: "Alto Hama", at: "em Alto Hama", about: "Alto Hama, no norte da província, fica na estrada que liga o Huambo ao Cuanza Sul." },
  { slug: "bimbe", name: "Bimbe", at: "em Bimbe", about: "Bimbe é um dos municípios mais recentes da província do Huambo, com forte atividade agrícola." },
  { slug: "chilata", name: "Chilata", at: "em Chilata", about: "Chilata é um dos municípios mais recentes da província do Huambo, com produção agrícola e comércio local." },
  { slug: "cuima", name: "Cuima", at: "em Cuima", about: "Cuima, no sul da província, é uma zona agrícola com comércio nas praças locais." },
  { slug: "galanga", name: "Galanga", at: "em Galanga", about: "Galanga, no norte da província, vive sobretudo da agricultura e do comércio local." },
  { slug: "sambo", name: "Sambo", at: "em Sambo", about: "Sambo, no sul da província, é uma zona agrícola ligada à cidade do Huambo e à Caála." }
];

export type LocalTopic = {
  slug: string; icon: string;
  /** Início do título, ex. «Casas à venda» → «Casas à venda na Caála». */
  label: string;
  intro: string;
  listingType?: "real_estate" | "vehicle";
  purpose?: "sale" | "rent";
  /** Atributo exigido (ex. terreno) ou excluído (ex. tudo menos terrenos). */
  attr?: { key: string; value: string; exclude?: boolean };
  jobs?: boolean;
  /** Página do Site com todos os anúncios deste tipo (para «ver mais»). */
  more: string;
  publish: string;
};

export const LOCAL_TOPICS: LocalTopic[] = [
  { slug: "casas-a-venda", icon: "🏠", label: "Casas à venda", listingType: "real_estate", purpose: "sale", attr: { key: "propertyType", value: "terreno", exclude: true },
    intro: "Casas, vivendas, apartamentos, lojas e armazéns à venda, publicados por donos, agentes e imobiliárias. Veja as fotografias, o preço e fale com o vendedor pelas Mensagens do Huambo Online.",
    more: "/imoveis?finalidade=sale", publish: "/classificados/publicar?tipo=real_estate" },
  { slug: "casas-para-arrendar", icon: "🔑", label: "Casas para arrendar", listingType: "real_estate", purpose: "rent",
    intro: "Casas, apartamentos, quartos, lojas e escritórios para arrendar. Publicar um arrendamento é grátis e pode combinar a visita diretamente pelas Mensagens.",
    more: "/imoveis?finalidade=rent", publish: "/classificados/publicar?tipo=real_estate" },
  { slug: "terrenos-a-venda", icon: "🌱", label: "Terrenos à venda", listingType: "real_estate", purpose: "sale", attr: { key: "propertyType", value: "terreno" },
    intro: "Terrenos para construir, lavrar ou investir. Antes de pagar, confirme os documentos do terreno (título ou declaração da administração) e visite o local.",
    more: "/imoveis?finalidade=sale", publish: "/classificados/publicar?tipo=real_estate" },
  { slug: "carros-a-venda", icon: "🚗", label: "Carros à venda", listingType: "vehicle", purpose: "sale", attr: { key: "vehicleType", value: "mota", exclude: true },
    intro: "Carros ligeiros, jipes, pick-ups, carrinhas e camiões à venda, novos e usados. Veja o ano, os quilómetros e o combustível de cada viatura e combine o test-drive com o vendedor.",
    more: "/viaturas?finalidade=sale", publish: "/classificados/publicar?tipo=vehicle" },
  { slug: "motorizadas-a-venda", icon: "🏍️", label: "Motorizadas à venda", listingType: "vehicle", purpose: "sale", attr: { key: "vehicleType", value: "mota" },
    intro: "Motorizadas e motas à venda, para o trabalho ou para o dia a dia. Confirme os documentos da mota antes de pagar.",
    more: "/viaturas?finalidade=sale", publish: "/classificados/publicar?tipo=vehicle" },
  { slug: "emprego", icon: "💼", label: "Emprego e vagas", jobs: true,
    intro: "Vagas de emprego e estágios publicados por empresas, lojas e particulares. Candidate-se e envie o seu CV pelas Mensagens do Huambo Online, sem custos.",
    more: "/emprego", publish: "/classificados/publicar?categoria=emprego" },
  { slug: "classificados", icon: "🏷️", label: "Classificados",
    intro: "Tudo o que se compra, vende, troca e arrenda: telemóveis, eletrodomésticos, móveis, roupa, produtos agrícolas, serviços e muito mais. Publicar um anúncio é grátis.",
    more: "/explorar", publish: "/classificados/publicar" }
];

export const localMunicipality = (slug: string | null | undefined) => HUAMBO_MUNICIPALITIES.find(m => m.slug === slug) ?? null;
export const localTopic = (slug: string | null | undefined) => LOCAL_TOPICS.find(t => t.slug === slug) ?? null;
export const localPath = (m: LocalMunicipality, t?: LocalTopic | null) => `/huambo/${m.slug}${t ? "/" + t.slug : ""}`;

/** Todos os endereços das páginas locais (para o mapa do site). */
export function allLocalPaths(): string[] {
  return ["/huambo", ...HUAMBO_MUNICIPALITIES.flatMap(m => [localPath(m), ...LOCAL_TOPICS.map(t => localPath(m, t))])];
}

/** Título e descrição (Google) de uma página local. */
export function localSeo(m: LocalMunicipality, t?: LocalTopic | null) {
  if (!t) return {
    title: `Classificados ${m.at}: casas, carros e emprego`,
    description: `Anúncios ${m.at} (província do Huambo): casas à venda e para arrendar, terrenos, carros, motorizadas, emprego e muito mais no Huambo Online.`
  };
  const title = `${t.label} ${m.at}${m.slug === "huambo" ? " (cidade)" : ""}`;
  return { title, description: `${title}, província do Huambo, Angola. ${t.intro}`.slice(0, 160).replace(/\s+\S*$/, "") + "…" };
}

/** Anúncios publicados de uma página local. Sem município = toda a província. */
export async function fetchLocalListings(client: SupabaseClient, t: LocalTopic, municipalityId: string | null, limit = 24) {
  let q = client.from("classified_listings").select("id,title,price,currency,purpose,listing_type,media,featured,video_url,created_at,attributes,budget_min,budget_max,sale_mode")
    .eq("status", "published");
  if (municipalityId) q = q.eq("attributes->>municipalityId", municipalityId);
  if (t.listingType) q = q.eq("listing_type", t.listingType);
  if (t.purpose) q = q.eq("purpose", t.purpose);
  if (t.attr) q = t.attr.exclude
    ? q.or(`attributes->>${t.attr.key}.is.null,attributes->>${t.attr.key}.neq.${t.attr.value}`)
    : q.eq(`attributes->>${t.attr.key}`, t.attr.value);
  if (t.jobs) {
    const c = await client.from("categories").select("id").in("slug", [...JOB_CATEGORY_SLUGS]);
    const ids = (c.data ?? []).map((r: { id: string }) => r.id);
    if (!ids.length) return [];
    q = q.in("category_id", ids);
  } else if (!t.listingType) {
    q = q.neq("purpose", "wanted");
  }
  const r = await q.order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  return (r.data ?? []) as any[];
}

/** Id do município na base de dados (pelo nome, dentro da província do Huambo). */
export async function municipalityIdOf(client: SupabaseClient, m: LocalMunicipality): Promise<string | null> {
  const r = await client.from("municipalities").select("id,name,provinces!inner(name)").eq("name", m.name).eq("provinces.name", "Huambo").limit(1);
  return ((r.data ?? [])[0] as { id: string } | undefined)?.id ?? null;
}
