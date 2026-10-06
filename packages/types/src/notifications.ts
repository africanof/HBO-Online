export type NotificationType="order"|"auction"|"bid"|"message"|"delivery"|"review"|"system"|"saved_search";
export interface Notification {
  id:string; userId:string; type:NotificationType; title:string; body:string;
  data:Record<string,unknown>; readAt?:string; createdAt:string;
}
