import type { Metadata } from "next";

export const metadata: Metadata = { title: "Viaturas", description: "Carros, jipes, pick-ups, carrinhas, camiões e motas à venda e para alugar no Huambo.", openGraph: { title: "Viaturas · Huambo Online", description: "Carros, jipes, pick-ups, carrinhas, camiões e motas à venda e para alugar no Huambo.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/viaturas" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
