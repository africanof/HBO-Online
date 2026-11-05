import type { MetadataRoute } from "next";

// Permite «Adicionar ao ecrã principal» no telemóvel.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Huambo Online", short_name: "Huambo Online", description: "Compre, venda e encontre tudo no Huambo.",
    start_url: "/", display: "standalone", background_color: "#ffffff", theme_color: "#3665F3", lang: "pt-AO",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
