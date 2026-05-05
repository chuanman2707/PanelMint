# PanelMint OSS Phase 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update PanelMint's public docs and repository metadata so the repo reads as a local-first OSS application while leaving runtime behavior untouched.

**Architecture:** Treat this as a docs/metadata-only pass. `README.md` becomes the primary local-first setup entrypoint, `.env.example` becomes the copyable Docker Postgres and WaveSpeed BYOK template, `docker-compose.yml` becomes the default local database helper, and `LICENSE` establishes the MIT license. Runtime cleanup remains explicitly deferred to later roadmap phases.

**Tech Stack:** Markdown, dotenv env templates, Docker Compose, Next.js 16, Prisma, Postgres 16, WaveSpeed API.

---

## Current Baseline

- `README.md` currently describes the repo as centered on Clerk, Neon Postgres, Inngest, and Cloudflare R2.
- `.env.example` currently leads with Neon connection strings and has local Docker Postgres commented as a fallback.
- `docker-compose.yml` currently says it is a legacy local helper and says the default deployment is Vercel + Neon + Clerk + Inngest + R2.
- No root `LICENSE` file exists.
- The working tree may contain unrelated user changes in `AGENTS.md`, `CLAUDE.md`, and `src/**`. Do not stage or modify those files for Phase 1.

## File Map

**Expected changes**

- Create: `LICENSE`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docker-compose.yml`

**Do not modify**

- `src/**`
- `prisma/**`
- `package.json`
- `package-lock.json`
- Existing unrelated dirty files

## Task 1: Add MIT License

**Files:**

- Create: `LICENSE`

- [ ] **Step 1: Confirm the license file is absent**

Run:

```bash
test ! -e LICENSE
```

Expected: command exits with status `0`.

- [ ] **Step 2: Create the MIT license**

Create `LICENSE` with exactly this content:

```text
MIT License

Copyright (c) 2026 Binhan

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

- [ ] **Step 3: Verify the license content**

Run:

```bash
sed -n '1,25p' LICENSE
```

Expected: output starts with `MIT License` and includes `Copyright (c) 2026 Binhan`.

## Task 2: Rewrite README Around Local-First OSS Setup

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Replace the SaaS-first README with the OSS-first structure**

Replace the full `README.md` content with:

```md
# PanelMint

PanelMint is a local-first, open-source comic generator. It helps a single local user turn manuscript text into comic analysis, storyboard structure, and generated panel images.

PanelMint OSS v1 is being migrated away from the hosted SaaS stack. The target local setup uses:

- Next.js 16 + React 19 for the app UI
- Postgres through Docker Compose
- Prisma for database access
- WaveSpeed through your own `WAVESPEED_API_KEY`
- Local-first runtime paths as the roadmap phases land

## Migration Status

Phase 1 updates the public OSS setup contract and repository metadata. Later phases remove the remaining Clerk auth, billing and credits, DB-stored provider keys, Inngest queueing, and cloud storage runtime paths.

If a current runtime path still references Clerk, Inngest, Cloudflare R2, Neon, Vercel, or payment code, treat it as transitional code scheduled for cleanup in the roadmap. These services are not the intended OSS v1 local setup.

## Quickstart

Requirements:

- Node.js 20 or newer
- npm
- Docker Desktop or another Docker Compose compatible runtime
- A WaveSpeed API key for generation

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

Start local Postgres:

```bash
docker compose up -d
```

Generate Prisma Client and sync the local schema:

```bash
npx prisma generate
npx prisma db push
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment

For the OSS v1 target, the primary local values are:

| Variable | Required | Local value |
| --- | --- | --- |
| `DATABASE_URL` | Yes | `postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public` |
| `DIRECT_URL` | Yes for Prisma CLI | `postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public` |
| `WAVESPEED_API_KEY` | Yes for generation | Your WaveSpeed server-side API key |
| `ALLOWED_ORIGINS` | Optional | `http://localhost:3000` |

Optional model tuning:

- `IMAGE_MODEL`
- `LLM_MODEL`
- `IMAGE_RATE_LIMIT`
- `IMAGE_RATE_LIMIT_TIMEOUT_MS`

Transitional variables may remain in `.env.example` while later phases remove legacy runtime paths. They are labeled there as transitional and are not the OSS v1 target contract.

## Local Database

`docker-compose.yml` starts a local Postgres 16 container named `panelmint-postgres`.

The container exposes Postgres on host port `15432`, so local app commands should use `127.0.0.1:15432` in `DATABASE_URL` and `DIRECT_URL`.

Useful commands:

```bash
docker compose ps
docker compose logs postgres
docker compose down
```

To reset local data:

```bash
docker compose down -v
docker compose up -d
npx prisma db push
```

## Worker Roadmap

The master OSS roadmap targets a local DB-backed worker command named `npm run worker`.

That command is implemented in Phase 5. Until then, do not treat `npm run worker` as available unless `package.json` contains the script in your branch.

## Useful Checks

```bash
curl http://localhost:3000/api/health
npm test
npm run lint
npm run build
```

For docs-only changes, also run:

```bash
git diff --check
```

## Troubleshooting

### Docker Postgres is not running

Check the container:

```bash
docker compose ps
docker compose logs postgres
```

If port `15432` is already in use, either stop the conflicting service or change the host port in `docker-compose.yml` and update `DATABASE_URL` plus `DIRECT_URL` in `.env`.

### Prisma cannot connect

Confirm `.env` uses the Docker Compose port:

```bash
DATABASE_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public
DIRECT_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public
```

Then rerun:

```bash
npx prisma generate
npx prisma db push
```

### WaveSpeed generation fails

Confirm `WAVESPEED_API_KEY` is set in `.env` and restart `npm run dev` after changing it.

Phase 1 does not change provider runtime behavior. Provider simplification happens in Phase 4.

### Health check fails

Run:

```bash
curl http://localhost:3000/api/health
```

Then check the terminal running `npm run dev` for the concrete missing env var, database, or runtime error.

### A legacy service is still referenced

Phase 1 does not remove runtime code. Clerk, Inngest, Cloudflare R2, billing, and provider-key cleanup happen in later phases. The Phase 1 goal is to document the OSS v1 target without presenting those services as required local setup.

## Testing And Contribution

Use the local red-green-refactor loop for behavior changes in `src/app`, `src/lib`, `src/app/api`, `src/components`, and `src/hooks`.

1. Write or update the failing test first.
2. Run the targeted test and confirm the failure.
3. Make the smallest implementation that passes.
4. Rerun the targeted test, then the owning folder suite when it exists, otherwise the closest relevant suite or the full suite.
5. Run broader repo checks when the change crosses multiple areas or needs extra confidence before opening a PR.

For docs-only changes, run `git diff --check` and inspect rendered Markdown when the change is substantial.

## Notes

- `runId` in the public API still maps to `episode.id`.
- Durable pipeline state currently lives in `pipeline_runs` and `pipeline_events`.
- Coarse UI state still mirrors `episodes.status`, `episodes.progress`, and `episodes.error`.
- The OSS roadmap is tracked in `docs/superpowers/specs/2026-05-05-panelmint-oss-roadmap-design.md`.
```

- [ ] **Step 2: Check that README no longer leads with hosted SaaS requirements**

Run:

```bash
sed -n '1,80p' README.md
```

Expected: the opening describes PanelMint as local-first OSS and includes a `Migration Status` section.

- [ ] **Step 3: Check that worker wording is not overpromising**

Run:

```bash
rg -n "npm run worker|Phase 5|package.json" README.md
```

Expected: matches show `npm run worker` is a Phase 5 roadmap command, not a Phase 1 available command.

## Task 3: Make `.env.example` Local-First

**Files:**

- Modify: `.env.example`

- [ ] **Step 1: Replace the env template**

Replace the full `.env.example` content with:

```dotenv
# PanelMint OSS local database
# docker-compose.yml exposes Postgres on host port 15432.
DATABASE_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public
DIRECT_URL=postgresql://postgres:change-local-dev-password@127.0.0.1:15432/panelmint?schema=public

# WaveSpeed BYOK
# Required for generation in the OSS v1 target.
WAVESPEED_API_KEY=

# Local app security
ALLOWED_ORIGINS=http://localhost:3000

# Optional model overrides / tuning
IMAGE_MODEL=wavespeed-ai/flux-kontext-pro/multi
LLM_MODEL=
IMAGE_RATE_LIMIT=10
IMAGE_RATE_LIMIT_TIMEOUT_MS=120000

# Transitional runtime variables
# These are retained only while later OSS roadmap phases remove legacy SaaS runtime paths.
# They are not the intended OSS v1 local setup contract.

# Phase 2 removes Clerk from the v1 runtime path.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=

# Phase 4 removes DB-stored provider keys and the encryption requirement if no other feature needs it.
ENCRYPTION_SECRET=

# Phase 5 replaces Inngest with a local DB-backed worker.
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
# INNGEST_DEV=1

# Phase 5 also moves generated image storage to the local runtime path.
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

- [ ] **Step 2: Verify the local database values match Docker Compose**

Run:

```bash
rg -n "15432|change-local-dev-password|WAVESPEED_API_KEY|Transitional runtime variables" .env.example
```

Expected: output includes both Postgres URLs on `15432`, `WAVESPEED_API_KEY`, and `Transitional runtime variables`.

- [ ] **Step 3: Verify Neon is not the default env path**

Run:

```bash
rg -n "Neon|neon.tech|pooler" .env.example
```

Expected: no matches.

## Task 4: Update Docker Compose Positioning

**Files:**

- Modify: `docker-compose.yml`

- [ ] **Step 1: Replace the legacy header comment**

Replace the first three comment lines in `docker-compose.yml` with:

```yaml
# Local Postgres for PanelMint OSS development.
# Keep DATABASE_URL and DIRECT_URL in .env aligned with the host port below.
```

Keep the existing service definition unchanged.

- [ ] **Step 2: Verify Docker Compose no longer calls itself legacy**

Run:

```bash
sed -n '1,20p' docker-compose.yml
rg -n "Legacy|Vercel|Neon|Clerk|Inngest|Cloudflare|R2|disposable" docker-compose.yml
```

Expected: `sed` shows the new local Postgres header. `rg` returns no matches.

## Task 5: Verify Phase 1 Scope And Commit

**Files:**

- Verify: `README.md`
- Verify: `.env.example`
- Verify: `docker-compose.yml`
- Verify: `LICENSE`

- [ ] **Step 1: Confirm only Phase 1 files are changed or staged by this work**

Run:

```bash
git status --short
```

Expected: `README.md`, `.env.example`, `docker-compose.yml`, and `LICENSE` are the only Phase 1 files to stage. Existing unrelated dirty files may still appear, but do not stage them.

- [ ] **Step 2: Run whitespace verification**

Run:

```bash
git diff --check -- README.md .env.example docker-compose.yml LICENSE
```

Expected: no output and exit status `0`.

- [ ] **Step 3: Review provider mentions for framing**

Run:

```bash
rg -n "Vercel|Neon|Clerk|Inngest|R2|Cloudflare|payment|credits" README.md .env.example docker-compose.yml
```

Expected: matches are acceptable only when they frame those services as transitional, non-required, or later-phase cleanup. No match should describe them as the required OSS v1 local setup.

- [ ] **Step 4: Verify required docs content exists**

Run:

```bash
rg -n "MIT License|local-first|Migration Status|Quickstart|WAVESPEED_API_KEY|docker compose up -d|15432|Testing And Contribution" LICENSE README.md .env.example docker-compose.yml
```

Expected: output includes the MIT license, local-first README copy, migration note, quickstart, WaveSpeed key, Docker command, host port `15432`, and contributor/testing guidance.

- [ ] **Step 5: Run recommended lint check**

Run:

```bash
npm run lint
```

Expected: PASS. If lint fails on unrelated pre-existing files, capture the failing paths and do not fix them as part of Phase 1 unless they are in `README.md`, `.env.example`, `docker-compose.yml`, or `LICENSE`.

- [ ] **Step 6: Stage only Phase 1 implementation files**

Run:

```bash
git add README.md .env.example docker-compose.yml LICENSE
```

Expected: only those four files are staged.

- [ ] **Step 7: Run GitNexus change detection before committing**

Run through the GitNexus tool:

```text
detect_changes(repo: "weoweo", scope: "staged")
```

Expected: low risk, no changed runtime symbols, and no affected execution flows. If GitNexus reports changed runtime symbols, stop and inspect the staged diff because Phase 1 should be docs/metadata only.

- [ ] **Step 8: Commit the implementation**

Run:

```bash
git commit -m "docs: update oss foundation docs"
```

Expected: commit includes only `README.md`, `.env.example`, `docker-compose.yml`, and `LICENSE`.
