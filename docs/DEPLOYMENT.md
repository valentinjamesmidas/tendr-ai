# Local operation and deployment gates
Node22+ (24 tested), pnpm11.25.0. Run pnpm install --frozen-lockfile; pnpm dev; open http://localhost:5173. No .env or external credentials needed. pnpm build emits apps/web/dist; pnpm --filter @tendr/web preview serves the build if configured.
The public Cloudflare deployment hosts the bid demo and NEN analysis pilot. A paid production service still requires authentication, server APIs, tested migrations and row-level security, private storage, a durable queue, Stripe integration, approved provider terms and monitoring.
Database development requires Docker and Supabase CLI: supabase start; supabase db reset; supabase test db. Run only against local development, never production. No Supabase CLI/Docker available during initial build. Database CI must be added with Supabase local setup before release.
Secrets listed in .env.example are server-only placeholders for the paid service.
Rollback: preserve immutable audit evidence and financial ledger, take backups before reviewed migrations, roll back frontend version independently; use tested forward corrective database migrations. Recovery is a design requirement, not exercised here.

## Cloudflare Pages GitHub deployment (demo only)
Connect repository valentinjamesmidas/tendr-ai using Pages → Connect to Git. Production branch main; root directory empty (repository root); framework None; build command pnpm build; output apps/web/dist. Set NODE_VERSION=24.22.1 and PNPM_VERSION=11.25.0 in build environment. No API keys needed. Cloudflare installs dependencies using the committed pnpm lockfile and workspace configuration. The .node-version file also pins the tested Node version.
This deploys the static synthetic demo, not the production backend. An existing Direct Upload Pages project requires a new Git-integrated Pages project. GitHub connection and hosting activation must be completed in the user's Cloudflare account; no hosting deployment is performed by uploading repository source.
Official references checked 2026-11-09: https://developers.cloudflare.com/pages/get-started/git-integration/ and https://developers.cloudflare.com/pages/configuration/build-image/ .

## Cloudflare Workers Git build (current dashboard project)
The production Worker is named tendr-ai. The root `wrangler.jsonc` declares the Worker entry point and static assets at `apps/web/dist` with SPA fallback. The dashboard deploys changes on `main` using `npx wrangler deploy` from the repository root. Wrangler invokes `pnpm build` as its custom build, so the dashboard build command stays empty. Confirm the linked commit succeeded and is serving production in Cloudflare.
References: https://developers.cloudflare.com/workers/wrangler/custom-builds/ and https://developers.cloudflare.com/workers/static-assets/ .

## NEN analysis pilot

The Worker serves the frontend and `/api/nen/analysis`. A GET reports source availability and the newest ISVZ month indexed. A POST streams NDJSON progress, errors and the result while the browser stays connected. Workers AI and the rate-limit binding are configured in Wrangler.

The default source indexes official ISVZ public procurement exports by the NEN reference and profile slug. The Worker then requests the authority's current public `XMLdataVZ` export and downloads the files listed for the exact reference. `NEN_PROFILE_SOURCES` provides fallback coverage of named profiles. Exports are published monthly, so a reference outside the index and fallback profiles may be missing. Restricted documents and material not exposed by the XML are outside this source's coverage. [ISVZ exports](https://isvz.nipez.cz/opendata), [NIPEZ machine interfaces](https://podpora.nipez.cz/cs/pravidla-pouziti-sluzeb-nipez/latest/pravidla-pro-pouzivani-api-systemu-nipez)

Run `node scripts/update-nen-index.mjs YYYY-MM` to add an available month. The same command accepts `YYYY-MM=/path/to/export.zip` when the official archive has already been downloaded. The published assets under `apps/web/public/nen-index/` contain only exact reference-to-profile mappings and the source month. Review the resulting index changes before publishing.

An authorized HTTPS resolver configured as `NEN_SOURCE_URL` takes precedence over the ISVZ route. It receives a GET with the normalized `reference` query parameter. If authentication is required, add the server-side secret `NEN_SOURCE_TOKEN`; it is sent as a Bearer token to the resolver only. Configure `NEN_DOCUMENT_ORIGINS` as a comma-separated list of approved HTTPS origins if downloads use hosts other than NEN or Zakázky GOV. The Worker validates every redirect against that list.

The resolver returns JSON with `reference`, `title`, optional `authority`, `complete` and `documents`. Each document includes `name` and `downloadUrl`, with optional `kind` (`documentation`, `clarification`, `amendment` or `other`) and offset-aware ISO `publishedAt`. Use `complete: true` only when the resolver confirms the public document inventory. Return 404 for a missing tender.

The pilot accepts text-layer PDF, DOCX, XLSX, TXT, CSV, XML and ZIP. It records encrypted, oversized, unreadable and unsupported files in the result. Limits include 15 top-level downloads, 8 MiB per downloaded file, 24 MiB of successful downloads and 140,000 extracted characters. Workers AI reviews up to three groups at a time and then checks for contradictions across groups. Scanned pages, segmented ZIP, and RAR require separate support. The app exposes file-level gaps and retains only findings with exact citations from extracted text. Source files and results are transient in the Worker.
