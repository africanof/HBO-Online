/** Endereço público do Site (para o Google, partilhas e o mapa do site). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://huamboonline.com").replace(/\/$/, "");

/** Imagem de partilha por omissão (WhatsApp, Facebook…), 1200×630. */
export const DEFAULT_OG_IMAGES = [{ url: "/og-image.png", width: 1200, height: 630, alt: "Huambo Online" }];
