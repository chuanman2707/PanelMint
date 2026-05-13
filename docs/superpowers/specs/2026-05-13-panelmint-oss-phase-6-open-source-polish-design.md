# PanelMint OSS Phase 6 Open-Source Polish Design

Date: 2026-05-13
Status: Draft for review
Owner: Binhan

## 1. Goal

Phase 6 makes the repository ready to publish publicly after the Phase 5 local worker and local storage work.

The public repo should present PanelMint OSS as a local-first, single-user comic generator with this default architecture:

- Next.js app.
- Postgres, preferably through the included Docker Compose helper for local setup.
- Local DB-backed worker via `npm run worker`.
- Local generated asset storage under `PANELMINT_STORAGE_DIR`, defaulting to `.panelmint/generated`.
- WaveSpeed BYOK through `WAVESPEED_API_KEY` in `.env`.

After this phase, a fresh reader should not think Clerk, Inngest, Cloudflare R2, Neon, Vercel, Stripe, payments, credits, Supabase, Redis, or Upstash are required for the main local OSS path.

## 2. Baseline

This design assumes Phase 5 has been merged into `main`, and Phase 6 starts from a new branch:

```text
codex/panelmint-oss-phase-6-open-source-polish
```

Current baseline findings:

- `main` has fast-forwarded to `codex/phase-5-local-worker-storage`.
- `package.json` has `npm run worker`.
- Active runtime code no longer imports Inngest, AWS SDK/R2, Clerk, Stripe, payment helpers, or billing helpers in the primary path.
- `/api/health` reports `queue: 'local-worker'`.
- `README.md`, `.env.example`, and `docker-compose.yml` still contain Neon/Vercel-first setup language.
- The repo does not yet have root `LICENSE` or `CONTRIBUTING.md`.
- No public sample manuscript or example local generation workflow exists.
- `.gitignore` does not yet ignore `.panelmint/`, even though that is now the default generated asset directory.

## 3. Decisions

- Phase 6 is a public-readiness pass, not a runtime architecture rewrite.
- Public-active docs must describe local Docker Postgres as the default fresh-clone path.
- Neon and Vercel may be mentioned only as optional deployment/provider choices, not as requirements for the main OSS workflow.
- Historical roadmap/spec/plan docs may keep references to removed SaaS systems when those references describe past phases or removal rationale. They must not be linked or framed as current setup requirements.
- Dependency removal is allowed only after an import/runtime usage scan confirms the package is unused.
- Prisma migration history should not be squashed in Phase 6 unless fresh-clone verification fails because of migration history. The active Prisma schema and final migrated database shape are the source of truth.
- Issue templates are out of scope unless implementation finds a clear need for a lightweight bug-report template.
- The Phase 6 implementation should end in a PR from the Phase 6 branch. Main should only receive the branch after the PR passes verification.

## 4. Scope

Phase 6 should include:

- Rewrite public setup docs around local-first install and run commands.
- Update `.env.example` so local Docker Postgres is the default example, with hosted Postgres as optional.
- Update `docker-compose.yml` comments so the file is presented as the default local database helper, not a legacy fallback.
- Add root `LICENSE` with the MIT license if still missing.
- Add root `CONTRIBUTING.md`.
- Add a sample manuscript and a short example workflow.
- Update `.gitignore` for `.panelmint/` generated local assets.
- Audit dependencies and remove confirmed unused packages.
- Clean active tests/docs that still encode stale cloud or monetization assumptions.
- Adjust `/api/health` if its response still implies Vercel or other hosted systems are part of the default local architecture.
- Verify install, test, build, schema, health, and local generation readiness from a clean checkout or clean worktree.

## 5. Non-Scope

Phase 6 should not:

- Redesign or replace the local worker queue.
- Change image generation provider architecture.
- Add another AI provider.
- Add auth, hosted identity, payment, credit, or deployment integrations.
- Rewrite Prisma migrations solely for aesthetics.
- Delete historical specs and plans just because they mention systems removed by prior phases.
- Add a full contributor governance process, code of conduct, or security policy unless the implementation discovers an immediate public-release need.

## 6. Public Docs Contract

The root README should make the default path obvious:

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate deploy
npm run dev
npm run worker
```

The README should explain:

- The app runs at `http://localhost:3000`.
- The worker must run in a second terminal for queued generation jobs.
- Generated assets are written under `PANELMINT_STORAGE_DIR`.
- `WAVESPEED_API_KEY` is required for real generation.
- Missing `WAVESPEED_API_KEY` should not be confused with a platform outage or in-app account setup issue.
- Hosted Postgres can be used by replacing `DATABASE_URL` and `DIRECT_URL`, but it is optional.
- `npm test`, `npm run build`, and `/api/health` are the primary checks.

The README should avoid current-path language that presents these as required:

- Clerk.
- Inngest.
- Cloudflare R2.
- Neon.
- Vercel.
- Stripe, payments, credits, billing, checkout, or subscriptions.
- Supabase.
- Redis or Upstash.

Historical references in dated roadmap/spec files are allowed if they are not part of the public quickstart.

## 7. Environment Contract

`.env.example` should default to local development:

- `DATABASE_URL` points at the Docker Compose Postgres service.
- `DIRECT_URL` points at the same local database unless there is a strong Prisma reason to differ.
- Hosted Postgres examples, if kept, live under clearly optional comments.
- `WAVESPEED_API_KEY` remains blank with a clear note that real generation requires the user to provide their own key.
- `WAVESPEED_BASE_URL`, model overrides, rate limits, and `PANELMINT_STORAGE_DIR` stay documented.
- No `INNGEST_*`, `R2_*`, Clerk, Stripe, Supabase, Redis, Upstash, or Vercel-only env vars should be present in `.env.example`.

## 8. Health Check Contract

`/api/health` should reflect the local OSS architecture:

- Database status.
- Environment readiness for `DATABASE_URL` and generation readiness for `WAVESPEED_API_KEY`.
- Runtime identity as local single-user.
- Queue as local worker.
- Storage as local filesystem, if storage is reported.

The health response must not make Vercel, Neon, Inngest, R2, Clerk, or payment services look like default requirements.

If `WAVESPEED_API_KEY` is missing, health may be degraded for generation readiness, but the message should point to `.env` setup and should not mention account login, Settings key storage, or a platform-managed provider key.

## 9. Examples

Add a small public example set outside internal planning docs, preferably under `examples/`:

- `examples/sample-manuscript.md`: short enough for a low-cost first run, with clear panel-friendly story beats.
- `examples/local-generation-workflow.md`: commands and UI steps for using the sample manuscript from fresh setup through worker-driven generation.

The example workflow should not include secrets, generated output, provider response bodies, or assumptions about a specific paid account beyond the user providing `WAVESPEED_API_KEY`.

## 10. Contributing

Add `CONTRIBUTING.md` with a concise contributor path:

- Local prerequisites.
- Setup commands.
- Test/build commands.
- TDD expectation for behavior changes.
- How to run the worker.
- How to keep public docs aligned with local architecture.
- Reminder not to reintroduce hosted auth, queue, storage, or payment requirements into the primary OSS path.

The contributing guide should be useful but lightweight. It should not create a heavy governance process.

## 11. Dependency Cleanup

Implementation should audit package usage before removing dependencies.

Current scan shows most dependencies have active imports. `dotenv` is a candidate to verify because the initial scan did not find an active import outside package metadata. If it is truly unused, remove it from `package.json` and `package-lock.json`.

Do not remove a dependency just because it looks suspicious. Confirm with:

- Import scan.
- Test suite.
- Build.
- Any dynamic import usage, especially editor/export libraries.

## 12. Verification Strategy

Required verification:

```bash
npm test
npm run build
npx prisma validate
```

Fresh-clone-style verification should use a clean temporary clone, clean worktree, or equivalent clean checkout when feasible:

```bash
npm ci
cp .env.example .env
docker compose up -d
npx prisma migrate deploy
npm test
npm run build
```

Local generation path verification should be split into two levels:

- Deterministic verification: tests and local worker/queue checks that do not require a real WaveSpeed call.
- Real generation smoke: run the sample manuscript through the app if `WAVESPEED_API_KEY` is available in the environment and the user accepts provider cost.

If no real WaveSpeed key is available, Phase 6 may still complete with the real generation smoke explicitly marked as not run, as long as the deterministic local path and docs are verified.

## 13. Scan Strategy

Run final scans over active public/runtime paths.

Forbidden as primary-path requirements:

```text
Clerk
Inngest
R2
Cloudflare R2
Neon
Vercel
Stripe
payment
billing
credit
Supabase
Redis
Upstash
```

The scan should distinguish:

- Active runtime and public setup files: must not present removed systems as requirements.
- Historical roadmap/spec/plan files: may mention removed systems as dated project history.
- Implementation internals: terms like `onRedisError` may remain if they describe local fallback behavior and are not an actual Redis dependency.

## 14. Error Handling And Troubleshooting

The public docs should include short troubleshooting entries for:

- Database connection failure.
- Missing `WAVESPEED_API_KEY`.
- Worker not running.
- Generated assets missing or storage directory permission errors.
- Build or Prisma generation issues after dependency install.

Troubleshooting should point to local commands and `.env` fixes, not hosted service dashboards unless discussing optional hosted Postgres.

## 15. PR And Merge Policy

Phase 6 implementation should happen on:

```text
codex/panelmint-oss-phase-6-open-source-polish
```

After implementation:

- Open a PR from the Phase 6 branch.
- Ensure tests and build pass.
- Review the final diff for accidental public requirement drift.
- Safety-merge into `main` only after PR verification passes.

## 16. Done Criteria

Phase 6 is done when:

- Root `README.md` describes the local-first fresh-clone path.
- `.env.example` defaults to local Docker Postgres and local generated asset storage.
- Root `LICENSE` exists with MIT license text.
- Root `CONTRIBUTING.md` exists.
- A sample manuscript and example local generation workflow exist.
- `.panelmint/` generated assets are ignored.
- Confirmed unused dependencies are removed.
- Active tests/docs no longer encode stale hosted-service requirements.
- `/api/health` reports the local architecture accurately.
- `npm test`, `npm run build`, and `npx prisma validate` pass.
- Fresh-clone-style verification has been run or any skipped real-provider step is explicitly documented.
- Final active-path scans do not show Clerk, Inngest, R2, Neon, Vercel, or payment systems as requirements for the primary local OSS path.
