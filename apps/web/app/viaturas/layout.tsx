import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Viaturas", description: "Carros, jipes, pick-ups, carrinhas, camiões e motas à venda e para alugar no Huambo.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Viaturas · Huambo Online", description: "Carros, jipes, pick-ups, carrinhas, camiões e motas à venda e para alugar no Huambo.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/viaturas" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
