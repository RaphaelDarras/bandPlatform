/**
 * Inventory API functions.
 * Requires authentication (apiClient injects JWT automatically).
 */
import { apiClient } from '@/api/client';
import type { CachedProduct } from '@/db/products';

/**
 * GET /inventory/stock — returns all products with per-variant stock counts.
 */
export async function apiGetStock(): Promise<CachedProduct[]> {
  const response = await apiClient.get<CachedProduct[]>('inventory/stock');
  return response.data;
}

/**
 * POST /inventory/restock — adds stock to a specific product variant.
 */
export async function apiRestock(
  productId: string,
  variantSku: string,
  quantity: number,
  reason: string
): Promise<{ success: boolean }> {
  const response = await apiClient.post<{ success: boolean }>('inventory/restock', {
    productId,
    variantSku,
    quantity,
    reason,
  });
  return response.data;
}
