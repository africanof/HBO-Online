import type { Metadata } from "next";
import { CONTACT_EMAIL } from "../../lib/contact";
import { LangInfoPage } from "./LangInfoPage";

export const metadata: Metadata = { title: "Devoluções e reembolsos", description: "Como pedir devolução, reembolso ou troca de uma encomenda da Loja do Huambo Online, e o que acontece em cada passo.", alternates: { canonical: "/devolucoes" } };
export default function Page() { return <LangInfoPage which="returns" email={CONTACT_EMAIL} />; }
