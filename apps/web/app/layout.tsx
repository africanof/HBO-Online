import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader, SiteFooter } from "../components/SiteHeader";

export const metadata: Metadata = { title: "Huambo Online", description: "Comércio, serviços e negócios do Huambo." };
// "only light": o Site é sempre claro (contraste alto), mesmo com o telemóvel em modo escuro.
export const viewport: Viewport = { themeColor: "#3665F3", width: "device-width", initialScale: 1, colorScheme: "only light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-AO" style={{ colorScheme: "only light", background: "#fff" }}><body><SiteHeader />{children}<SiteFooter /></body></html>;
}
