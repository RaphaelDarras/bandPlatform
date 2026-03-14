/**
 * Tests for ProductGrid, ProductTile, and VariantPicker components.
 * TDD RED phase — written before implementation.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// Mock @gorhom/bottom-sheet before importing components
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef(({ children }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      expand: jest.fn(),
      close: jest.fn(),
      snapToIndex: jest.fn(),
    }));
    return <View testID="bottom-sheet">{children}</View>;
  });
  const BottomSheetView = ({ children }: any) => <View>{children}</View>;
  const BottomSheetFlatList = ({ data, renderItem }: any) => (
    <View>
      {data?.map((item: any, i: number) => (
        <View key={i}>{renderItem({ item })}</View>
      ))}
    </View>
  );
  return { default: BottomSheet, BottomSheetView, BottomSheetFlatList };
});

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  Gesture: { Pan: jest.fn() },
  GestureDetector: ({ children }: any) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    View: ({ children }: any) => {
      const { View } = require('react-native');
      return <View>{children}</View>;
    },
    createAnimatedComponent: (Component: any) => Component,
    Value: jest.fn(),
    event: jest.fn(),
    add: jest.fn(),
    eq: jest.fn(),
    set: jest.fn(),
    cond: jest.fn(),
    interpolate: jest.fn(),
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((val: any) => val),
    withSpring: jest.fn((val: any) => val),
    runOnJS: jest.fn((fn: any) => fn),
    useAnimatedGestureHandler: jest.fn(),
  },
  useSharedValue: jest.fn(() => ({ value: 0 })),
  useAnimatedStyle: jest.fn(() => ({})),
  withTiming: jest.fn((val: any) => val),
  withSpring: jest.fn((val: any) => val),
  FadeIn: { duration: jest.fn(() => ({ delay: jest.fn(() => ({})) })) },
  SlideInDown: { duration: jest.fn(() => ({ delay: jest.fn(() => ({})) })) },
  SlideOutDown: { duration: jest.fn(() => ({ delay: jest.fn(() => ({})) })) },
}));

import { ProductGrid } from '@/features/catalog/ProductGrid';
import { ProductTile } from '@/features/catalog/ProductTile';
import { useCartStore } from '@/stores/cartStore';
import type { CachedProduct } from '@/db/products';

// Reset cart store between tests
beforeEach(() => {
  useCartStore.getState().clearCart();
});

const makeProduct = (overrides: Partial<CachedProduct> = {}): CachedProduct => ({
  id: 'prod-1',
  name: 'Band T-Shirt',
  price: 25.0,
  imageUrl: null,
  active: 1,
  updatedAt: Date.now(),
  variants: [
    { sku: 'TSHIRT-S', label: 'S', priceAdjustment: 0, stock: 3 },
    { sku: 'TSHIRT-M', label: 'M', priceAdjustment: 0, stock: 12 },
    { sku: 'TSHIRT-XL', label: 'XL', priceAdjustment: 0, stock: 0 },
  ],
  ...overrides,
});

const makeSingleVariantProduct = (): CachedProduct => ({
  id: 'prod-2',
  name: 'Sticker Pack',
  price: 5.0,
  imageUrl: null,
  active: 1,
  updatedAt: Date.now(),
  variants: [{ sku: 'STICKER-1', label: 'Default', priceAdjustment: 0, stock: 20 }],
});

describe('ProductGrid', () => {
  it('renders correct number of product tiles', () => {
    const products = [makeProduct(), makeSingleVariantProduct()];
    const { getAllByTestId } = render(
      <ProductGrid products={products} onRefresh={jest.fn()} refreshing={false} />
    );
    expect(getAllByTestId('product-tile')).toHaveLength(2);
  });

  it('passes products to tiles', () => {
    const products = [makeProduct()];
    const { getByText } = render(
      <ProductGrid products={products} onRefresh={jest.fn()} refreshing={false} />
    );
    expect(getByText('Band T-Shirt')).toBeTruthy();
  });
});

describe('ProductTile', () => {
  it('renders product name and price', () => {
    const { getByText } = render(
      <ProductTile product={makeProduct()} />
    );
    expect(getByText('Band T-Shirt')).toBeTruthy();
    expect(getByText('€25.00')).toBeTruthy();
  });

  it('displays per-variant stock counts', () => {
    const { getByText } = render(
      <ProductTile product={makeProduct()} />
    );
    // Should show stock summary like "S:3 M:12 XL:0"
    expect(getByText(/S:3/)).toBeTruthy();
    expect(getByText(/M:12/)).toBeTruthy();
    expect(getByText(/XL:0/)).toBeTruthy();
  });

  it('single-variant product tap adds directly to cart without picker', () => {
    const { getByTestId } = render(
      <ProductTile product={makeSingleVariantProduct()} />
    );
    const tile = getByTestId('product-tile');
    fireEvent.press(tile);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].variantSku).toBe('STICKER-1');
    expect(items[0].productName).toBe('Sticker Pack');
  });

  it('multi-variant product tap opens variant picker', () => {
    const { getByTestId } = render(
      <ProductTile product={makeProduct()} />
    );
    const tile = getByTestId('product-tile');
    fireEvent.press(tile);
    // Cart should NOT have items yet — picker should open first
    expect(useCartStore.getState().items).toHaveLength(0);
    // VariantPicker should be shown
    expect(getByTestId('variant-picker')).toBeTruthy();
  });

  it('variant picker lists all variants with stock counts', () => {
    const { getByTestId, getByLabelText } = render(
      <ProductTile product={makeProduct()} />
    );
    fireEvent.press(getByTestId('product-tile'));
    expect(getByLabelText('S, 3 left')).toBeTruthy();
    expect(getByLabelText('M, 12 left')).toBeTruthy();
    expect(getByLabelText('XL, 0 left')).toBeTruthy();
  });

  it('tapping a variant in picker adds item to cart', () => {
    const { getByTestId, getByLabelText } = render(
      <ProductTile product={makeProduct()} />
    );
    fireEvent.press(getByTestId('product-tile'));
    // Tap the "S" variant
    fireEvent.press(getByLabelText('S, 3 left'));
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].variantSku).toBe('TSHIRT-S');
    expect(items[0].priceAtSale).toBe(25.0);
  });

  it('zero-stock variants are still tappable', () => {
    const { getByTestId, getByLabelText } = render(
      <ProductTile product={makeProduct()} />
    );
    fireEvent.press(getByTestId('product-tile'));
    // XL has 0 stock but should still be pressable
    fireEvent.press(getByLabelText('XL, 0 left'));
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].variantSku).toBe('TSHIRT-XL');
  });
});
