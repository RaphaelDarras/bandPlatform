/**
 * Tests for SyncManager - outbox processing with batching and exponential backoff.
 * TDD RED phase - written before implementation.
 */

// Mock expo-router (needed for test environment)
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

import { requestSync, startPeriodicSync, stopPeriodicSync, _resetSyncState } from '@/features/sync/SyncManager';
import * as outboxModule from '@/db/outbox';
import { useSyncStore } from '@/stores/syncStore';

// Mock outbox module
jest.mock('@/db/outbox', () => ({
  SHOPIFY_STOCK: 'shopify_stock',
  SALE_APPLIED: 'sale_applied',
  SALE_SET_VOIDED: 'sale_set_voided',
  markOutboxFailed: jest.fn(() => Promise.resolve()),
  getPendingOutboxRows: jest.fn(() => Promise.resolve([])),
  markOutboxDone: jest.fn(() => Promise.resolve()),
  markOutboxDoneIfPayload: jest.fn(() => Promise.resolve()),
  incrementAttempt: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/features/sync/shopifyStockOps', () => ({ executeStockOp: jest.fn() }));
jest.mock('@/api/sales', () => ({
  apiUpdateSale: jest.fn(() => Promise.resolve()),
  apiPatchSaleApplied: jest.fn(() => Promise.resolve()),
}));

// Mock apiClient
jest.mock('@/api/client', () => ({
  apiClient: {
    post: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Mock syncStore
const mockSyncStore = {
  pendingCount: 0,
  consecutiveFailures: 0,
  isOnline: true,
  lastSyncAt: null,
  setPendingCount: jest.fn(),
  setLastSyncAt: jest.fn(),
  incrementFailures: jest.fn(),
  resetFailures: jest.fn(),
  setIsOnline: jest.fn(),
};

jest.mock('@/stores/syncStore', () => ({
  useSyncStore: {
    getState: jest.fn(() => mockSyncStore),
  },
}));

import { executeStockOp } from '@/features/sync/shopifyStockOps';
import { apiPatchSaleApplied } from '@/api/sales';
const mockExecuteStockOp = executeStockOp as jest.Mock;
const mockPatchApplied = apiPatchSaleApplied as jest.Mock;
const mockGetPendingOutboxRows = outboxModule.getPendingOutboxRows as jest.Mock;
const mockMarkOutboxDone = outboxModule.markOutboxDone as jest.Mock;
const mockMarkDoneIfPayload = outboxModule.markOutboxDoneIfPayload as jest.Mock;
const mockIncrementAttempt = outboxModule.incrementAttempt as jest.Mock;

// Build mock outbox rows
function makeOutboxRow(overrides: Partial<{
  id: string;
  type: string;
  payload: string;
  idempotency_key: string;
  status: 'pending' | 'done' | 'failed';
  attempt_count: number;
  next_attempt_at: number;
  created_at: number;
}> = {}) {
  return {
    id: 'row-1',
    type: 'sale_create',
    payload: JSON.stringify({ id: 'sale-1', items: [], totalAmount: 50, concertId: 'c-1' }),
    idempotency_key: 'idem-1',
    status: 'pending' as const,
    attempt_count: 0,
    next_attempt_at: 0,
    created_at: Date.now() - 1000,
    ...overrides,
  };
}

// Build a mock db
const mockDb = {
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  execAsync: jest.fn(() => Promise.resolve()),
  withTransactionAsync: jest.fn((fn: () => Promise<void>) => fn()),
};

// Build a mock apiClient
const mockApiClient = {
  post: jest.fn(() => Promise.resolve({ data: {} })),
};

beforeEach(() => {
  jest.clearAllMocks();
  _resetSyncState(); // Reset singleton syncInProgress guard between tests
  // Restore useSyncStore.getState implementation after clearAllMocks clears it
  (useSyncStore.getState as jest.Mock).mockReturnValue(mockSyncStore);
  // Use mockReset on getPendingOutboxRows to clear any queued Once implementations from prior tests
  mockGetPendingOutboxRows.mockReset();
  mockGetPendingOutboxRows.mockResolvedValue([]);
  mockMarkOutboxDone.mockResolvedValue(undefined);
  mockIncrementAttempt.mockResolvedValue(undefined);
  mockApiClient.post.mockReset();
  mockApiClient.post.mockResolvedValue({ data: {} });
  mockSyncStore.consecutiveFailures = 0;
  mockSyncStore.pendingCount = 0;
  mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });
  mockDb.getAllAsync.mockResolvedValue([]);
  mockDb.getFirstAsync.mockResolvedValue(null);
  mockDb.execAsync.mockResolvedValue(undefined);
  mockDb.withTransactionAsync.mockImplementation((fn: () => Promise<void>) => fn());
});

describe('requestSync — basic processing', () => {
  it('returns early when there are no pending outbox rows', async () => {
    mockGetPendingOutboxRows.mockResolvedValue([]);

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockMarkOutboxDone).not.toHaveBeenCalled();
    expect(mockApiClient.post).not.toHaveBeenCalled();
  });

  it('processes pending sale_create rows and calls POST /sales/batch', async () => {
    const row = makeOutboxRow({ id: 'row-1', type: 'sale_create' });
    mockGetPendingOutboxRows.mockResolvedValue([row]);

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      expect.stringContaining('sales/batch'),
      expect.any(Object)
    );
  });

  it('marks outbox row as done after successful sync', async () => {
    const row = makeOutboxRow({ id: 'row-1', type: 'sale_create' });
    mockGetPendingOutboxRows.mockResolvedValue([row]);
    mockApiClient.post.mockResolvedValue({ data: { synced: 1 } });

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'row-1');
  });

  it('increments attempt with exponential backoff on failure', async () => {
    const row = makeOutboxRow({ id: 'row-1', type: 'sale_create', attempt_count: 1 });
    mockGetPendingOutboxRows.mockResolvedValue([row]);
    mockApiClient.post.mockRejectedValue(new Error('Network error'));

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockIncrementAttempt).toHaveBeenCalledWith(
      mockDb,
      'row-1',
      expect.any(Number) // next_attempt_at
    );
    // Verify exponential backoff: delay = min(1000 * 2^attempt_count, 30000)
    const callArgs = mockIncrementAttempt.mock.calls[0];
    const nextAttemptAt = callArgs[2] as number;
    const expectedDelay = Math.min(1000 * Math.pow(2, 1), 30000); // 2000ms for attempt 1
    expect(nextAttemptAt).toBeGreaterThanOrEqual(Date.now() + expectedDelay - 100);
  });

  it('batches multiple sale_create rows together in a single POST', async () => {
    const rows = [
      makeOutboxRow({ id: 'row-1', type: 'sale_create', payload: JSON.stringify({ id: 'sale-1', items: [], totalAmount: 10, concertId: 'c-1' }) }),
      makeOutboxRow({ id: 'row-2', type: 'sale_create', idempotency_key: 'idem-2', payload: JSON.stringify({ id: 'sale-2', items: [], totalAmount: 20, concertId: 'c-1' }) }),
    ];
    mockGetPendingOutboxRows.mockResolvedValue(rows);
    mockApiClient.post.mockResolvedValue({ data: { synced: 2 } });

    await requestSync(mockDb as never, mockApiClient as never);

    // Should only call POST once (batched) for sale_create
    const batchCalls = mockApiClient.post.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('sales/batch')
    );
    expect(batchCalls).toHaveLength(1);

    // Both rows should be marked done
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'row-1');
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'row-2');
  });

  it('updates pendingCount in syncStore after sync run', async () => {
    const row = makeOutboxRow({ id: 'row-1', type: 'sale_create' });
    mockGetPendingOutboxRows
      .mockResolvedValueOnce([row]) // first call returns pending rows
      .mockResolvedValueOnce([]); // after processing, 0 pending

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockSyncStore.setPendingCount).toHaveBeenCalledWith(0);
  });
});

describe('requestSync — concurrent sync prevention', () => {
  it('prevents concurrent sync (second call returns early while first is running)', async () => {
    let resolveFirstPost: ((value: { data: Record<string, unknown> }) => void) | null = null;
    mockApiClient.post.mockReturnValueOnce(
      new Promise<{ data: Record<string, unknown> }>((resolve) => { resolveFirstPost = resolve; })
    );

    const row1 = makeOutboxRow({ id: 'row-1', type: 'sale_create' });
    const row2 = makeOutboxRow({ id: 'row-2', type: 'sale_create', idempotency_key: 'idem-2' });
    mockGetPendingOutboxRows.mockResolvedValue([row1, row2]);

    // Start first sync (will hang on post)
    const firstSync = requestSync(mockDb as never, mockApiClient as never);
    // Start second sync immediately (should return early)
    const secondSync = requestSync(mockDb as never, mockApiClient as never);

    // Resolve first sync
    if (resolveFirstPost) {
      (resolveFirstPost as (value: { data: Record<string, unknown> }) => void)({ data: {} });
    }

    await Promise.all([firstSync, secondSync]);

    // One run = initial query + pending-count re-query; the guarded second call adds none
    expect(mockGetPendingOutboxRows).toHaveBeenCalledTimes(2);
  });
});

describe('requestSync — failure alerting', () => {
  it('triggers alert flag after 3 consecutive failures', async () => {
    mockSyncStore.consecutiveFailures = 3;

    const row = makeOutboxRow({ id: 'row-1', type: 'sale_create' });
    mockGetPendingOutboxRows.mockResolvedValue([row]);
    mockApiClient.post.mockRejectedValue(new Error('Network error'));

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockSyncStore.incrementFailures).toHaveBeenCalled();
    // With consecutiveFailures >= 3, the store should be consulted for alert
    // The sync manager increments and checks after
    expect(mockSyncStore.incrementFailures).toHaveBeenCalledTimes(1);
  });

  it('resets consecutive failures on successful sync', async () => {
    const row = makeOutboxRow({ id: 'row-1', type: 'sale_create' });
    mockGetPendingOutboxRows.mockResolvedValue([row]);
    mockApiClient.post.mockResolvedValue({ data: { synced: 1 } });

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockSyncStore.resetFailures).toHaveBeenCalled();
  });
});

describe('requestSync — sale_void and sale_unvoid', () => {
  it('calls POST /sales/:id/void for sale_void type', async () => {
    const row = makeOutboxRow({
      id: 'row-1',
      type: 'sale_void',
      payload: JSON.stringify({ saleId: 'sale-abc' }),
    });
    mockGetPendingOutboxRows.mockResolvedValue([row]);

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      expect.stringContaining('sales/sale-abc/void'),
      expect.anything()
    );
    expect(mockMarkDoneIfPayload).toHaveBeenCalledWith(mockDb, 'row-1', row.payload);
  });

  it('calls POST /sales/:id/unvoid for sale_unvoid type', async () => {
    const row = makeOutboxRow({
      id: 'row-1',
      type: 'sale_unvoid',
      payload: JSON.stringify({ saleId: 'sale-xyz' }),
    });
    mockGetPendingOutboxRows.mockResolvedValue([row]);

    await requestSync(mockDb as never, mockApiClient as never);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      expect.stringContaining('sales/sale-xyz/unvoid'),
      expect.anything()
    );
    expect(mockMarkDoneIfPayload).toHaveBeenCalledWith(mockDb, 'row-1', row.payload);
  });
});

describe('requestSync — shopify_stock and sale_applied', () => {
  const stockRow = (id: string, created: number) =>
    makeOutboxRow({ id, type: 'shopify_stock', payload: '{}', created_at: created });

  beforeEach(() => {
    mockExecuteStockOp.mockReset();
    mockExecuteStockOp.mockResolvedValue('done');
    mockPatchApplied.mockReset();
    mockPatchApplied.mockResolvedValue(undefined);
  });

  it('posts sale_create and executes the stock row', async () => {
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'a', type: 'sale_create' }),
      stockRow('s1', 2),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockApiClient.post).toHaveBeenCalledWith(expect.stringContaining('sales/batch'), expect.any(Object));
    expect(mockExecuteStockOp).toHaveBeenCalledTimes(1);
    expect(mockExecuteStockOp.mock.calls[0][1].id).toBe('s1');
  });

  it('stock op failure does not block sale_create nor touch the API indicator', async () => {
    mockExecuteStockOp.mockRejectedValue(new Error('shopify down'));
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'a', type: 'sale_create' }),
      stockRow('s1', 2),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'a');
    expect(mockSyncStore.incrementFailures).not.toHaveBeenCalled();
    expect(mockSyncStore.setIsOnline).not.toHaveBeenCalledWith(false);
  });

  it('only-stock outbox with Shopify failing leaves API indicator unchanged', async () => {
    mockExecuteStockOp.mockRejectedValue(new Error('x'));
    mockGetPendingOutboxRows.mockResolvedValue([stockRow('s1', 1)]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockSyncStore.incrementFailures).not.toHaveBeenCalled();
    expect(mockSyncStore.setIsOnline).not.toHaveBeenCalled();
  });

  it('executes stock rows sequentially in order', async () => {
    const order: string[] = [];
    let release: () => void = () => {};
    mockExecuteStockOp.mockImplementation((_db: unknown, r: { id: string }) => {
      order.push('start:' + r.id);
      if (r.id === 's1') {
        return new Promise<string>((res) => {
          release = () => { order.push('end:s1'); res('done'); };
        });
      }
      order.push('end:' + r.id);
      return Promise.resolve('done');
    });
    mockGetPendingOutboxRows.mockResolvedValue([stockRow('s1', 1), stockRow('s2', 2)]);
    const p = requestSync(mockDb as never, mockApiClient as never);
    await new Promise<void>((r) => setImmediate(() => r()));
    expect(order).toEqual(['start:s1']);
    release();
    await p;
    expect(order).toEqual(['start:s1', 'end:s1', 'start:s2', 'end:s2']);
  });

  it('sale_applied calls apiPatchSaleApplied then marks done', async () => {
    const lines = [{ lineIndex: 0, appliedDelta: -1 }];
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'sa', type: 'sale_applied', payload: JSON.stringify({ saleId: 'sale-1', lines }) }),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockPatchApplied).toHaveBeenCalledWith('sale-1', lines);
    // done only if the row still carries the value that was sent (CR-03)
    expect(mockMarkDoneIfPayload).toHaveBeenCalledWith(
      mockDb,
      'sa',
      JSON.stringify({ saleId: 'sale-1', lines })
    );
    expect(mockMarkOutboxDone).not.toHaveBeenCalledWith(mockDb, 'sa');
  });

  it('sale_applied 404 backs off and stays pending', async () => {
    mockPatchApplied.mockRejectedValue({ response: { status: 404 } });
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'sa', type: 'sale_applied', payload: JSON.stringify({ saleId: 'sale-1', lines: [] }) }),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockIncrementAttempt).toHaveBeenCalledWith(mockDb, 'sa', expect.any(Number));
    expect(mockMarkOutboxDone).not.toHaveBeenCalledWith(mockDb, 'sa');
  });
});

describe('startPeriodicSync / stopPeriodicSync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    stopPeriodicSync();
  });

  it('startPeriodicSync sets up a 60s interval', () => {
    startPeriodicSync(mockDb as never, mockApiClient as never);
    // Advance 60 seconds
    jest.advanceTimersByTime(60000);
    // getPendingOutboxRows would be called if there was work to do (empty so no-op)
    expect(mockGetPendingOutboxRows).toHaveBeenCalledTimes(1);
  });

  it('stopPeriodicSync clears the interval', () => {
    startPeriodicSync(mockDb as never, mockApiClient as never);
    stopPeriodicSync();
    jest.advanceTimersByTime(120000);
    // No calls after stopping
    expect(mockGetPendingOutboxRows).not.toHaveBeenCalled();
  });
});

describe('requestSync — sale_set_voided and permanent API errors (CR-06)', () => {
  const mockMarkFailed = outboxModule.markOutboxFailed as jest.Mock;

  it('posts void or unvoid according to the desired state', async () => {
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'v', type: 'sale_set_voided', payload: JSON.stringify({ saleId: 's9', voided: true }) }),
      makeOutboxRow({ id: 'u', type: 'sale_set_voided', payload: JSON.stringify({ saleId: 's8', voided: false }) }),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockApiClient.post).toHaveBeenCalledWith('sales/s9/void', {});
    expect(mockApiClient.post).toHaveBeenCalledWith('sales/s8/unvoid', {});
  });

  it('marks a 400-rejected op failed instead of retrying forever', async () => {
    mockApiClient.post.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Sale already voided' } } });
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'v', type: 'sale_void', payload: JSON.stringify({ saleId: 's9' }) }),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockMarkFailed).toHaveBeenCalledWith(mockDb, 'v');
    expect(mockIncrementAttempt).not.toHaveBeenCalledWith(mockDb, 'v', expect.any(Number));
  });

  it('keeps retrying 404 (sale not synced yet) and 5xx', async () => {
    mockApiClient.post
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockRejectedValueOnce({ response: { status: 503 } });
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'a', type: 'sale_set_voided', payload: JSON.stringify({ saleId: 's1', voided: true }) }),
      makeOutboxRow({ id: 'b', type: 'sale_set_voided', payload: JSON.stringify({ saleId: 's2', voided: true }) }),
    ]);
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockIncrementAttempt).toHaveBeenCalledWith(mockDb, 'a', expect.any(Number));
    expect(mockIncrementAttempt).toHaveBeenCalledWith(mockDb, 'b', expect.any(Number));
  });
});

describe('requestSync — per-sale batch results (WR-01)', () => {
  const mockMarkFailed = outboxModule.markOutboxFailed as jest.Mock;

  it('marks created/skipped rows done and invalid rows failed', async () => {
    mockGetPendingOutboxRows.mockResolvedValue([
      makeOutboxRow({ id: 'r1', type: 'sale_create', idempotency_key: 'sale_create:a' }),
      makeOutboxRow({ id: 'r2', type: 'sale_create', idempotency_key: 'sale_create:b' }),
      makeOutboxRow({ id: 'r3', type: 'sale_create', idempotency_key: 'sale_create:c' }),
      makeOutboxRow({ id: 'r4', type: 'sale_create', idempotency_key: 'sale_create:d' }),
    ]);
    mockApiClient.post.mockResolvedValueOnce({
      data: {
        results: [
          { idempotencyKey: 'sale_create:a', status: 'created' },
          { idempotencyKey: 'sale_create:b', status: 'invalid' },
          { idempotencyKey: 'sale_create:c', status: 'skipped' },
        ],
      },
    });
    await requestSync(mockDb as never, mockApiClient as never);
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'r1');
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'r3');
    expect(mockMarkFailed).toHaveBeenCalledWith(mockDb, 'r2');
    expect(mockMarkOutboxDone).not.toHaveBeenCalledWith(mockDb, 'r2');
    // no result: stays pending
    expect(mockMarkOutboxDone).not.toHaveBeenCalledWith(mockDb, 'r4');
    expect(mockMarkFailed).not.toHaveBeenCalledWith(mockDb, 'r4');
  });
});
