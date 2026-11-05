import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Procura-se", description: "Pedidos de compradores no Huambo, com orçamento: veja o que procuram e ofereça.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Procura-se · Huambo Online", description: "Pedidos de compradores no Huambo, com orçamento: veja o que procuram e ofereça.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/procura-se" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
