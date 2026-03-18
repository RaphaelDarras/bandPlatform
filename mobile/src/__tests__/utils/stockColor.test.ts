import { stockColor } from '@/utils/stockColor';

describe('stockColor', () => {
  describe('red zone — sold out (<=0)', () => {
    it('returns red for stock of 0', () => {
      expect(stockColor(0)).toBe('#ef4444');
    });

    it('returns red for negative stock (-5)', () => {
      expect(stockColor(-5)).toBe('#ef4444');
    });

    it('returns red for -1', () => {
      expect(stockColor(-1)).toBe('#ef4444');
    });
  });

  describe('orange zone — low stock (1-4)', () => {
    it('returns orange for stock of 1', () => {
      expect(stockColor(1)).toBe('#f59e0b');
    });

    it('returns orange for stock of 4', () => {
      expect(stockColor(4)).toBe('#f59e0b');
    });

    it('returns orange for stock of 2', () => {
      expect(stockColor(2)).toBe('#f59e0b');
    });
  });

  describe('gray zone — normal stock (>=5)', () => {
    it('returns gray for stock of 5', () => {
      expect(stockColor(5)).toBe('#888');
    });

    it('returns gray for stock of 100', () => {
      expect(stockColor(100)).toBe('#888');
    });

    it('returns gray for large stock values', () => {
      expect(stockColor(999)).toBe('#888');
    });
  });
});
