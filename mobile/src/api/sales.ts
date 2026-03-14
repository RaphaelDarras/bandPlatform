import { apiClient } from './client';

export interface ApiSale {
  id: string;
  concertId: string;
  totalAmount: number;
  paymentMethod: string;
  currency: string;
  discount: number;
  discountType: 'flat' | 'percent';
  voided: boolean;
  createdAt: string;
  items: Array<{
    productId: string;
    variantSku: string;
    quantity: number;
    priceAtSale: number;
  }>;
}

/**
 * GET /sales?concertId=xxx — list sales, optionally filtered by concert.
 */
export async function apiGetSales(concertId?: string): Promise<ApiSale[]> {
  const params = concertId ? { concertId } : {};
  const { data } = await apiClient.get<ApiSale[]>('/sales', { params });
  return data;
}

/**
 * POST /sales/:id/void — void a sale on the server.
 */
export async function apiVoidSale(id: string): Promise<void> {
  await apiClient.post(`/sales/${id}/void`);
}

/**
 * POST /sales/:id/unvoid — unvoid a sale on the server.
 */
export async function apiUnvoidSale(id: string): Promise<void> {
  await apiClient.post(`/sales/${id}/unvoid`);
}
