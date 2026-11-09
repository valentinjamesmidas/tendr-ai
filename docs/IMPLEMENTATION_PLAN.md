# Implementation backlog

| ID | Priority | Owner | Dependencies | Acceptance / tests | Status |
|---|---|---|---|---|---|
| M0 | P0 | Lead | preflight | coherent architecture, contracts, AGENTS, dependency lock | DONE |
| M1 | P0 | Web/Lead | M0 | runnable React workspace, strict typing, unit tests, CI, browser journey | PARTIAL: build/DOM tests pass; real-browser tests blocked |
| M2 | P0 | Database | M0 | local auth/provisioning + tenant RLS negative tests + storage isolation | PARTIAL: SQL only; NOT_RUN |
| M3a | P0 | Sources | M1 | fixture normalization, inventory, document set hash | DONE, MOCKED source |
| M3b | P0 | Documents | M2 | authenticated private uploads, bounded PDF/DOCX/XLSX/ZIP extraction and lineage tests | NOT_IMPLEMENTED |
| M4a | P0 | Core | M3a | exact arithmetic, valid fixture findings, citations and numeric mismatch rejection | DONE, MOCKED AI |
| M4b | P0 | AI | M3b | verified live provider API/model, structured outputs, limits and evaluation | NEEDS_VERIFICATION |
| M5 | P0 | Jobs | M2/M4 | transactional claim, leases, retries, restart-safe completion/cancel tests | PARTIAL: lifecycle guard only |
| M6 | P0 | Commerce | M2/M5 | Stripe sandbox signature verification, ledger/reservation RPC, race/replay tests | PARTIAL: isolated reference model only |
| M7 | P0 | Web | M1/M4a | full local browser journey, same-data exports | PARTIAL: demo; DOCX and native PDF deferred |
| M8 | P0 | Lead | M2–M7 | server limits, privacy/export/deletion, operations, security gates | NOT_IMPLEMENTED |
| M9 | P1 | Future | all P0 | subscriptions, re-audits, profiles and PWA | DEFERRED |
| M10 | P2 | Future | commercial platform | separate sales data boundary, provenance and reviewed outreach drafts | DEFERRED |

Next three tasks: (1) install isolated Supabase environment and execute/fix SQL tests; wire real auth and organization provisioning. (2) implement tenant-authorized upload/conversion and durable worker with crash recovery. (3) implement transactional credits and Stripe sandbox end-to-end before live provider activation. External activation is never implied by presence of a placeholder environment variable.
