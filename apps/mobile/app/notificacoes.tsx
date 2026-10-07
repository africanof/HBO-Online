import { useEffect,useState } from "react";
import { Link } from "expo-router";
import { StyleSheet,Text,View,Pressable,ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
import { countUnreadNotifications,listNotifications,markAllNotificationsRead,markNotificationRead,getNotificationListingId,getNotificationConversationId,getNotificationSavedSearchId,subscribeToNotifications } from "@huambo-online/core";
const url=process.env.EXPO_PUBLIC_SUPABASE_URL??"";const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"";
export default function Notificacoes(){
 const [items,setItems]=useState<any[]>([]); const [unread,setUnread]=useState(0); const [error,setError]=useState("");
 async function load(){const c=supabase();const a=await listNotifications(c);const b=await countUnreadNotifications(c);if(a.error) setError(a.error.message); setItems(a.data??[]);setUnread(b.count??0);}
 useEffect(()=>{void load();const c=supabase();let stop=()=>{};void c.auth.getUser().then(({data})=>{if(data.user)stop=subscribeToNotifications(c,data.user.id,()=>{void load();});});return()=>stop();},[]);
 return <ScrollView contentContainerStyle={s.container}><Link href="/">← Huambo Online</Link><Link href="/notificacoes-preferencias">⚙️ Preferências de notificações</Link>{error&&<Text>{error}</Text>}<Text style={s.title}>Notificações {unread>0?(`(${unread} novas)`):""}</Text>
 <Pressable onPress={async()=>{const c=supabase();await markAllNotificationsRead(c);await load();}}><Text>Marcar todas como lidas</Text></Pressable>
 {items.map(n=><View key={n.id} style={s.card}><Text style={s.strong}>{n.title}</Text><Text>{n.body}</Text><Text>{new Date(n.created_at).toLocaleString("pt-AO")}</Text>
 {!n.read_at&&<Pressable onPress={async()=>{const c=supabase();await markNotificationRead(c,n.id);await load();}}><Text>Marcar como lida</Text></Pressable>}
 {getNotificationConversationId(n)&&<Link href={"/mensagens?conversation="+getNotificationConversationId(n)}>Abrir conversa →</Link>}{getNotificationListingId(n)&&<Link href={"/classificados/"+getNotificationListingId(n)}>🔎 Abrir anúncio →</Link>}{getNotificationSavedSearchId(n)&&<Link href={"/pesquisas-guardadas?search="+getNotificationSavedSearchId(n)}>⭐ Abrir pesquisa guardada →</Link>}{n.data?.digest&&Array.isArray(n.data?.listing_ids)&&n.data.listing_ids.length>1&&<Link href={"/notificacoes/digest?ids="+n.data.listing_ids.join(",")}>📦 Ver todos os anúncios ({n.data.listing_ids.length}) →</Link>}</View>)}</ScrollView>;
}
const s=StyleSheet.create({container:{padding:28,gap:18},title:{fontSize:30,fontWeight:"800"},card:{borderWidth:1,borderColor:"#ddd",borderRadius:14,padding:16,gap:8},strong:{fontWeight:"800"}});