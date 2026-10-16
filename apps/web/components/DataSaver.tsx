"use client";
import { useEffect, useState } from "react";
import { DATA_SAVER_OPTIONS } from "@huambo-online/core";
import { useT, savedTextIn } from "../lib/i18n";
import { useDataSaver, useDataSaverMode, setDataSaverMode, useSkippedCount } from "../lib/dataSaver";

/** Botão rápido no topo: liga ou desliga «Poupar dados». */
export function DataSaverToggle() {
  const { t } = useT();
  const on = useDataSaver();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return null;
  return <button type="button" className="theme-toggle" aria-pressed={on} onClick={() => setDataSaverMode(on ? "off" : "on")}
    aria-label={on ? t("ds.turn_off") : t("ds.turn_on")}>📉<span className="theme-label"> {on ? t("ds.saving") : t("nav.data_saver")}</span></button>;
}

/** «Poupar dados: Automático · Ligado · Desligado», com o que já se poupou. */
export function DataSaverPicker() {
  const { lang, t } = useT();
  const mode = useDataSaverMode(); const on = useDataSaver(); const skipped = useSkippedCount();
  return <div className="stack" style={{ gap: 6 }}>
    <div className="row" role="radiogroup" aria-label={t("nav.data_saver")}>
      {DATA_SAVER_OPTIONS.map(o => <button key={o.value} type="button" role="radio" aria-checked={mode === o.value} className={"chip" + (mode === o.value ? " on" : "")} onClick={() => setDataSaverMode(o.value)}>{t("ds." + o.value)}</button>)}
    </div>
    <small>{on ? t("ds.desc_on") : mode === "auto" ? t("ds.desc_auto") : t("ds.desc_off")}</small>
    {on && skipped > 0 && <small className="ok">{savedTextIn(skipped, lang, t)}</small>}
  </div>;
}
