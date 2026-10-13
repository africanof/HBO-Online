import type { Metadata } from "next";

const description = "Vídeos de publicidade e lives de profissionais, lojas e empresas do Huambo.";
export const metadata: Metadata = { title: "Vídeos e lives", description, openGraph: { title: "Vídeos e lives · Huambo Online", description, siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/videos" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
