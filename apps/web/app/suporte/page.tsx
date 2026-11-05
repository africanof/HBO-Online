import type { Metadata } from "next";
import { SupportPageView } from "../../components/InfoPage";

export const metadata: Metadata = { title: "Suporte", description: "Fale com o suporte do Huambo Online: o assistente responde primeiro e pode pedir para falar com uma pessoa da equipa.", alternates: { canonical: "/suporte" } };

export default function Suporte() { return <SupportPageView />; }
