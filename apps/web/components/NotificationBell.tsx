"use client";
import { useEffect, useState } from "react";
import { countUnreadNotifications, subscribeToNotifications, countUnreadMessages, getMyCart } from "@huambo-online/core";
import { supabase, supabaseConfigured } from "../lib/supabase";

/** Contadores do topo: notificações e mensagens por ler e artigos no carrinho (atualiza em tempo real). */
export function useUnreadCounts() {
  const [counts, setCounts] = useState({ notifications: 0, messages: 0, cart: 0 });
  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true; let stop = () => {};
    const c = supabase();
    const refresh = async (uid: string) => {
      const [n, m, cart] = await Promise.all([countUnreadNotifications(c, uid), countUnreadMessages(c, uid), getMyCart(c)]);
      const items = ((cart.data as any[]) ?? []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
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

/** Botões soltos de notificações e mensagens (o cabeçalho do Site já os mostra; mantido para páginas sem cabeçalho). */
export function NotificationBell() {
  const { notifications, messages } = useUnreadCounts();
  return <div className="row">
    <a className="icon-btn" href="/notificacoes" aria-label={`Notificações (${notifications} por ler)`}>🔔{notifications > 0 && <span className="count">{notifications}</span>}</a>
    <a className="icon-btn" href="/mensagens" aria-label={`Mensagens (${messages} por ler)`}>💬{messages > 0 && <span className="count">{messages}</span>}</a>
  </div>;
}
