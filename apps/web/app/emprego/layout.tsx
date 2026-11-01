import type { Metadata } from "next";

export const metadata: Metadata = { title: "Emprego e estágios", description: "Vagas de emprego, estágios remunerados e não remunerados no Huambo. Envie o seu CV pelo Huambo Online.", openGraph: { title: "Emprego e estágios · Huambo Online", description: "Vagas de emprego, estágios remunerados e não remunerados no Huambo. Envie o seu CV pelo Huambo Online.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/emprego" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
