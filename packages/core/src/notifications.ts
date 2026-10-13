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

/** Ligação extra para notificações de encomendas e avaliações (igual no Site e na APP). */
export function getNotificationLink(n: Pick<AppNotification, "data" | "type" | "title">): { href: string; label: string } | null {
  const d = n.data ?? {};
  if (d.for === "commission") return { href: "/conta/comissoes", label: "💸 Ver as minhas comissões →" };
  if (d.for === "plan") return { href: "/conta/plano", label: "💳 Ver o meu plano →" };
  if (d.for === "dispute" && isUuid(d.dispute_id)) return { href: "/disputas", label: "⚖️ Ver devolução / reembolso →" };
  if (d.for === "follow" && isUuid(d.product_id)) return { href: "/loja/" + d.product_id, label: "🛍️ Ver produto →" };
  if (d.for === "follow" && isUuid(d.provider_id)) return { href: "/profissionais/" + d.provider_id, label: "🧰 Ver perfil →" };
  if (d.for === "follow" && isUuid(d.business_id)) return { href: "/empresas/" + d.business_id, label: "🏪 Ver empresa →" };
  if (d.for === "new_follower") return { href: "/seguindo", label: "👥 Ver quem eu sigo →" };
  if (d.for === "boost") return { href: "/meus-anuncios", label: "⭐ Ver os meus anúncios →" };
  if (d.for === "referral") return { href: "/convidar", label: "🎁 Ver os meus convites →" };
  if (d.for === "agent") return { href: "/agente", label: "🤝 Ver o meu painel de agente →" };
  if (d.for === "wallet") return { href: "/conta/saldo", label: "💰 Ver o meu saldo →" };
  if (d.for === "sale" && isUuid(d.order_id)) return { href: "/encomendas?vendas=1", label: "📦 Ver venda →" };
  if (d.for === "purchase" && isUuid(d.order_id)) return { href: "/encomendas", label: "📦 Ver encomenda →" };
  if (n.type === "order" && isUuid(d.order_id)) return /^Nova encomenda/.test(n.title) ? { href: "/encomendas?vendas=1", label: "📦 Ver venda →" } : { href: "/encomendas", label: "📦 Ver encomenda →" };
  if (n.type === "delivery") return d.for === "courier" ? { href: "/entregas", label: "🛵 Ver entregas →" } : isUuid(d.order_id) ? { href: "/encomendas", label: "📦 Ver encomenda →" } : null;
  if (isUuid(d.market_id)) return d.for === "admin" ? { href: "/admin", label: "🧺 Ver na administração →" } : { href: "/pracas/" + d.market_id, label: "🧺 Ver praça →" };
  if (isUuid(d.rental_id)) return { href: /^Novo pedido/.test(n.title) ? "/alugueres?recebidos=1" : "/alugueres", label: "📅 Ver alugueres →" };
  if (d.for === "admin" && (isUuid(d.report_id) || isUuid(d.verification_id) || isUuid(d.dispute_id) || isUuid(d.payment_id) || isUuid(d.payout_id) || isUuid(d.boost_id) || typeof d.reference === "string")) return { href: "/admin", label: "🛡️ Ver na administração →" };
  if (d.for === "offer" && isUuid(d.listing_id)) return { href: "/classificados/" + d.listing_id + "#propostas", label: "💬 Ver propostas →" };
  if (d.for === "my_offer") return { href: "/propostas", label: "💬 As minhas propostas →" };
  if (d.for === "verification") return { href: "/conta/verificacao", label: "✔ Ver verificação →" };
  if (d.for === "service" && isUuid(d.service_request_id)) return { href: /^Novo pedido/.test(n.title) ? "/servicos?recebidos=1" : "/servicos", label: "🛠️ Ver pedidos de serviço →" };
  if (d.for === "review") return { href: "/avaliacoes", label: "⭐ Avaliar agora →" };
  if (d.for === "profile" && isUuid(d.user_id)) return { href: "/vendedor/" + d.user_id, label: "⭐ Ver as minhas avaliações →" };
  if (n.type === "review" && isUuid(d.provider_id)) return { href: "/profissionais/" + d.provider_id, label: "⭐ Ver avaliações →" };
  if (n.type === "review" && isUuid(d.business_id)) return { href: "/empresas/" + d.business_id, label: "⭐ Ver avaliações →" };
  return null;
}
