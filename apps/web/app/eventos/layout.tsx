import type { Metadata } from "next";

const description = "Concertos, festas, jogos, feiras e formações no Huambo. Compre o bilhete e entre com o código no telemóvel.";
export const metadata: Metadata = { title: "Eventos no Huambo", description, openGraph: { title: "Eventos no Huambo · Huambo Online", description, siteName: "Huambo Online", locale: "pt_AO", type: "website" }, alternates: { canonical: "/eventos" } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
