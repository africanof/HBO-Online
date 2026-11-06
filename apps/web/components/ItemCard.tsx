"use client";
import { firstPhoto, isExampleName } from "@huambo-online/core";
import { LiteImg } from "./LiteImg";
import { useT } from "../lib/i18n";
import { SaveHeart } from "./SaveHeart";
import type { SavedKind } from "@huambo-online/core";

/** Cartão de artigo ao estilo eBay: fotografia quadrada, título em duas linhas, preço forte, detalhes discretos. */
export function ItemCard({ href, media, title, price, meta, tag, tagRed, icon = "📦", video, featured, save }: {
  href: string; media?: unknown; title: string; price: string; meta?: string; tag?: string; tagRed?: boolean; icon?: string; video?: boolean; featured?: boolean;
  /** Mostra o coração ♡ para guardar (anúncios e produtos). */
  save?: { kind: SavedKind; id: string };
}) {
  const { t, tc } = useT();
  const photo = firstPhoto(media);
  const card = <a href={href} className={"item" + (featured ? " featured" : "")}>
    <div className="item-img">
      {photo ? <LiteImg src={photo} alt="" loading="lazy" placeholder={icon} /> : <span aria-hidden>{icon}</span>}
      {tag && <span className={"item-tag" + (tagRed ? " red" : "")}>{tc(tag)}</span>}
      {video && <span className="item-video">▶ {t("promo.video")}</span>}
      {featured && <span className="item-feat">⭐ {t("ls.featured")}</span>}
      {isExampleName(title) && <span className="item-example">{t("pp.example_badge")}</span>}
    </div>
    <span className="item-title">{title}</span>
    <span className="item-price">{tc(price)}</span>
    {meta && <span className="item-meta">{meta}</span>}
  </a>;
  // O coração fica fora da ligação (um botão não pode estar dentro de um link), por cima da fotografia.
  return save ? <div className="item-wrap">{card}<SaveHeart kind={save.kind} id={save.id} title={title} /></div> : card;
}

export const LISTING_ICON: Record<string, string> = { real_estate: "🏠", vehicle: "🚗", product: "📦", service: "🛠️", classified: "🏷️" };
