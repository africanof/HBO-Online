import type { Metadata } from "next";

export const metadata: Metadata = { title: "Procura-se", description: "Pedidos de compradores no Huambo, com orçamento: veja o que procuram e ofereça.", openGraph: { title: "Procura-se · Huambo Online", description: "Pedidos de compradores no Huambo, com orçamento: veja o que procuram e ofereça.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/procura-se" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
