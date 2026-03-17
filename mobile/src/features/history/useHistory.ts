import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { getDb } from '@/db';
import type { LocalSaleRow } from '@/db/sales';
import { getLocalSales, voidLocalSale, unvoidLocalSale } from '@/db/sales';
import { updateLocalStock } from '@/db/products';
import { getCachedConcerts } from '@/db/concerts';
import { apiVoidSale, apiUnvoidSale } from '@/api/sales';

/**
 * A parsed sale with items as an array (not raw JSON).
 */
export interface SaleWithItems extends LocalSaleRow {
  parsedItems: Array<{
    productId: string;
    variantSku: string;
    quantity: number;
    priceAtSale: number;
  }>;
}

/**
 * Hook for loading transaction history from local SQLite.
 *
 * Groups sales by concertId, sorted newest first within each group.
 * Provides voidSale and unvoidSale actions with local stock adjustment and outbox entries.
 */
export function useHistory() {
  const [salesByGroup, setSalesByGroup] = useState<Record<string, SaleWithItems[]>>({});
  const [concertNames, setConcertNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  /**
   * Loads transaction history from SQLite.
   * Optionally filtered by concertId.
   * Groups sales by concertId, sorted newest first within each group.
   */
  const loadHistory = useCallback(async (concertFilter?: string) => {
    setLoading(true);
    try {
      const db = await getDb();

      // Load sales from SQLite
      const rows = await getLocalSales(db, concertFilter);

      // Parse items_json for each row
      const sales: SaleWithItems[] = rows.map((row) => ({
        ...row,
        parsedItems: JSON.parse(row.items_json ?? '[]') as SaleWithItems['parsedItems'],
      }));

      // Group by concertId
      const groups: Record<string, SaleWithItems[]> = {};
      for (const sale of sales) {
        const cid = sale.concertId;
        if (!groups[cid]) groups[cid] = [];
        groups[cid].push(sale);
      }

      // Sort each group by created_at desc (newest first)
      for (const cid of Object.keys(groups)) {
        groups[cid].sort((a, b) => b.created_at - a.created_at);
      }

      setSalesByGroup(groups);

      // Load concert names from cache
      const concerts = await getCachedConcerts(db);
      const names: Record<string, string> = {};
      for (const c of concerts) {
        names[c.id] = c.name;
      }
      setConcertNames(names);
    } catch (err) {
      console.error('[useHistory] loadHistory error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Voids a sale locally and adds an outbox entry for API sync.
   * Also reverses local stock (adds items back).
   * If online, immediately calls the API void endpoint.
   */
  const voidSale = useCallback(async (saleId: string) => {
    const db = await getDb();

    // Find the sale in current state to get items
    let sale: SaleWithItems | undefined;
    for (const group of Object.values(salesByGroup)) {
      sale = group.find((s) => s.id === saleId);
      if (sale) break;
    }

    // 1. Void in SQLite
    await voidLocalSale(db, saleId);

    // 2. Reverse local stock (add items back)
    if (sale) {
      for (const item of sale.parsedItems) {
        await updateLocalStock(db, item.productId, item.variantSku, item.quantity);
      }
    }

    // 3. Add outbox entry for background API sync
    const outboxId = Crypto.randomUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
      [
        outboxId,
        'sale_void',
        JSON.stringify({ saleId }),
        `sale_void:${saleId}`,
        now,
      ]
    );

    // 4. Try immediate API call (best effort — outbox handles retry if offline)
    try {
      await apiVoidSale(saleId);
    } catch {
      // Offline or API error — outbox will sync later
    }

    // 5. Reload history
    await loadHistory();
  }, [salesByGroup, loadHistory]);

  /**
   * Unvoids a sale locally and adds an outbox entry for API sync.
   * Also re-deducts local stock.
   * If online, immediately calls the API unvoid endpoint.
   */
  const unvoidSale = useCallback(async (saleId: string) => {
    const db = await getDb();

    // Find the sale in current state to get items
    let sale: SaleWithItems | undefined;
    for (const group of Object.values(salesByGroup)) {
      sale = group.find((s) => s.id === saleId);
      if (sale) break;
    }

    // 1. Unvoid in SQLite
    await unvoidLocalSale(db, saleId);

    // 2. Re-deduct local stock (apply sale again)
    if (sale) {
      for (const item of sale.parsedItems) {
        await updateLocalStock(db, item.productId, item.variantSku, -item.quantity);
      }
    }

    // 3. Add outbox entry for background API sync
    const outboxId = Crypto.randomUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
      [
        outboxId,
        'sale_unvoid',
        JSON.stringify({ saleId }),
        `sale_unvoid:${saleId}`,
        now,
      ]
    );

    // 4. Try immediate API call (best effort)
    try {
      await apiUnvoidSale(saleId);
    } catch {
      // Offline or API error — outbox will sync later
    }

    // 5. Reload history
    await loadHistory();
  }, [salesByGroup, loadHistory]);

  return {
    salesByGroup,
    concertNames,
    loading,
    loadHistory,
    voidSale,
    unvoidSale,
  };
}
