# Sousa Murray Profiles — Cloudflare Migration

## Purpose

This migration moves Sousa Murray Profiles away from the Airo-specific Node and local SQLite runtime while preserving the existing React frontend and the live Cloudflare Pages deployment.

The migration must be completed in controlled stages. The existing Node API must not be removed until the corresponding Cloudflare Pages Functions have been implemented, tested and confirmed against a preview deployment.

## Deployment settings

Use the following Cloudflare Pages build settings for the Cloudflare-native frontend build:

- **Build command:** `npm run build:cloudflare`
- **Build output directory:** `dist/client`
- **Root directory:** repository root
- **Node version:** 22 or later

The normal `npm run build` command remains available for the legacy Node/SSR build during the transition.

## Cloudflare bindings

Configure the following binding in both **Production** and **Preview**:

| Binding | Cloudflare resource | Required |
|---|---|---:|
| `DB` | Sousa Murray Profiles D1 database | Yes |

Cloudflare dashboard path:

`Workers & Pages → profile-centre → Settings → Bindings → Add → D1 database`

After changing a binding, redeploy the Pages project so the Function receives the updated environment.

## Runtime variables and secrets

Configure non-secret values as variables and confidential values as encrypted secrets in both Production and Preview.

### Variables

- `ENVIRONMENT`
- `SITE_ORIGIN`
- `OIDC_CLIENT_ID`
- `OIDC_ISSUER_URL`
- `OIDC_REDIRECT_URI`
- `EMAIL_FROM`

### Secrets

- `SESSION_SECRET`
- `OIDC_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

Do not commit production values to GitHub. `.dev.vars` is ignored and `.dev.vars.example` contains placeholders for local development.

## D1 migration

The initial Cloudflare schema is located at:

`migrations/0001_cloudflare_foundation.sql`

It creates the core tables for:

- application settings and schema versioning;
- users and sessions;
- plans and subscriptions;
- profiles and profile links;
- support tickets and messages;
- data protection requests;
- audit events;
- integration synchronisation logs.

Apply migrations locally first, then to the remote D1 database:

```bash
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

Do not run a remote migration until the correct Cloudflare account and D1 database have been confirmed.

## Health check

The Cloudflare Function at `/api/health` verifies:

1. that the Pages Function is running;
2. that the `DB` binding is available;
3. that the D1 schema migration has created `app_settings`;
4. that `schema_version` is present.

Expected healthy response:

```json
{
  "status": "ok",
  "service": "profile-centre",
  "checks": {
    "database": {
      "status": "ok",
      "schemaVersion": "1"
    }
  }
}
```

A missing binding, missing migration or database error returns HTTP `503` and a `degraded` status.

## Migration stages

### Stage 1 — Foundation

- Cloudflare-specific frontend build command.
- Pages Functions directory.
- D1 schema.
- API health endpoint.
- API security middleware.
- Secret and local-state protection.

### Stage 2 — Authentication and sessions

- Microsoft Entra/OpenID Connect login and callback Functions.
- Signed, secure and HTTP-only session cookies.
- D1-backed session records.
- CSRF protection.
- Customer and administrator authorisation middleware.

### Stage 3 — Profile operations

- Profile create, read, update and delete endpoints.
- Link management.
- Public profile lookup.
- Profile visibility, PIN and moderation controls.
- D1 data import from the legacy export.

### Stage 4 — Commercial and operational functions

- Stripe checkout and webhook Functions.
- Plans, subscriptions and entitlement checks.
- Support tickets and customer replies.
- Notifications and Resend email delivery.
- Data protection requests and audit reporting.

### Stage 5 — Final cutover

- Confirm all customer and administrator journeys in Preview.
- Import the final production data snapshot.
- Place the legacy service into read-only mode.
- Switch all API traffic to Pages Functions.
- Verify authentication, billing, webhooks and email.
- Remove the Airo runtime and obsolete local SQLite code only after sign-off.

## Wrangler configuration warning

Do not add a hand-written production `wrangler.jsonc` without first downloading and reviewing the existing Pages project configuration:

```bash
npx wrangler pages download config <PAGES_PROJECT_NAME>
```

Once a Pages project deploys with a Wrangler configuration containing `pages_build_output_dir`, that file becomes the source of truth for the project. An incomplete file could remove or replace existing dashboard bindings.

## Release gate

This branch is safe to preview because it does not delete or replace the existing Node backend. Merge only after:

- the Cloudflare preview build succeeds;
- `/api/health` returns the expected result;
- the D1 binding is confirmed as `DB`;
- the initial migration is applied to the intended preview database;
- existing public pages still load and deep links continue to work.
