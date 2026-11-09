# Decisions — 2026-11-09
ADR-001: pnpm workspace, TypeScript strict, React/Vite. Matches requested stack; no repository initially existed. Installed versions are captured in lockfile. Node v24.22.1 and pnpm 11.25.0 available.
ADR-002: credential-free synthetic adapter first; production mode unavailable. Avoids presenting invented NEN data or payment confirmation as real. External APIs behind contracts; integration activation requires separate validation.
ADR-003: custom CSS rather than introducing shadcn/Tailwind in first milestone. Keeps starter small and runnable; UI primitives may be migrated later. No claim of full preferred stack compliance.
ADR-004: PostgreSQL/RLS migration foundation authored, NOT_RUN without Docker/Supabase CLI. No cloud changes. Frontend demo is isolated from all tenant data.
ADR-005: no deployment. Supplied specification explicitly requires authorization before production publication. Source archive is the reviewable deliverable.
ADR-006: PDF via browser print, JSON/Markdown downloads in first slice; programmatic PDF and editable DOCX deferred. Exports derive from the report object, never independent AI arithmetic.
ADR-007: financial/job models are in-memory reference models; atomicity tests cover a single JS process only, not database concurrency or worker recovery.
