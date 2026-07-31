# Profile Centre Stripe on Cloudflare

Profile Centre uses its dedicated Stripe account (`acct_1TfUSWDLIZgCwhkL`) for customer purchases, orders, Checkout, subscriptions and Billing Portal access.

## Production endpoints

- Store webhook: `https://profilecentre.jagroupservices.co.uk/api/stripe/webhook`
- Head Office tracking webhook: `https://customerops.jagroupservices.co.uk/api/webhooks/stripe/profile-centre`
- Authenticated Checkout: `POST /api/billing/checkout`
- Authenticated Billing Portal: `POST /api/billing/portal`
- Authenticated cancellation: `POST /api/billing/cancel`

The two webhook endpoints are intentional. The Profile Centre endpoint updates the store's D1 customer and subscription records. The CustomerOps endpoint is a separate Head Office oversight and reconciliation feed.

## Cloudflare production bindings

- `STRIPE_PUBLISHABLE_KEY` - Pages secret
- `STRIPE_SECRET_KEY` - Pages secret
- `STRIPE_WEBHOOK_SECRET` - Pages secret for the Profile Centre store webhook only

Secret values must never be stored in D1, source control, documentation, browser responses or logs. The webhook handler verifies Stripe's signature against the unmodified request body before parsing JSON.

## Identity and idempotency

Checkout requires an authenticated Profile Centre account with a Head Office UCN. Stripe customers, Checkout Sessions, subscriptions and PaymentIntents carry the Profile Centre user ID and Head Office UCN as server-controlled metadata. Existing Stripe customers are reused only when there is one exact email match and any existing UCN metadata agrees.

Each Stripe event is recorded by event ID in `stripe_webhook_events`. Successfully processed duplicates receive HTTP 2xx without applying customer or subscription changes again. Processing failures receive HTTP 5xx so Stripe can retry.

## Head Office status

Profile Centre reports Stripe as connected in its platform heartbeat only after a genuine signed production event has been processed and `app_settings.stripe_production_verified_at` has been recorded. This prevents a configured secret from being presented as an operational integration.
