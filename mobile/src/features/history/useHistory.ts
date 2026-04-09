import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { getDb } from '@/db';
import type { LocalSaleRow } from '@/db/sales';
import { getLocalSales, voidLocalSale, unvoidLocalSale, reconcileSalesFromServer } from '@/db/sales';
import { updateLocalStock } from '@/db/products';
import { getCachedConcerts, type CachedConcert } from '@/db/concerts';
import { apiGetSales, apiVoidSale, apiUnvoidSale } from '@/api/sales';

function concertLabel(c: CachedConcert): string {
  const location = [c.venue || c.city, c.country].filter(Boolean).join(', ');
  const date = new Date(c.date).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  return location ? `${location} — ${date}` : date;
}

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
  const [allConcertIds, setAllConcertIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Pulls sales from the server and reconciles with local SQLite.
   * Best-effort: silently falls back to local cache on failure.
   */
  const pullFromServer = useCallback(async () => {
    try {
      const db = await getDb();
      const serverSales = await apiGetSales();
      await reconcileSalesFromServer(db, serverSales);
    } catch {
      // Offline or API error — local cache is still valid
    }
  }, []);

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

      // Group by concertId — now aliased in SELECT so sale.concertId is always populated
      const groups: Record<string, SaleWithItems[]> = {};
      for (const sale of sales) {
        const cid: string = sale.concertId ?? '';
        if (!groups[cid]) groups[cid] = [];
        groups[cid].push(sale);
      }

      // Sort each group by created_at desc (newest first)
      for (const cid of Object.keys(groups)) {
        groups[cid].sort((a, b) => b.created_at - a.created_at);
      }

      setSalesByGroup(groups);

      // When loading unfiltered, record all concert IDs that have sales
      // so the dropdown options stay stable when a filter is active.
      if (concertFilter === undefined) {
        setAllConcertIds(Object.keys(groups));
      }

      // Load concert names from cache
      const concerts = await getCachedConcerts(db);
      const names: Record<string, string> = {};
      for (const c of concerts) {
        names[c.id] = concertLabel(c);
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
   *
   * @param items - Optional items array. When provided, stock reversal uses this
   *   directly instead of searching salesByGroup (which may be empty if the caller
   *   never loaded history).
   */
  const voidSale = useCallback(async (
    saleId: string,
    items?: Array<{ productId: string; variantSku: string; quantity: number }>
  ) => {
    const db = await getDb();

    // Use caller-supplied items when available; fall back to salesByGroup lookup
    let resolvedItems = items;
    if (!resolvedItems) {
      let sale: SaleWithItems | undefined;
      for (const group of Object.values(salesByGroup)) {
        sale = group.find((s) => s.id === saleId);
        if (sale) break;
      }
      resolvedItems = sale?.parsedItems;
    }

    // 1. Void in SQLite
    await voidLocalSale(db, saleId);

    // 2. Reverse local stock (add items back)
    if (resolvedItems) {
      for (const item of resolvedItems) {
        await updateLocalStock(db, item.productId, item.variantSku, item.quantity);
      }
    }

    // 3. Add outbox entry for background API sync (include items for stock delta computation)
    const outboxId = Crypto.randomUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
      [
        outboxId,
        'sale_void',
        JSON.stringify({ saleId, items: resolvedItems }),
        `sale_void:${saleId}`,
        now,
      ]
    );

    // 4. Try immediate API call (best effort — outbox handles retry if offline)
    try {
      await apiVoidSale(saleId);
      // Success — mark outbox done so refreshStock won't double-count the delta
      await db.runAsync(`UPDATE outbox SET status = 'done' WHERE id = ?`, [outboxId]);
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
   *
   * @param items - Optional items array. When provided, stock deduction uses this
   *   directly instead of searching salesByGroup.
   */
  const unvoidSale = useCallback(async (
    saleId: string,
    items?: Array<{ productId: string; variantSku: string; quantity: number }>
  ) => {
    const db = await getDb();

    // Use caller-supplied items when available; fall back to salesByGroup lookup
    let resolvedItems = items;
    if (!resolvedItems) {
      let sale: SaleWithItems | undefined;
      for (const group of Object.values(salesByGroup)) {
        sale = group.find((s) => s.id === saleId);
        if (sale) break;
      }
      resolvedItems = sale?.parsedItems;
    }

    // 1. Unvoid in SQLite
    await unvoidLocalSale(db, saleId);

    // 2. Re-deduct local stock (apply sale again)
    if (resolvedItems) {
      for (const item of resolvedItems) {
        await updateLocalStock(db, item.productId, item.variantSku, -item.quantity);
      }
    }

    // 3. Add outbox entry for background API sync (include items for stock delta computation)
    const outboxId = Crypto.randomUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
      [
        outboxId,
        'sale_unvoid',
        JSON.stringify({ saleId, items: resolvedItems }),
        `sale_unvoid:${saleId}`,
        now,
      ]
    );

    // 4. Try immediate API call (best effort)
    try {
      await apiUnvoidSale(saleId);
      // Success — mark outbox done so refreshStock won't double-count the delta
      await db.runAsync(`UPDATE outbox SET status = 'done' WHERE id = ?`, [outboxId]);
    } catch {
      // Offline or API error — outbox will sync later
    }

    // 5. Reload history
    await loadHistory();
  }, [salesByGroup, loadHistory]);

  return {
    salesByGroup,
    concertNames,
    allConcertIds,
    loading,
    loadHistory,
    pullFromServer,
    voidSale,
    unvoidSale,
  };
}
