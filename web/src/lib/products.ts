// Keep-alive ping only (07.1 D-22). Warms the Render API out of cold-start
// via /health. Product/stock data now lives in Shopify; the former product
// fetchers were removed with the retired /stock admin page.

const API = import.meta.env.VITE_API_URL ?? 'https://hurakan-band-platform.onrender.com'

/**
 * Fire-and-forget keep-alive ping. Never throws — best-effort warm-up.
 */
export function pingHealth(): void {
  fetch(`${API}/health`).catch(() => {})
}
