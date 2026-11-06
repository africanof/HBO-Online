"use client";
import { useEffect, useState } from "react";
import { mySavedMap, toggleSaved, type SavedKind } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { useT } from "../lib/i18n";

// Os favoritos de cada tipo carregam uma só vez por página, para todos os corações ♡ da lista.
type Store = { uid: string | null; map: Record<string, string>; ready: Promise<void> | null; subs: Set<() => void> };
const stores: Partial<Record<SavedKind, Store>> = {};
function storeFor(kind: SavedKind): Store {
  const s = stores[kind] ?? (stores[kind] = { uid: null, map: {}, ready: null, subs: new Set() });
  if (!s.ready && supabaseConfigured) {
    s.ready = (async () => {
      const c = supabase(); const u = await c.auth.getUser();
      s.uid = u.data.user?.id ?? null;
      if (s.uid) s.map = await mySavedMap(c, s.uid, kind);
      s.subs.forEach(f => f());
    })().catch(() => {});
  }
  return s;
}

/** Coração para guardar sem abrir o anúncio (como no eBay e no OLX). Sem sessão, leva a «Entrar». */
export function SaveHeart({ kind, id, title }: { kind: SavedKind; id: string; title: string }) {
  const { t } = useT();
  const [, force] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { const s = storeFor(kind); const f = () => force(n => n + 1); s.subs.add(f); return () => { s.subs.delete(f); }; }, [kind]);
  const s = storeFor(kind); const savedId = s.map[id] ?? null;
  async function click(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await s.ready;
    if (!s.uid) { window.location.href = "/conta/login?voltar=" + encodeURIComponent(window.location.pathname + window.location.search); return; }
    setBusy(true);
    const r = await toggleSaved(supabase(), s.uid, kind, id, s.map[id] ?? null);
    setBusy(false);
    if (r.error) return;
    if (r.data) s.map[id] = r.data; else delete s.map[id];
    s.subs.forEach(f => f());
  }
  const label = (savedId ? t("ls.saved") : t("ls.save_listing")) + " — " + title;
  return <button type="button" className={"save-heart" + (savedId ? " on" : "")} aria-pressed={!!savedId} aria-label={label} title={label} disabled={busy} onClick={e => void click(e)}>
    <span aria-hidden>{savedId ? "♥" : "♡"}</span>
  </button>;
}
