import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Agentes no terreno", description: "Trabalha numa praça do Huambo? Ajude vendedores a publicar no Huambo Online e ganhe uma comissão por cada venda.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Agentes no terreno · Huambo Online", description: "Trabalha numa praça do Huambo? Ajude vendedores a publicar no Huambo Online e ganhe uma comissão por cada venda.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/agente" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
