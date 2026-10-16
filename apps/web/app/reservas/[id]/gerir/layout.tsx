import type { Metadata } from "next";
export const metadata: Metadata = { title: "Gerir estabelecimento", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
