# Go-Live Checklist — Payment Processing (Phase 6, D-19)

Build and verify happened entirely against **Stripe test mode + PayPal sandbox**. This
checklist is the required sequence to flip the shop to real, live payments. Do not skip
steps — the most common go-live failure (RESEARCH Pitfall 6) is forgetting that Stripe and
PayPal each issue **distinct** webhook secrets/ids per environment: the test secret you
already have in `STRIPE_WEBHOOK_SECRET`/`PAYPAL_WEBHOOK_ID` will NOT work in live mode.

## Where each variable lives

- **Render (API service)** — all `api/.env.example` keys below (server-side secrets, never
  exposed to the browser). Set via Render Dashboard → your service → Environment.
- **Vercel (web app)** — only the Stripe **publishable** key, if/when the checkout page needs
  it client-side (this phase uses hosted redirect flows, so the web app currently has no
  Stripe/PayPal secret exposure — confirm no `VITE_STRIPE_*`/`VITE_PAYPAL_*` var was
  accidentally added before go-live).

## 1. Stripe — swap to live mode

- [ ] Swap `STRIPE_SECRET_KEY` on Render from `sk_test_...` to the live `sk_live_...` key
      (Stripe Dashboard → Developers → API keys, toggle "Viewing test data" off first).
- [ ] Register a **NEW live-mode webhook endpoint** in the Stripe Dashboard (Developers →
      Webhooks, with test mode toggled OFF) pointing at
      `https://<render-api-domain>/api/webhooks/stripe`, subscribed to
      `checkout.session.completed`.
- [ ] Copy that live endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on Render.
      **This is a DIFFERENT value from both the `stripe listen` CLI secret and the test-mode
      Dashboard endpoint secret used during development (Pitfall 6) — do not reuse either.**
- [ ] Confirm the live endpoint shows "Enabled" and a recent successful delivery after the
      smoke test below.

## 2. PayPal — swap to live mode

- [ ] Create (or confirm) a **live** PayPal app in the PayPal Developer Dashboard (separate
      from the sandbox app used during development).
- [ ] Swap `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` on Render to the live app's
      credentials.
- [ ] Set `PAYPAL_ENV=live` on Render (this flips `paypalClient.js`'s
      `Environment.Production` branch and the REST API base URL to
      `api-m.paypal.com`).
- [ ] Register a **live** webhook subscription (PayPal Developer Dashboard → your live app →
      Webhooks) pointing at `https://<render-api-domain>/api/webhooks/paypal`, subscribed to
      `PAYMENT.CAPTURE.COMPLETED`.
- [ ] Copy the live webhook's `webhook_id` into `PAYPAL_WEBHOOK_ID` on Render. **This is a
      different id from the sandbox `webhook_id`** — `verifyPaypalWebhook` will silently fail
      verification (400 on every real payment) if the sandbox id is left in place.

## 3. Resend / transactional email

- [ ] Confirm the `hurakanband.fr` domain shows **Verified** in the Resend dashboard (SPF +
      DKIM records added to Vercel DNS). Note: DNS propagation can take anywhere from a few
      minutes to ~48 hours depending on TTLs and registrar caching — do not flip live traffic
      until verification is green, or customer confirmation emails will land in spam or
      bounce.
- [ ] `RESEND_API_KEY` is set on Render (production Resend key, not a throwaway/test key if
      Resend's account has separate test/live key scoping).
- [ ] `BAND_NOTIFICATION_EMAIL` is set on Render to the real inbox the band monitors for
      fulfillment (D-13) — verify it's not still a placeholder/test address.

## 4. Web origin

- [ ] `WEB_BASE_URL` on Render is set to the production origin (`https://hurakanband.fr`),
      not a preview/staging Vercel URL — this value builds the Stripe `success_url`/
      `cancel_url` and PayPal `return_url`/`cancel_url` redirect targets baked into every
      Checkout Session / PayPal Order created after the swap.

## 5. Pre-live smoke test (run BEFORE flipping any of the above to live)

Run this against the **test/sandbox** configuration first, immediately before the live
swap, to confirm the whole pipeline still works end-to-end on this exact deployed build:

- [ ] **Stripe test card:** `stripe listen --forward-to
      https://<render-api-domain>/api/webhooks/stripe` (or the registered test-mode Dashboard
      endpoint), complete a checkout with card `4242 4242 4242 4242`, any future expiry, any
      CVC. Confirm: Order flips `pending` → `paid`, the variant's stock decrements by the
      purchased quantity, and both the customer confirmation and band notification emails
      arrive.
- [ ] **PayPal sandbox buyer:** complete a checkout using a PayPal sandbox buyer account.
      Confirm the same three outcomes (Order paid, stock decremented, both emails sent) plus
      that the `/checkout/paypal-return` capture step actually moves the sandbox order to
      `COMPLETED` before the webhook fires.
- [ ] Replay one webhook delivery manually (Stripe Dashboard → Webhooks → endpoint → resend a
      recent event, or `stripe trigger checkout.session.completed` twice) and confirm no
      double stock-deduction and no duplicate emails (D-10 idempotency).

Only after this smoke test passes cleanly should the live-mode swaps in sections 1–4 above
be made. After swapping, repeat a **real, low-value purchase** (a cheap variant, live keys)
end-to-end once before considering the shop fully live — a live webhook endpoint pointed at
the wrong secret is the single most common way this phase's happy path silently breaks in
production (Pitfall 6).
