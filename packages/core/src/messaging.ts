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
  return client.from("messages").select("id,conversation_id,sender_id,body,created_at,edited_at,attachment_kind,attachment_path,attachment_seconds,from_team,audience,forwarded_from,handled_at,blocked_reason,payment_offer_id").eq("conversation_id",conversationId).order("created_at");
}

export async function sendMessage(client:SupabaseClient,conversationId:string,senderId:string,body:string){
  const r = await client.from("messages").insert({conversation_id:conversationId,sender_id:senderId,body:body.trim()}).select().single();
  // Com contactos ou dados bancários a mensagem fica gravada (só quem a escreveu a vê), mas não é entregue.
  if (!r.error && (r.data as any)?.blocked_reason) return { ...r, error: new Error("CONTACT_BLOCKED") };
  return r;
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

export type ConversationPartner = { conversation_id: string; other_user_id: string; other_name: string; other_avatar: string | null };
/** Nome da outra pessoa em cada conversa (mapa conversa → pessoa). */
export async function listConversationPartners(client: SupabaseClient): Promise<Record<string, ConversationPartner>> {
  const { data } = await client.rpc("my_conversation_partners");
  const map: Record<string, ConversationPartner> = {};
  for (const row of (data as ConversationPartner[] | null) ?? []) map[row.conversation_id] = row;
  return map;
}

// ───────────── Mensagens mediadas pela equipa ─────────────
// Os utilizadores nunca falam diretamente: cada um só vê as suas mensagens e as da equipa.
// A equipa (administradores e moderadores) lê tudo e reencaminha ou responde a cada lado.
export type MediatedParticipant = { user_id: string; name: string; role: "starter" | "owner" };
export type MediatedConversation = { conversation_id: string; subject: string | null; context_type: string; classified_listing_id: string | null;
  updated_at: string; pending: number; last_message_at: string | null; participants: MediatedParticipant[] };

export async function listMediatedConversations(client: SupabaseClient, pendingOnly = true, limit = 50) {
  const r = await client.rpc("admin_list_mediated_conversations", { p_pending_only: pendingOnly, p_limit: limit });
  return { data: ((r.data ?? []) as any[]).map(x => ({ ...x, pending: Number(x.pending ?? 0) })) as MediatedConversation[], error: r.error };
}
export async function pendingMessagesCount(client: SupabaseClient): Promise<number> {
  const r = await client.rpc("admin_pending_messages_count"); return Number(r.data ?? 0);
}
/** A equipa escreve a uma das partes (audience) ou às duas (null). */
export async function teamSendMessage(client: SupabaseClient, conversationId: string, audience: string | null, body: string) {
  if (!body.trim()) return { data: null, error: new Error("MESSAGE_REQUIRED") };
  return client.rpc("team_send_message", { p_conversation_id: conversationId, p_audience: audience, p_body: body.trim(), p_forward_message_id: null });
}
/** Reencaminha a mensagem de um utilizador para a outra parte (pode corrigir o texto antes). */
export async function teamForwardMessage(client: SupabaseClient, conversationId: string, messageId: string, audience: string, body?: string) {
  return client.rpc("team_send_message", { p_conversation_id: conversationId, p_audience: audience, p_body: body?.trim() || null, p_forward_message_id: messageId });
}
/** Marca como tratada sem reencaminhar (por exemplo, conteúdo impróprio ou contactos pessoais). */
export async function markMessageHandled(client: SupabaseClient, messageId: string) {
  return client.rpc("admin_mark_message_handled", { p_message_id: messageId });
}
/** A outra parte de uma conversa (para onde se reencaminha). */
export function otherParticipant(c: Pick<MediatedConversation, "participants">, senderId: string): MediatedParticipant | null {
  return c.participants.find(p => p.user_id !== senderId) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Suporte: a IA responde primeiro; «Falar com um agente» abre uma conversa com a equipa nas Mensagens.
export type SupportTurn = { role: "user" | "assistant"; content: string };
/** Resumo da conversa com o assistente que segue para a equipa (as últimas trocas, até ~3 000 caracteres). */
export function supportSummary(turns: SupportTurn[]): string {
  const lines = turns.filter(x => x.content?.trim()).map(x => (x.role === "user" ? "🙂 " : "🤖 ") + x.content.trim().replace(/\s+/g, " "));
  let out = "";
  for (let i = lines.length - 1; i >= 0; i--) { const next = lines[i] + (out ? "\n" + out : ""); if (next.length > 3000) break; out = next; }
  return out;
}
/** Abre (ou reutiliza) a conversa de suporte com a equipa e devolve o seu id. */
export async function openSupportConversation(client: SupabaseClient, turns: SupportTurn[] = []): Promise<{ data: string | null; error: any }> {
  const r = await client.rpc("open_support_conversation", { p_summary: supportSummary(turns) || null });
  return { data: (r.data as string | null) ?? null, error: r.error };
}
export function isSupportConversation(x: { context_type?: string | null } | null | undefined): boolean { return x?.context_type === "support"; }
