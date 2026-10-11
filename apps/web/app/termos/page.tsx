import type { Metadata } from "next";
import { termsPage } from "@huambo-online/core";
import { InfoPageView } from "../../components/InfoPage";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Termos de Uso", description: "Regras de uso do Huambo Online: conta, anúncios, propostas, trocas, avaliações e responsabilidade.", alternates: { canonical: "/termos" } };
export default function Page() { return <InfoPageView page={termsPage(CONTACT_EMAIL)} />; }
