/**
 * Products API functions.
 * All operations require internet — product changes are not queued offline.
 */
import { apiClient } from '@/api/client';

export interface ApiProductVariant {
  sku: string;
  label: string;
  size?: string;
  color?: string;
  priceAdjustment: number;
  stock: number;
}

export interface ApiProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  active: boolean;
  variants: ApiProductVariant[];
  updatedAt?: number;
}

export interface CreateProductInput {
  name: string;
  price: number;
  imageUrl?: string | null;
  variants: Omit<ApiProductVariant, 'stock'>[];
}

export interface UpdateProductInput {
  name?: string;
  price?: number;
  imageUrl?: string | null;
  variants?: Omit<ApiProductVariant, 'stock'>[];
}

/**
 * GET /products — returns all active products.
 */
export async function apiGetProducts(): Promise<ApiProduct[]> {
  const response = await apiClient.get<ApiProduct[]>('products');
  return response.data;
}

/**
 * POST /products — creates a new product.
 */
export async function apiCreateProduct(data: CreateProductInput): Promise<ApiProduct> {
  const response = await apiClient.post<ApiProduct>('products', data);
  return response.data;
}

/**
 * PUT /products/:id — fully updates a product.
 */
export async function apiUpdateProduct(
  id: string,
  data: UpdateProductInput
): Promise<ApiProduct> {
  const response = await apiClient.put<ApiProduct>(`products/${id}`, data);
  return response.data;
}

/**
 * PATCH /products/:id — deactivates a product (soft delete).
 */
export async function apiDeactivateProduct(id: string): Promise<ApiProduct> {
  const response = await apiClient.patch<ApiProduct>(`products/${id}`, { active: false });
  return response.data;
}
