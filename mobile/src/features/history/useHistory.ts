import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';

import { getDb } from '@/db';
import type { LocalSaleRow } from '@/db/sales';
import {
  getLocalSales,
  getLocalSaleItems,
  voidLocalSale,
  unvoidLocalSale,
  reconcileSalesFromServer,
} from '@/db/sales';
import { markOutboxDone, upsertSetVoided, type LocalSaleItem } from '@/db/outbox';
import { withDbLock } from '@/db/lock';
import { enqueueVoidRestores, enqueueUnvoidDeducts } from '@/db/stockOps';
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
  parsedItems: LocalSaleItem[];
}

/**
 * Hook for loading transaction history from local SQLite.
 *
 * Groups sales by concertId, sorted newest first within each group.
 * Stock is mirrored to Shopify by shopify_stock outbox ops; void restores exactly
 * the applied delta (D-13).
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


  /** Resolve lines: SQLite row is authoritative (holds appliedDelta), then caller items, then loaded history. */
  const resolveItems = useCallback(async (
    db: Awaited<ReturnType<typeof getDb>>,
    saleId: string,
    items?: LocalSaleItem[]
  ): Promise<LocalSaleItem[]> => {
    const stored = await getLocalSaleItems(db, saleId);
    if (stored) return stored;
    if (items) return items;
    for (const group of Object.values(salesByGroup)) {
      const sale = group.find((s) => s.id === saleId);
      if (sale) return sale.parsedItems;
    }
    return [];
  }, [salesByGroup]);

  /**
   * Voids a sale locally and adds an outbox entry for the API voidedAt flag.
   * Queues Shopify restore ops for the exact applied delta (D-13) and
   * optimistically reverses local stock. If online, immediately calls the API.
   *
   * @param items - Optional fallback items when the SQLite row is unavailable.
   */
  const voidSale = useCallback(async (saleId: string, items?: LocalSaleItem[]) => {
    const db = await getDb();
    const resolvedItems = await resolveItems(db, saleId, items);

    // 1. Void in SQLite
    await voidLocalSale(db, saleId);

    // 2. Queue Shopify restores (exact applied delta) + optimistic local stock
    await enqueueVoidRestores(db, saleId, resolvedItems, Date.now());
    for (const item of resolvedItems) {
      if (!item.variantGid) continue;
      await updateLocalStock(
        db,
        item.productGid ?? '',
        item.variantGid,
        item.appliedDelta !== undefined ? -item.appliedDelta : item.quantity
      );
    }

    // 3. Add outbox entry for the API voidedAt flag
    const outboxId = Crypto.randomUUID();
    const now = Date.now();
    // Desired-state op (CR-06): replaces any earlier void/unvoid row for the
    // sale, even a done one, so the latest intent always reaches the server.
    await withDbLock(() => upsertSetVoided(db, outboxId, saleId, true, now));

    // 4. Try immediate API call (best effort — outbox handles retry if offline)
    try {
      await apiVoidSale(saleId);
      // By id: a newer void/unvoid replaced this row with a new id and stays pending.
      await withDbLock(() => markOutboxDone(db, outboxId));
    } catch {
      // Offline or API error — outbox will sync later
    }

    // 5. Reload history
    await loadHistory();
  }, [resolveItems, loadHistory]);

  /**
   * Unvoids a sale locally and adds an outbox entry for the API flag.
   * Queues clamped Shopify re-deducts and optimistically re-deducts local stock.
   *
   * @param items - Optional fallback items when the SQLite row is unavailable.
   */
  const unvoidSale = useCallback(async (saleId: string, items?: LocalSaleItem[]) => {
    const db = await getDb();
    const resolvedItems = await resolveItems(db, saleId, items);

    // 1. Unvoid in SQLite
    await unvoidLocalSale(db, saleId);

    // 2. Queue clamped Shopify re-deducts + optimistic local stock
    await enqueueUnvoidDeducts(db, saleId, resolvedItems, Date.now());
    for (const item of resolvedItems) {
      if (!item.variantGid) continue;
      await updateLocalStock(db, item.productGid ?? '', item.variantGid, -item.quantity);
    }

    // 3. Add outbox entry for the API flag
    const outboxId = Crypto.randomUUID();
    const now = Date.now();
    // Desired-state op (CR-06): replaces any earlier void/unvoid row for the
    // sale, even a done one, so the latest intent always reaches the server.
    await withDbLock(() => upsertSetVoided(db, outboxId, saleId, false, now));

    // 4. Try immediate API call (best effort)
    try {
      await apiUnvoidSale(saleId);
      // By id: a newer void/unvoid replaced this row with a new id and stays pending.
      await withDbLock(() => markOutboxDone(db, outboxId));
    } catch {
      // Offline or API error — outbox will sync later
    }

    // 5. Reload history
    await loadHistory();
  }, [resolveItems, loadHistory]);

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
