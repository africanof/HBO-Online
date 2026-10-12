"use client";
import { useSyncExternalStore } from "react";
import { DATA_SAVER_KEY, readDataSaverMode, resolveDataSaver, type DataSaverMode } from "@huambo-online/core";

/** «Poupar dados» no Site: a escolha fica guardada neste aparelho (localStorage). */
const CHANGED = "huambo:poupar-dados-mudou";
const COUNT_KEY = "huambo:fotos-poupadas";

export function getDataSaverMode(): DataSaverMode {
  try { return readDataSaverMode(localStorage.getItem(DATA_SAVER_KEY)); } catch { return "auto"; }
}
function deviceSaveData(): boolean {
  try { return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData; } catch { return false; }
}
export function isDataSaverOn(): boolean {
  return typeof window !== "undefined" && resolveDataSaver(getDataSaverMode(), deviceSaveData());
}
export function setDataSaverMode(mode: DataSaverMode) {
  try { if (mode === "auto") localStorage.removeItem(DATA_SAVER_KEY); else localStorage.setItem(DATA_SAVER_KEY, mode); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(CHANGED));
}
function subscribe(cb: () => void) {
  window.addEventListener(CHANGED, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(CHANGED, cb); window.removeEventListener("storage", cb); };
}
/** true quando o modo «Poupar dados» está ligado (no servidor é sempre false). */
export function useDataSaver(): boolean { return useSyncExternalStore(subscribe, isDataSaverOn, () => false); }
export function useDataSaverMode(): DataSaverMode { return useSyncExternalStore(subscribe, getDataSaverMode, () => "auto"); }

// Fotografias que não foram carregadas nesta sessão (para mostrar quanto se poupou).
function seenList(): string[] {
  try { const v = JSON.parse(sessionStorage.getItem(COUNT_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function countSkipped(src: string) {
  const list = seenList();
  if (list.includes(src) || list.length >= 2000) return;
  try { sessionStorage.setItem(COUNT_KEY, JSON.stringify([...list, src])); } catch { return; }
  window.dispatchEvent(new Event(CHANGED));
}
let cache = { raw: "", n: 0 };
export function skippedCount(): number {
  let raw = "";
  try { raw = sessionStorage.getItem(COUNT_KEY) ?? ""; } catch { return 0; }
  if (raw !== cache.raw) cache = { raw, n: seenList().length };
  return cache.n;
}
export function useSkippedCount(): number { return useSyncExternalStore(subscribe, skippedCount, () => 0); }
