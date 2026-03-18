/**
 * Returns a color string based on stock level.
 *
 * - Red (#ef4444):  stock <= 0 (sold out)
 * - Orange (#f59e0b): stock < 5 (low stock warning)
 * - Gray (#888):   stock >= 5 (normal)
 */
export function stockColor(stock: number): string {
  if (stock <= 0) return '#ef4444'; // red — sold out
  if (stock < 5) return '#f59e0b';  // orange — low stock
  return '#888';                     // default gray
}
