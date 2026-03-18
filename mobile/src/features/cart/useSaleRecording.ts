import * as Crypto from 'expo-crypto';

import { getDb } from '@/db';
import { recordSaleLocally } from '@/db/outbox';
import type { LocalSale } from '@/db/outbox';
import { updateLocalStock } from '@/db/products';
import { useCartStore } from '@/stores/cartStore';
import { useSyncStore } from '@/stores/syncStore';
import { requestSync } from '@/features/sync/SyncManager';
import { apiClient } from '@/api/client';

/**
 * Hook that encapsulates the sale recording flow.
 * All operations are local — no API calls.
 * The outbox drives sync later via background job.
 */
export function useSaleRecording() {
  const cartItems = useCartStore((state) => state.items);
  const concertId = useCartStore((state) => state.concertId);
  const currency = useCartStore((state) => state.currency);
  const discount = useCartStore((state) => state.discount);
  const discountType = useCartStore((state) => state.discountType);
  const totalFn = useCartStore((state) => state.total);
  const clearCart = useCartStore((state) => state.clearCart);
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const setPendingCount = useSyncStore((state) => state.setPendingCount);

  /**
   * Record a sale locally.
   * @param paymentMethod - payment method selected by user
   * @returns the sale ID
   */
  const recordSale = async (paymentMethod: string): Promise<string> => {
    const db = await getDb();
    const saleId = Crypto.randomUUID();
    const outboxId = Crypto.randomUUID();
    const now = Date.now();

    // Build LocalSale
    const sale: LocalSale = {
      id: saleId,
      concertId: concertId ?? '',
      items: cartItems.map((item) => ({
        productId: item.productId,
        variantSku: item.variantSku,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
      })),
      totalAmount: totalFn(),
      paymentMethod,
      currency,
      discount,
      discountType,
    };

    // Map UI payment method labels to backend enum values
    const paymentMethodMap: Record<string, string> = {
      'Cash': 'cash',
      'Card': 'card',
      'E-transfer': 'etransfer',
      'PayPal': 'paypal',
    };

    // Build outbox payload (matches API batch format)
    const outboxPayload: Record<string, unknown> = {
      saleId,
      items: sale.items,
      totalAmount: sale.totalAmount,
      paymentMethod: paymentMethodMap[paymentMethod] ?? paymentMethod.toLowerCase(),
      currency,
      discount,
      discountType,
      recordedAt: now,
    };
    // Only include concertId when it's a valid ID (backend expects ObjectId)
    if (sale.concertId) {
      outboxPayload.concertId = sale.concertId;
    }

    // 1. Atomic write: sale + outbox
    await recordSaleLocally(db, sale, {
      id: outboxId,
      type: 'sale_create',
      payload: JSON.stringify(outboxPayload),
      idempotency_key: `sale_create:${saleId}`,
      created_at: now,
    });

    // 2. Update local product stock for each item
    for (const item of cartItems) {
      await updateLocalStock(db, item.productId, item.variantSku, -item.quantity);
    }

    // 3. Clear cart
    clearCart();

    // 4. Increment sync pending count
    setPendingCount(pendingCount + 1);

    // 5. Kick off sync immediately (fire-and-forget)
    requestSync(db, apiClient);

    return saleId;
  };

  return { recordSale };
}
