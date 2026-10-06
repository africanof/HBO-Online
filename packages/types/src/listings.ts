export interface ProviderProfile {
  userId: string;
  displayName: string;
  headline?: string;
  bio?: string;
  categoryId?: string;
  addressId?: string;
  phone?: string;
  verified: boolean;
  active: boolean;
}

export interface CreateBusinessInput {
  name: string;
  description?: string;
  categoryId?: string;
  organizationId?: string;
  addressId?: string;
}

export interface CreateServiceInput {
  title: string;
  description?: string;
  categoryId?: string;
  businessId?: string;
  priceFrom?: number;
  addressId?: string;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  categoryId?: string;
  businessId?: string;
  price: number;
  stock: number;
  addressId?: string;
}