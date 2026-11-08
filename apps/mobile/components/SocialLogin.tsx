import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { enabledSocialProviders, completeSocialLogin, claimPendingReferral, mfaRequired, SOCIAL_PROVIDERS, type SocialProvider } from "@huambo-online/core";
import { supabase } from "../lib/supabase";
import { deviceStore } from "./Engage";
import { ui, C } from "../lib/ui";
import { useT } from "../lib/i18n";

const URL_ = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? "").trim(); const KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
let cache: Promise<SocialProvider[]> | null = null;
const STYLE: Record<SocialProvider, { bg: string; fg: string; border?: string; ic: string }> = {
  google: { bg: "#ffffff", fg: "#1f1f1f", border: "#747775", ic: "#4285f4" },
  facebook: { bg: "#1877f2", fg: "#ffffff", ic: "#ffffff" },
  apple: { bg: "#000000", fg: "#ffffff", ic: "#ffffff" }
};

/** «Continuar com Google / Facebook / Apple»: abre o navegador do telemóvel e volta à APP já com sessão. */
export function SocialLogin({ onDone, onNeedCode }: { onDone: () => void; onNeedCode?: () => void }) {
  const { t } = useT();
  const [list, setList] = useState<SocialProvider[]>([]); const [busy, setBusy] = useState<SocialProvider | null>(null); const [error, setError] = useState("");
  useEffect(() => { if (!URL_) return; cache ??= enabledSocialProviders(URL_, KEY); void cache.then(setList); }, []);
  if (!list.length) return null;
  async function go(p: SocialProvider, label: string) {
    setError(""); setBusy(p);
    try {
      const c = supabase(); const redirectTo = Linking.createURL("login-callback");
      const { data, error: e } = await c.auth.signInWithOAuth({ provider: p, options: { redirectTo, skipBrowserRedirect: true } });
      if (e || !data?.url) throw e ?? new Error(label);
      const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (res.type !== "success") { setError(t("social.cancelled")); return; }
      const r = await completeSocialLogin(c, res.url);
      if (r.error) { setError(r.error.message === "SOCIAL_LOGIN_CANCELLED" ? t("social.cancelled") : t("social.failed", { error: r.error.message })); return; }
      await claimPendingReferral(c, deviceStore).catch(() => {});
      if (onNeedCode && await mfaRequired(c)) { onNeedCode(); return; }
      onDone();
    } catch (e: any) { setError(t("social.failed", { error: String(e?.message ?? e) })); }
    finally { setBusy(null); }
  }
  return <View style={{ gap: 10 }}>
    {SOCIAL_PROVIDERS.filter(p => list.includes(p.id)).map(p => { const s = STYLE[p.id]; return <Pressable key={p.id} accessibilityRole="button" disabled={!!busy} onPress={() => void go(p.id, p.label)}
      style={({ pressed }) => ({ minHeight: 52, borderRadius: 999, backgroundColor: s.bg, borderWidth: s.border ? 1 : 0, borderColor: s.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, opacity: busy && busy !== p.id ? 0.5 : pressed ? 0.85 : 1 })}>
      {!!p.icon && <Text style={{ color: s.ic, fontWeight: "900", fontSize: 18, width: 22, textAlign: "center" }}>{p.icon}</Text>}
      <Text style={{ color: s.fg, fontWeight: "800", fontSize: 16 }}>{busy === p.id ? t("social.wait", { name: p.label }) : t("social.continue", { name: p.label })}</Text>
    </Pressable>; })}
    <Text style={ui.muted}>{t("social.note")}</Text>
    {!!error && <Text style={ui.error} accessibilityRole="alert">{error}</Text>}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 }}><View style={{ flex: 1, height: 1, backgroundColor: C.line }} /><Text style={ui.muted}>{t("social.or")}</Text><View style={{ flex: 1, height: 1, backgroundColor: C.line }} /></View>
  </View>;
}
