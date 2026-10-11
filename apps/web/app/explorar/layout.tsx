import type { Metadata } from "next";

export const metadata: Metadata = { title: "Classificados e pesquisa", description: "Pesquise anúncios no Huambo: casas, carros, telemóveis, terrenos, serviços e muito mais.", openGraph: { title: "Classificados e pesquisa · Huambo Online", description: "Pesquise anúncios no Huambo: casas, carros, telemóveis, terrenos, serviços e muito mais.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/explorar" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
