import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Classificados e pesquisa", description: "Pesquise anúncios no Huambo: casas, carros, telemóveis, terrenos, serviços e muito mais.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Classificados e pesquisa · Huambo Online", description: "Pesquise anúncios no Huambo: casas, carros, telemóveis, terrenos, serviços e muito mais.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/explorar" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
