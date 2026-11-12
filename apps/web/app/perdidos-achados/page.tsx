import type { Metadata } from "next";
import { LostFoundPage } from "../../components/LostFound";
import { DEFAULT_OG_IMAGES } from "../../lib/site";

const description = "Perdeu ou encontrou documentos, telemóvel, chaves ou um animal no Huambo? Publique um aviso gratuito e ajude a devolver ao dono.";
export const metadata: Metadata = {
  title: "Perdidos e achados no Huambo",
  description,
  openGraph: { images: DEFAULT_OG_IMAGES, title: "Perdidos e achados · Huambo Online", description, siteName: "Huambo Online", locale: "pt_AO", type: "website" },
  alternates: { canonical: "/perdidos-achados" }
};

export default function PerdidosAchados() { return <LostFoundPage />; }
