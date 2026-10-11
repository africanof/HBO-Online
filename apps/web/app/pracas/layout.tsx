import type { Metadata } from "next";

export const metadata: Metadata = { title: "Praças do Huambo", description: "Praça do Kapango, do Ferro, das Cassilhas, da Alemanha e outras: vendedores e produtos.", openGraph: { title: "Praças do Huambo · Huambo Online", description: "Praça do Kapango, do Ferro, das Cassilhas, da Alemanha e outras: vendedores e produtos.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/pracas" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
