# Sousa Murray Profiles — Head Office Central Payments

Sousa Murray Profiles no longer creates new customer purchases directly against a Profiles-specific Stripe account. New plan Checkout, Billing Portal access and subscription cancellation are routed through **JA Group Services Ltd Head Office Central Payments**.

## Production architecture

```text
Sousa Murray Profiles
        |
        | scoped Head Office platform credential
        | UCN + governed product/price code
        v
JA Group Services Head Office Central Payments
        |
        v
Approved JA Group Services Ltd Stripe account
```

The Profiles website never receives the principal Central Payments Stripe secret or webhook signing secret.

## Production endpoints

Profiles keeps its customer-facing API contract:

- Authenticated Checkout: `POST /api/billing/checkout`
- Authenticated Billing Portal: `POST /api/billing/portal`
- Authenticated cancellation: `POST /api/billing/cancel`

Those routes now call Head Office:

- `GET /api/v1/payments/account-info`
- `POST /api/v1/payments/checkout`
- `GET /api/v1/payments/status`
- `POST /api/v1/payments/portal`
- `POST /api/v1/payments/subscription`

The approved payment brand is `SOUSA_MURRAY_PROFILES`.

## Governed monthly catalogue

The Profiles website sends Head Office product and price codes rather than Stripe Product/Price IDs:

| Profiles plan | Product code | Price code |
|---|---|---|
| Starter | `PROFILES_STARTER` | `PROFILES_STARTER_MONTHLY` |
| Professional | `PROFILES_PROFESSIONAL` | `PROFILES_PROFESSIONAL_MONTHLY` |
| Organisation / Business | `PROFILES_ORGANISATION` | `PROFILES_ORGANISATION_MONTHLY` |
| Ultimate Organisation | `PROFILES_ULTIMATE_ORGANISATION` | `PROFILES_ULTIMATE_ORGANISATION_MONTHLY` |

Head Office owns the Stripe Product/Price IDs and repairs/reprovisions the standard catalogue against the currently approved Stripe account when required.

## Cloudflare production connection

Profiles accepts either of the existing server-only Head Office credential names:

- `CUSTOMEROPS_API_KEY` — preferred Central Payments connection credential; or
- `HEAD_OFFICE_PLATFORM_KEY` — supported where the existing Profiles Head Office credential has the required payment scopes.

The Head Office base URL is read from `CUSTOMEROPS_BASE_URL` or `HEAD_OFFICE_API_BASE_URL`, with `https://customerops.jagroupservices.co.uk` as the production default.

The credential must include the Central Payments scopes required by the operation, including `payments:checkout`, `payments:status` and `payments:portal`.

Do not put `CENTRAL_STRIPE_SECRET_KEY` or `CENTRAL_STRIPE_WEBHOOK_SECRET` on the Profiles website.

## Customer identity and local subscription state

A valid ten-digit JA Group Services UCN remains the authoritative customer billing identity. After Checkout, Profiles reads its own platform-scoped Central Payments status and reconciles the active subscription into the local D1 `subscriptions` table so existing dashboard entitlement logic continues to work.

The local `stripe_customer_id` and `stripe_subscription_id` fields are references returned through the governed Head Office status API; the Profiles website does not use them to make unrestricted Stripe API calls.

## Legacy Profiles Stripe webhook

`POST /api/stripe/webhook` remains temporarily available only for subscriptions created under the former dedicated Profiles Stripe integration. It is not used for new Central Payments Checkout sessions.

This compatibility route can be retired separately once any legacy subscriptions, refunds, disputes, reporting and record-retention obligations have been reviewed.
