import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Páginas públicas abertas ao Google; contas, mensagens e administração ficam de fora.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/conta", "/admin", "/mensagens", "/notificacoes", "/encomendas", "/carrinho", "/meus-anuncios", "/avaliacoes", "/servicos", "/entregas", "/alugueres", "/guardados", "/historico", "/pesquisas-guardadas"] }],
    sitemap: SITE_URL + "/sitemap.xml"
  };
}
