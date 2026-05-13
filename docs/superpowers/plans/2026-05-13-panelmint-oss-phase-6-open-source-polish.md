# PanelMint OSS Phase 6 Open-Source Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PanelMint ready for public release with a local-first setup contract, contributor docs, sample workflow, accurate health reporting, and verified fresh-clone checks.

**Architecture:** Keep the Phase 5 runtime architecture intact: Next.js app, Postgres through Prisma, local DB-backed worker, local generated asset storage, and WaveSpeed BYOK. This phase edits public docs, examples, health metadata, CI checks, and verification commands; it does not redesign queue, storage, provider, or schema behavior.

**Tech Stack:** Next.js 16, React 19, Prisma 7, Postgres 16 Docker Compose helper, Vitest, GitHub Actions, TypeScript, WaveSpeed API.

---

## Safety Rules

- Before modifying any exported function, route handler, class, or method, run GitNexus impact analysis with upstream direction.
- If GitNexus returns HIGH or CRITICAL risk, stop and report the direct callers and affected processes before editing.
- Use `apply_patch` for manual edits.
- Before every commit, run `mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "staged" })`.
- Keep Phase 6 scoped to public polish and verification. Do not reintroduce hosted auth, external queue, cloud storage, or monetization requirements into the primary local path.
- Do not remove dependencies unless an import/runtime usage scan proves they are unused. `dotenv` is retained because `prisma.config.ts` imports `dotenv/config`.

## File Structure

Create:

- `LICENSE` - MIT license for public release.
- `CONTRIBUTING.md` - lightweight contributor setup and workflow guide.
- `examples/sample-manuscript.md` - short public manuscript for a first local generation run.
- `examples/local-generation-workflow.md` - end-to-end local example workflow using the sample manuscript.

Modify:

- `README.md` - local-first fresh-clone setup, checks, env table, troubleshooting, and example links.
- `.env.example` - local Docker Postgres defaults and WaveSpeed/local storage env contract.
- `docker-compose.yml` - remove legacy hosted-deployment comments and align with `.env.example`.
- `.gitignore` - ignore `.panelmint/` generated local asset directory.
- `src/app/api/health/route.ts` - remove hosted deployment metadata from default runtime contract and report local storage.
- `src/app/api/health/route.test.ts` - assert local runtime metadata.
- `.github/workflows/test.yml` - add Prisma schema validation to CI.

No package dependency changes are expected. The dependency audit task verifies that each dependency is still used and explicitly retains `dotenv`.

---

### Task 1: Public Setup Docs And Release Basics

**Files:**

- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docker-compose.yml`
- Modify: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Confirm current stale public setup matches**

Run:

```bash
rg -n "Neon|neon|Vercel|vercel|Inngest|inngest|R2_|Cloudflare R2|Clerk|clerk|Stripe|stripe|payment|billing|credit|Supabase|supabase|Redis|redis|Upstash" README.md .env.example docker-compose.yml
```

Expected: matches in `README.md`, `.env.example`, and `docker-compose.yml` for current Neon/Vercel-first wording. These matches confirm the task is editing the intended stale public setup files.

- [ ] **Step 2: Replace README with local-first public contract**

Replace `README.md` with:

````markdown
# PanelMint

PanelMint is a local-first AI-assisted text-to-comic generator.

The open-source runtime is centered on:

- Next.js 16 + React 19 frontend.
- Single local workspace owner, with no hosted identity service in OSS v1.
- Postgres via Prisma.
- Local DB-backed worker queue.
- Local generated asset storage.
- WaveSpeed BYOK through `WAVESPEED_API_KEY`.

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The app runs at `http://localhost:3000`.

Run the local worker in a second terminal while the app is running:

```bash
npm run worker
```

The worker processes queued analysis, storyboard, character sheet, and image jobs. Generated images are stored under `PANELMINT_STORAGE_DIR`, which defaults to `.panelmint/generated`.

## First Comic

Use the sample manuscript in `examples/sample-manuscript.md`, then follow `examples/local-generation-workflow.md`.

Real generation requires a WaveSpeed key:

```bash
WAVESPEED_API_KEY=your_key_here
```

PanelMint reads that key from `.env`. It does not store provider keys in the database.

## Useful Checks

```bash
npx prisma validate
npm test
npm run build
curl http://localhost:3000/api/health
```

`/api/health` returns degraded status when generation env is missing. If only `WAVESPEED_API_KEY` is missing, setup is still close: add the key to `.env` before running real generation.

## Environment Variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres runtime connection string. The default `.env.example` value matches `docker-compose.yml`. |
| `DIRECT_URL` | Optional | Direct Postgres connection for Prisma migrations. For local Docker setup, use the same value as `DATABASE_URL`. |
| `WAVESPEED_API_KEY` | Yes for generation | Your WaveSpeed API key; used for both LLM and image generation. |
| `WAVESPEED_BASE_URL` | Optional | Defaults to `https://api.wavespeed.ai/api/v3`; override only for a WaveSpeed-compatible proxy. |
| `ALLOWED_ORIGINS` | Optional | Extra trusted origins for mutating requests. Local same-origin requests work without extra values. |
| `PANELMINT_STORAGE_DIR` | Optional | Local directory for generated images; defaults to `.panelmint/generated`. |
| `IMAGE_MODEL` | Optional | WaveSpeed image model override. |
| `LLM_MODEL` | Optional | WaveSpeed LLM model override. |
| `IMAGE_RATE_LIMIT` | Optional | Local image request concurrency budget. |
| `IMAGE_RATE_LIMIT_TIMEOUT_MS` | Optional | Timeout for waiting on image generation budget. |

## Hosted Database

The default setup uses local Docker Postgres. To use a hosted Postgres database instead, replace `DATABASE_URL` and `DIRECT_URL` in `.env` with that provider's connection strings, then run:

```bash
npx prisma migrate deploy
```

## Troubleshooting

### Database connection failed

Start the local database and apply migrations:

```bash
docker compose up -d
npx prisma migrate deploy
```

Make sure `.env` uses:

```bash
DATABASE_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public
DIRECT_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public
```

### Generation reports missing provider key

Set `WAVESPEED_API_KEY` in `.env`, then restart `npm run dev` and `npm run worker`.

### Jobs stay queued

Start the worker in a second terminal:

```bash
npm run worker
```

### Generated images are missing

Check `PANELMINT_STORAGE_DIR` in `.env`. The default path is `.panelmint/generated`. Make sure the process can create and write to that directory.

### Prisma or build fails after install

Regenerate the Prisma client and rerun checks:

```bash
npx prisma generate
npx prisma validate
npm run build
```

## Development Workflow

Use the local red-green-refactor loop for behavior changes in `src/app`, `src/lib`, `src/app/api`, `src/components`, and `src/hooks`.

1. Write or update the failing test first.
2. Run that targeted test and confirm the failure.
3. Make the smallest implementation that passes.
4. Rerun the targeted test, then the owning folder suite when it exists.
5. Run broader checks before opening a PR.

See `CONTRIBUTING.md` for contributor setup and expectations.

## Notes

- `runId` in the public API maps to `episode.id`.
- Durable pipeline state lives in `pipeline_runs`, `pipeline_events`, and `pipeline_jobs`.
- Coarse UI state mirrors `episodes.status`, `episodes.progress`, and `episodes.error`.
- Public examples live in `examples/`.
````

- [ ] **Step 3: Replace `.env.example` with local Docker defaults**

Replace `.env.example` with:

```dotenv
# Local Postgres
# These defaults match docker-compose.yml.
DATABASE_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public
DIRECT_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public

# Optional hosted Postgres:
# Replace DATABASE_URL and DIRECT_URL with your provider's connection strings.
# Prisma CLI prefers DIRECT_URL for migrations when it is set.

# App security
ALLOWED_ORIGINS=http://localhost:3000

# WaveSpeed BYOK provider key
# Required for real local generation. Get a key from https://wavespeed.ai/accesskey.
WAVESPEED_API_KEY=
# Override only if you are routing through a WaveSpeed-compatible proxy.
WAVESPEED_BASE_URL=https://api.wavespeed.ai/api/v3

# Optional model overrides / tuning
IMAGE_MODEL=wavespeed-ai/flux-kontext-pro/multi
LLM_MODEL=
IMAGE_RATE_LIMIT=10
IMAGE_RATE_LIMIT_TIMEOUT_MS=120000

# Local generated asset storage
# Defaults to .panelmint/generated when empty.
PANELMINT_STORAGE_DIR=.panelmint/generated
```

- [ ] **Step 4: Update Docker Compose comments**

Replace the first three comment lines in `docker-compose.yml` with:

```yaml
# Local Postgres helper for PanelMint OSS.
# The exposed port and credentials match .env.example.
# Run with: docker compose up -d
```

Keep the service definition unchanged.

- [ ] **Step 5: Ignore local generated asset directory**

In `.gitignore`, change the generated images section to:

```gitignore
# generated images
.panelmint/
public/generated/
```

Keep the existing `.vercel` ignore entry because it prevents accidental deployment metadata commits and is not a runtime requirement.

- [ ] **Step 6: Add MIT license**

Create `LICENSE`:

```text
MIT License

Copyright (c) 2026 Binhan and PanelMint contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 7: Verify public setup scan**

Run:

```bash
rg -n "Neon|neon|Vercel|vercel|Inngest|inngest|INNGEST_|R2_|Cloudflare R2|Clerk|clerk|Stripe|stripe|payment|billing|credit|Supabase|supabase|Redis|redis|Upstash" README.md .env.example docker-compose.yml
```

Expected: no matches.

- [ ] **Step 8: Commit public setup docs**

Run GitNexus detect changes, then:

```bash
git add README.md .env.example docker-compose.yml .gitignore LICENSE
git commit -m "docs: polish local-first public setup"
```

---

### Task 2: Add Contributor Guide And Example Workflow

**Files:**

- Create: `CONTRIBUTING.md`
- Create: `examples/sample-manuscript.md`
- Create: `examples/local-generation-workflow.md`

- [ ] **Step 1: Create examples directory**

Run:

```bash
mkdir -p examples
```

- [ ] **Step 2: Add sample manuscript**

Create `examples/sample-manuscript.md`:

```markdown
# Sample Manuscript: Lantern Delivery

Style target: bright indie comic, expressive faces, clean panel composition, warm evening light.

Mina runs a tiny repair cart at the edge of a harbor market. At sunset, every lantern in the market flickers out at once. The fish sellers blame the wind, the bakers blame bad wiring, and Mina notices a trail of blue sparks hopping across the cobblestones like a nervous firefly.

She follows the sparks under the pier and finds a lost delivery drone tangled in fishing line. Its cargo is a glass lantern holding a miniature storm cloud. Each time the cloud sneezes, another row of market lights goes dark.

Mina frees the drone, patches its cracked wing with copper tape, and speaks gently to the storm cloud until it calms down. The cloud glows gold. The market lights return one by one, brighter than before.

In the final scene, the drone leaves Mina a thank-you note printed on a receipt: "Next delivery: one sunrise, handle with care."

Panel beats:

1. Mina works at her repair cart while the harbor market glows behind her.
2. The market lanterns suddenly flicker out, leaving surprised faces in blue dusk.
3. Mina kneels to inspect blue sparks jumping across the cobblestones.
4. Under the pier, she finds the tangled drone and the tiny storm lantern.
5. Mina repairs the drone wing while calming the storm cloud.
6. The market lights return as the drone lifts into the sky with its note.
```

- [ ] **Step 3: Add local generation workflow**

Create `examples/local-generation-workflow.md`:

````markdown
# Local Generation Workflow

This workflow uses `examples/sample-manuscript.md` for a small first run.

## 1. Install And Configure

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate deploy
```

Open `.env` and set:

```bash
WAVESPEED_API_KEY=your_key_here
```

## 2. Start The App

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run worker
```

Open `http://localhost:3000`.

## 3. Create A Comic

1. Open the create screen.
2. Paste the contents of `examples/sample-manuscript.md` into the manuscript field.
3. Keep the default generation settings for the first run.
4. Submit the run.
5. Wait for analysis to complete.
6. Review and approve the analysis.
7. Review and approve the storyboard.
8. Start image generation.

The worker terminal should show queued jobs being claimed and completed.

## 4. Check Output

Generated image files are stored under:

```text
.panelmint/generated
```

The app serves those files through its storage API, so the reader and editor should keep working after an app restart.

## 5. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected when fully configured:

```json
{
  "status": "ready"
}
```

If `WAVESPEED_API_KEY` is missing, health reports degraded generation readiness. Add the key to `.env`, then restart the app and worker.
````

- [ ] **Step 4: Add contributor guide**

Create `CONTRIBUTING.md`:

````markdown
# Contributing

PanelMint OSS is a local-first single-user comic generator. The primary development path uses local Postgres, the local worker, local generated asset storage, and a WaveSpeed key in `.env`.

## Prerequisites

- Node.js 20.
- npm.
- Docker Desktop or another Docker-compatible runtime.
- A WaveSpeed API key for real generation smoke tests.

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Run the worker in a second terminal:

```bash
npm run worker
```

## Checks

Run focused tests while developing, then run the broader checks before opening a PR:

```bash
npx prisma validate
npm test
npm run build
```

## TDD Expectations

For behavior changes in `src/app`, `src/app/api`, `src/lib`, `src/components`, and `src/hooks`:

1. Add or update the failing test first.
2. Run the targeted test and confirm the failure.
3. Make the smallest implementation that passes.
4. Rerun the targeted test.
5. Run the owning suite or full suite before final review.

## Public Contract

Keep the main open-source path local-first:

- Do not require hosted identity for OSS v1.
- Do not require an external background queue service.
- Do not require cloud object storage for generated assets.
- Do not add monetization gates to local generation.
- Keep provider keys in `.env`; do not store them in the database.

When changing setup behavior, update `README.md`, `.env.example`, and `examples/local-generation-workflow.md` in the same PR.

## Sample Workflow

Use `examples/sample-manuscript.md` and `examples/local-generation-workflow.md` to verify the public first-run path.
````

- [ ] **Step 5: Verify docs render and links exist**

Run:

```bash
test -f CONTRIBUTING.md
test -f examples/sample-manuscript.md
test -f examples/local-generation-workflow.md
rg -n "examples/sample-manuscript.md|examples/local-generation-workflow.md|CONTRIBUTING.md" README.md
```

Expected: all `test -f` commands exit 0, and `rg` returns README references to the examples and contributing guide.

- [ ] **Step 6: Commit contributor and example docs**

Run GitNexus detect changes, then:

```bash
git add CONTRIBUTING.md examples/sample-manuscript.md examples/local-generation-workflow.md
git commit -m "docs: add contributing guide and sample workflow"
```

---

### Task 3: Align Health Check With Local Architecture

**Files:**

- Modify: `src/app/api/health/route.test.ts`
- Modify: `src/app/api/health/route.ts`

- [ ] **Step 1: Run route impact checks**

Run:

```text
mcp__gitnexus__.api_impact({ repo: "weoweo", file: "src/app/api/health/route.ts" })
mcp__gitnexus__.impact({ repo: "weoweo", target: "src/app/api/health/route.ts", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: low route risk. If GitNexus reports HIGH or CRITICAL risk, stop and report direct callers and affected processes before editing.

- [ ] **Step 2: Strengthen the health route test first**

In `src/app/api/health/route.test.ts`, replace the first test body with:

```ts
    it('returns ready when dependencies and env are healthy', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/health'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        const body = await response.json()
        expect(body).toMatchObject({
            status: 'ready',
            details: {
                missingRequiredEnv: [],
                notes: [
                    'Local single-user runtime. Auth is disabled for OSS v1.',
                    'Generated assets are stored on the local filesystem.',
                ],
            },
            checks: {
                runtime: {
                    app: 'nextjs',
                    queue: 'local-worker',
                    identity: 'local-single-user',
                    storage: 'local-filesystem',
                },
            },
        })
        expect(body.checks.runtime).not.toHaveProperty('deployment')
    })
```

- [ ] **Step 3: Run the targeted test and verify it fails**

Run:

```bash
npm test -- src/app/api/health/route.test.ts
```

Expected: FAIL because the current health route reports `deployment` and does not report `app` or `storage`.

- [ ] **Step 4: Update the health route runtime metadata**

In `src/app/api/health/route.ts`, replace the `runtime` object and `notes` array in the JSON response with:

```ts
                runtime: {
                    app: 'nextjs',
                    queue: 'local-worker',
                    identity: 'local-single-user',
                    storage: 'local-filesystem',
                },
```

and:

```ts
                notes: [
                    'Local single-user runtime. Auth is disabled for OSS v1.',
                    'Generated assets are stored on the local filesystem.',
                ],
```

The route should no longer read `process.env.VERCEL`.

- [ ] **Step 5: Run targeted health tests**

Run:

```bash
npm test -- src/app/api/health/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify no hosted deployment metadata remains in health route**

Run:

```bash
rg -n "VERCEL|vercel|deployment" src/app/api/health/route.ts src/app/api/health/route.test.ts
```

Expected: no matches.

- [ ] **Step 7: Commit health check alignment**

Run GitNexus detect changes, then:

```bash
git add src/app/api/health/route.ts src/app/api/health/route.test.ts
git commit -m "fix: align health check with local runtime"
```

---

### Task 4: CI And Dependency Audit

**Files:**

- Modify: `.github/workflows/test.yml`
- Read-only verification: `package.json`, `package-lock.json`, `prisma.config.ts`, `src`, `scripts`

- [ ] **Step 1: Audit dependency usage**

Run:

```bash
for dep in '@prisma/adapter-pg' '@radix-ui/react-dialog' '@radix-ui/react-slot' 'class-variance-authority' 'clsx' 'dotenv' 'fabric' 'framer-motion' 'jsonrepair' 'jspdf' 'lucide-react' 'pg' 'tailwind-merge' 'tsx' 'zod'; do
  printf '\n## %s\n' "$dep"
  rg -n "${dep}|from ['\"]${dep}(/|['\"])|require\(['\"]${dep}|import ['\"]${dep}" src scripts prisma.config.ts package.json vitest.config.ts eslint.config.mjs 2>/dev/null | sed -n '1,20p'
done
```

Expected:

- Every listed dependency has active usage.
- `dotenv` is reported from `prisma.config.ts`.
- No dependency is removed in Phase 6.

If a dependency has no active usage, stop and report the exact package before editing `package.json`.

- [ ] **Step 2: Add Prisma validation to CI**

In `.github/workflows/test.yml`, insert this step after dependency installation:

```yaml
      - name: Validate Prisma schema
        run: npx prisma validate
```

The workflow should become:

```yaml
name: test

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Validate Prisma schema
        run: npx prisma validate

      - name: Run tests
        run: npm test

      - name: Build app
        run: npm run build
```

- [ ] **Step 3: Run schema validation locally**

Run:

```bash
npx prisma validate
```

Expected: PASS.

- [ ] **Step 4: Verify package files are unchanged**

Run:

```bash
git diff -- package.json package-lock.json
```

Expected: no output.

- [ ] **Step 5: Commit CI validation**

Run GitNexus detect changes, then:

```bash
git add .github/workflows/test.yml
git commit -m "ci: validate prisma schema"
```

---

### Task 5: Final Verification And Fresh-Clone Smoke

**Files:**

- No file changes expected.

- [ ] **Step 1: Run active public requirement scan**

Run:

```bash
rg -n -I "Clerk|clerk|Inngest|inngest|INNGEST_|R2_|Cloudflare R2|Neon|neon|Vercel|vercel|Stripe|stripe|payment|billing|credit|Supabase|supabase|Redis|redis|Upstash|subscription|login|signup" README.md .env.example docker-compose.yml package.json .github CONTRIBUTING.md examples
```

Expected: no matches.

- [ ] **Step 2: Run active runtime forbidden import scan**

Run:

```bash
rg -n -I "@aws-sdk|s3-request-presigner|inngest|Inngest|INNGEST_|R2_|Cloudflare R2|R2StorageProvider|Clerk|clerk|Stripe|stripe|payment|billing|checkCredits|deductCredits|refundCredits|credit-catalog|Supabase|supabase|Upstash|NEXT_PUBLIC_CLERK|CLERK_|STRIPE_" src prisma/schema.prisma package.json .env.example
```

Expected: no matches.

- [ ] **Step 3: Run broad repo checks**

Run:

```bash
npx prisma validate
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 4: Run fresh-clone-style smoke in a temporary local clone**

Run:

```bash
SMOKE_ROOT="$(mktemp -d)"
git clone --local . "$SMOKE_ROOT/panelmint-phase6-smoke"
cd "$SMOKE_ROOT/panelmint-phase6-smoke"
npm ci
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npx prisma validate
npm test
npm run build
docker compose down
```

Expected: install, migrations, schema validation, tests, and build all pass from the clean temporary clone.

- [ ] **Step 5: Optional health endpoint smoke**

Run only if port `3100` is available:

```bash
PORT=3100 npm run dev > /tmp/panelmint-phase6-dev.log 2>&1 &
DEV_PID=$!
sleep 12
curl -s -o /tmp/panelmint-phase6-health.json -w "%{http_code}" http://localhost:3100/api/health
kill "$DEV_PID"
cat /tmp/panelmint-phase6-health.json
```

Expected:

- HTTP `200` if `.env` contains a real `WAVESPEED_API_KEY`.
- HTTP `503` if `WAVESPEED_API_KEY` is blank.
- JSON `checks.runtime.queue` is `local-worker`.
- JSON `checks.runtime.storage` is `local-filesystem`.
- JSON does not contain `deployment`.

- [ ] **Step 6: Real generation smoke decision**

If `WAVESPEED_API_KEY` is configured and the user accepts provider cost, run the sample manuscript through the UI using `examples/local-generation-workflow.md`.

Expected:

- Worker claims and completes jobs.
- Generated assets appear under `.panelmint/generated`.
- Reader/editor can load generated images.

If no real key is available or provider cost is not accepted, do not run real generation. Record in the final implementation summary: `Real WaveSpeed generation smoke: not run; no key/cost approval available.`

- [ ] **Step 7: Confirm working tree and prepare PR**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected:

- Working tree is clean.
- Current branch is `codex/panelmint-oss-phase-6-open-source-polish`.
- Recent commits include the Phase 6 docs, health, CI, and verification commits.

Open a PR from `codex/panelmint-oss-phase-6-open-source-polish` after all required verification passes. Safety-merge into `main` only after PR checks pass.
