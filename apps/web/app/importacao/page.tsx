import type { Metadata } from "next";
import { ImportsPage } from "../../components/Imports";

export const metadata: Metadata = {
  title: "Importação — compramos por si no exterior | Huambo Online",
  description: "Peça um produto da China, Dubai, Portugal, Brasil ou outro país. A equipa do Huambo Online envia o orçamento, compra, importa e entrega no Huambo, com pagamento protegido.",
  alternates: { canonical: "/importacao" }
};

export default function Importacao() { return <ImportsPage />; }
