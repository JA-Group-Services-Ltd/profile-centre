# Head Office connector

Profile Centre connects to the JA Group Services Head Office customer authority
as platform `PROFILE_CENTRE` (division `DIV-020`).

Production Pages Functions require:

- `HEAD_OFFICE_API_BASE_URL` set to `https://customerops.jagroupservices.co.uk`;
- `HEAD_OFFICE_PLATFORM_KEY` stored as an encrypted production secret.

Customer authentication synchronises the verified JA Group Services ID identity
before creating a Profile Centre session. The returned UCN and branch-safe
access summary are cached locally. A fresh Head Office decision is required
when authenticated customer APIs are used. Deny, review, step-up, and session
revocation instructions fail closed. A previous allow may be used for no more
than five minutes during a transient Head Office outage; first login and expired
decisions do not fail open.

Staff authentication is excluded. It continues to use
`ADMIN_OIDC_*`, `admin_entra_oid`, the Administrator app role, and the existing
admin PIN/RBAC controls.

The admin customer record exposes a read-only Head Office Security section.
It displays only the UCN, account/security status, access decision,
restriction summaries, and age-assurance state. It cannot create, clear, or
downgrade Head Office controls and never receives confidential case reasoning.

Age assurance follows contract `ja-head-office-age-assurance-v1`, applies only
to customer identities, has a minimum age of 18, excludes staff identities, and
must remain disabled until Head Office explicitly enables enforcement.
