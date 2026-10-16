import type { Metadata } from "next";
import { CONTACT_EMAIL } from "../../lib/contact";
import { LangInfoPage } from "../devolucoes/LangInfoPage";

export const metadata: Metadata = { title: "Como apagar a minha conta", description: "Passos para apagar a sua conta do Huambo Online e o que é apagado.", alternates: { canonical: "/apagar-conta" } };
export default function Page() { return <LangInfoPage which="delete" email={CONTACT_EMAIL} />; }
