"use client";
import { useEffect, type ImgHTMLAttributes, type ReactNode } from "react";
import { useDataSaver, countSkipped } from "../lib/dataSaver";
import { useT } from "../lib/i18n";

/** Imagem que não carrega com «Poupar dados» ligado: mostra um ícone no lugar da fotografia. */
export function LiteImg({ placeholder, ...props }: ImgHTMLAttributes<HTMLImageElement> & { placeholder?: ReactNode }) {
  const saver = useDataSaver();
  const { t } = useT();
  const src = typeof props.src === "string" ? props.src : "";
  useEffect(() => { if (saver && src) countSkipped(src); }, [saver, src]);
  if (saver) return <span className={"lite-ph " + (props.className ?? "")} style={props.style} title={t("ls.photo_not_loaded")}
    {...(props.alt ? { role: "img", "aria-label": props.alt } : { "aria-hidden": true })}>{placeholder ?? "📷"}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} />;
}
