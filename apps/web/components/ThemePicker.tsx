"use client";
import { useEffect, useState } from "react";
import { THEME_OPTIONS, THEME_STORAGE_KEY, readThemePreference, resolveTheme, type ThemePreference } from "@huambo-online/core";

function apply(pref: ThemePreference) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(pref, dark);
}

/** «Aparência: Automático · Claro · Escuro» (fica guardado neste aparelho). */
export function ThemePicker() {
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => {
    let p: ThemePreference = "system";
    try { p = readThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* sem armazenamento */ }
    setPref(p); apply(p);
    // Em «Automático», acompanha a mudança do telemóvel/computador.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { let cur: ThemePreference = "system"; try { cur = readThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* */ } if (cur === "system") apply("system"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  function choose(p: ThemePreference) {
    setPref(p);
    try { if (p === "system") localStorage.removeItem(THEME_STORAGE_KEY); else localStorage.setItem(THEME_STORAGE_KEY, p); } catch { /* sem armazenamento */ }
    apply(p);
  }
  return <div className="row" role="radiogroup" aria-label="Aparência">
    {THEME_OPTIONS.map(o => <button key={o.value} type="button" role="radio" aria-checked={pref === o.value} className={"chip" + (pref === o.value ? " on" : "")} onClick={() => choose(o.value)}>{o.label}</button>)}
  </div>;
}
