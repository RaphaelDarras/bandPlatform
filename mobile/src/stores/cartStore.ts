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
  productGid: string;
  variantGid: string;
  variantSku: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  priceAtSale: number;
  originalPrice: number;
}

interface CartStore {
  items: CartItem[];
  concertId: string | null;
  currency: string;
  discount: number;
  discountType: 'flat' | 'percent';
  addItem: (item: CartItem) => void;
  removeItem: (variantGid: string) => void;
  updateQuantity: (variantGid: string, quantity: number) => void;
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
          const existing = s.items.find((i) => i.variantGid === item.variantGid);
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.variantGid === item.variantGid
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { items: [...s.items, item] };
        }),

      removeItem: (variantGid) =>
        set((s) => ({ items: s.items.filter((i) => i.variantGid !== variantGid) })),

      updateQuantity: (variantGid, quantity) =>
        set((s) => ({
          items: s.items.map((i) => (i.variantGid === variantGid ? { ...i, quantity } : i)),
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
        // pre-07.1 carts hold Mongo ids (no variantGid); discard
        const rawItems: CartItem[] = (state.items ?? []).filter(
          (item) => typeof (item as Partial<CartItem>).variantGid === 'string'
        );
        const deduped = rawItems.reduce<CartItem[]>((acc, item) => {
          const existing = acc.find((i) => i.variantGid === item.variantGid);
          if (existing) {
            existing.quantity += item.quantity;
            return acc;
          }
          return [...acc, { ...item }];
        }, []);
        return { ...current, ...state, items: deduped };
      },
    }
  )
);
