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
  title: { default: "Huambo Online — compre, venda e encontre tudo no Huambo", template: "%s · Huambo Online" },
  description: "Classificados, loja, praças, profissionais e empresas do Huambo (Angola). Compre, venda, arrende e peça serviços perto de si.",
  keywords: ["Huambo", "Angola", "classificados", "comprar", "vender", "arrendar", "loja online", "profissionais", "empresas", "praça", "Kapango"],
  openGraph: { type: "website", locale: "pt_AO", siteName: "Huambo Online", url: SITE_URL, title: "Huambo Online", description: "Compre, venda e encontre tudo no Huambo." }
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, colorScheme: "light dark",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#3665F3" }, { media: "(prefers-color-scheme: dark)", color: "#121417" }]
};

// Aplica o tema (Automático / Claro / Escuro) antes de a página aparecer, para não piscar.
const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

// Línguas: as páginas continuam estáticas (o servidor não lê o cookie «lang», para não tornar todas as
// páginas dinâmicas). O LANG_SCRIPT põe <html lang> certo antes de a página aparecer e o I18nProvider
// troca os textos para a língua guardada logo a seguir.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-AO" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /><script dangerouslySetInnerHTML={{ __html: LANG_SCRIPT }} /></head>
    <body><I18nProvider><ConnectionWatcher /><ReferralCapture /><SiteHeader />{children}<SiteFooter /></I18nProvider></body>
  </html>;
}
