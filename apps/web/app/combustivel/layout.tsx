import type { Metadata } from "next";

const description = "Onde há gasolina, gasóleo, petróleo e gás agora no Huambo. Postos marcam quando há, avisos e reservas.";
export const metadata: Metadata = { title: "Combustível e gás", description, openGraph: { title: "Combustível e gás · Huambo Online", description, siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/combustivel" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
