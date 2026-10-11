import type { Metadata } from "next";
import { deleteAccountPage } from "@huambo-online/core";
import { InfoPageView } from "../../components/InfoPage";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Como apagar a minha conta", description: "Passos para apagar a sua conta do Huambo Online e o que é apagado.", alternates: { canonical: "/apagar-conta" } };
export default function Page() { return <InfoPageView page={deleteAccountPage(CONTACT_EMAIL)} />; }
