import type { Metadata } from "next";
import { seoMetadata, SeoJsonLd } from "../../../lib/seo";

export const revalidate = 600;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return seoMetadata("provider", id, "/profissionais/");
}
export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><SeoJsonLd kind="provider" rawId={id} base="/profissionais/" />{children}</>;
}
