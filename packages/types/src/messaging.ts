export type ConversationContext = "general"|"business"|"provider"|"service"|"product"|"order"|"classified";

export interface Conversation {
  id:string; createdBy:string; subject?:string; contextType:ConversationContext;
  businessId?:string; providerId?:string; serviceId?:string; productId?:string; orderId?:string;
  createdAt:string; updatedAt:string;
}
export interface Message {
  id:string; conversationId:string; senderId:string; body:string; createdAt:string; editedAt?:string;
}