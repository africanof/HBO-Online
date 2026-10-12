import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DATA_SAVER_KEY, readDataSaverMode } from "@huambo-online/core";

/** «Poupar dados» na APP (fica guardado no telemóvel). Ligado: as fotografias das listas não carregam. */
type State = { on: boolean; setOn: (v: boolean) => void; skipped: number; countSkipped: (src: string) => void };
const Ctx = createContext<State>({ on: false, setOn: () => {}, skipped: 0, countSkipped: () => {} });
export const useDataSaver = () => useContext(Ctx);

const seen = new Set<string>();
export function DataSaverProvider({ children }: { children: ReactNode }) {
  const [on, setOnState] = useState(false); const [skipped, setSkipped] = useState(0);
  useEffect(() => { void AsyncStorage.getItem(DATA_SAVER_KEY).then(v => setOnState(readDataSaverMode(v, "off") === "on")).catch(() => {}); }, []);
  const setOn = (v: boolean) => { setOnState(v); void AsyncStorage.setItem(DATA_SAVER_KEY, v ? "on" : "off").catch(() => {}); };
  const countSkipped = (src: string) => { if (!seen.has(src)) { seen.add(src); setSkipped(n => n + 1); } };
  return <Ctx.Provider value={{ on, setOn, skipped, countSkipped }}>{children}</Ctx.Provider>;
}
