import type { Metadata } from "next";

export const metadata: Metadata = { title: "Trocas", description: "Troque o que já não usa no Huambo: telemóveis, roupa, móveis, motorizadas e muito mais.", openGraph: { title: "Trocas · Huambo Online", description: "Troque o que já não usa no Huambo.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/trocas" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
