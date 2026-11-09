# Supabase foundation — PARTIAL / NOT_RUN

This is a local-first foundational migration, **not a connected production backend**. The browser currently uses synthetic demo adapters. Do not point the browser at this schema until authenticated APIs, onboarding and integration tests are complete.

Requirements: Docker and a compatible Supabase CLI, installed separately. Neither was available in the build environment. Run from the repository root:

```sh
supabase start
supabase db reset
supabase test db
supabase stop
```

`db reset` destroys the **local development database**. Never add a production `--db-url` or linked cloud target to these commands. These commands have not been executed here. The 23 pgTAP assertions are test definitions, not passing test results. The database major version is pinned to 15 for the local draft; confirm supported project/runtime versions before activation.

The seed contains only clearly synthetic tender metadata. Tests create transient synthetic tenants/users and roll back. A private Storage bucket accepts only supported document MIME types, up to 25 MiB; ZIP handling and worker extraction are not implemented. Storage MIME checks do not replace file-signature validation or malware scanning.

Public tables have RLS and explicit grants. Authenticated users may read their tenant data and shared public metadata; trusted server code owns all financial, audit, membership and job writes. Browser organization owners cannot self-grant credits or entitlements. Uploads must use an organization UUID path prefix; client replacement/deletion is not permitted. Generate unique immutable version keys in the future ingestion service. Signed download links must be generated server-side only after authorization, with short expirations; no such endpoint exists yet.

Missing before real use: Auth onboarding/API, transactional payment/credit reservation logic (advisory or row locks and atomic business validation), signature-verified Stripe webhook, atomic worker claim/lease/heartbeat/retry handlers, lineage hashing/validation, upload quarantine and file checks, retention/deletion implementation, full RLS/Storage tests against the target runtime. The ledger table prevents duplicate idempotency keys and mutations, but table constraints alone **do not** enforce balance availability or exactly-once consumption. Entitlement expiry/revocation must be checked by protected processing/download APIs; table read access does not grant processing permission.
