import { firstPhoto } from "@huambo-online/core";

/** Cartão de artigo ao estilo eBay: fotografia quadrada, título em duas linhas, preço forte, detalhes discretos. */
export function ItemCard({ href, media, title, price, meta, tag, tagRed, icon = "📦", video }: {
  href: string; media?: unknown; title: string; price: string; meta?: string; tag?: string; tagRed?: boolean; icon?: string; video?: boolean;
}) {
  const photo = firstPhoto(media);
  return <a href={href} className="item">
    <div className="item-img">
      {photo ? <img src={photo} alt="" loading="lazy" /> : <span aria-hidden>{icon}</span>}
      {tag && <span className={"item-tag" + (tagRed ? " red" : "")}>{tag}</span>}
      {video && <span className="item-video">▶ Vídeo</span>}
    </div>
    <span className="item-title">{title}</span>
    <span className="item-price">{price}</span>
    {meta && <span className="item-meta">{meta}</span>}
  </a>;
}

export const LISTING_ICON: Record<string, string> = { real_estate: "🏠", vehicle: "🚗", product: "📦", service: "🛠️", classified: "🏷️" };
