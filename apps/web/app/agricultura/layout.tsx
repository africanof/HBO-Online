import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Agricultura e pecuária", description: "Milho, batata, feijão, hortícolas, gado, sementes e adubo direto dos produtores do Huambo. Venda e compre por grosso no Huambo Online.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Agricultura e pecuária · Huambo Online", description: "Milho, batata, feijão, hortícolas, gado, sementes e adubo direto dos produtores do Huambo. Venda e compre por grosso no Huambo Online.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/agricultura" } };

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
