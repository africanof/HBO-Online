export type DeliveryStatus="pending"|"assigned"|"accepted"|"picked_up"|"in_transit"|"delivered"|"cancelled";
export interface DeliveryRequest {
  id:string; orderId:string; requesterId:string; pickupAddressId?:string; dropoffAddressId?:string;
  assignedTo?:string; status:DeliveryStatus; notes?:string; requestedAt:string; assignedAt?:string; deliveredAt?:string;
}