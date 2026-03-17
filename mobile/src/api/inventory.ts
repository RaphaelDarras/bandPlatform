/**
 * Inventory API functions.
 * Requires authentication (apiClient injects JWT automatically).
 */
import { apiClient } from '@/api/client';
import type { CachedProduct } from '@/db/products';

interface StockVariant {
  sku: string;
  size?: string | null;
  color?: string | null;
  stock: number;
}

interface StockProduct {
  productId: string;
  name: string;
  variants: StockVariant[];
}

interface StockResponse {
  grandTotal: number;
  productCount: number;
  products: StockProduct[];
}

/**
 * GET /inventory/stock — returns all products with per-variant stock counts.
 */
export async function apiGetStock(): Promise<CachedProduct[]> {
  const response = await apiClient.get<StockResponse>('inventory/stock');
  return response.data.products.map((p) => ({
    id: String(p.productId),
    name: p.name,
    price: 0,
    imageUrl: null,
    active: 1,
    updatedAt: Date.now(),
    variants: p.variants.map((v) => ({
      sku: v.sku,
      label: [v.size, v.color].filter(Boolean).join(' / ') || v.sku,
      priceAdjustment: 0,
      stock: v.stock,
    })),
  }));
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
