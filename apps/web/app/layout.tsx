import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader, SiteFooter } from "../components/SiteHeader";
import { ReferralCapture } from "../components/Referral";
import { ConnectionWatcher } from "../components/Offline";
import { SITE_URL } from "../lib/site";
import { THEME_STORAGE_KEY } from "@huambo-online/core";
import { I18nProvider } from "../lib/i18n";
import { LANG_SCRIPT } from "../lib/lang-script";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Huambo Online — classificados, imóveis, viaturas e emprego no Huambo", template: "%s · Huambo Online" },
  description: "Compre, venda e arrende no Huambo (Angola): anúncios classificados, casas, carros, empregos, loja, profissionais e empresas perto de si.",
  keywords: ["Huambo", "Angola", "classificados", "comprar", "vender", "arrendar", "casas no Huambo", "carros no Huambo", "emprego no Huambo", "loja online", "profissionais", "empresas", "praça", "Kapango"],
  alternates: { canonical: "/" },
  // Verificação do Google Search Console por etiqueta (opcional; a verificação por DNS também funciona).
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
  openGraph: { type: "website", locale: "pt_AO", siteName: "Huambo Online", url: SITE_URL, title: "Huambo Online", description: "Compre, venda e encontre tudo no Huambo." }
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#3665F3" }, { media: "(prefers-color-scheme: dark)", color: "#121417" }]
};

/** Dados estruturados do site para o Google: a organização e a pesquisa (caixa de pesquisa nos resultados). */
const SITE_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": SITE_URL + "/#org", name: "Huambo Online", url: SITE_URL, logo: SITE_URL + "/icon.svg",
      areaServed: { "@type": "City", name: "Huambo", address: { "@type": "PostalAddress", addressLocality: "Huambo", addressCountry: "AO" } } },
    { "@type": "WebSite", "@id": SITE_URL + "/#site", name: "Huambo Online", url: SITE_URL, inLanguage: "pt-AO", publisher: { "@id": SITE_URL + "/#org" },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: SITE_URL + "/explorar?q={search_term_string}" }, "query-input": "required name=search_term_string" } }
  ]
}).replace(/</g, "\\u003c");

// Aplica o tema (Automático / Claro / Escuro) antes de a página aparecer, para não piscar.
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

// Línguas: as páginas continuam estáticas (o servidor não lê o cookie «lang», para não tornar todas as
// páginas dinâmicas). O LANG_SCRIPT põe <html lang> certo antes de a página aparecer e o I18nProvider
// troca os textos para a língua guardada logo a seguir.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-AO" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /><script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_JSON_LD }} /></head>
    <body><I18nProvider><ConnectionWatcher /><ReferralCapture /><SiteHeader />{children}<SiteFooter /></I18nProvider></body>
  </html>;
}
