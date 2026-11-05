import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Loja", description: "Compre online no Huambo e receba em casa ou levante na loja.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Loja · Huambo Online", description: "Compre online no Huambo e receba em casa ou levante na loja.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/loja" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
