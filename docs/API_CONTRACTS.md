# Contracts and current verification
Shared contracts: packages/schemas/src/index.ts. SourceProvider normalizes references, fetches metadata and document inventory, downloads known documents and versions. AuditAIProvider emits typed proposals. No real source/model SDK is implemented or required to start demo.
AuditReport retains source hash, rule version, fixture provider/model, timestamp, verification summary, findings and calculations. Only supported synthetic reference fixtures resolve. Unknown reference produces an error.

Official documents checked 2026-11-09:
- https://supabase.com/docs/guides/database/postgres/row-level-security : RLS/auth.uid policies checked. Runtime and negative tests NOT_RUN locally.
- https://supabase.com/docs/guides/storage/security/access-control : private object policies are required.
- https://docs.stripe.com/webhooks : webhook signatures, durable event deduplication and event-order tolerance required. No Stripe SDK/webhook integrated.
- https://docs.stripe.com/checkout/fulfillment : fulfillment must be server-authoritative; redirect alone never grants access.
- https://ai.google.dev/gemini-api/docs/structured-output : search retrieved official schema-support guidance; full page retrieval failed with unsupported text/markdown. Model names, feature compatibility, pricing and exact SDK calls NEEDS_VERIFICATION. No historical model name hardcoded.
- Apify studio-amba/nen-nipez-cz-scraper and apify/rag-web-browser: NEEDS_VERIFICATION. No actor calls implemented. NEN binary acquisition not verified.

No API credentials, private files or external billable calls used. Current package versions come from registry resolution and lockfile; successful local build does not verify provider contracts.
