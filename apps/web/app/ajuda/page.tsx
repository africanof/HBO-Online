import type { Metadata } from "next";
import { HelpPageView } from "../../components/InfoPage";

export const metadata: Metadata = { title: "Ajuda", description: "Perguntas frequentes: publicar, propostas, trocas, serviços, avaliações, verificação e segurança.", alternates: { canonical: "/ajuda" } };

export default function Ajuda() { return <HelpPageView />; }
