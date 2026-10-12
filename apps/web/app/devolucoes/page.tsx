import type { Metadata } from "next";
import { returnsPage } from "@huambo-online/core";
import { InfoPageView } from "../../components/InfoPage";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Devoluções e reembolsos", description: "Como pedir devolução, reembolso ou troca de uma encomenda da Loja do Huambo Online, e o que acontece em cada passo.", alternates: { canonical: "/devolucoes" } };
export default function Page() { return <InfoPageView page={returnsPage(CONTACT_EMAIL)} />; }
