import type { SupabaseClient } from "@supabase/supabase-js";

export async function createConversation(client:SupabaseClient,userId:string,input:{
  subject?:string; contextType?:string; businessId?:string; providerId?:string; serviceId?:string; productId?:string; orderId?:string; classifiedListingId?:string; participantIds:string[];
}) {
  if(!userId) return {data:null,error:new Error("Utilizador autenticado obrigatório.")};
  const participantIds=[...new Set(input.participantIds.filter(Boolean))].filter(id=>id!==userId);
  const created=await client.from("conversations").insert({
    created_by:userId,subject:input.subject?.trim()||null,context_type:input.contextType||"general",
    business_id:input.businessId||null,provider_id:input.providerId||null,service_id:input.serviceId||null,
    product_id:input.productId||null,order_id:input.orderId||null,classified_listing_id:input.classifiedListingId||null
  }).select().single();
  if(created.error) return created;
  const ids=[userId,...participantIds].map(user_id=>({conversation_id:created.data.id,user_id}));
  const participants=await client.from("conversation_participants").insert(ids);
  if(participants.error) return {data:null,error:participants.error};
  return created;
}

export async function listConversations(client:SupabaseClient,userId?:string){
  if(!userId)return client.from("conversations").select("id,created_by,subject,context_type,business_id,provider_id,service_id,product_id,order_id,classified_listing_id,created_at,updated_at").order("updated_at",{ascending:false});
  return client.from("conversation_participants").select("conversation_id,last_read_at,conversations(id,created_by,subject,context_type,business_id,provider_id,service_id,product_id,order_id,classified_listing_id,created_at,updated_at)").eq("user_id",userId);
}
export function conversationFromParticipantRow(row:any){return row?.conversations??row;}
export function isConversationUnread(row:any,lastMessage:any,userId:string){return !!lastMessage&&lastMessage.sender_id!==userId&&(!row.last_read_at||new Date(lastMessage.created_at)>new Date(row.last_read_at));}

export async function listMessages(client:SupabaseClient,conversationId:string){
  return client.from("messages").select("id,conversation_id,sender_id,body,created_at,edited_at").eq("conversation_id",conversationId).order("created_at");
}

export async function sendMessage(client:SupabaseClient,conversationId:string,senderId:string,body:string){
  return client.from("messages").insert({conversation_id:conversationId,sender_id:senderId,body:body.trim()}).select().single();
}
export async function markConversationRead(client:SupabaseClient,conversationId:string,userId:string){return client.from("conversation_participants").update({last_read_at:new Date().toISOString()}).eq("conversation_id",conversationId).eq("user_id",userId);}
export function subscribeToConversationMessages(client:SupabaseClient,conversationId:string,onChange:()=>void){const channel=client.channel(`conversation:${conversationId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},onChange).subscribe();return ()=>{void client.removeChannel(channel);};}

export async function countUnreadMessages(client:SupabaseClient,userId:string){
 const {data,error}=await client.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id",userId);
 if(error)return {count:0,error}; let count=0;
 for(const p of data??[]){let q=client.from("messages").select("id",{count:"exact",head:true}).eq("conversation_id",p.conversation_id).neq("sender_id",userId); if(p.last_read_at)q=q.gt("created_at",p.last_read_at); const r=await q;if(r.error)return {count:0,error:r.error};count+=r.count??0;}
 return {count,error:null};
}
export async function countUnreadConversations(client:SupabaseClient,userId:string){
 const {data,error}=await client.from("conversation_participants").select("conversation_id,last_read_at").eq("user_id",userId);
 if(error)return {count:0,error}; let count=0;
 for(const p of data??[]){let q=client.from("messages").select("id",{count:"exact",head:true}).eq("conversation_id",p.conversation_id).neq("sender_id",userId); if(p.last_read_at)q=q.gt("created_at",p.last_read_at); const r=await q;if(r.error)return {count:0,error:r.error};if((r.count??0)>0)count++;}
 return {count,error:null};
}

export function subscribeToUserConversationMessages(client:SupabaseClient,userId:string,onChange:()=>void){const channel=client.channel(`user-conversations:${userId}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},onChange).subscribe();return ()=>{void client.removeChannel(channel);};}
