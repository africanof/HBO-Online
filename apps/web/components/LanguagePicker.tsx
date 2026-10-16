"use client";
import { useId, useState } from "react";
import { LANGS, LANG_FLAGS, LANG_LABELS, LANG_TAGS, type Lang } from "@huambo-online/core";
import { useT } from "../lib/i18n";

/**
 * Escolher a língua do Site.
 * - «compact»: uma caixa de escolha pequena (topo da página).
 * - «chips»: botões grandes, como a Aparência (rodapé e página da conta).
 * Depois de mudar para inglês ou chinês, avisa uma vez que algumas páginas ainda estão só em português.
 */
export function LanguagePicker({ variant = "chips" }: { variant?: "compact" | "chips" }) {
  const { lang, t, setLang } = useT();
  const [note, setNote] = useState(false);
  const id = useId();

  function choose(l: Lang) {
    if (l === lang) return;
    setLang(l);
    setNote(l !== "pt");
  }
  const noteEl = note && lang !== "pt" ? <small className="lang-note" role="status">{t("lang.partial")}</small> : null;

  if (variant === "compact") return <span className="lang-picker">
    <select id={id} className="lang-select" aria-label={t("lang.choose")} value={lang} onChange={e => choose(e.target.value as Lang)} title={t("lang.choose")}>
      {LANGS.map(l => <option key={l} value={l} lang={LANG_TAGS[l]}>{LANG_FLAGS[l]} {LANG_LABELS[l]}</option>)}
    </select>
    {noteEl}
  </span>;

  return <div className="stack" style={{ gap: 6 }}>
    <div className="row" role="radiogroup" aria-label={t("lang.choose")}>
      {LANGS.map(l => <button key={l} type="button" role="radio" lang={LANG_TAGS[l]} aria-checked={lang === l}
        className={"chip" + (lang === l ? " on" : "")} onClick={() => choose(l)}>
        <span aria-hidden="true">{LANG_FLAGS[l]}</span> {LANG_LABELS[l]}
      </button>)}
    </div>
    {noteEl}
  </div>;
}
