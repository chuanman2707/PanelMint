# PanelMint OSS Phase 7 Launch/Release Ops Design

Date: 2026-05-17
Status: Draft for review
Owner: Binhan

## 1. Goal

Phase 7 protects the just-public PanelMint OSS release by strengthening the existing GitHub Actions gate around the documented fresh-clone path.

The release has already been published from `main` and tagged as `v0.1.0`. Phase 7 should make future pull requests, pushes to `main`, and manual release checks catch basic setup regressions before they reach users.

## 2. Baseline

Current baseline findings:

- `main` contains the Phase 6 public polish merge.
- `v0.1.0` points at the Phase 6 merge commit.
- The repository has a local-first public setup: Next.js app, Docker Postgres, Prisma migrations, local DB-backed worker, local filesystem storage, and WaveSpeed BYOK through `.env`.
- `.github/workflows/test.yml` already runs on pull requests and pushes to `main`.
- The existing workflow installs dependencies, validates the Prisma schema, runs tests, and builds the app.
- The existing workflow does not run database migrations from `.env.example`, start the app, or smoke `/api/health`.

## 3. Decisions

- Use the existing `.github/workflows/test.yml`; do not add a second release workflow.
- Add `workflow_dispatch` so the release owner can run the gate manually.
- Add a Postgres service to the existing job using credentials and port mapping compatible with `.env.example`.
- Copy `.env.example` to `.env` inside CI to exercise the public setup contract.
- Run `npx prisma migrate deploy` in CI before schema validation, tests, and build.
- Start the built app on a non-default port and smoke `/api/health`.
- Treat missing `WAVESPEED_API_KEY` as expected in CI. Health should be degraded, not ready.
- Keep the release gate focused on technical fresh-clone readiness.

## 4. Scope

Phase 7 should include:

- Update `.github/workflows/test.yml`.
- Add `workflow_dispatch`.
- Add a Postgres service with database `panelmint`, user `postgres`, password `change-local-dev-password`, and host port `15432`.
- Add a step to copy `.env.example` to `.env`.
- Add a migration step with `npx prisma migrate deploy`.
- Keep `npx prisma validate`, `npm test`, and `npm run build`.
- Start the app on port `3100` after build.
- Call `http://127.0.0.1:3100/api/health`.
- Assert the expected degraded health response when no provider key is configured.

## 5. Non-Scope

Phase 7 should not:

- Add a runbook, incident guide, rollback guide, or issue triage process.
- Add secret scanning, dependency audit gates, or public-contract forbidden-term scanning.
- Add real WaveSpeed generation to CI.
- Require a real provider key in GitHub Actions.
- Create a separate `release-ops.yml` workflow.
- Change application runtime behavior.
- Change worker, queue, storage, provider, or API implementation code.

## 6. Workflow Behavior

The workflow should run on:

- `pull_request`
- `push` to `main`
- `workflow_dispatch`

The job should model the public setup path:

1. Check out the repository.
2. Set up Node.js 20 with npm cache.
3. Install dependencies with `npm ci`.
4. Copy `.env.example` to `.env`.
5. Wait for the Postgres service to become ready if the service health check does not fully cover readiness.
6. Apply Prisma migrations with `npx prisma migrate deploy`.
7. Validate the Prisma schema with `npx prisma validate`.
8. Run tests with `npm test`.
9. Build the app with `npm run build`.
10. Start the app on port `3100`.
11. Call `/api/health`.
12. Validate the health response.

## 7. Health Smoke Contract

CI should not configure `WAVESPEED_API_KEY`, so `/api/health` should return degraded generation readiness.

Expected health smoke response:

- HTTP status is `503`.
- JSON `status` is `degraded`.
- `checks.runtime.queue` is `local-worker`.
- `checks.runtime.storage` is `local-filesystem`.
- `details.missingRequiredEnv` contains `WAVESPEED_API_KEY`.

The smoke should fail if the app cannot start, the endpoint cannot be reached, the response is not JSON, or the response stops reporting the local runtime metadata.

## 8. Failure Handling

CI failure should be easy to locate from step names. The workflow should avoid hiding several independent checks inside one large shell block.

Recommended step names:

- `Copy example env`
- `Apply database migrations`
- `Validate Prisma schema`
- `Run tests`
- `Build app`
- `Start app for health smoke`
- `Check degraded health without provider key`

The app startup step may write logs to a temporary file. If health smoke fails, the workflow should print the app log and health response body to make diagnosis practical.

## 9. Test Strategy

The main test is the GitHub Actions workflow itself.

Local validation before committing should include:

```bash
npx prisma validate
npm test
npm run build
```

If feasible, the implementation should also run the health smoke locally using the same port and expected degraded response. It does not need a real WaveSpeed key.

## 10. Definition Of Done

Phase 7 is done when:

- `.github/workflows/test.yml` runs on pull requests, pushes to `main`, and manual dispatch.
- CI starts a Postgres service compatible with `.env.example`.
- CI copies `.env.example` to `.env`.
- CI applies Prisma migrations before validating schema, running tests, and building.
- CI starts the app and verifies `/api/health`.
- The health smoke expects degraded status without `WAVESPEED_API_KEY`.
- No app runtime behavior changes are included.
- Required local verification passes.
