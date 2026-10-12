"use client";
import { useEffect, type ImgHTMLAttributes, type ReactNode } from "react";
import { useDataSaver, countSkipped } from "../lib/dataSaver";

/** Imagem que não carrega com «Poupar dados» ligado: mostra um ícone no lugar da fotografia. */
export function LiteImg({ placeholder, ...props }: ImgHTMLAttributes<HTMLImageElement> & { placeholder?: ReactNode }) {
  const saver = useDataSaver();
  const src = typeof props.src === "string" ? props.src : "";
  useEffect(() => { if (saver && src) countSkipped(src); }, [saver, src]);
  if (saver) return <span className={"lite-ph " + (props.className ?? "")} style={props.style} title="Fotografia não carregada (Poupar dados)"
    {...(props.alt ? { role: "img", "aria-label": props.alt } : { "aria-hidden": true })}>{placeholder ?? "📷"}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} />;
}
