import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { mySavedMap, toggleSaved, type SavedKind } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { useT } from "../lib/i18n";

// Os favoritos de cada tipo carregam uma só vez, para todos os corações ♡ da lista.
type Store = { uid: string | null; map: Record<string, string>; ready: Promise<void> | null; subs: Set<() => void> };
const stores: Partial<Record<SavedKind, Store>> = {};
function storeFor(kind: SavedKind): Store {
  const s = stores[kind] ?? (stores[kind] = { uid: null, map: {}, ready: null, subs: new Set() });
  if (!s.ready) {
    s.ready = (async () => {
      const c = supabase(); const u = await c.auth.getUser();
      s.uid = u.data.user?.id ?? null;
      if (s.uid) s.map = await mySavedMap(c, s.uid, kind);
      s.subs.forEach(f => f());
    })().catch(() => {});
  }
  return s;
}
/** Ao entrar ou sair da conta, os corações voltam a ser lidos. */
export function resetSavedHearts() { for (const k of Object.keys(stores) as SavedKind[]) delete stores[k]; }

/** Coração para guardar sem abrir o anúncio. Sem sessão, leva a «Entrar». */
export function SaveHeart({ kind, id, title }: { kind: SavedKind; id: string; title: string }) {
  const { t } = useT(); const router = useRouter();
  const [, force] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { const s = storeFor(kind); const f = () => force(n => n + 1); s.subs.add(f); return () => { s.subs.delete(f); }; }, [kind]);
  const s = storeFor(kind); const saved = !!s.map[id];
  async function press() {
    await s.ready;
    if (!s.uid) { router.push("/login"); return; }
    setBusy(true);
    const r = await toggleSaved(supabase(), s.uid, kind, id, s.map[id] ?? null);
    setBusy(false);
    if (r.error) return;
    if (r.data) s.map[id] = r.data; else delete s.map[id];
    s.subs.forEach(f => f());
  }
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: saved, disabled: busy }} accessibilityLabel={(saved ? t("act.saved") : t("act.save")) + " — " + title}
    hitSlop={8} disabled={busy} onPress={() => void press()}
    style={{ position: "absolute", top: 6, right: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
    <Text style={{ fontSize: 20, color: saved ? "#c7102e" : "#191919", lineHeight: 22 }}>{saved ? "♥" : "♡"}</Text>
  </Pressable>;
}
