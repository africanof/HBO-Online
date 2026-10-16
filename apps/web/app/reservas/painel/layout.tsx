import type { Metadata } from "next";
export const metadata: Metadata = { title: "O meu estabelecimento", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
