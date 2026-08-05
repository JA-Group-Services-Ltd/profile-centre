# Sousa Murray Profiles D1 production migration

## Scope

This migration converts the 70-table Airo SQLite production schema to a
Cloudflare D1-compatible schema while preserving production identifiers,
relationships, timestamps, profile configuration, plans, subscriptions,
audit records, platform settings, themes, features, rewards, support records,
data-protection records and business-card order data.

No production export, generated data SQL, customer data or authentication
material is stored in this repository.

## D1 column-limit normalisation

The legacy `profiles` table contains 131 columns. It is normalised into:

- `profiles`;
- `profile_business_details`;
- `profile_public_content`;
- `profile_configuration`.

The legacy `business_card_orders` table contains 106 columns. It is normalised
into:

- `business_card_orders`;
- `business_card_order_design`;
- `business_card_order_financials`.

Each extension table uses the original `id` as both its primary key and a
foreign key to its parent row with `ON DELETE CASCADE`.

## Security filtering

Legacy rows from the following tables are deliberately not imported:

- `account_pins`;
- `admin_challenge_tokens`;
- `admin_pins`;
- `oidc_state`;
- `session_activity`;
- `sessions`;
- `stripe_config`;
- `support_pins`.

The schemas remain available for runtime use, but legacy customer or
administrative PIN hashes, temporary codes, session state, cookies,
fingerprints, OAuth state/verifiers and credential configuration are not
carried into D1.

The `users.password_hash`, `profiles.pin_hash` and
`profiles.public_pin_hash` fields are set to `NULL` during transformation.
The migration build refuses to proceed unless every source user has a
Microsoft Entra identity.

## Controlled execution

`scripts/migration/build_d1_migration.py` creates a consistent local snapshot
without changing the source database or its WAL files. It independently checks
every JSON export against SQLite, builds a temporary transformed database,
and verifies integrity, primary-key uniqueness, record counts and foreign-key
relationships.

Generated `schema.sql`, `data.sql`, `validated.db` and detailed migration
report files are production artefacts and must remain outside the repository.
Only the permanent, data-free D1 schema belongs in `migrations`.

Before applying the schema or data to production:

1. verify the exact Cloudflare account, Pages project, D1 database and `DB`
   binding;
2. record D1 table names, row counts and schema version;
3. create and retain a D1 export and Time Travel restore point/bookmark;
4. remove only positively identified partial migration tables;
5. apply schema and records in recoverable batches;
6. verify D1 record counts and `PRAGMA foreign_key_check`;
7. test production routes and customer/admin journeys;
8. remove the temporary importer endpoint and status artefacts.

## Rollback

If production verification fails, stop application writes and restore the D1
database to the pre-migration Time Travel bookmark. Confirm the restored table
list, row counts, schema version and `/api/health` result before reopening
writes. The immutable Airo export remains the independent source of truth.
