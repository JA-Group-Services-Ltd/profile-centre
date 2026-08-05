# Sousa Murray Profiles D1 migration validation report

## Validation status

Local transformation and validation completed successfully against the
production export created at `2026-07-31T00:55:04.958Z`.

This report contains counts and security actions only. It contains no customer
email addresses, Microsoft Entra identifiers, hashes, PINs, cookies, tokens,
session fingerprints, API credentials or secret values.

## Source verification

| Measure | Result |
| --- | ---: |
| SQLite integrity check | Passed |
| Source tables | 70 |
| JSON table exports | 70 |
| JSON/SQLite count mismatches | 0 |
| Source records | 435 |
| Source users | 3 |
| Users with Microsoft Entra identity | 3 |
| Populated legacy password hashes | 0 |
| Source foreign-key errors | 0 |

### Populated source tables

| Table | Records |
| --- | ---: |
| `admin_pins` | 1 |
| `admin_settings` | 39 |
| `audit_log` | 143 |
| `card_templates` | 5 |
| `feature_plan_rules` | 130 |
| `legal_policies` | 12 |
| `partner_enquiries` | 1 |
| `plans` | 7 |
| `platform_features` | 26 |
| `points_ledger` | 2 |
| `points_rules` | 7 |
| `points_store_items` | 12 |
| `referral_codes` | 2 |
| `rewards` | 6 |
| `session_activity` | 1 |
| `support_pins` | 1 |
| `themes` | 36 |
| `users` | 3 |
| `vat_settings` | 1 |
| **Total** | **435** |

## Destination verification

| Measure | Result |
| --- | ---: |
| D1 schema version | 3 |
| Destination tables | 76 |
| Largest table | 62 columns |
| Approved production records imported locally | 432 |
| Migration metadata records | 7 |
| Total local destination records | 439 |
| Deliberately excluded source records | 3 |
| Destination integrity check | Passed |
| Duplicate primary-key errors | 0 |
| Record-count mismatches | 0 |
| Destination foreign-key errors | 0 |
| Unexplained record loss | 0 |

### Populated destination tables

| Table | Records |
| --- | ---: |
| `admin_settings` | 39 |
| `app_settings` | 7 |
| `audit_log` | 143 |
| `card_templates` | 5 |
| `feature_plan_rules` | 130 |
| `legal_policies` | 12 |
| `partner_enquiries` | 1 |
| `plans` | 7 |
| `platform_features` | 26 |
| `points_ledger` | 2 |
| `points_rules` | 7 |
| `points_store_items` | 12 |
| `referral_codes` | 2 |
| `rewards` | 6 |
| `themes` | 36 |
| `users` | 3 |
| `vat_settings` | 1 |
| **Total** | **439** |

All other destination tables contain zero rows in this source export.

## Normalisation

The 131-column legacy `profiles` table is represented by:

- `profiles` — 32 columns;
- `profile_business_details` — 25 columns;
- `profile_public_content` — 41 columns;
- `profile_configuration` — 37 columns.

The 106-column legacy `business_card_orders` table is represented by:

- `business_card_orders` — 33 columns;
- `business_card_order_design` — 42 columns;
- `business_card_order_financials` — 34 columns.

Every extension table retains the original record `id` as its primary key and
as a foreign key to the parent table.

## Security exclusions

Three populated legacy security-state records were deliberately excluded:

| Source | Records | Reason |
| --- | ---: | --- |
| `admin_pins` | 1 | Legacy administrative PIN hash |
| `session_activity` | 1 | Active session identifier and device fingerprint |
| `support_pins` | 1 | Temporary support PIN |

The following empty security-state tables were also configured for
whole-table data exclusion: `account_pins`, `admin_challenge_tokens`,
`oidc_state`, `sessions` and `stripe_config`.

The migration sets `users.password_hash`, `profiles.pin_hash` and
`profiles.public_pin_hash` to `NULL`. No populated values were present in
those fields in this export.

## Production gate

At the time of this report, the production `/api/health` endpoint reported
schema version 1 and the temporary importer reported `ready`, not `complete`.
This proves that the corrected production import marker has not been written.

The live D1 migration, Time Travel checkpoint and post-import verification
remain gated on authenticated Cloudflare D1 access. They must not be marked as
complete from the local validation result.
