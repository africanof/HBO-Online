import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import { createScreenCounter, logAppError, trackAppScreens } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "./supabase";

/** Erros e uso da APP (só contagens por ecrã, sem saber quem): para a equipa saber o que falha. */
const version = String(Constants.expoConfig?.version ?? "");
let currentScreen = "/";
const counter = createScreenCounter(c => supabaseConfigured ? Promise.resolve(trackAppScreens(supabase(), c)) : Promise.resolve());

export function screenViewed(path: string) { currentScreen = path; counter.add(path); }

let lastSent = 0;
export function reportError(e: unknown, fatal = false) {
  if (!supabaseConfigured) return;
  const now = Date.now(); if (now - lastSent < 3000) return; lastSent = now; // não inunda
  const err = e instanceof Error ? e : new Error(String(e));
  void Promise.resolve(logAppError(supabase(), { message: err.message, stack: err.stack ?? null, screen: currentScreen.split("?")[0].replace(/[0-9a-f-]{36}/gi, "[id]"), version, platform: Platform.OS, fatal })).catch(() => {});
}

/** Liga a recolha: erros não apanhados e envio das visitas quando a APP vai para segundo plano. */
export function startHealth() {
  const g: any = globalThis as any;
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((e: unknown, isFatal?: boolean) => { reportError(e, !!isFatal); prev?.(e, isFatal); });
  const sub = AppState.addEventListener("change", s => { if (s !== "active") void counter.flush(); });
  return () => { sub.remove(); if (prev) g.ErrorUtils?.setGlobalHandler?.(prev); };
}
