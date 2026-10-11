import type { Metadata } from "next";
import { seoMetadata } from "../../../lib/seo";

export const revalidate = 600;
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return seoMetadata("market", id, "/pracas/" + id);
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
