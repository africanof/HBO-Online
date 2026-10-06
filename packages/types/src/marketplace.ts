export type OrderStatus = "pending"|"confirmed"|"processing"|"ready"|"completed"|"cancelled";

export interface CartItem { id:string; cartId:string; productId:string; quantity:number; }
export interface Order { id:string; buyerId:string; status:OrderStatus; currency:"AOA"; subtotal:number; deliveryFee:number; total:number; deliveryAddressId?:string; }
export interface OrderItem { id:string; orderId:string; productId:string; sellerId:string; quantity:number; unitPrice:number; lineTotal:number; }