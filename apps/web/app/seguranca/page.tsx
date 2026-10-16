import type { Metadata } from "next";
import { SafetyPageView } from "../../components/InfoPage";

export const metadata: Metadata = { title: "Segurança", description: "Como comprar e vender em segurança no Huambo: pontos de encontro seguros, sinais de burla, bloquear e denunciar.", alternates: { canonical: "/seguranca" } };

export default function Seguranca() { return <SafetyPageView />; }
