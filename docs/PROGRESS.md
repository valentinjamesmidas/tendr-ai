# Implementation status

## Interactive report, account and pricing — 2026-11-26

The live report includes searchable findings, severity and category filters, an attachment inventory, and exact citations. Its bid action creates an editable Markdown draft and a checklist from the selected report. The homepage includes a downloadable illustrative offer for public procurement `N006/26/V00015697` and a comparison of Pro, Business and Enterprise.

Customer accounts, sessions, the initial free credit and expiring analysis reservations use the Cloudflare D1 `CUSTOMERS` binding. A report with verified findings consumes one credit. Failed or unreadable runs release the reservation. Email addresses are not verified and there is no email-based recovery. The pricing CTAs create stored purchase requests with the selected period and amount. Card charging, automatic subscription renewal and paid credit provisioning require a payment provider and remain pending.

## NEN analysis pilot — 2026-11-26

The homepage takes a single NEN reference and shows progress for lookup, download, extraction, analysis and verification. The production Cloudflare Worker resolves it through the ISVZ index and retrieves the public attachments from the applicable NEN XML profile. The Ministry for Regional Development profile also covers recent references beyond the index. The Worker handles bounded downloads and ZIP extraction and passes text with locators to Workers AI. The report identifies unreadable files and includes only findings with exact evidence. The Czech homepage uses Inter Tight and a five-step list.

Production acceptance on `N006/26/V00034418` read four DOCX files and returned six findings with verified citations. Production verification on `N006/26/V00017834` reported that the scanned PDF required OCR. Local typecheck, lint, 36 unit and integration tests, three Chromium journeys and the Wrangler dry run passed. Nationwide coverage of recent and historical references, OCR, and large or unsupported archives remain partial. See [Deployment](DEPLOYMENT.md#nen-analysis-pilot) for coverage and file limits.

## Bid preparation — 2026-11-25

The demo follows the bid-preparation workflow from the Notion brief. After simulated checkout it shows a sourced requirements matrix, then a simulated specialist review and an editable package for handoff. The package contains a cover sheet, sample declarations, a reference list, inputs for JEO when applicable and quoted attachment requirements. It exports as Markdown or through browser print. The checklist includes the fixture-specific attachments and prompts to confirm the deadline, clarifications and submission method.

The service price is CZK 9,999 per bid without a commission. VAT treatment is pending. Written customer intake and handoff, live portal ingestion and change tracking, and authenticated specialist review are pending production work. No live payment or deployment was performed.

Lint, typecheck, build, 30 unit and integration tests, and both Chromium end-to-end tests passed. The Chromium results supersede the historical launch blocker below.

## First runnable milestone — 2026-11-09

First runnable milestone delivered with a functional local demo vertical slice. Production P0 is incomplete. Repository originally empty; Node24.22.1/pnpm11.25.0/Git/package registry available; Docker and Supabase CLI absent.

## Completed
Workspace, React/Vite shell, TypeScript strict contracts, two synthetic tenders, normalized input and unknown-reference errors, document inventory, mock source/AI interfaces, exact financial rules, source verification, numeric consistency gate, SHA-256 document-set hash, report/filters/source inspector, qualification missing-evidence state, draft/checklist, JSON/Markdown/TXT downloads and section print. CI configuration included (not run in GitHub). Unit/integration/UI-DOM tests pass. Initial source upload to GitHub is tracked by the repository commit history; hosting remains a separate step.

## Partial / mocked
Source, AI and purchase are MOCKED; no real source/model/payment request. Demo uses real audit functions but no durable queue or server entitlements. Financial/job packages are isolated reference models, not production implementations. Supabase initial schema/RLS/private storage and 23 SQL assertion definitions are PARTIAL and NOT_RUN. No auth UI/session, private upload, PDF/DOCX/XLSX/ZIP conversion, Node worker, real Checkout/webhook, native PDF/DOCX, subscriptions or sales module.

## Verification evidence
- pnpm install: PASS after explicitly allowing esbuild build script; lockfile produced. No other install scripts authorized.
- pnpm lint: PASS.
- pnpm typecheck: PASS.
- pnpm test: PASS — 30 tests / 3 files (24 core, 5 reference-commerce/lifecycle, 1 UI-DOM journey).
- pnpm build: PASS — Vite output with nonfatal upstream Zod annotation warnings.
- pnpm exec playwright install chromium: FAILED — CDN returned unusable/truncated ZIP.
- PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm test:e2e: BLOCKED — both cases failed at browser launch; Chromium socket() Operation not permitted. No application assertion reached. These are NOT_PASS; browser acceptance gate not met. Separate browser surface could not connect to local loopback. No visual/mobile QA claimed.
- UI-DOM integration uses jsdom to exercise actual React input validation → preview → simulation → rules/evidence → qualification → editable clarification → switching fixtures without stale access. This does not validate browser layout, downloads or PDF.
- pnpm test:db: NOT_RUN — no local Supabase or Docker; SQL test count is static, not a passing result.
- Live integration/payment/recovery/security acceptance: NOT_RUN.

## Decisions and risks
No production publication, live charges or outbound communication performed. No credentials required or processed. Custom CSS replaces preferred Tailwind/shadcn for this first slice. print/PDF exports the current section, not a complete generated report; DOCX deferred. Source matching does not establish legal correctness; synthetic data must not be used as a real tender assessment. Browser state and demo credits are not persistent authorization. Network provider SDKs/model identifiers remain NEEDS_VERIFICATION. A working build is not production readiness.

## Next milestone
1. Run browser tests and visual/mobile QA on an unrestricted development host; fix any failures before accepting M1.
2. Establish local Supabase, run negative tenant/storage tests and implement auth/provisioning against migration.
3. Add safe ingestion and durable worker; then transactional billing and Stripe sandbox. See IMPLEMENTATION_PLAN for acceptance dependencies.

Startup: pnpm install --frozen-lockfile && pnpm dev. Open http://localhost:5173. No environment variables required for demo. Deployment prerequisites in DEPLOYMENT.md; runtime operations in RUNBOOK.md.

## Cloudflare Workers configuration fix
Added root wrangler.jsonc for the existing Worker project tendr-ai. The current npx wrangler deploy command now invokes pnpm build via Wrangler custom-build configuration, publishes apps/web/dist as static assets, and applies SPA fallback. No separate dashboard build command required. Verified locally with npx --yes wrangler@4 deploy --dry-run using Wrangler4.158.0: Vite build and static-asset discovery PASS; no upload performed during verification. A separate pnpm build also passed. Live Cloudflare deployment status is not yet verified.
