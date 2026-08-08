# Sousa Murray Profiles Custom Domain Router

This Worker is the Cloudflare for SaaS origin router for customer vanity hostnames.

- Script name: `sousa-murray-profiles-custom-domain-router`
- Canonical upstream: `https://sousamurrayprofiles.jagroupservices.co.uk`
- Customer hostnames are attached as exact Worker Routes by the Profiles server after a Custom Hostname is created.
- Do not attach this Worker to `*/*` across `jagroupservices.co.uk`; the zone also contains unrelated JA Group Services systems.
- The Worker refuses direct JA Group Services/Pages hostnames as a defence-in-depth measure.

Deploy from this directory with Wrangler after the Cloudflare account is authenticated. `PROFILES_ORIGIN` may be overridden if the canonical Profiles origin changes.
