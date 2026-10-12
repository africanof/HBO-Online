/**
 * «Poupar dados» (igual no Site e na APP): as fotografias das listas não carregam e, na página do artigo,
 * só carregam quando a pessoa toca. Os vídeos já só carregam quando se carrega em ▶.
 * Automático (só no Site): segue a opção «Poupança de dados» do navegador/telemóvel.
 */
export type DataSaverMode = "auto" | "on" | "off";
export const DATA_SAVER_KEY = "huambo:poupar-dados";
export const DATA_SAVER_OPTIONS: { value: DataSaverMode; label: string }[] = [
  { value: "auto", label: "Automático" }, { value: "on", label: "📉 Ligado" }, { value: "off", label: "Desligado" }
];
/** Tamanho médio de uma fotografia de anúncio já reduzida (para dar uma ideia do que se poupou). */
export const AVG_PHOTO_KB = 150;

export function readDataSaverMode(v: string | null | undefined, fallback: DataSaverMode = "auto"): DataSaverMode {
  return v === "on" || v === "off" || v === "auto" ? v : fallback;
}
/** Está ligado? «Automático» liga quando o aparelho pede para poupar dados (Save-Data). */
export function resolveDataSaver(mode: DataSaverMode, deviceSaveData = false): boolean {
  return mode === "on" || (mode === "auto" && deviceSaveData);
}
/** «Poupou cerca de 3,2 MB (21 fotografias)». */
export function savedText(photos: number): string {
  if (photos <= 0) return "";
  const kb = photos * AVG_PHOTO_KB;
  const size = kb >= 1024 ? (kb / 1024).toFixed(1).replace(".", ",") + " MB" : kb + " KB";
  return `Poupou cerca de ${size} (${photos === 1 ? "1 fotografia não carregada" : photos + " fotografias não carregadas"}).`;
}
