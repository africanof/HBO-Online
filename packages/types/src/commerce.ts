export type PaymentStatus = "unpaid"|"pending"|"paid"|"failed"|"refunded";
export type PaymentMethod = "cash_on_delivery"|"bank_transfer"|"card"|"reference"|"mobile_money";
export type FulfillmentType = "delivery"|"pickup";
export type FulfillmentStatus = "pending"|"assigned"|"in_transit"|"delivered"|"cancelled";

export interface CommerceOrderState {
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  fulfillmentType: FulfillmentType;
  fulfillmentStatus: FulfillmentStatus;
  deliveryNotes?: string;
}