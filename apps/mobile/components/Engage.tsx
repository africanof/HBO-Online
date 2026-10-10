import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Linking, Share, Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { findSaved, toggleSaved, recordView, shareMessage, friendlyError, type SavedKind, type KeyValueStore } from "@huambo-online/core";
import { supabase, siteUrl } from "../lib/supabase";
import { ui } from "../lib/ui";
import { Button } from "./Ui";

export const deviceStore: KeyValueStore = { getItem: k => AsyncStorage.getItem(k), setItem: (k, v) => AsyncStorage.setItem(k, v) };

export function useRecordView(kind: SavedKind, id: string | undefined, title: string | undefined, image?: string | null) {
  useEffect(() => { if (id && title) void recordView(deviceStore, { kind, id, title, image: image ?? null }); }, [kind, id, title, image]);
}

export function SaveButton({ kind, id }: { kind: SavedKind; id: string }) {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null); const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void (async () => {
    const c = supabase(); const u = await c.auth.getUser(); const me = u.data.user?.id ?? null; setUid(me);
    if (me) { const r = await findSaved(c, me, kind, id); setSavedId((r.data as any)?.id ?? null); }
  })(); }, [kind, id]);
  async function press() {
    if (!uid) { router.push("/login"); return; }
    setBusy(true); setError("");
    const r = await toggleSaved(supabase(), uid, kind, id, savedId); setBusy(false);
    if (r.error) setError(friendlyError(r.error)); else setSavedId(r.data);
  }
  return <>
    <Button title={savedId ? "★ Guardado" : "☆ Guardar"} variant="secondary" disabled={busy} onPress={() => void press()} />
    {!!error && <Text style={ui.error}>{error}</Text>}
  </>;
}

export function ShareButton({ kind, id, title }: { kind: SavedKind; id: string; title: string }) {
  const { url, text } = shareMessage(siteUrl, kind, id, title);
  return <>
    <Button title="🔗 Partilhar" variant="secondary" onPress={() => void Share.share({ message: text, url: url || undefined, title })} />
    <Button title="Enviar por WhatsApp" variant="secondary" onPress={() => void Linking.openURL("https://wa.me/?text=" + encodeURIComponent(text))} />
  </>;
}
