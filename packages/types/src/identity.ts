export type AccountCapability = "customer" | "provider" | "seller" | "business_owner" | "business_staff" | "courier";

export interface UserProfile {
  id: string;
  fullName: string;
  phone?: string;
  province: string;
  municipality: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  type: "business" | "store" | "organization";
  verified: boolean;
}

export interface ProviderSummary {
  id: string;
  displayName: string;
  categories: string[];
  verified: boolean;
}
