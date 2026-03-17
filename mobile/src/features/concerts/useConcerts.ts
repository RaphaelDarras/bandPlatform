import { useCallback, useState } from 'react';
import * as Crypto from 'expo-crypto';
import NetInfo from '@react-native-community/netinfo';

import { getDb } from '@/db';
import type { CachedConcert } from '@/db/concerts';
import {
  getCachedConcerts,
  getConcertById,
  upsertConcert,
  upsertConcerts,
  updateConcertActive,
} from '@/db/concerts';
import type { CreateConcertData } from '@/api/concerts';
import {
  apiGetConcerts,
  apiCreateConcert,
  apiPatchConcert,
} from '@/api/concerts';
import { getLocalSales } from '@/db/sales';

export interface ConcertTotals {
  totalRevenue: number;
  transactionCount: number;
  itemsSold: number;
}

export function useConcerts() {
  const [concerts, setConcerts] = useState<CachedConcert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Returns the currently active concert (if any).
   */
  const activeConcert = concerts.find((c) => c.active === 1) ?? null;

  /**
   * Loads concerts: fetches from API if online and upserts to cache,
   * otherwise reads from local SQLite cache.
   */
  const loadConcerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = await getDb();
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        try {
          const apiConcerts = await apiGetConcerts();
          const now = Date.now();
          const mapped: CachedConcert[] = apiConcerts.map((c) => ({
            id: c.id,
            venue: c.venue ?? null,
            country: c.country ?? '',
            city: c.city ?? null,
            date: c.date ? new Date(c.date).getTime() : now,
            active: c.active ? 1 : 0,
            updated_at: c.updatedAt ? new Date(c.updatedAt).getTime() : now,
          }));
          await upsertConcerts(db, mapped);
          // Prune local rows that no longer exist on the server
          const serverIds = mapped.map((c) => c.id);
          if (serverIds.length > 0) {
            const placeholders = serverIds.map(() => '?').join(',');
            await db.runAsync(
              `DELETE FROM concerts WHERE id NOT IN (${placeholders})`,
              serverIds
            );
          } else {
            await db.runAsync('DELETE FROM concerts');
          }
        } catch (apiErr) {
          console.warn('[useConcerts] API fetch failed, falling back to cache:', apiErr);
        }
      }

      const cached = await getCachedConcerts(db);
      setConcerts(cached);
    } catch (err) {
      console.error('[useConcerts] loadConcerts error:', err);
      setError('Failed to load concerts');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Creates a new concert.
   * If online: POST to API + upsert locally.
   * If offline: create in SQLite with a local UUID.
   */
  const createConcert = useCallback(
    async (data: CreateConcertData): Promise<CachedConcert> => {
      const db = await getDb();
      const netState = await NetInfo.fetch();
      const now = Date.now();

      if (netState.isConnected) {
        const apiConcert = await apiCreateConcert(data);
        const cached: CachedConcert = {
          id: apiConcert.id,
          venue: apiConcert.venue ?? null,
          country: apiConcert.country ?? '',
          city: apiConcert.city ?? null,
          date: apiConcert.date ? new Date(apiConcert.date).getTime() : now,
          active: apiConcert.active ? 1 : 0,
          updated_at: apiConcert.updatedAt ? new Date(apiConcert.updatedAt).getTime() : now,
        };
        await upsertConcert(db, cached);
        return cached;
      } else {
        // Offline: create locally with UUID
        const localId = Crypto.randomUUID();
        const dateTs = data.date ? new Date(data.date).getTime() : now;
        const localConcert: CachedConcert = {
          id: localId,
          venue: data.venue ?? null,
          country: data.country ?? '',
          city: data.city ?? null,
          date: dateTs,
          active: 1,
          updated_at: now,
        };
        await upsertConcert(db, localConcert);
        return localConcert;
      }
    },
    []
  );

  /**
   * Closes a concert: PATCH API { active: false } + update local cache.
   * Returns totals summary (revenue, transaction count, items sold).
   */
  const closeConcert = useCallback(
    async (id: string): Promise<ConcertTotals> => {
      const db = await getDb();
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        try {
          await apiPatchConcert(id, { active: false });
        } catch (err) {
          console.warn('[useConcerts] API patch failed for close, updating locally only:', err);
        }
      }

      await updateConcertActive(db, id, false);

      // Calculate totals from local sales
      const sales = await getLocalSales(db, id);
      const nonVoided = sales.filter((s) => !s.voided);
      // Note: SQLite returns total_amount as snake_case column; LocalSaleRow types it as totalAmount
      // but the actual DB row has snake_case keys. Cast to access actual column.
      const totalRevenue = nonVoided.reduce(
        (sum, s) => sum + ((s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0),
        0
      );
      const transactionCount = nonVoided.length;
      const itemsSold = nonVoided.reduce((sum, s) => {
        const items = JSON.parse(s.items_json ?? '[]') as Array<{ quantity: number }>;
        return sum + items.reduce((iSum, item) => iSum + item.quantity, 0);
      }, 0);

      return { totalRevenue, transactionCount, itemsSold };
    },
    []
  );

  /**
   * Reopens a closed concert.
   */
  const reopenConcert = useCallback(
    async (id: string): Promise<void> => {
      const db = await getDb();
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        try {
          await apiPatchConcert(id, { active: true });
        } catch (err) {
          console.warn('[useConcerts] API patch failed for reopen, updating locally only:', err);
        }
      }

      await updateConcertActive(db, id, true);
    },
    []
  );

  /**
   * Returns totals for a concert (used for display on closed concert detail).
   */
  const getConcertTotals = useCallback(async (id: string): Promise<ConcertTotals> => {
    const db = await getDb();
    const sales = await getLocalSales(db, id);
    const nonVoided = sales.filter((s) => !s.voided);
    const totalRevenue = nonVoided.reduce(
      (sum, s) => sum + ((s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0),
      0
    );
    const transactionCount = nonVoided.length;
    const itemsSold = nonVoided.reduce((sum, s) => {
      const items = JSON.parse(s.items_json ?? '[]') as Array<{ quantity: number }>;
      return sum + items.reduce((iSum, item) => iSum + item.quantity, 0);
    }, 0);
    return { totalRevenue, transactionCount, itemsSold };
  }, []);

  return {
    concerts,
    loading,
    error,
    activeConcert,
    loadConcerts,
    createConcert,
    closeConcert,
    reopenConcert,
    getConcertTotals,
  };
}
