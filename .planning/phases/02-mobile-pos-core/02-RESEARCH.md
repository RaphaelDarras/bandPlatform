# Phase 2: Mobile POS Core - Research

**Researched:** 2026-03-14 (forced re-research)
**Domain:** React Native / Expo offline-first mobile POS app
**Confidence:** HIGH (stack), MEDIUM (NativeWind v5 SDK 55 compatibility)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sales Flow & Cart UX**
- Product selection: Grid of product tiles showing product name, image thumbnail, price, and per-variant stock counts directly on the tile
- Variant selection: Bottom sheet picker for multi-variant products showing each variant with its individual stock count (e.g. "S — 3 left", "M — 12 left", "XL — 0"). Single-variant products add directly to cart on tap (no picker)
- Cart behavior: Sticky bottom bar in portrait mode showing item count + total. Tap to expand full cart with quantity controls. In selling mode, cart bar replaces the bottom tab bar navigation; back arrow in top-left exits selling mode
- Sale completion: Full review screen showing all items, quantities, total, payment method selection, currency, and discount before final confirm
- Payment methods: Cash, Card (external reader), E-transfer, PayPal — app tags which method was used, no in-app payment processing
- Discount: Manual discount field per sale on the review screen (flat amount or percentage on the whole transaction)
- Post-sale: Brief success toast, cart resets, immediately back to product grid
- Void sales: Void from transaction history detail screen. Voided sales remain visible with "VOIDED" badge. Voided sales can be unvoided (reversed)
- Per-concert price overrides: Default prices come from database. Before or during a concert, prices can be overridden for specific products — applies only to that concert session. Price overrides reset each new concert (not carried forward)
- Currency: Per-sale currency selection. EUR as default. Tapping the currency field shows a configurable list of currencies (EUR, GBP, USD, etc.)

**Concert Session Model**
- Concert selection: List of pre-created concerts (from API) plus a "+ New Concert" option for unplanned gigs
- Quick-create fields: Name, venue, date, city (4 required fields)
- Multi-device: Single device for v1, but architecture must not block multi-device support later
- Concert close: Explicit "Close Concert" button triggers final sync and shows totals-only summary (total revenue, number of transactions, items sold)

**Auth & App Entry**
- Login method: PIN only (4-6 digit numeric). Fast one-handed entry for concert environment
- Session duration: 24-hour JWT expiry
- Accounts: Single admin account (shared PIN)
- Offline login: Always allowed — PIN cached locally securely after first setup
- No lockout: Unlimited PIN attempts. Just "Wrong PIN, try again"
- Home screen: Dashboard with quick action cards after login

**Dashboard Quick Actions**
- Start/resume selling (primary action)
- Concert management (view/create/close concerts)
- Sync status indicator (online/offline/pending)
- Stock overview (per-product, per-variant quantities)
- Needs reproduction (items with negative stock deficit, red badge with count)
- Restock (navigate to separate restock screen)
- Transaction history
- Manage products (full CRUD)

**Offline Strategy & Sync**
- Concert sales never rejected: Sales always go through regardless of stock levels. If stock goes negative, items appear in "Needs Reproduction" screen showing what to reorder before fulfilling online orders
- Sync trigger: Auto sync in background when connectivity detected
- Offline indicator: Small icon in corner that changes color (online/offline). Minimal, not a full status bar
- Catalog caching: Product names and prices cached locally. No images stored offline (placeholder icons when offline)
- Local stock tracking: Optimistic local update — stock count decreases immediately on offline sale
- Data persistence: Every sale written to local storage immediately on confirmation. Survives app crashes and phone restarts
- Sync errors: Silent retry, alert only after 3 consecutive failures. Doesn't interrupt selling

**Navigation Structure**
- Bottom tab bar with 4 tabs: Dashboard, History, Stock, Settings
- Selling mode: Tab bar replaced by cart bar. Back arrow in top-left to exit selling mode and restore tab navigation
- Restock access: Button on stock screen + dashboard quick action (two entry points)
- Gestures: Standard system back gesture only, no custom swipe actions

**Transaction History**
- Organization: Grouped by concert (headers), chronological within each concert (newest first)
- Sale detail: Tap to open full breakdown — all items with quantities, prices, variant info, discount, total, payment method, currency, timestamp, and Void/Unvoid button
- Filtering: Filter by concert only (dropdown)
- Voided sales: Visible in list with "VOIDED" badge, can be unvoided

**Stock Overview**
- Layout: Expandable product rows — collapsed shows product name + total stock, tap to expand per-variant breakdown
- Low stock display: No special highlighting or sorting — just plain numbers
- Restock: Separate screen (not inline on stock overview) to prevent misclicks. Accessible from stock screen button + dashboard
- Refresh: Auto-refresh on screen open + pull-to-refresh

**Product Management**
- Access: Dashboard quick action "Manage Products"
- Capabilities: Full CRUD — add, edit, deactivate products from the app
- New product fields: Name, price, variants (size/color/SKU/price adjustment), and image upload
- Deletion: Deactivate only (hidden from sales grid, preserved for historical records)
- Connectivity: Requires internet — product changes are not queued offline

**App Appearance**
- Orientation: Portrait only
- Language: Bilingual French/English with toggle
- Theme: Dark/light mode switch
- Layout: Follow current mobile UI trends (Claude's discretion on specifics)

**Error Handling**
- Sync failures: Silent retry, alert after 3 consecutive failures
- Login failures: No lockout, unlimited PIN attempts

**Notifications (In-App Only)**
- No push notifications in v1
- Sale confirmation toast (brief success message)
- Sync complete toast ("X sales synced")
- Session expiry warning (alert 30 minutes before JWT expires)
- Sync error alert (after 3 consecutive failures)

### Claude's Discretion
- Concert reopen policy
- Auto-resume active concert behavior
- Cold-start offline handling
- Dashboard layout and card arrangement
- Back-navigation from selling mode (dashboard vs concert detail)
- Loading states, skeleton screens, error state design
- Exact spacing, typography, and color palette
- Progress bar/spinner implementations

### Deferred Ideas (OUT OF SCOPE)
- Multi-device concurrent selling at same concert — future enhancement after v1
- Push notifications — not in v1
- Data export (CSV/PDF reports) — future phase
- Card reader hardware integration — explicitly out of scope
- Per-item discounts — v1 supports whole-sale discount only
- Product image storage/CDN strategy — needs research during planning
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POS-01 | User can record sales offline without internet connectivity | Expo SQLite outbox pattern with WAL mode; atomic transaction writes sale + outbox row simultaneously |
| POS-02 | User can quickly select products with touch-friendly interface | React Native FlatList grid with Pressable tiles; @gorhom/bottom-sheet for variant picker |
| POS-03 | User can view transaction history for current concert | SQLite query by concertId with section list header pattern |
| POS-04 | User can see real-time inventory levels that sync when online | NetInfo + optimistic local stock decrement; pull-to-refresh on stock screen |
| POS-05 | User can authenticate with PIN or password | PIN-only flow; expo-secure-store for hashed PIN; offline JWT caching |
| POS-09 | User can add multiple items to a single transaction | Cart state in Zustand; MMKV persistence; survives app backgrounding |
| POS-10 | App automatically calculates transaction total based on selected items | Derived from cart state; includes variant priceAdjustment + discount (flat or percent) |
| AUTH-01 | Admin can log in to mobile POS app securely | PIN hashed with expo-crypto SHA-256, stored in expo-secure-store; JWT cached for 24h offline re-auth |
</phase_requirements>

---

## Summary

This phase builds a complete React Native / Expo mobile POS app from scratch. The app is a new sub-project inside the existing monorepo — the Node.js/MongoDB API from Phase 1 is the sync target. Phase 2 is entirely the mobile client: project setup, local database, offline-first sale recording, PIN auth, catalog/stock caching, sync queue, and all core screens.

The most critical technical challenge is the offline-first data layer. Every sale must be written atomically to local SQLite in the same transaction as the outbox entry; sync is a background process, not a gating condition. Expo SDK 55 (React Native 0.83, React 19.2) with the New Architecture mandatory is the current stable as of March 2026. Expo Router v7 ships with SDK 55.

**NativeWind v5 SDK 55 compatibility is uncertain** (v5 is documented as targeting SDK 54; SDK 55 support is unconfirmed as of March 2026). Use NativeWind v4.2.x which has verified SDK 54/55 support with the New Architecture, or use plain React Native StyleSheet with a custom theme object as a zero-risk fallback. See Standard Stack for the full recommendation.

The API layer needs several new endpoints: PIN-based login, concert CRUD, batched sale submission with idempotency keys, and sale void/unvoid. The existing inventory deduct endpoint from Phase 1 is reused for stock sync. New API work and mobile app work can proceed in parallel once the contract is agreed.

**Primary recommendation:** Use Expo SDK 55 + Expo Router v7 (file-based) + expo-sqlite (WAL mode) for the outbox queue + Zustand + MMKV for UI state + NativeWind v4.2.x for styling + expo-secure-store for PIN storage. Build the mobile app as a `/mobile` workspace inside the repo. Requires `expo prebuild` (not Expo Go) due to MMKV's native module dependency.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | SDK 55 (55.0.6) | React Native runtime + build tooling | Current stable (released Feb 25, 2026); React Native 0.83; React 19.2; New Architecture mandatory |
| expo-router | v7 (55.0.5) | File-based navigation | Ships with SDK 55; official Expo recommendation; replaces react-navigation boilerplate |
| react-native | 0.83 | Native runtime | Bundled with Expo SDK 55 |
| expo-sqlite | 55.0.10 | Local database for offline storage + outbox queue | Official Expo library; WAL mode support; async API; SQLite Inspector DevTools in SDK 55 |
| react-native-mmkv | 3.x | Fast key-value storage for UI state persistence | 30x faster than AsyncStorage; synchronous reads; used by Zustand persist; requires react-native-nitro-modules + expo prebuild |
| zustand | 5.x | UI state management (cart, auth, sync status) | Lightweight; persist middleware works natively with MMKV adapter |
| expo-secure-store | 55.x | Encrypted storage for PIN hash and JWT token | iOS Keychain / Android Keystore; OS-level encryption; 2048 byte limit per value |
| @react-native-community/netinfo | 11.x | Network connectivity detection | Official community package; Expo-compatible; addEventListener for connectivity events |
| @gorhom/bottom-sheet | 5.x | Variant picker bottom sheet | Latest stable; Reanimated v3 compatible; known SDK 55 crash workaround: ensure expo-router is installed (it is) |
| react-native-reanimated | 3.x | Animation primitives required by bottom-sheet | Required peer dep; ships with Expo SDK 55; NativeWind also requires v3 (not v4) |
| react-native-gesture-handler | 2.x | Gesture primitives required by bottom-sheet | Required peer dep; ships with Expo SDK 55 |
| nativewind | 4.2.x | Tailwind CSS utility styling | v4.2.x is verified SDK 54/55 compatible with New Architecture; v5 is preview and targets SDK 54 — SDK 55 support unconfirmed |
| i18next + react-i18next + expo-localization | latest | French/English bilingual support | De-facto standard combination for Expo i18n |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-nitro-modules | latest | Required peer dep for MMKV 3.x | Must install alongside MMKV; handles native Turbo Module binding |
| expo-crypto | latest | Hashing PIN with SHA-256 before SecureStore | Secure PIN storage without bcrypt (bcrypt not available in RN environment) |
| expo-image | latest | Product image display with offline placeholder | Official Expo image component with blurhash placeholder support |
| expo-constants | latest | Build-time constants (API URL, etc.) | Access app.json extra config |
| expo-updates | latest | OTA updates for production | Post-launch patching without App Store review |
| axios | 1.x | HTTP client for API requests | Interceptors for JWT header injection; better than fetch for error handling |
| date-fns | 3.x | Date formatting for history/concert grouping | Lightweight; no moment.js bloat |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NativeWind v4.2.x | NativeWind v5 (preview) | v5 targets SDK 54; SDK 55 support not confirmed; v5 is not for production use yet |
| NativeWind | Plain StyleSheet + theme object | Zero risk, maximum control; less ergonomic; viable fallback if NativeWind build issues emerge |
| NativeWind | Gluestack UI v3 | Gluestack uses NativeWind engine internally; confirmed SDK 53+ support; SDK 55 support in roadmap but not confirmed |
| expo-sqlite (outbox) | Legend-State + SQLite | Legend-State adds abstraction but reduces control over outbox schema |
| zustand + MMKV | Redux + redux-persist | Zustand is significantly less boilerplate; Redux appropriate for larger teams |
| expo-secure-store | react-native-keychain | SecureStore simpler API; keychain has biometric support (not needed in v1) |
| axios | fetch | axios interceptors make JWT injection and error handling cleaner across all API calls |
| JS Tabs (tabBarStyle hide/show) | NativeTabs (Router v7 alpha) | NativeTabs is alpha in SDK 55; JS Tabs with tabBarStyle display toggle is reliable and required for cart-bar replacement pattern |

**Installation:**
```bash
# From repo root, create mobile workspace
npx create-expo-app@latest mobile --template default@sdk-55
cd mobile

# Core dependencies
npx expo install expo-sqlite expo-secure-store expo-crypto expo-image expo-constants expo-localization @react-native-community/netinfo react-native-reanimated react-native-gesture-handler react-native-safe-area-context

# State & storage (MMKV requires nitro-modules + prebuild)
npm install zustand react-native-mmkv react-native-nitro-modules

# UI
npm install nativewind@4 tailwindcss @gorhom/bottom-sheet

# i18n
npm install i18next react-i18next

# HTTP + utils
npm install axios date-fns

# Dev dependencies
npm install --save-dev jest jest-expo @testing-library/react-native

# Required: run native build generation (not Expo Go compatible due to MMKV)
npx expo prebuild
```

---

## Architecture Patterns

### Recommended Project Structure
```
mobile/
├── src/
│   ├── app/                    # Expo Router v7 file-based routes (screens only)
│   │   ├── _layout.tsx         # Root layout: providers, fonts, splash
│   │   ├── (auth)/
│   │   │   └── pin.tsx         # PIN login screen
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx     # Tab bar layout (4 tabs; tabBarStyle hidden in selling mode)
│   │   │   ├── index.tsx       # Dashboard tab
│   │   │   ├── history.tsx     # Transaction history tab
│   │   │   ├── stock.tsx       # Stock overview tab
│   │   │   └── settings.tsx    # Settings tab
│   │   ├── selling/
│   │   │   ├── _layout.tsx     # Selling mode layout (cart bar replaces tab bar)
│   │   │   ├── index.tsx       # Product grid
│   │   │   └── review.tsx      # Sale review + confirm screen
│   │   ├── concerts/
│   │   │   ├── index.tsx       # Concert list
│   │   │   └── [id].tsx        # Concert detail / close
│   │   ├── history/
│   │   │   └── [saleId].tsx    # Sale detail + void button
│   │   ├── restock.tsx         # Restock screen
│   │   └── products/
│   │       ├── index.tsx       # Product list (manage)
│   │       ├── new.tsx         # New product form
│   │       └── [id].tsx        # Edit product
│   ├── features/               # Feature logic, hooks, components
│   │   ├── auth/
│   │   ├── cart/
│   │   ├── catalog/
│   │   ├── concerts/
│   │   ├── history/
│   │   ├── stock/
│   │   └── sync/
│   ├── db/                     # expo-sqlite setup + table schemas
│   │   ├── index.ts            # openDatabaseAsync + WAL enable
│   │   ├── migrations.ts       # Table creation (run on app start)
│   │   ├── outbox.ts           # Outbox table operations
│   │   ├── sales.ts            # Local sales table operations
│   │   ├── products.ts         # Cached products table operations
│   │   └── concerts.ts         # Local concerts table operations
│   ├── stores/                 # Zustand stores (MMKV persisted)
│   │   ├── authStore.ts
│   │   ├── cartStore.ts
│   │   └── syncStore.ts
│   ├── api/                    # Axios client + endpoint wrappers
│   │   ├── client.ts           # Axios instance with JWT interceptor
│   │   ├── auth.ts
│   │   ├── concerts.ts
│   │   ├── products.ts
│   │   ├── sales.ts
│   │   └── inventory.ts
│   ├── i18n/                   # Translations
│   │   ├── index.ts
│   │   ├── en.json
│   │   └── fr.json
│   └── utils/
│       ├── currency.ts
│       └── dateFormat.ts
├── app.json
├── tailwind.config.js
└── package.json
```

### Pattern 1: SQLite Outbox for Offline-Safe Sale Recording

**What:** Write the sale to a local `sales` table AND append a row to the `outbox` table in a single atomic SQLite transaction. The outbox drives background sync to the server.

**When to use:** Any mutation that must survive connectivity loss — sale creation, void, concert creation.

```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/sqlite/
// src/db/outbox.ts
import * as SQLite from 'expo-sqlite';

export interface OutboxRow {
  id: string;           // UUID
  type: string;         // 'sale_create' | 'sale_void' | 'concert_create'
  payload: string;      // JSON.stringify(data)
  idempotency_key: string; // deterministic: type + local_id
  status: 'pending' | 'done' | 'failed';
  attempt_count: number;
  next_attempt_at: number; // unix ms
  created_at: number;
}

// Called once on app start
export async function createOutboxTable(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS outbox_idem_idx ON outbox(idempotency_key);
  `);
}

// Atomic write: sale + outbox in one transaction
export async function recordSaleLocally(
  db: SQLite.SQLiteDatabase,
  sale: LocalSale,
  outboxEntry: Omit<OutboxRow, 'status' | 'attempt_count' | 'next_attempt_at'>
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO sales (id, concert_id, items_json, total_amount, payment_method,
        currency, discount, discount_type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sale.id, sale.concertId, JSON.stringify(sale.items), sale.totalAmount,
       sale.paymentMethod, sale.currency, sale.discount, sale.discountType, Date.now()]
    );
    // INSERT OR IGNORE prevents duplicate on retry
    await db.runAsync(
      `INSERT OR IGNORE INTO outbox
       (id, type, payload, idempotency_key, status, attempt_count, next_attempt_at, created_at)
       VALUES (?, ?, ?, ?, 'pending', 0, 0, ?)`,
      [outboxEntry.id, outboxEntry.type, outboxEntry.payload,
       outboxEntry.idempotency_key, outboxEntry.created_at]
    );
  });
}
```

### Pattern 2: SyncManager — Single Sync Process

**What:** A singleton service that processes the outbox in batches of 10. Only one sync runs at a time. NetInfo triggers sync on connectivity restore.

**When to use:** App resume, NetInfo online event, periodic interval during active session.

```typescript
// Source: https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli
// src/features/sync/SyncManager.ts
let syncInProgress = false;
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_ALERT = 3;
const BATCH_SIZE = 10;

export async function requestSync(db: SQLite.SQLiteDatabase, apiClient: AxiosInstance) {
  if (syncInProgress) return; // Prevent concurrent syncs
  syncInProgress = true;
  try {
    const pending = await db.getAllAsync<OutboxRow>(
      `SELECT * FROM outbox WHERE status = 'pending' AND next_attempt_at <= ?
       ORDER BY created_at ASC LIMIT ?`,
      [Date.now(), BATCH_SIZE]
    );
    for (const row of pending) {
      try {
        await processOutboxRow(row, db, apiClient);
        consecutiveFailures = 0;
      } catch {
        consecutiveFailures++;
        const delay = Math.min(1000 * 2 ** row.attempt_count, 30_000); // exp backoff cap 30s
        await db.runAsync(
          `UPDATE outbox SET attempt_count = attempt_count + 1,
           next_attempt_at = ? WHERE id = ?`,
          [Date.now() + delay, row.id]
        );
        if (consecutiveFailures >= MAX_FAILURES_BEFORE_ALERT) {
          // Surface alert to user via syncStore
        }
      }
    }
  } finally {
    syncInProgress = false;
  }
}
```

### Pattern 3: PIN Authentication — Offline-First

**What:** On first login (online), hash the PIN with SHA-256, store hash in expo-secure-store, cache JWT in secure-store. On subsequent logins (offline-capable), compare input PIN hash against stored hash.

```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/securestore/
// Source: https://docs.expo.dev/versions/latest/sdk/crypto/
// src/features/auth/pinAuth.ts
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = 'pin_hash';
const JWT_KEY = 'auth_token';

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function setupPinLocally(pin: string, jwt: string) {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(JWT_KEY, jwt);
}

export async function verifyPinOffline(inputPin: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!storedHash) return false; // No cached PIN — must login online first
  const inputHash = await hashPin(inputPin);
  return inputHash === storedHash;
}

export async function getCachedToken(): Promise<string | null> {
  return SecureStore.getItemAsync(JWT_KEY);
}
```

### Pattern 4: NetInfo Connectivity Hook

**What:** React hook that subscribes to network changes and triggers sync when connectivity is restored.

```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/netinfo/
// src/features/sync/useConnectivity.ts
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/syncStore';

export function useConnectivitySync() {
  const wasOffline = useRef(false);
  const setIsOnline = useSyncStore(s => s.setIsOnline);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const online = state.isConnected && state.isInternetReachable;
      setIsOnline(!!online);
      if (online && wasOffline.current) {
        requestSync(/* db, apiClient */);
      }
      wasOffline.current = !online;
    });
    return unsub;
  }, []);
}
```

### Pattern 5: Zustand Cart Store with MMKV Persistence

**What:** Cart state survives app backgrounding during a concert. MMKV is synchronous so there is no hydration delay.

```typescript
// Source: https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_ZUSTAND_PERSIST_MIDDLEWARE.md
// src/stores/cartStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({ id: 'cart-store' });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.delete(key),
};

interface CartItem { productId: string; variantSku: string; quantity: number; priceAtSale: number; }
interface CartStore {
  items: CartItem[];
  concertId: string | null;
  currency: string;
  discount: number;
  discountType: 'flat' | 'percent';
  addItem: (item: CartItem) => void;
  removeItem: (sku: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      concertId: null,
      currency: 'EUR',
      discount: 0,
      discountType: 'flat',
      addItem: (item) => set(s => ({ items: [...s.items, item] })),
      removeItem: (sku) => set(s => ({ items: s.items.filter(i => i.variantSku !== sku) })),
      clearCart: () => set({ items: [], discount: 0 }),
      total: () => {
        const { items, discount, discountType } = get();
        const subtotal = items.reduce((sum, i) => sum + i.priceAtSale * i.quantity, 0);
        if (discountType === 'flat') return Math.max(0, subtotal - discount);
        return subtotal * (1 - discount / 100);
      },
    }),
    { name: 'cart', storage: createJSONStorage(() => mmkvStorage) }
  )
);
```

### Pattern 6: Tab Bar Hide/Show for Selling Mode

**What:** In selling mode the tab bar is replaced by the cart bar. Use `tabBarStyle` display toggle (not NativeTabs alpha) for reliable cross-platform behavior.

```typescript
// Source: https://docs.expo.dev/router/advanced/tabs/
// src/app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { useCartStore } from '@/stores/cartStore';

export default function TabLayout() {
  const isSellingMode = useCartStore(s => s.concertId !== null);
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: isSellingMode ? 'none' : 'flex' }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="stock" options={{ title: 'Stock' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
```

### Anti-Patterns to Avoid

- **Syncing before writing locally:** Always write to SQLite first, then sync. Never block the sale on API availability.
- **Multiple concurrent sync runs:** Use the `syncInProgress` flag. Triggering sync from every screen focus without a guard causes SQLite lock errors and duplicate outbox submissions.
- **Deleting outbox rows after sync:** Mark as `status = 'done'` to retain audit trail and enable debugging.
- **Storing raw PIN in SecureStore:** Always store the SHA-256 hash, never the plaintext PIN.
- **Blocking login on connectivity:** The PIN check must work offline. Never call the API during login when a cached PIN hash exists.
- **Putting business logic in `app/` routes:** Routes are thin screens only. Features live in `src/features/`.
- **Using NativeTabs for selling mode tab control:** NativeTabs is alpha in SDK 55 and does not support the `tabBarStyle` display:none toggle needed for the cart-bar pattern. Use JS Tabs.
- **Running MMKV in Expo Go:** MMKV 3.x requires native prebuild. Always use `expo prebuild` + development builds.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variant picker bottom sheet | Custom Modal + animated View | @gorhom/bottom-sheet v5 | Gesture handling, backdrop, snap points, keyboard avoidance — hundreds of edge cases |
| Network connectivity detection | polling / XHR checks | @react-native-community/netinfo | Handles airplane mode, WiFi without internet, cell transitions correctly |
| Secure credential storage | AsyncStorage for PIN/JWT | expo-secure-store | iOS Keychain / Android Keystore encryption; AsyncStorage is plaintext |
| PIN hashing | Custom hash function | expo-crypto SHA-256 | Native crypto APIs; no bcrypt available in RN runtime |
| Sync retry with backoff | setTimeout chains | Outbox pattern with `next_attempt_at` timestamp | Survives app kill/restart; atomic with write; deduplication via idempotency key |
| Key-value state persistence | Custom file storage | Zustand + MMKV | 30x faster than AsyncStorage; synchronous reads prevent flash of empty state |
| Localization string lookup | Hardcoded ternaries | i18next + react-i18next | Pluralization, interpolation, lazy loading, missing key fallbacks |
| Portrait lock | Manual dimension checks | `expo.orientation: "portrait"` in app.json | Single config line handles both platforms |

**Key insight:** The offline sync layer looks simple but accumulates sharp edges around duplicate prevention, partial batch failures, and app crashes mid-transaction. The outbox pattern with SQLite transactions and idempotency keys handles all of these correctly without custom orchestration.

---

## Common Pitfalls

### Pitfall 1: Sale Lost on App Crash During Sync
**What goes wrong:** App writes sale to memory/state then crashes before SQLite write. Sale is lost permanently.
**Why it happens:** Treating SQLite write as a "save" step after the sale, rather than the first thing that happens.
**How to avoid:** `recordSaleLocally()` is called the instant the user taps "Confirm". Write is the first operation; no async gap before it.
**Warning signs:** Any code path where state changes before `db.withTransactionAsync` is called.

### Pitfall 2: MMKV Fails in Expo Go / Without Prebuild
**What goes wrong:** `Error: Failed to create a new MMKV instance: react-native-mmkv 3.x.x requires TurboModules`. App crashes on launch.
**Why it happens:** MMKV 3.x requires native Turbo Module linking via `expo prebuild`. Expo Go cannot load custom native modules.
**How to avoid:** Always run `npx expo prebuild` after installing MMKV. Use a development build, not Expo Go. Also install `react-native-nitro-modules` alongside MMKV.
**Warning signs:** Running `npx expo start` in Expo Go mode after installing MMKV.

### Pitfall 3: Concurrent Sync Runs Cause SQLite Lock
**What goes wrong:** Multiple sync triggers (app focus + connectivity restored + manual refresh) fire simultaneously. SQLite throws "database is locked" error.
**Why it happens:** Each NetInfo event or screen focus naively calls `requestSync()` without checking if one is already running.
**How to avoid:** Guard with `if (syncInProgress) return` at the top of `requestSync()`.
**Warning signs:** Intermittent "database is locked" errors in logs.

### Pitfall 4: Offline Login Fails on Fresh Install Without Prior Online Session
**What goes wrong:** User opens app at venue, no internet. No PIN hash in SecureStore. Login is impossible.
**Why it happens:** PIN hash only exists after the first successful online login.
**How to avoid:** Cold-start offline handling: Show "Need to connect once to set up your PIN" with retry button when `SecureStore.getItemAsync(PIN_HASH_KEY)` returns null and device is offline.
**Warning signs:** `storedHash === null` in `verifyPinOffline`.

### Pitfall 5: expo-secure-store 2048 Byte Limit
**What goes wrong:** Storing large JSON blobs (e.g., full product catalog) in SecureStore fails or throws.
**Why it happens:** SecureStore has a hard 2048 byte limit per value on Android.
**How to avoid:** SecureStore holds only PIN hash (64 chars) and JWT token (~500 chars). Product/concert catalog goes in SQLite. Large preferences go in MMKV.
**Warning signs:** SecureStore `setItemAsync` failing for any value approaching 2KB.

### Pitfall 6: Sale Model Missing Fields for Mobile Needs
**What goes wrong:** The existing `Sale` model's `paymentMethod` enum is `['cash', 'card', 'other']` — does not include 'etransfer' or 'paypal'. `currency`, `discount`, `discountType`, `voidedAt` fields do not exist.
**Why it happens:** Sale model was built before mobile POS requirements were defined.
**How to avoid:** API plan must include Sale model migration: expand `paymentMethod` enum to add `etransfer` and `paypal`, add `currency` (String, default 'EUR'), `discount` (Number, default 0), `discountType` (String enum 'flat'/'percent'), `voidedAt` (Date), `voidedBy` (ObjectId ref Admin). Also add `idempotencyKey` (String, unique sparse index) for offline batch deduplication.
**Warning signs:** Sale sync returning 400 validation errors for payment method values.

### Pitfall 7: Per-Concert Price Overrides Not Persisted Locally
**What goes wrong:** Price override applied before concert, app killed, override lost. Subsequent sales use wrong price.
**Why it happens:** Price overrides stored only in React state.
**How to avoid:** Store concert price overrides in SQLite `concert_price_overrides` table keyed by `(concert_id, product_id)`. Reset automatically when a new concert is selected.

### Pitfall 8: NativeTabs vs JS Tabs Confusion in Router v7
**What goes wrong:** Developer uses new NativeTabs API from Router v7 and cannot control tab bar visibility for selling mode cart-bar replacement.
**Why it happens:** NativeTabs (alpha) delegates rendering to the OS — `tabBarStyle` display:none does not work with NativeTabs.
**How to avoid:** Use `Tabs` from `expo-router` (the JavaScript tabs, backed by React Navigation Bottom Tabs). This supports `tabBarStyle` and the display toggle pattern for cart mode.

### Pitfall 9: @gorhom/bottom-sheet Crash on SDK 55
**What goes wrong:** `Tried to synchronously call a non-worklet function addListener on the UI thread` crash on iOS with latest bottom-sheet + SDK 55.
**Why it happens:** Known Reanimated worklet issue in SDK 55 when expo-router is not present.
**How to avoid:** The crash does not occur when expo-router is installed — which this project does. Ensure expo-router is installed before running the prebuild.
**Warning signs:** Crash only on SDK 55 without expo-router present.

---

## Code Examples

### SQLite Database Initialization (WAL Mode)
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/sqlite/
// src/db/index.ts
import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('pos.db');
  // WAL mode improves concurrent read/write performance
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await runMigrations(_db);
  return _db;
}
```

### Local Sales Table Schema
```sql
-- src/db/migrations.ts
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,           -- UUID generated on device
  concert_id TEXT NOT NULL,
  items_json TEXT NOT NULL,      -- JSON array of sale items
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  discount REAL NOT NULL DEFAULT 0,
  discount_type TEXT NOT NULL DEFAULT 'flat',
  voided INTEGER NOT NULL DEFAULT 0,   -- boolean 0/1
  voided_at INTEGER,             -- unix ms
  synced INTEGER NOT NULL DEFAULT 0,   -- boolean 0/1
  created_at INTEGER NOT NULL    -- unix ms
);
CREATE INDEX IF NOT EXISTS sales_concert_idx ON sales(concert_id);
CREATE INDEX IF NOT EXISTS sales_created_idx ON sales(created_at DESC);

CREATE TABLE IF NOT EXISTS concert_price_overrides (
  concert_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  price REAL NOT NULL,
  PRIMARY KEY (concert_id, product_id)
);
```

### i18n Setup
```typescript
// Source: https://docs.expo.dev/versions/latest/sdk/localization/
// src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import en from './en.json';
import fr from './fr.json';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: Localization.getLocales()[0]?.languageCode ?? 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AsyncStorage for state persistence | MMKV + Zustand persist | 2023-2025 | 30x perf improvement; synchronous reads |
| React Navigation (standalone) | Expo Router v7 (file-based) | SDK 50+ (2024-2026) | Convention over configuration; deep links automatic |
| Optional New Architecture | Mandatory New Architecture | SDK 55 (Feb 2026) | NativeWind v4 required (v5 preview only); prebuild mandatory |
| Expo Router v4 | Expo Router v7 | SDK 55 (Feb 2026) | New Stack API, NativeTabs (alpha), Router UI components |
| Custom network polling | @react-native-community/netinfo | Ongoing | Handles all connectivity edge cases |
| NativeTabs (alpha) for all tab layouts | JS Tabs for layout-controlled scenarios | SDK 55 | NativeTabs alpha cannot hide tab bar — use JS Tabs when cart-bar replacement is needed |

**Deprecated/outdated:**
- `@react-navigation/bottom-tabs` standalone: Expo Router now wraps this; don't install separately
- `AsyncStorage` for sensitive data: Never use for PIN or JWT; SecureStore only
- Legacy Architecture (`newArchEnabled: false`): Removed in SDK 55; config key no longer exists
- Expo Router v4/v6: Superseded by v7 in SDK 55

---

## New API Endpoints Required

Phase 2 requires these new backend API endpoints that do not exist after Phase 1:

| Endpoint | Method | Purpose | Notes |
|----------|--------|---------|-------|
| `/api/auth/pin-login` | POST | Accepts `{ pin }`, returns JWT | New endpoint; existing login is username+password |
| `/api/auth/pin-setup` | POST | (Admin only) Set/reset PIN | Must hash PIN server-side with bcrypt before storing on Admin model |
| `/api/concerts` | GET | List all concerts | Needed for concert selector |
| `/api/concerts` | POST | Create new concert | Quick-create from mobile (name, venue, date, city) |
| `/api/concerts/:id` | GET | Concert detail | |
| `/api/concerts/:id` | PATCH | Update concert (close, reopen) | `{ active: false }` to close |
| `/api/sales/batch` | POST | Submit batch of offline sales | Accepts array with idempotency keys; deduplicates server-side via unique index on `idempotencyKey` |
| `/api/sales/:id/void` | POST | Void a sale | Sets `voidedAt`, reverses stock deduction |
| `/api/sales/:id/unvoid` | POST | Unvoid a sale | Reverses the void, re-applies stock deduction |
| `/api/sales` | GET | List sales (with concert filter) | `?concertId=xxx` |
| `/api/inventory/stock` | GET | Stock summary | Already exists (Phase 1) |
| `/api/inventory/deduct` | POST | Deduct stock on sync | Already exists (Phase 1) |

**Sale model additions required** (existing model lacks these fields):
- `paymentMethod` enum: expand to include `etransfer`, `paypal` (current: `cash`, `card`, `other`)
- `currency` (String, default `'EUR'`)
- `discount` (Number, default `0`)
- `discountType` (String enum `'flat' | 'percent'`, default `'flat'`)
- `voidedAt` (Date, optional)
- `voidedBy` (ObjectId ref Admin, optional)
- `idempotencyKey` (String, unique sparse index — for offline batch deduplication)

**Concert model** — `location` field maps to city (existing); `venue` field exists. No schema changes needed for city vs. location mapping.

**Admin model addition required:**
- `pinHash` (String, optional) — stores bcrypt-hashed PIN set via `/api/auth/pin-setup`

---

## Open Questions

1. **Product image upload and storage**
   - What we know: CONTEXT.md notes "Product image storage/CDN strategy — needs research during planning" (deferred)
   - What's unclear: Where images are stored (S3, Cloudinary, MongoDB GridFS?), how mobile uploads during product management
   - Recommendation: For v1, store image URL as a string on the Product model. Use a free-tier Cloudinary account for upload; mobile sends multipart form or base64 to a new `/api/products/:id/image` endpoint. Flag this as a Wave 0 decision in the plan.

2. **NativeWind v4 vs v5 final decision**
   - What we know: NativeWind v4.2.x is verified for SDK 54/55 New Architecture. v5 is preview, targets SDK 54, SDK 55 support unconfirmed as of March 2026.
   - What's unclear: Whether v5 will stabilize for SDK 55 during this phase's build window.
   - Recommendation: Use NativeWind v4.2.x. If build issues emerge with v4, fall back to plain React Native StyleSheet with a theme constants object for dark mode.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + jest-expo (mobile), Jest 30 + Supertest (API) |
| Config file (API) | `api/package.json` jest config (`testEnvironment: node`) |
| Config file (mobile) | `mobile/jest.config.js` — Wave 0 gap |
| Quick run command (API) | `cd api && npm test` |
| Quick run command (mobile) | `cd mobile && npm test` |
| Full suite command | `npm run test:all` (root script — Wave 0 gap) |

### Phase Requirements — Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POS-01 | Sale written to SQLite when offline | unit | `cd mobile && npm test -- --testPathPattern=db/outbox` | Wave 0 |
| POS-01 | Outbox row created atomically with sale | unit | `cd mobile && npm test -- --testPathPattern=db/outbox` | Wave 0 |
| POS-02 | Product grid renders tiles with variant stock | unit (RTL) | `cd mobile && npm test -- --testPathPattern=features/catalog` | Wave 0 |
| POS-03 | History grouped by concert, newest first | unit | `cd mobile && npm test -- --testPathPattern=features/history` | Wave 0 |
| POS-04 | Stock decrements optimistically on sale | unit | `cd mobile && npm test -- --testPathPattern=features/stock` | Wave 0 |
| POS-05 | PIN hash stored in SecureStore on setup | unit | `cd mobile && npm test -- --testPathPattern=features/auth` | Wave 0 |
| POS-05 | Offline PIN verify matches stored hash | unit | `cd mobile && npm test -- --testPathPattern=features/auth` | Wave 0 |
| POS-09 | Cart accepts multiple items, tracks quantities | unit | `cd mobile && npm test -- --testPathPattern=stores/cartStore` | Wave 0 |
| POS-10 | Cart total calculated correctly with discount | unit | `cd mobile && npm test -- --testPathPattern=stores/cartStore` | Wave 0 |
| AUTH-01 | PIN login endpoint returns JWT (API) | integration | `cd api && npm test -- --testPathPattern=tests/pin-auth` | Wave 0 (partial: existing auth test covers password login only) |
| AUTH-01 | JWT cached in SecureStore on login | unit | `cd mobile && npm test -- --testPathPattern=features/auth` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd mobile && npm test -- --testPathPattern={changed_feature} --passWithNoTests`
- **Per wave merge:** `cd api && npm test && cd ../mobile && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `mobile/jest.config.js` — jest-expo preset configuration
- [ ] `mobile/src/__tests__/db/outbox.test.ts` — covers POS-01
- [ ] `mobile/src/__tests__/stores/cartStore.test.ts` — covers POS-09, POS-10
- [ ] `mobile/src/__tests__/features/auth/pinAuth.test.ts` — covers POS-05, AUTH-01
- [ ] `mobile/src/__tests__/features/catalog/productGrid.test.tsx` — covers POS-02
- [ ] `mobile/src/__tests__/features/history/history.test.ts` — covers POS-03
- [ ] `mobile/src/__tests__/features/stock/stock.test.ts` — covers POS-04
- [ ] `api/tests/pin-auth.test.js` — covers AUTH-01 PIN endpoint
- [ ] `api/tests/concerts.test.js` — covers concert CRUD endpoints
- [ ] `api/tests/sales-batch.test.js` — covers batch sale submission with idempotency

---

## Sources

### Primary (HIGH confidence)
- Expo SDK 55 Changelog — https://expo.dev/changelog/sdk-55 — React Native 0.83, React 19.2, New Architecture mandatory, SQLite Inspector, Expo Router v7
- Expo SQLite Docs — https://docs.expo.dev/versions/latest/sdk/sqlite/ — openDatabaseAsync, WAL mode, runAsync/getAllAsync/withTransactionAsync APIs; current version 55.0.10
- Expo SecureStore Docs — https://docs.expo.dev/versions/latest/sdk/securestore/ — iOS Keychain/Android Keystore, 2048 byte limit confirmed
- NetInfo Expo Docs — https://docs.expo.dev/versions/latest/sdk/netinfo/ — addEventListener, isConnected, isInternetReachable
- Expo Router v7 Tabs Docs — https://docs.expo.dev/router/advanced/tabs/ — tab layout, tabBarStyle display toggle, route groups
- Expo Router v55 Blog — https://expo.dev/blog/expo-router-v55-more-native-navigation-more-powerful-web — v7 features, NativeTabs alpha status
- Existing API code inspection — `api/models/Sale.js`, `api/models/Concert.js`, `api/models/Product.js`, `api/routes/auth.js` — confirmed Sale model gaps

### Secondary (MEDIUM confidence)
- NativeWind v5 Installation Docs — https://www.nativewind.dev/v5/getting-started/installation — targets SDK 54; SDK 55 support not explicitly confirmed; v5 labeled "preview / not for production"
- NativeWind Expo Compatibility Discussion — https://github.com/nativewind/nativewind/discussions/1604 — maintainer confirmed v4.2.x for SDK 54; SDK 55 status unclear
- @gorhom/bottom-sheet SDK 55 issue — https://github.com/expo/expo/issues/42886 — confirmed crash workaround (expo-router must be installed)
- react-native-mmkv 3.x Nitro requirement — https://github.com/mrousavy/react-native-mmkv/issues/931 — requires react-native-nitro-modules + expo prebuild
- Outbox pattern with SQLite + idempotency keys — https://dev.to/sathish_daggula/how-to-build-offline-first-sqlite-sync-in-expo-1lli — verified against multiple sources
- Zustand + MMKV persistence pattern — https://github.com/mrousavy/react-native-mmkv/blob/main/docs/WRAPPER_ZUSTAND_PERSIST_MIDDLEWARE.md — official mrousavy docs

### Tertiary (LOW confidence)
- expo-sqlite-mock for Jest unit testing — single source; validate during Wave 0 test setup
- NativeWind v5 SDK 55 compatibility — no confirmed working reports as of March 2026; marked LOW until verified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Expo SDK 55 changelog verified; library versions cross-checked against npm and official docs
- Architecture: HIGH — Outbox pattern and Expo Router v7 structure verified against official docs and multiple 2025/2026 sources
- Pitfalls: HIGH — MMKV prebuild requirement, bottom-sheet SDK 55 bug, NativeTabs limitation all sourced from official issues and release notes
- NativeWind version: MEDIUM — v4.2.x is verified; v5 SDK 55 compatibility is unconfirmed as of March 2026
- API gaps: HIGH — Directly derived from inspection of `api/models/Sale.js`, `api/models/Concert.js`, `api/routes/auth.js`

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (SDK releases quarterly; NativeWind v5 ecosystem still stabilizing; verify NativeWind before starting styling work)
