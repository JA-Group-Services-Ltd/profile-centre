# Custom Domains launch checklist

## Code gates

- Customer plan entitlement is enforced server-side.
- Free and Starter are denied.
- One active custom domain is permitted per profile in version 1.
- Hostnames are unique across active records.
- Apex/root domains are rejected in version 1.
- JA Group Services, Pages and Workers platform hostnames are reserved.
- Customer and Admin create/check/disconnect actions are audited.
- Public resolution requires active Cloudflare hostname status, active SSL, published profile and current eligible plan.
- Exact Worker Routes are used per customer hostname.

## Cloudflare account gates

Before the first live customer domain can be connected:

1. Enable Cloudflare for SaaS on the zone.
2. Configure and activate the fallback origin/CNAME target used by `CLOUDFLARE_SAAS_CNAME_TARGET`.
3. Deploy `workers/custom-domain-router` as `sousa-murray-profiles-custom-domain-router`.
4. Add Pages server-side configuration:
   - `CLOUDFLARE_SAAS_API_TOKEN`
   - `CLOUDFLARE_SAAS_ZONE_ID`
   - `CLOUDFLARE_SAAS_CNAME_TARGET`
   - optional `CLOUDFLARE_SAAS_ROUTER_SCRIPT`
5. The API token must be restricted to the SaaS zone and permit Custom Hostnames/SSL Certificates plus Workers Routes.
6. Verify a real test subdomain through DNS, hostname activation, SSL activation and public profile rendering before customer launch.

No Cloudflare API secret belongs in GitHub or D1.
