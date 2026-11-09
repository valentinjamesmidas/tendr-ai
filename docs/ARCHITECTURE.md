# Architecture
React/Vite web consumes shared TypeScript schemas and a browser-compatible domain pipeline. The demo's source and AI providers are deterministic fixtures. Source evidence preserves document ID, version, locator, and exact text. Hashes use Web Crypto SHA-256. Money uses bounded integer minor units; percentage calculations use exact integer arithmetic and explicit rounding.

Production target: authenticated browser → Supabase tenant-scoped data/API → server-authoritative payment/entitlement transaction → durable queue → Node worker → acquisition/extraction/rules/AI/verification → private report. Database is authoritative; never trust demo state as authorization. Current implementation has no live API, Node worker daemon or payment endpoint. In-memory financial reference model is tested but deliberately not exposed as production infrastructure.

Boundaries: schemas owns contracts; sources owns acquisition; rules owns arithmetic; verification resolves evidence; AI owns analysis proposals; domain orchestrates. Frontend renders and exports the same report object. Supabase migration is an independent initial foundation, not currently connected to the web adapter.

Lifecycle guard forbids entitlement bypass and terminal reentry. Production retry/leases/outbox/transactional completion remain unimplemented; browser demo reload starts over. SQL must be tested in an isolated local Supabase environment before integration or release.
