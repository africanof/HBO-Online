import { useEffect, useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { countUnreadNotifications, subscribeToNotifications, countUnreadMessages, getMyCart } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { C, themed } from "../lib/ui";

/** Contadores: notificações e mensagens por ler e artigos no carrinho (atualiza em tempo real). */
export function useUnreadCounts() {
  const [counts, setCounts] = useState({ notifications: 0, messages: 0, cart: 0 });
  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true; let stop = () => {};
    const c = supabase();
    const refresh = async (uid: string) => {
      const [n, m, cart] = await Promise.all([countUnreadNotifications(c, uid), countUnreadMessages(c, uid), getMyCart(c)]);
      const items = ((cart.data as any[]) ?? []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      if (alive) setCounts({ notifications: n.count ?? 0, messages: m.count ?? 0, cart: items });
    };
    void (async () => {
      const u = await c.auth.getUser();
      if (!u.data.user || !alive) return;
      const uid = u.data.user.id;
      await refresh(uid);
      if (alive) stop = subscribeToNotifications(c, uid, () => { if (alive) void refresh(uid); });
    })();
    return () => { alive = false; stop(); };
  }, []);
  return counts;
}

function IconLink({ href, icon, count, label }: { href: string; icon: string; count: number; label: string }) {
  return <Link href={href as any} accessibilityLabel={label} style={s.btn}>
    <View><Text style={{ fontSize: 24 }}>{icon}</Text>{count > 0 && <View style={s.count}><Text style={s.countText}>{count > 99 ? "99+" : count}</Text></View>}</View>
  </Link>;
}

/** Ícones do topo: notificações, mensagens e carrinho, com contadores. */
export function NotificationBell() {
  const { notifications, messages, cart } = useUnreadCounts();
  return <View style={{ flexDirection: "row" }}>
    <IconLink href="/notificacoes" icon="🔔" count={notifications} label={`Notificações (${notifications} por ler)`} />
    <IconLink href="/mensagens" icon="💬" count={messages} label={`Mensagens (${messages} por ler)`} />
    <IconLink href="/carrinho" icon="🛒" count={cart} label={`Carrinho (${cart} artigos)`} />
  </View>;
}

const s = themed(C => StyleSheet.create({
  btn: { padding: 8 },
  count: { position: "absolute", top: -4, right: -10, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  countText: { color: C.onAccent, fontSize: 11, fontWeight: "800" }
}));
