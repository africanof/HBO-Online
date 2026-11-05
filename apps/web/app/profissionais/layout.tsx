import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

export const metadata: Metadata = { title: "Profissionais e serviços", description: "Eletricistas, canalizadores, explicadores, domésticas e outros profissionais do Huambo, com avaliações.", openGraph: { images: DEFAULT_OG_IMAGES, title: "Profissionais e serviços · Huambo Online", description: "Eletricistas, canalizadores, explicadores, domésticas e outros profissionais do Huambo, com avaliações.", siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/profissionais" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
