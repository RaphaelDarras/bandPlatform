import { useCartStore } from '@/stores/cartStore';

const item1 = { productId: 'p1', variantSku: 'p1-m', productName: 'T-Shirt', variantLabel: 'M', quantity: 1, priceAtSale: 20 };
const item2 = { productId: 'p2', variantSku: 'p2-l', productName: 'Cap', variantLabel: 'L', quantity: 2, priceAtSale: 10 };

beforeEach(() => {
  useCartStore.getState().clearCart();
  useCartStore.setState({ concertId: null, currency: 'EUR', discount: 0, discountType: 'flat' });
});

describe('cartStore - addItem', () => {
  it('adds an item to the cart', () => {
    useCartStore.getState().addItem(item1);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].variantSku).toBe('p1-m');
  });

  it('adds multiple items', () => {
    useCartStore.getState().addItem(item1);
    useCartStore.getState().addItem(item2);
    expect(useCartStore.getState().items).toHaveLength(2);
  });
});

describe('cartStore - removeItem', () => {
  it('removes item by variantSku', () => {
    useCartStore.getState().addItem(item1);
    useCartStore.getState().addItem(item2);
    useCartStore.getState().removeItem('p1-m');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].variantSku).toBe('p2-l');
  });
});

describe('cartStore - updateQuantity', () => {
  it('updates quantity for specific item', () => {
    useCartStore.getState().addItem(item1);
    useCartStore.getState().updateQuantity('p1-m', 3);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });
});

describe('cartStore - clearCart', () => {
  it('resets items and discount', () => {
    useCartStore.getState().addItem(item1);
    useCartStore.setState({ discount: 5 });
    useCartStore.getState().clearCart();
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().discount).toBe(0);
  });
});

describe('cartStore - total()', () => {
  it('returns 0 when cart is empty', () => {
    expect(useCartStore.getState().total()).toBe(0);
  });

  it('calculates subtotal with no discount', () => {
    useCartStore.getState().addItem({ ...item1, quantity: 2, priceAtSale: 10 });
    expect(useCartStore.getState().total()).toBe(20);
  });

  it('applies flat discount correctly: subtotal 20, discount 5 = 15', () => {
    useCartStore.getState().addItem({ ...item1, quantity: 2, priceAtSale: 10 });
    useCartStore.setState({ discount: 5, discountType: 'flat' });
    expect(useCartStore.getState().total()).toBe(15);
  });

  it('applies percent discount correctly: subtotal 100, discount 10% = 90', () => {
    useCartStore.getState().addItem({ ...item1, quantity: 1, priceAtSale: 100 });
    useCartStore.setState({ discount: 10, discountType: 'percent' });
    expect(useCartStore.getState().total()).toBe(90);
  });

  it('returns 0 when flat discount exceeds subtotal (no negative totals)', () => {
    useCartStore.getState().addItem({ ...item1, quantity: 1, priceAtSale: 5 });
    useCartStore.setState({ discount: 100, discountType: 'flat' });
    expect(useCartStore.getState().total()).toBe(0);
  });
});

describe('cartStore - setConcertId', () => {
  it('sets the active concert', () => {
    useCartStore.getState().setConcertId('concert-123');
    expect(useCartStore.getState().concertId).toBe('concert-123');
  });
});

describe('cartStore - setCurrency', () => {
  it('default currency is EUR', () => {
    expect(useCartStore.getState().currency).toBe('EUR');
  });

  it('sets currency to a custom value', () => {
    useCartStore.getState().setCurrency('CAD');
    expect(useCartStore.getState().currency).toBe('CAD');
  });
});
