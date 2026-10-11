import type { Metadata } from "next";
import { privacyPage } from "@huambo-online/core";
import { InfoPageView } from "../../components/InfoPage";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Política de Privacidade", description: "Que dados o Huambo Online guarda, para quê, quem os vê e os seus direitos.", alternates: { canonical: "/privacidade" } };
export default function Page() { return <InfoPageView page={privacyPage(CONTACT_EMAIL)} />; }
