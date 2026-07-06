// Shared price-formatting helper (WR-04). Every price shown to a customer
// (Cart, Checkout, ShopDetail, CatalogGrid) is a sum of plain-float fields
// (basePrice + priceAdjustment) and was previously interpolated raw, so a
// plausible price configuration (e.g. 10.10 + 0.20) could render as
// "€10.299999999999999". Mirrors api/services/email.js's formatEur(), which
// already does `.toFixed(2)` for the same reason.
export function formatPrice(amount: number): string {
  return `€${amount.toFixed(2)}`
}
