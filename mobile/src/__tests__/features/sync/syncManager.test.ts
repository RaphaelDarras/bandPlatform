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
  getPendingOutboxRows: jest.fn(() => Promise.resolve([])),
  markOutboxDone: jest.fn(() => Promise.resolve()),
  incrementAttempt: jest.fn(() => Promise.resolve()),
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

const mockGetPendingOutboxRows = outboxModule.getPendingOutboxRows as jest.Mock;
const mockMarkOutboxDone = outboxModule.markOutboxDone as jest.Mock;
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

    // getPendingOutboxRows should be called once (not twice) due to concurrent guard
    expect(mockGetPendingOutboxRows).toHaveBeenCalledTimes(1);
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
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'row-1');
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
    expect(mockMarkOutboxDone).toHaveBeenCalledWith(mockDb, 'row-1');
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
