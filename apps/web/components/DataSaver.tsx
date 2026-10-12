"use client";
import { useEffect, useState } from "react";
import { DATA_SAVER_OPTIONS, savedText } from "@huambo-online/core";
import { useDataSaver, useDataSaverMode, setDataSaverMode, useSkippedCount } from "../lib/dataSaver";

/** Botão rápido no topo: liga ou desliga «Poupar dados». */
export function DataSaverToggle() {
  const on = useDataSaver();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return <button type="button" className="theme-toggle" aria-pressed={on} onClick={() => setDataSaverMode(on ? "off" : "on")}
    aria-label={on ? "Desligar Poupar dados" : "Ligar Poupar dados (não carrega as fotografias das listas)"}>📉<span className="theme-label"> {on ? "A poupar dados" : "Poupar dados"}</span></button>;
}

/** «Poupar dados: Automático · Ligado · Desligado», com o que já se poupou. */
export function DataSaverPicker() {
  const mode = useDataSaverMode(); const on = useDataSaver(); const skipped = useSkippedCount();
  return <div className="stack" style={{ gap: 6 }}>
    <div className="row" role="radiogroup" aria-label="Poupar dados">
      {DATA_SAVER_OPTIONS.map(o => <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} className={"chip" + (mode === o.value ? " on" : "")} onClick={() => setDataSaverMode(o.value)}>{o.label}</button>)}
    </div>
    <small>{on ? "Ligado: as fotografias das listas não carregam; na página do artigo, toque para as ver. Os vídeos só carregam quando carrega em ▶." : mode === "auto" ? "Automático: liga sozinho quando o telemóvel ou o navegador está em poupança de dados." : "Desligado: as fotografias carregam normalmente."}</small>
    {on && skipped > 0 && <small className="ok">{savedText(skipped)}</small>}
  </div>;
}
