import type { Metadata } from "next";
import { NotificationBell } from "../components/NotificationBell";
export const metadata: Metadata={title:"Huambo Online",description:"Comércio, serviços e negócios do Huambo."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-AO"><body style={{margin:0,fontFamily:"system-ui, sans-serif"}}>{children}<NotificationBell/></body></html>;}