"use client";
import { useEffect, useState } from "react";
import { THEME_OPTIONS, THEME_STORAGE_KEY, readThemePreference, resolveTheme, type ThemePreference } from "@huambo-online/core";
import { useT } from "../lib/i18n";

const CHANGED = "huambo:tema-mudou";
function apply(pref: ThemePreference) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(pref, dark);
}
function save(p: ThemePreference) {
  try { if (p === "system") localStorage.removeItem(THEME_STORAGE_KEY); else localStorage.setItem(THEME_STORAGE_KEY, p); } catch { /* sem armazenamento */ }
  apply(p);
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: p }));
}

/** Botão rápido no topo: «🌙 Escuro» / «☀️ Claro» (troca e fica guardado). */
export function ThemeToggle() {
  const { t } = useT();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === "dark");
    read();
    window.addEventListener(CHANGED, read);
    const mq = window.matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", read);
    return () => { window.removeEventListener(CHANGED, read); mq.removeEventListener("change", read); };
  }, []);
  return <button type="button" className="theme-toggle" onClick={() => save(dark ? "light" : "dark")}
    aria-label={dark ? t("theme.to_light") : t("theme.to_dark")} aria-pressed={dark}>{dark ? "☀️" : "🌙"}<span className="theme-label"> {dark ? t("theme.light_short") : t("theme.dark_short")}</span></button>;
}

/** «Aparência: Automático · Claro · Escuro» (fica guardado neste aparelho). */
export function ThemePicker() {
  const { t } = useT();
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => {
    let p: ThemePreference = "system";
    try { p = readThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* sem armazenamento */ }
    setPref(p); apply(p);
    // Em «Automático», acompanha a mudança do telemóvel/computador.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { let cur: ThemePreference = "system"; try { cur = readThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* */ } if (cur === "system") apply("system"); };
    mq.addEventListener("change", onChange);
    const onToggle = (e: Event) => setPref((e as CustomEvent<ThemePreference>).detail);
    window.addEventListener(CHANGED, onToggle);
    return () => { mq.removeEventListener("change", onChange); window.removeEventListener(CHANGED, onToggle); };
  }, []);
  function choose(p: ThemePreference) { setPref(p); save(p); }
  return <div className="row" role="radiogroup" aria-label={t("nav.appearance")}>
    {THEME_OPTIONS.map(o => <button key={o.value} type="button" role="radio" aria-checked={pref === o.value} className={"chip" + (pref === o.value ? " on" : "")} onClick={() => choose(o.value)}>{t("theme." + o.value)}</button>)}
  </div>;
}
