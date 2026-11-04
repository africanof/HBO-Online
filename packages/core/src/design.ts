import { parseRef } from "./refs";
/**
 * Identidade visual do Huambo Online (inspirada no eBay: fundo branco, azul forte nas ações,
 * pesquisa grande no topo, categorias redondas e montras de artigos). Igual no Site e na APP.
 * Cores escolhidas com contraste alto (texto ≥ 4.5:1 sobre branco).
 */
export const BRAND = {
  blue: "#3665F3",      // botões e ligações principais
  blueDark: "#2148C9",  // botão ao passar o rato / premido
  blueSoft: "#EEF2FE",
  ink: "#191919",       // texto
  muted: "#595959",     // texto secundário
  line: "#E5E5E5",
  surface: "#F7F7F7",   // fundo das imagens e chips
  red: "#C7102E",       // erros e "Leilão"
  green: "#0B7A3B",     // sucesso e "Entrega"
  yellow: "#F5AF02",
  white: "#FFFFFF"
} as const;

/** As quatro letras do logótipo, cada uma com a sua cor (como no eBay, mas com a nossa palavra). */
/** Amarelo mais escuro só no logótipo: contraste 3,4:1 sobre branco (legível ao sol). */
export const LOGO_YELLOW = "#B88200";
export const LOGO_PARTS: [string, string][] = [["Huambo", BRAND.blue], ["On", BRAND.red], ["li", LOGO_YELLOW], ["ne", BRAND.green]];

export type SearchScope = "classificados" | "loja" | "pracas" | "profissionais" | "empresas";
export const SEARCH_SCOPES: { value: SearchScope; label: string; path: string }[] = [
  { value: "classificados", label: "Classificados", path: "/explorar" },
  { value: "loja", label: "Loja", path: "/loja" },
  { value: "pracas", label: "Praças", path: "/pracas" },
  { value: "profissionais", label: "Profissionais", path: "/profissionais" },
  { value: "empresas", label: "Empresas", path: "/empresas" }
];

/** Endereço da página de resultados para a pesquisa do topo. */
export function searchHref(scope: SearchScope, query: string, extra: Record<string, string | undefined> = {}): string {
  const ref = parseRef(query);
  if (ref) return "/ref/" + ref.code; // número de anúncio, produto ou encomenda → vai direto
  const path = SEARCH_SCOPES.find(s => s.value === scope)?.path ?? "/explorar";
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Lê ?q=, ?tipo= e ?finalidade= da página Explorar. */
export function readExploreParams(get: (key: string) => string | null | undefined) {
  const tipo = get("tipo") ?? "", finalidade = get("finalidade") ?? "";
  const TYPES = ["classified", "product", "vehicle", "real_estate", "service"];
  const PURPOSES = ["sale", "rent", "lease", "wanted", "service", "auction"];
  const modo = get("modo") ?? "";
  const MODES = ["fixed", "negotiable", "offers", "auction", "trade"];
  const categoria = (get("categoria") ?? "").trim().toLowerCase();
  return { query: (get("q") ?? "").trim(), listingType: TYPES.includes(tipo) ? tipo : "", purpose: PURPOSES.includes(finalidade) ? finalidade : "", saleMode: MODES.includes(modo) ? modo : "",
    categorySlug: /^[a-z0-9-]{1,60}$/.test(categoria) ? categoria : "" };
}

/** Categorias redondas da página inicial. */
export const HOME_CATEGORIES: { label: string; icon: string; href: string }[] = [
  { label: "Imóveis", icon: "🏠", href: "/imoveis" },
  { label: "Viaturas", icon: "🚗", href: "/viaturas" },
  { label: "Campo", icon: "🌾", href: "/agricultura" },
  { label: "Fábricas", icon: "🏭", href: "/empresas?categoria=fabricas" },
  { label: "Emprego", icon: "💼", href: "/emprego" },
  { label: "Combustível e gás", icon: "⛽", href: "/combustivel" },
  { label: "Hotéis", icon: "🏨", href: "/reservas?tipo=hoteis" },
  { label: "Restaurantes", icon: "🍽️", href: "/reservas?tipo=restaurantes" },
  { label: "Armazéns", icon: "🏬", href: "/reservas?tipo=armazens" },
  { label: "Eventos", icon: "🎟️", href: "/eventos" },
  { label: "Importação", icon: "✈️", href: "/importacao" },
  { label: "Praças", icon: "🧺", href: "/pracas" },
  { label: "Loja", icon: "🛍️", href: "/loja" },
  { label: "Arrendar", icon: "🔑", href: "/explorar?finalidade=rent" },
  { label: "Leilões", icon: "🔨", href: "/explorar?finalidade=auction" },
  { label: "Procura-se", icon: "🔎", href: "/procura-se" },
  { label: "Trocas", icon: "🔁", href: "/trocas" },
  { label: "Produtos", icon: "📦", href: "/explorar?tipo=product" },
  { label: "Profissionais", icon: "👷", href: "/profissionais" },
  { label: "Empresas", icon: "🏢", href: "/empresas" }
];

/** "há 5 min", "há 3 h", "há 2 dias", "10/10/2026" */
export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "há 1 dia" : `há ${d} dias`;
  return new Date(t).toLocaleDateString("pt-AO");
}

/** Primeira fotografia de um artigo (anúncio ou produto), ou null. */
export function firstPhoto(media: unknown): string | null {
  return Array.isArray(media) && typeof media[0] === "string" && media[0] ? media[0] : null;
}
