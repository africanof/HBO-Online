import type { Metadata } from "next";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

const description = "Hotéis e hospedagem, restaurantes e armazéns no Huambo: veja quartos livres, o menu e os produtos, reserve e pague no local ou adiantado.";
export const metadata: Metadata = { title: "Reservas: hotéis, restaurantes e armazéns", description, openGraph: { images: DEFAULT_OG_IMAGES, title: "Reservas · Huambo Online", description, siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/reservas" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
