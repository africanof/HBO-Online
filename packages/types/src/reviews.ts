export type ReviewStatus = "pending"|"published"|"hidden"|"rejected";

export interface Review {
  id: string;
  authorId: string;
  businessId?: string;
  providerId?: string;
  productId?: string;
  serviceId?: string;
  orderId?: string;
  rating: 1|2|3|4|5;
  title?: string;
  comment?: string;
  status: ReviewStatus;
  createdAt: string;
}

export interface RatingSummary {
  averageRating: number;
  reviewCount: number;
}