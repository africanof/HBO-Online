"use client";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@huambo-online/supabase";
import { countUnreadNotifications, listNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications, getNotificationListingId, getNotificationConversationId, getNotificationSavedSearchId } from "@huambo-online/core";

const url=process.env.NEXT_PUBLIC_SUPABASE_URL??"";
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"";

export default function NotificacoesPage(){
 const [items,setItems]=useState<any[]>([]); const [unread,setUnread]=useState(0); const [error,setError]=useState("");
 async function load(){
  try{
   const c=createSupabaseClient(url,key);
   const [a,b]=await Promise.all([listNotifications(c),countUnreadNotifications(c)]);
   if(a.error) throw a.error;
   setItems(a.data??[]); setUnread(b.count);
  }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar as notificações.");}
 }
 useEffect(()=>{void load();const c=createSupabaseClient(url,key);let stop=()=>{};void c.auth.getUser().then(({data})=>{if(data.user)stop=subscribeToNotifications(c,data.user.id,()=>{void load();});});return()=>stop();},[]);
 return <main style={{maxWidth:900,margin:"0 auto",padding:32}}>
  <a href="/">← Huambo Online</a><p><a href="/notificacoes/preferencias">⚙️ Preferências de notificações</a></p><h1>Notificações {unread>0&&<small>({unread} novas)</small>}</h1>
  <button onClick={async()=>{const c=createSupabaseClient(url,key);await markAllNotificationsRead(c);await load();}}>Marcar todas como lidas</button>
  {error&&<p>{error}</p>}
  <section style={{marginTop:24,display:"grid",gap:12}}>
   {items.map(n=><article key={n.id} style={{border:"1px solid #ddd",borderRadius:14,padding:16,opacity:n.read_at?.7:1}}>
    <strong>{n.title}</strong><p>{n.body}</p><small>{new Date(n.created_at).toLocaleString("pt-AO")}</small>
    {!n.read_at&&<button onClick={async()=>{const c=createSupabaseClient(url,key);await markNotificationRead(c,n.id);await load();}}>Marcar como lida</button>}
    {getNotificationConversationId(n)&&<p><a href={"/mensagens?conversation="+getNotificationConversationId(n)}>Abrir conversa →</a></p>}{getNotificationListingId(n)&&<p><a href={"/classificados/"+getNotificationListingId(n)}>🔎 Abrir anúncio →</a></p>}{getNotificationSavedSearchId(n)&&<p><a href={"/pesquisas-guardadas?search="+getNotificationSavedSearchId(n)}>⭐ Abrir pesquisa guardada →</a></p>}{n.data?.digest&&Array.isArray(n.data?.listing_ids)&&n.data.listing_ids.length>1&&<p><a href={"/notificacoes/digest?ids="+n.data.listing_ids.join(",")}>📦 Ver todos os anúncios ({n.data.listing_ids.length}) →</a></p>}
   </article>)}
  </section>
 </main>;
}