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
import { getCachedProducts } from '@/db/products';
import type { LocalSaleItem } from '@/db/outbox';

export interface ConcertTotals {
  revenuesByCurrency: Record<string, number>;
  transactionCount: number;
  itemsSold: number;
}

export interface VariantSaleBreakdown {
  productId: string;
  productName: string;
  variantSku: string;
  variantLabel: string;
  quantitySold: number;
  revenue: number;
  currency: string;
}

export interface PaymentMethodBreakdown {
  method: string;        // normalised lowercase: 'cash', 'card', 'e-transfer', 'paypal'
  displayLabel: string;  // human-readable: 'Cash', 'Card', 'E-transfer', 'PayPal'
  revenue: number;
  currency: string;
  transactionCount: number;
}

export interface ConcertReport extends ConcertTotals {
  variantBreakdowns: VariantSaleBreakdown[];
  paymentBreakdowns: PaymentMethodBreakdown[];
  voidedCount: number;
  voidedRevenue: number;
}

const PAYMENT_DISPLAY_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  'e-transfer': 'E-transfer',
  etransfer: 'E-transfer',
  paypal: 'PayPal',
};

function toDisplayLabel(raw: string): string {
  const normalised = raw.toLowerCase();
  if (PAYMENT_DISPLAY_LABELS[normalised]) {
    return PAYMENT_DISPLAY_LABELS[normalised];
  }
  // Title-case fallback
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * Standalone function that computes a full concert report from local SQLite data.
 * Can be called outside the hook for testability.
 */
export async function getConcertReport(concertId: string): Promise<ConcertReport> {
  const db = await getDb();
  const allSales = await getLocalSales(db, concertId);
  const products = await getCachedProducts(db);

  // Build product+variant lookup map
  const productMap = new Map<string, { productName: string; variantLabel: string }>();
  for (const product of products) {
    for (const variant of product.variants) {
      productMap.set(`${product.id}:${variant.sku}`, {
        productName: product.name,
        variantLabel: variant.label,
      });
    }
  }

  // Split into voided and non-voided
  const nonVoided = allSales.filter((s) => !s.voided);
  const voided = allSales.filter((s) => s.voided);

  // Compute ConcertTotals from non-voided
  const revenuesByCurrency: Record<string, number> = {};
  for (const s of nonVoided) {
    const amount = (s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0;
    const currency = s.currency || 'EUR';
    revenuesByCurrency[currency] = (revenuesByCurrency[currency] ?? 0) + amount;
  }
  const transactionCount = nonVoided.length;
  const itemsSold = nonVoided.reduce((sum, s) => {
    const items = JSON.parse(s.items_json ?? '[]') as Array<{ quantity: number }>;
    return sum + items.reduce((iSum, item) => iSum + item.quantity, 0);
  }, 0);

  // Compute variant breakdowns from non-voided, distributing sale-level discount proportionally
  const variantMap = new Map<string, VariantSaleBreakdown>();
  for (const s of nonVoided) {
    const currency = s.currency || 'EUR';
    const items = JSON.parse(s.items_json ?? '[]') as LocalSaleItem[];

    // Compute discount ratio for this sale
    const subtotal = items.reduce((sum, i) => sum + i.priceAtSale * i.quantity, 0);
    const rawDiscount = s.discount ?? 0;
    const discountType = s.discountType ?? 'flat';
    const discountAmount = subtotal > 0
      ? (discountType === 'flat' ? rawDiscount : subtotal * (rawDiscount / 100))
      : 0;
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;

    for (const item of items) {
      const key = `${item.productId}:${item.variantSku}:${currency}`;
      const lookup = productMap.get(`${item.productId}:${item.variantSku}`);
      const grossRevenue = item.priceAtSale * item.quantity;
      const netRevenue = grossRevenue * (1 - discountRatio);
      const existing = variantMap.get(key);
      if (existing) {
        existing.quantitySold += item.quantity;
        existing.revenue += netRevenue;
      } else {
        variantMap.set(key, {
          productId: item.productId,
          productName: lookup?.productName ?? item.productId,
          variantSku: item.variantSku,
          variantLabel: lookup?.variantLabel ?? item.variantSku,
          quantitySold: item.quantity,
          revenue: netRevenue,
          currency,
        });
      }
    }
  }
  const variantBreakdowns = Array.from(variantMap.values()).sort(
    (a, b) => b.quantitySold - a.quantitySold
  );

  // Compute payment breakdowns from non-voided
  // Split payments (e.g., "Card:10.00/Cash:15.00") are parsed and distributed to individual methods
  const paymentMap = new Map<string, PaymentMethodBreakdown>();

  function addToPaymentMap(method: string, amount: number, saleCurrency: string) {
    const normalised = method.toLowerCase();
    const key = `${normalised}:${saleCurrency}`;
    const existing = paymentMap.get(key);
    if (existing) {
      existing.revenue += amount;
      existing.transactionCount += 1;
    } else {
      paymentMap.set(key, {
        method: normalised,
        displayLabel: toDisplayLabel(method),
        revenue: amount,
        currency: saleCurrency,
        transactionCount: 1,
      });
    }
  }

  for (const s of nonVoided) {
    const rawMethod = s.paymentMethod || (s as unknown as Record<string, string>)['payment_method'] || '';
    const currency = s.currency || 'EUR';
    const amount = (s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0;

    // Preferred: normalised split sale carries paymentSplit array (current format).
    if (rawMethod.toLowerCase() === 'split' && Array.isArray(s.paymentSplit) && s.paymentSplit.length > 0) {
      for (const entry of s.paymentSplit) {
        if (entry && typeof entry.amount === 'number' && !isNaN(entry.amount)) {
          addToPaymentMap(entry.method, entry.amount, currency);
        }
      }
    }
    // Legacy fallback: pre-fix local rows stored the encoded form "Card:10.00/Cash:15.00"
    // in payment_method. Keep parsing it so historical data still renders correctly.
    else if (rawMethod.includes('/') && rawMethod.includes(':')) {
      const parts = rawMethod.split('/');
      for (const part of parts) {
        const colonIdx = part.indexOf(':');
        if (colonIdx > 0) {
          const methodLabel = part.substring(0, colonIdx).trim();
          const partAmount = parseFloat(part.substring(colonIdx + 1));
          if (!isNaN(partAmount)) {
            addToPaymentMap(methodLabel, partAmount, currency);
          }
        }
      }
    } else {
      addToPaymentMap(rawMethod, amount, currency);
    }
  }

  const paymentBreakdowns = Array.from(paymentMap.values()).sort((a, b) => b.revenue - a.revenue);

  // Compute voided totals
  const voidedCount = voided.length;
  const voidedRevenue = voided.reduce((sum, s) => {
    const amount = (s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0;
    return sum + amount;
  }, 0);

  return {
    revenuesByCurrency,
    transactionCount,
    itemsSold,
    variantBreakdowns,
    paymentBreakdowns,
    voidedCount,
    voidedRevenue,
  };
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
            currency: c.currency ?? 'EUR',
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
          currency: apiConcert.currency ?? 'EUR',
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
          currency: data.currency ?? 'EUR',
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
      const revenuesByCurrency: Record<string, number> = {};
      for (const s of nonVoided) {
        const amount = (s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0;
        const currency = s.currency || 'EUR';
        revenuesByCurrency[currency] = (revenuesByCurrency[currency] ?? 0) + amount;
      }
      const transactionCount = nonVoided.length;
      const itemsSold = nonVoided.reduce((sum, s) => {
        const items = JSON.parse(s.items_json ?? '[]') as Array<{ quantity: number }>;
        return sum + items.reduce((iSum, item) => iSum + item.quantity, 0);
      }, 0);

      return { revenuesByCurrency, transactionCount, itemsSold };
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
    const revenuesByCurrency: Record<string, number> = {};
    for (const s of nonVoided) {
      const amount = (s as unknown as Record<string, number>)['total_amount'] ?? s.totalAmount ?? 0;
      const currency = s.currency || 'EUR';
      revenuesByCurrency[currency] = (revenuesByCurrency[currency] ?? 0) + amount;
    }
    const transactionCount = nonVoided.length;
    const itemsSold = nonVoided.reduce((sum, s) => {
      const items = JSON.parse(s.items_json ?? '[]') as Array<{ quantity: number }>;
      return sum + items.reduce((iSum, item) => iSum + item.quantity, 0);
    }, 0);
    return { revenuesByCurrency, transactionCount, itemsSold };
  }, []);

  const getConcertReportHook = useCallback(
    (id: string) => getConcertReport(id),
    []
  );

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
    getConcertReport: getConcertReportHook,
  };
}
