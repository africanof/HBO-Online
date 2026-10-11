import type { Metadata } from "next";

export const metadata: Metadata = { title: "Loja", description: "Compre online no Huambo e receba em casa ou levante na loja.", openGraph: { title: "Loja · Huambo Online", description: "Compre online no Huambo e receba em casa ou levante na loja.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/loja" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
