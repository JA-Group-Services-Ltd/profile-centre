# Sousa Murray Profiles — Custom Domains

## Customer entitlement

Custom Domains are available only to:

- Professional
- Organisation (`business`)
- Ultimate Organisation (`ultimate_business`)
- Ultimate Organisation+ (`ultimate_plus`)

Free and Starter are denied server-side. The D1 plan flags are synchronised to this policy and the approved monthly pricing update is applied once using the `custom_domain_plan_pricing_v1` marker.

## Customer flow

1. Customer opens `/dashboard/custom-domains`.
2. Customer selects one of their Profiles records and enters a subdomain such as `profile.example.co.uk`.
3. The server verifies account entitlement, profile ownership, hostname validity and uniqueness.
4. The server creates a Cloudflare for SaaS Custom Hostname and an exact Worker route for that hostname.
5. The dashboard shows the CNAME target and any validation records returned by Cloudflare.
6. `POST /api/custom-domains/:id/check` refreshes Cloudflare hostname and SSL state.
7. The domain becomes active only when both Cloudflare hostname status and SSL status are `active`.
8. Requests to the customer hostname are routed through `sousa-murray-profiles-custom-domain-router` to the canonical Profiles application.
9. The browser resolves the hostname through `/api/custom-domains/resolve` and renders only the assigned published profile at `/`.

Version 1 deliberately supports customer subdomains only. Apex/root domains are rejected.

## Cloudflare runtime configuration

Sousa Murray Profiles Pages Functions require these server-side values:

- `CLOUDFLARE_SAAS_API_TOKEN` — secret; minimum permissions must cover Custom Hostnames/SSL Certificates and Workers Routes for the SaaS zone.
- `CLOUDFLARE_SAAS_ZONE_ID` — zone containing the Cloudflare for SaaS configuration.
- `CLOUDFLARE_SAAS_CNAME_TARGET` — friendly customer CNAME target.
- `CLOUDFLARE_SAAS_ROUTER_SCRIPT` — optional; defaults to `sousa-murray-profiles-custom-domain-router`.

The API token must never be exposed to the browser or stored in D1/GitHub.

## Router Worker

Source: `workers/custom-domain-router/`.

The Worker proxies customer-hostname requests to `https://sousamurrayprofiles.jagroupservices.co.uk` while preserving the customer hostname in `x-sousa-murray-custom-hostname` for diagnostics. Exact per-customer Worker routes are used rather than a zone-wide `*/*` route, protecting other JA Group Services hostnames from accidental interception.

The Worker must exist in the Cloudflare account before the first customer hostname is connected.

## D1 records

The existing `custom_domains` table is extended at runtime with:

- `cloudflare_hostname_id`
- `cloudflare_route_id`
- `cname_target`
- `ownership_verification_json`
- `ssl_validation_json`
- `last_checked_at`

Active hostname and active-profile uniqueness are enforced with partial unique indexes. Disconnected records are retained for audit history and can be reconnected later.

## Administration

- Customer management: `/dashboard/custom-domains`
- Admin customer domain view: `/admin/users/:userId/custom-domains`
- Public resolver: `/api/custom-domains/resolve`

Customer and administrator create/check/disconnect operations write to the existing audit log.
