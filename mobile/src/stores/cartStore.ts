import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';

const mmkv = createMMKV({ id: 'cart-store' });
const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

export interface CartItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  priceAtSale: number;
}

interface CartStore {
  items: CartItem[];
  concertId: string | null;
  currency: string;
  discount: number;
  discountType: 'flat' | 'percent';
  addItem: (item: CartItem) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  setConcertId: (id: string | null) => void;
  setCurrency: (currency: string) => void;
  setDiscount: (discount: number, type: 'flat' | 'percent') => void;
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

      addItem: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantSku === item.variantSku);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantSku === item.variantSku
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { items: [...s.items, item] };
        }),

      removeItem: (sku) =>
        set((s) => ({ items: s.items.filter((i) => i.variantSku !== sku) })),

      updateQuantity: (sku, quantity) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.variantSku === sku ? { ...i, quantity } : i
          ),
        })),

      clearCart: () => set({ items: [], discount: 0, discountType: 'flat' }),

      setConcertId: (id) => set({ concertId: id }),

      setCurrency: (currency) => set({ currency }),

      setDiscount: (discount, type) =>
        set({ discount, discountType: type }),

      total: () => {
        const { items, discount, discountType } = get();
        const subtotal = items.reduce(
          (sum, i) => sum + i.priceAtSale * i.quantity,
          0
        );
        if (discountType === 'flat') return Math.max(0, subtotal - discount);
        return subtotal * (1 - discount / 100);
      },
    }),
    {
      name: 'cart',
      storage: createJSONStorage(() => mmkvStorage),
      merge: (persisted, current) => {
        const state = persisted as Partial<CartStore>;
        const rawItems: CartItem[] = state.items ?? [];
        const deduped = rawItems.reduce<CartItem[]>((acc, item) => {
          const existing = acc.find((i) => i.variantSku === item.variantSku);
          if (existing) {
            existing.quantity += item.quantity;
            return acc;
          }
          return [...acc, item];
        }, []);
        return { ...current, ...state, items: deduped };
      },
    }
  )
);
