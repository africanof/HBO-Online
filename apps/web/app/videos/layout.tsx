import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

const description = "Vídeos de publicidade e lives de profissionais, lojas e empresas do Huambo.";
export const metadata: Metadata = { title: "Vídeos e lives", description, openGraph: { images: DEFAULT_OG_IMAGES, title: "Vídeos e lives · Huambo Online", description, siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/videos" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
