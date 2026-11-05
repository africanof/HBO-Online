import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Empresas e lojas", description: "Empresas, lojas, farmácias, oficinas e restaurantes do Huambo, com contactos e avaliações.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Empresas e lojas · Huambo Online", description: "Empresas, lojas, farmácias, oficinas e restaurantes do Huambo, com contactos e avaliações.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/empresas" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
