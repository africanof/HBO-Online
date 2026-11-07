import { themed, C } from "../lib/ui";
import { usePull } from "../components/Pull";
import { useT, formatDateTimeIn } from "../lib/i18n";
import { useEffect,useState } from "react";
import { Link } from "expo-router";
import { StyleSheet,Text,View,Pressable,ScrollView } from "react-native";
import { supabase } from "../lib/supabase";
import { countUnreadNotifications,listNotifications,markAllNotificationsRead,markNotificationRead,getNotificationListingId,getNotificationConversationId,getNotificationSavedSearchId,subscribeToNotifications,getNotificationLink,friendlyErrorIn } from "@huambo-online/core";
const url=process.env.EXPO_PUBLIC_SUPABASE_URL??"";const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"";
export default function Notificacoes(){
 const {t,tc,lang}=useT();
 const [items,setItems]=useState<any[]>([]); const [unread,setUnread]=useState(0); const [error,setError]=useState("");
 const pull=usePull(load);async function load(){const c=supabase();const a=await listNotifications(c);const b=await countUnreadNotifications(c);if(a.error) setError(friendlyErrorIn(a.error,lang)); setItems(a.data??[]);setUnread(b.count??0);}
 useEffect(()=>{void load();const c=supabase();let stop=()=>{};void c.auth.getUser().then(({data})=>{if(data.user)stop=subscribeToNotifications(c,data.user.id,()=>{void load();});});return()=>stop();},[]);
 return <ScrollView contentContainerStyle={s.container} refreshControl={pull}><Link style={s.lk} href="/">← Huambo Online</Link><Link style={s.lk} href="/notificacoes-preferencias">⚙️ {t("ls.np.title")}</Link>{!!error&&<Text style={s.tx}>{error}</Text>}<Text style={s.title}>{t("nav.notifications")} {unread>0?t("ls.notif.new",{n:unread}):""}</Text>
 <Pressable onPress={async()=>{const c=supabase();await markAllNotificationsRead(c);await load();}}><Text style={s.tx}>{t("ls.notif.read_all")}</Text></Pressable>
 {items.map(n=><View key={n.id} style={s.card}><Text style={s.strong}>{tc(n.title)}</Text><Text style={s.tx}>{tc(n.body)}</Text><Text style={s.tx}>{formatDateTimeIn(n.created_at,lang)}</Text>
 {!n.read_at&&<Pressable onPress={async()=>{const c=supabase();await markNotificationRead(c,n.id);await load();}}><Text style={s.tx}>{t("ls.notif.read")}</Text></Pressable>}
 {!!getNotificationConversationId(n)&&<Link style={s.lk} href={"/mensagens?conversation="+getNotificationConversationId(n)}>{t("ls.notif.open_chat")}</Link>}{!!getNotificationListingId(n)&&<Link style={s.lk} href={"/classificados/"+getNotificationListingId(n)}>{t("ls.notif.open_listing")}</Link>}{!!getNotificationSavedSearchId(n)&&<Link style={s.lk} href={"/pesquisas-guardadas?search="+getNotificationSavedSearchId(n)}>{t("ls.notif.open_search")}</Link>}{!!getNotificationLink(n)&&<Link style={s.lk} href={getNotificationLink(n)!.href as any}>{tc(getNotificationLink(n)!.label)}</Link>}{n.data?.digest&&Array.isArray(n.data?.listing_ids)&&n.data.listing_ids.length>1&&<Link style={s.lk} href={"/notificacoes/digest?ids="+n.data.listing_ids.join(",")}>{t("ls.notif.see_all",{n:n.data.listing_ids.length})}</Link>}</View>)}</ScrollView>;
}
const s=themed(C=>StyleSheet.create({tx:{color:C.ink,fontSize:16},lk:{color:C.blue,fontWeight:"800",fontSize:16},container:{padding:28,gap:18},title:{color:C.ink,fontSize:30,fontWeight:"800"},card:{borderWidth:1,borderColor:C.line,borderRadius:14,padding:16,gap:8},strong:{color:C.ink,fontWeight:"800"}}));