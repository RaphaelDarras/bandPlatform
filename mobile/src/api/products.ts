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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduct(p: any): ApiProduct {
  return {
    id: p._id ?? p.id,
    name: p.name,
    price: p.basePrice ?? p.price,
    imageUrl: p.images?.[0] ?? p.imageUrl ?? null,
    active: p.active,
    variants: p.variants ?? [],
    updatedAt: p.updatedAt,
  };
}

/**
 * GET /products — returns all active products.
 */
export async function apiGetProducts(): Promise<ApiProduct[]> {
  const response = await apiClient.get<unknown[]>('products');
  return response.data.map(mapProduct);
}

/**
 * POST /products — creates a new product.
 */
export async function apiCreateProduct(data: CreateProductInput): Promise<ApiProduct> {
  const { price, ...rest } = data;
  const response = await apiClient.post<unknown>('products', { ...rest, basePrice: price });
  return mapProduct(response.data);
}

/**
 * PUT /products/:id — fully updates a product.
 */
export async function apiUpdateProduct(
  id: string,
  data: UpdateProductInput
): Promise<ApiProduct> {
  const { price, ...rest } = data;
  const body = price !== undefined ? { ...rest, basePrice: price } : rest;
  const response = await apiClient.put<unknown>(`products/${id}`, body);
  return mapProduct(response.data);
}

/**
 * PATCH /products/:id — deactivates a product (soft delete).
 */
export async function apiDeactivateProduct(id: string): Promise<ApiProduct> {
  const response = await apiClient.patch<unknown>(`products/${id}`, { active: false });
  return mapProduct(response.data);
}
