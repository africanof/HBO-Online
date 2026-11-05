import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Imóveis", description: "Casas, apartamentos, vivendas, terrenos, lojas e escritórios à venda e para arrendar no Huambo.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Imóveis · Huambo Online", description: "Casas, apartamentos, vivendas, terrenos, lojas e escritórios à venda e para arrendar no Huambo.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/imoveis" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
