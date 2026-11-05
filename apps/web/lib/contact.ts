/** E-mail público de contacto (opcional): defina NEXT_PUBLIC_CONTACT_EMAIL no alojamento (Vercel). */
export const CONTACT_EMAIL = ((process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "").trim() || "suporte@huamboonline.com");
