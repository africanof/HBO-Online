import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@huambo-online/types";

export type AppNotification={id:string;user_id:string;type:NotificationType;title:string;body:string;data:Record<string,unknown>;read_at:string|null;created_at:string};
const columns="id,user_id,type,title,body,data,read_at,created_at";
const currentUserId=async(client:SupabaseClient,userId?:string)=>userId??(await client.auth.getUser()).data.user?.id??"";

export async function listNotifications(client:SupabaseClient,userId?:string){const u=await currentUserId(client,userId);return client.from("notifications").select(columns).eq("user_id",u).order("created_at",{ascending:false});}
export async function listUnreadNotifications(client:SupabaseClient,userId?:string){const u=await currentUserId(client,userId);return client.from("notifications").select(columns).eq("user_id",u).is("read_at",null).order("created_at",{ascending:false});}
export async function countUnreadNotifications(client:SupabaseClient,userId?:string){const u=await currentUserId(client,userId);const result=await client.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",u).is("read_at",null);return{count:result.count??0,error:result.error};}
export async function markNotificationRead(client:SupabaseClient,id:string,userId?:string){const u=await currentUserId(client,userId);return client.from("notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("user_id",u).is("read_at",null).select(columns).single();}
export async function markAllNotificationsRead(client:SupabaseClient,userId?:string){const u=await currentUserId(client,userId);return client.from("notifications").update({read_at:new Date().toISOString()}).eq("user_id",u).is("read_at",null);}
const isUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function getNotificationConversationId(n:Pick<AppNotification,"data">){const v=n.data?.conversation_id;return isUuid(v)?v:null;}
export function getNotificationSavedSearchId(n:Pick<AppNotification,"data">){const v=n.data?.saved_search_id;return isUuid(v)?v:null;}
export function getNotificationListingId(n:Pick<AppNotification,"data">){const v=n.data?.listing_id;if(isUuid(v))return v;const ids=n.data?.listing_ids;if(Array.isArray(ids)){const first=ids.find((id):id is string=>isUuid(id));return first??null;}return null;}
export function getNotificationDestination(n:Pick<AppNotification,"data">){const conversationId=getNotificationConversationId(n);if(conversationId)return{kind:"conversation" as const,id:conversationId};const listingId=getNotificationListingId(n);if(listingId)return{kind:"listing" as const,id:listingId};const savedSearchId=getNotificationSavedSearchId(n);if(savedSearchId)return{kind:"saved_search" as const,id:savedSearchId};return null;}
export function subscribeToNotifications(client:SupabaseClient,userId:string,onChange:()=>void){const channel=client.channel(`notifications:${userId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${userId}`},onChange).on("postgres_changes",{event:"UPDATE",schema:"public",table:"notifications",filter:`user_id=eq.${userId}`},onChange).subscribe();return()=>{void client.removeChannel(channel);};}
export async function listSavedSearchNotifications(client:SupabaseClient,userId?:string){const u=await currentUserId(client,userId);return client.from("notifications").select(columns).eq("user_id",u).eq("type","saved_search").order("created_at",{ascending:false});}
