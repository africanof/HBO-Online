import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Mapa", description: "Mapa do Huambo com anúncios, empresas, profissionais, combustível e eventos.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Mapa · Huambo Online", description: "Mapa do Huambo com anúncios, empresas, profissionais, combustível e eventos.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/mapa" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
