# PanelMint OSS Phase 7 Launch/Release Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the existing GitHub Actions test workflow so it protects the public OSS release with a fresh-clone database migration and health smoke gate.

**Architecture:** Keep one workflow at `.github/workflows/test.yml`. Add manual dispatch, a Postgres service compatible with `.env.example`, migration execution from the example env, and a post-build `/api/health` smoke that expects degraded readiness because CI intentionally has no `WAVESPEED_API_KEY`.

**Tech Stack:** GitHub Actions, Node.js 20, npm, Next.js, Prisma, Postgres 16 Alpine, shell, curl, Node JSON assertion script.

---

## File Structure

- Modify `.github/workflows/test.yml`: existing CI workflow; add the release protection behavior directly here.
- No app code changes.
- No docs or runbook changes beyond this implementation plan.
- No separate `.github/workflows/release-ops.yml`.

## Scope Check

This plan implements one subsystem: the GitHub Actions release gate. It does not add incident response, rollback docs, forbidden-term scans, dependency audits, secret scans, or real WaveSpeed generation.

---

### Task 1: Add Manual Dispatch And Postgres Service

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Inspect the current workflow**

Run:

```bash
sed -n '1,220p' .github/workflows/test.yml
```

Expected: the workflow is named `test`, runs on `pull_request` and `push` to `main`, and has one `test` job without a Postgres service.

- [ ] **Step 2: Add manual dispatch trigger and Postgres service**

Edit `.github/workflows/test.yml` so the top of the file and the job header look like this:

```yaml
name: test

on:
  workflow_dispatch:
  pull_request:
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: panelmint
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: change-local-dev-password
        ports:
          - 15432:5432
        options: >-
          --health-cmd "pg_isready -U postgres -d panelmint"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 30
          --health-start-period 10s
```

Leave the existing `steps:` block under this job in place.

- [ ] **Step 3: Verify YAML structure**

Run:

```bash
sed -n '1,80p' .github/workflows/test.yml
```

Expected: `workflow_dispatch` is present under `on`, and `services.postgres` is indented under `jobs.test`.

- [ ] **Step 4: Commit the trigger and service change**

Run GitNexus detect changes before committing:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "unstaged" })
```

Expected: risk is low, with changed scope limited to `.github/workflows/test.yml`.

```bash
git status --short
```

Expected: only `.github/workflows/test.yml` is modified.

Then commit:

```bash
git add .github/workflows/test.yml
git commit -m "ci: add release gate database service"
```

---

### Task 2: Exercise The Public Env And Migration Path

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add example env and migration steps**

In `.github/workflows/test.yml`, place these steps after `Install dependencies` and before `Validate Prisma schema`:

```yaml
      - name: Copy example env
        run: cp .env.example .env

      - name: Apply database migrations
        run: npx prisma migrate deploy
```

The workflow steps around this area should become:

```yaml
      - name: Install dependencies
        run: npm ci

      - name: Copy example env
        run: cp .env.example .env

      - name: Apply database migrations
        run: npx prisma migrate deploy

      - name: Validate Prisma schema
        run: npx prisma validate

      - name: Run tests
        run: npm test

      - name: Build app
        run: npm run build
```

- [ ] **Step 2: Confirm the migration step precedes validation, tests, and build**

Run:

```bash
sed -n '30,120p' .github/workflows/test.yml
```

Expected: `Copy example env` appears after `npm ci`, and `Apply database migrations` appears before `Validate Prisma schema`.

- [ ] **Step 3: Run local deterministic checks**

Run:

```bash
npx prisma validate
npm test
npm run build
```

Expected: all three commands pass.

- [ ] **Step 4: Commit the migration gate**

Run GitNexus detect changes before committing:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "unstaged" })
```

Expected: risk is low, with changed scope limited to `.github/workflows/test.yml`.

```bash
git status --short
```

Expected: only `.github/workflows/test.yml` is modified.

Then commit:

```bash
git add .github/workflows/test.yml
git commit -m "ci: apply migrations in release gate"
```

---

### Task 3: Add App Startup And Degraded Health Smoke

**Files:**
- Modify: `.github/workflows/test.yml`

- [ ] **Step 1: Add app startup step**

In `.github/workflows/test.yml`, after the `Build app` step, add:

```yaml
      - name: Start app for health smoke
        run: |
          PORT=3100 npm run start > /tmp/panelmint-health-smoke.log 2>&1 &
          echo $! > /tmp/panelmint-health-smoke.pid
```

- [ ] **Step 2: Add degraded health assertion step**

Immediately after `Start app for health smoke`, add:

```yaml
      - name: Check degraded health without provider key
        run: |
          set -euo pipefail

          health_body="$(mktemp)"
          http_code=""

          for attempt in {1..30}; do
            http_code="$(curl -sS -o "$health_body" -w "%{http_code}" http://127.0.0.1:3100/api/health || true)"
            if [ "$http_code" = "503" ]; then
              break
            fi
            sleep 2
          done

          echo "Health HTTP status: $http_code"
          cat "$health_body"
          echo

          if [ "$http_code" != "503" ]; then
            echo "Expected /api/health to return 503 in CI because WAVESPEED_API_KEY is intentionally unset."
            echo "App log:"
            cat /tmp/panelmint-health-smoke.log
            exit 1
          fi

          node - "$health_body" <<'NODE'
          const fs = require('node:fs')

          const body = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
          const missingRequiredEnv = body.details?.missingRequiredEnv ?? []

          if (body.status !== 'degraded') {
            throw new Error(`Expected status degraded, received ${body.status}`)
          }
          if (body.checks?.runtime?.queue !== 'local-worker') {
            throw new Error('Expected runtime queue local-worker')
          }
          if (body.checks?.runtime?.storage !== 'local-filesystem') {
            throw new Error('Expected runtime storage local-filesystem')
          }
          if (!missingRequiredEnv.includes('WAVESPEED_API_KEY')) {
            throw new Error('Expected missingRequiredEnv to include WAVESPEED_API_KEY')
          }
          NODE
```

- [ ] **Step 3: Add cleanup step**

Immediately after `Check degraded health without provider key`, add:

```yaml
      - name: Stop app for health smoke
        if: always()
        run: |
          if [ -f /tmp/panelmint-health-smoke.pid ]; then
            kill "$(cat /tmp/panelmint-health-smoke.pid)" || true
          fi
```

- [ ] **Step 4: Confirm final workflow shape**

Run:

```bash
sed -n '1,220p' .github/workflows/test.yml
```

Expected: the final workflow contains the Postgres service, migration step, build step, app startup step, health smoke step, and cleanup step in that order.

- [ ] **Step 5: Run local deterministic checks**

Run:

```bash
npx prisma validate
npm test
npm run build
```

Expected: all three commands pass.

- [ ] **Step 6: Optionally run local health smoke with Docker Postgres**

Run this only if local Docker is available and port `3100` is free:

```bash
docker compose up -d --wait
test -f .env || cp .env.example .env
npx prisma migrate deploy
npm run build
PORT=3100 WAVESPEED_API_KEY= npm run start > /tmp/panelmint-phase7-health-smoke.log 2>&1 &
APP_PID=$!
sleep 10
curl -sS -o /tmp/panelmint-phase7-health.json -w "%{http_code}" http://127.0.0.1:3100/api/health
kill "$APP_PID"
cat /tmp/panelmint-phase7-health.json
```

Expected:

```text
503
```

Expected JSON properties:

```json
{
  "status": "degraded",
  "checks": {
    "runtime": {
      "queue": "local-worker",
      "storage": "local-filesystem"
    }
  },
  "details": {
    "missingRequiredEnv": ["WAVESPEED_API_KEY"]
  }
}
```

If a local `.env` forces a real `WAVESPEED_API_KEY` despite the command override, skip this optional smoke and rely on GitHub Actions for the exact CI behavior.

- [ ] **Step 7: Commit the health smoke**

Run GitNexus detect changes before committing:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "unstaged" })
```

Expected: risk is low, with changed scope limited to `.github/workflows/test.yml`.

```bash
git status --short
```

Expected: only `.github/workflows/test.yml` is modified.

Then commit:

```bash
git add .github/workflows/test.yml
git commit -m "ci: smoke health in release gate"
```

---

### Task 4: Final Verification

**Files:**
- No file changes expected.

- [ ] **Step 1: Review the final workflow diff**

Run:

```bash
git diff HEAD~3..HEAD --stat -- .github/workflows/test.yml
git diff HEAD~3..HEAD -- .github/workflows/test.yml
```

Expected:

- Only `.github/workflows/test.yml` changed in implementation commits.
- No app runtime files changed.
- Workflow includes `workflow_dispatch`, Postgres service, migration gate, and degraded health smoke.

- [ ] **Step 2: Run final local checks**

Run:

```bash
npx prisma validate
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 3: Run GitNexus changed-scope check**

Run:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "compare", base_ref: "HEAD~3" })
```

Expected: risk is low, with changed scope limited to the GitHub Actions workflow and no application execution flows affected.

- [ ] **Step 4: Confirm working tree state**

Run:

```bash
git status --short --branch
git log --oneline --decorate -5
```

Expected:

- Working tree is clean.
- Recent commits include the Phase 7 spec and the CI release gate commits.

## Implementation Notes

- Do not add `WAVESPEED_API_KEY` to GitHub Actions. The degraded health response is the intended CI assertion.
- Do not add public-contract scans, secret scans, dependency audits, or real generation smoke in Phase 7.
- Keep failure output practical by printing the health response and app log when the health smoke fails.
- If GitHub Actions later shows that the service health check waits long enough for Postgres, do not add extra wait loops. If migrations fail due to database readiness, add a small `pg_isready` wait step before migrations.
