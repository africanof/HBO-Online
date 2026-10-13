import type { Metadata } from "next";
export const metadata: Metadata = { title: "Novo evento", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
