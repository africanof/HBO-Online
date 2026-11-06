// Notificações no telemóvel: regista este telemóvel na conta e abre o sítio certo quando se toca num aviso.
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { getNotificationLink } from "@huambo-online/core";
import { supabase } from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "huambo:push-token";

// Com a APP aberta, o aviso aparece em cima, com som.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false })
});

async function ensureChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Huambo Online", importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 150, 250], lightColor: "#3665F3"
  });
}

/** Pede autorização (só na primeira vez) e regista o telemóvel na conta com sessão iniciada. */
export async function registerForPush(): Promise<"ok" | "denied" | "unavailable"> {
  try {
    const { data } = await supabase().auth.getSession();
    if (!data.session) return "unavailable";
    await ensureChannel();
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return "denied";
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    const r = await supabase().rpc("register_push_token", { p_token: token, p_platform: Platform.OS === "ios" ? "ios" : "android" });
    if (r.error) return "unavailable";
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return "ok";
  } catch {
    // Sem Firebase configurado, sem rede ou num emulador: a APP continua a funcionar sem notificações.
    return "unavailable";
  }
}

/** Ao sair da conta: este telemóvel deixa de receber os avisos dessa conta. */
export async function unregisterPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) await supabase().rpc("unregister_push_token", { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch { /* sem rede: o token é limpo quando a Expo avisar que já não serve */ }
}

/** Para onde vai quem toca no aviso. */
export function pushTarget(data: Record<string, any> | null | undefined): string {
  const d = data ?? {};
  if (typeof d.conversation_id === "string") return "/mensagens?conversation=" + d.conversation_id;
  if (typeof d.tab === "string") return "/admin?tab=" + encodeURIComponent(d.tab);
  if (typeof d.support_conversation_id === "string") return "/admin";
  const link = getNotificationLink({ data: d, type: d.type ?? "system", title: d.title ?? "" } as any);
  return link?.href ?? "/notificacoes";
}

/** Liga tudo: regista ao entrar na conta e trata os toques nos avisos. Devolve a função para desligar. */
export function startPush(open: (href: string) => void): () => void {
  void registerForPush();
  const auth = supabase().auth.onAuthStateChange((event, session) => { if (event === "SIGNED_IN" && session) void registerForPush(); });
  const tap = Notifications.addNotificationResponseReceivedListener(r => open(pushTarget(r.notification.request.content.data as any)));
  // A APP foi aberta por um toque num aviso.
  void Notifications.getLastNotificationResponseAsync().then(r => { if (r) open(pushTarget(r.notification.request.content.data as any)); }).catch(() => {});
  return () => { auth.data.subscription.unsubscribe(); tap.remove(); };
}
