import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader, SiteFooter } from "../components/SiteHeader";
import { ConnectionWatcher } from "../components/Offline";
import { SITE_URL } from "../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Huambo Online — compre, venda e encontre tudo no Huambo", template: "%s · Huambo Online" },
  description: "Classificados, loja, praças, profissionais e empresas do Huambo (Angola). Compre, venda, arrende e peça serviços perto de si.",
  keywords: ["Huambo", "Angola", "classificados", "comprar", "vender", "arrendar", "loja online", "profissionais", "empresas", "praça", "Kapango"],
  openGraph: { type: "website", locale: "pt_AO", siteName: "Huambo Online", url: SITE_URL, title: "Huambo Online", description: "Compre, venda e encontre tudo no Huambo." }
};
// "only light": o Site é sempre claro (contraste alto), mesmo com o telemóvel em modo escuro.
export const viewport: Viewport = { themeColor: "#3665F3", width: "device-width", initialScale: 1, colorScheme: "only light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-AO" style={{ colorScheme: "only light", background: "#fff" }}><body><ConnectionWatcher /><SiteHeader />{children}<SiteFooter /></body></html>;
}
