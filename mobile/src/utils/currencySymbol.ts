const SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
};

export function currencySymbol(code: string): string {
  return SYMBOLS[code] ?? code;
}
