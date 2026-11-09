# Data model

Status: **PARTIAL — migration drafted; database tests NOT_RUN**. The web demo is isolated from this schema. No database, Auth, paid entitlements or worker service is currently activated.

## Tenant boundary

`organizations` has memberships in `organization_members`. Every private document, audit, finding, job and financial record has `organization_id`. Membership checks use `private.is_member(uuid)`, a `SECURITY DEFINER` helper with an empty fixed `search_path`, no dynamic SQL, qualified table names and explicitly limited execute grants. The migration owner must remain a trusted database role. Never use mutable JWT user metadata for organization ownership.

All public tables enable RLS. Anonymous access is revoked. Authenticated users have tenant-scoped SELECT only, except authenticated shared tender metadata. Service-role server code owns onboarding, membership, evidence, jobs and all financial mutations. Service keys must never be bundled into the frontend. Provider events are not visible to clients. Storage has a private, 25 MiB bucket with tenant prefix checks against actual membership; UPDATE/DELETE has no client policy.

## Core relationships

| Relation | Responsibility | Integrity boundary |
|---|---|---|
| `tenders` | Shared public metadata and synthetic marker | Unique validated NEN reference; no private uploads |
| `tender_documents` | Private source inventory | Tenant + document key; organization-prefixed storage key |
| `document_versions` | Version identity and SHA-256 | Tenant + parent document FK; unique version number |
| `document_extractions` | Extracted content, locators, warnings | Tenant + version FK |
| `audits` | Status and analysis provenance | Tenant + audit key; provider/model/rule/prompt/schema versions |
| `audit_document_versions` | Exact audit input version set | Composite FKs to audit and versions |
| `findings` | Fact/calculation/assessment with action | Tenant + audit + finding key |
| `finding_evidence` | Quote, locator and verification | Must reference a version belonging to the same audit and tenant |
| `audit_jobs`, `audit_job_events` | Queue draft, lease fields, safe progress events | Tenant FKs and unique idempotency key |
| `payments` | Confirmed server-side payment state | Unique Stripe session/intent IDs; integer minor units |
| `stripe_events` | Minimized server-only event envelope | Unique provider event ID, digest and processing state |
| `entitlements` | Audit access grant | Same-tenant audit and payment; expiry/revocation fields |
| `credit_ledger` | Append-only signed credit-unit accounting | Immutable records, unique tenant idempotency key |
| `credit_reservations` | Hold lifecycle | Same-tenant audit and ledger references |

Composite foreign keys reject cross-tenant evidence and payment relationships even when a trusted writer makes a mistake. Credit quantities are integers; money uses integer minor units in `bigint` and CZK currency. Adapters must serialize bigint without lossy conversion into JavaScript numbers.

## Financial semantics: design only

Ledger `grant/release/refund` increases available units, `reserve/expire` decreases available units, `consume` records finalized reservation with zero additional delta; adjustment requires a nonzero signed delta. This is a proposed accounting convention, not a working payment integration. Availability checks, reservation/consumption/release ordering and authorization require transactional server functions with tenant row locking. They are not implemented. No client may write any of these rows.

A unique event/key constraint alone cannot provide atomic webhook fulfillment or prevent credit overspending. Server handlers must commit event processing, payment state, entitlement changes and ledger entries together and account for duplicate/out-of-order events. Separate payment status and audit job status. No status on a success URL may grant access.

## Deferred model

Profiles/preferences, company qualification inputs, chunk indexing, relationship analysis, report exports, usage-cost telemetry, subscriptions/plans and billing adjustments remain future migrations. Sales Intelligence is intentionally absent and must never reuse private audit tables. No empty schema is presented as a completed product feature.

## Retention and historical evidence

The ledger forbids UPDATE/DELETE by trigger; corrections require additional entries. Versioned extraction/evidence should be treated as immutable by future server code; draft SQL does not yet enforce complete historical immutability for every provenance table. Document deletion, organizational deletion and statutory financial-record retention require explicit workflows and `NEEDS_LEGAL_REVIEW`. Current FKs deliberately do not cascade away records. Storage reads permit authorized tenant members; short-lived signed links and object lifecycle cleanup still require server endpoints.

## Verification

`supabase/tests/tenant_isolation.test.sql` defines 23 pgTAP assertions including A/B read isolation, owner mutation rejection, raw Stripe event access rejection, storage prefix enforcement, cross-tenant composite FK rejection, ledger immutability and duplicate-key rejection. These tests are **NOT_RUN** because Docker and Supabase CLI were unavailable. Execute and extend them against local Supabase before connecting any real customers. See `supabase/README.md` for commands and explicit production blockers.

Design references checked by the orchestrator: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). Documentation review is not execution evidence.
