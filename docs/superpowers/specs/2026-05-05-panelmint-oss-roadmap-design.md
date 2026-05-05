# PanelMint OSS Roadmap Design

Date: 2026-05-05
Status: Approved for roadmap handoff
Owner: Binhan

## 1. Product Direction

PanelMint OSS v1 is a local-first, single-user comic generator. A user should be able to clone the repository, configure a local Postgres database, add a WaveSpeed API key, and generate comics without any SaaS platform dependency.

The project keeps the PanelMint name and moves from a hosted SaaS posture to an open-source local application. The user pays model/API costs directly through their own WaveSpeed account.

## 2. Decisions

- License: MIT.
- User model: single local user.
- Authentication: no login, signup, Clerk, or hosted identity provider in v1.
- AI provider: WaveSpeed only.
- API key source: `WAVESPEED_API_KEY` in `.env`.
- Database: Postgres through Docker for v1.
- Queue: local DB-backed worker, not Inngest.
- Storage: local generated image files, not R2.
- Billing: no credits, checkout, pricing gates, or payment flow.
- Branding: keep PanelMint.
- SaaS/cloud code should be removed from the v1 main path, not hidden behind runtime flags.

## 3. Non-Goals

- Multi-provider AI adapters.
- SQLite migration.
- Local Stable Diffusion, ComfyUI, Ollama, or other local model runtimes.
- Self-hosted multi-user mode.
- Clerk, Inngest, R2, Neon, Vercel, or payment integration.
- Credit budgeting or local cost limits.
- A single large implementation plan for the whole roadmap.

## 4. Spec Strategy

This document is the master roadmap spec. It defines the target, phase order, boundaries, and done criteria. It does not describe every file edit.

Each implementation phase gets its own smaller design spec before any implementation plan is written. After a phase spec is approved, that phase gets a focused implementation plan. This keeps review scope small and prevents one large plan from mixing unrelated risk areas.

The intended document flow is:

1. Master roadmap spec.
2. Phase-specific spec.
3. Phase-specific implementation plan.
4. Phase implementation and verification.
5. Repeat for the next phase.

## 5. Target Architecture

PanelMint OSS v1 keeps the current Next.js application as the main UI for creating, reviewing, reading, editing, and exporting comics.

Postgres remains the database through the existing Prisma layer. Local setup uses Docker Compose. This avoids a broad schema and migration refactor during the first open-source cleanup.

The app resolves all requests to a default local user. API routes and pages no longer require Clerk or user login. The local user is created or upserted as needed.

WaveSpeed is the only AI provider in v1. The provider config is loaded from environment variables, with `WAVESPEED_API_KEY` as the required key for both LLM and image generation.

Generated images are stored locally and served by the app. Cloudflare R2 is removed from the v1 runtime path.

Background work runs through a DB-backed local worker. API routes enqueue work in the database, and the worker claims jobs, runs pipeline steps, and updates pipeline state.

Billing and credits are removed from the local product. The application no longer blocks generation based on internal credit balances.

## 6. Target Data Flow

1. User opens the local PanelMint app.
2. User creates a comic from manuscript text and generation settings.
3. The API creates a project, episode, and queued pipeline job.
4. The local worker claims the job and runs analysis.
5. The UI polls status and shows analysis review.
6. User approves analysis.
7. The API queues storyboard work.
8. The worker creates pages and panels.
9. User approves storyboard panels.
10. The API queues image generation work.
11. The worker generates panel images through WaveSpeed and saves files locally.
12. The UI shows the completed comic in reader/editor flows.

## 7. Error Handling

Missing `WAVESPEED_API_KEY` should be reported clearly in local health/setup surfaces before a user starts generation. The phase specs should identify the exact surfaces, with `/api/health`, README troubleshooting, and the create/generation UI as the expected candidates.

If the worker is not running, queued work should remain visible as queued or stalled through the status endpoint and user-facing generation status UI. Docs should tell the user to run `npm run worker`.

WaveSpeed errors, content filters, and timeouts should be stored on the relevant episode, job, or panel record. Retrying failed panel generation should remain possible from the existing retry flow or a phase-approved replacement.

Database and storage errors should fail the current job clearly, persist an error message for the status UI, and preserve enough state for the user to retry after fixing local setup.

## 8. Phase Breakdown

### Phase 1: OSS Foundation

Goal: make the repository read as a local open-source application before deeper runtime refactors.

Scope:

- Add MIT license.
- Rewrite README around local-first setup.
- Update `.env.example` for local Postgres and WaveSpeed BYOK.
- Update Docker setup docs.
- Add or update quickstart, troubleshooting, contribution, and test instructions.
- Remove SaaS-first positioning from primary docs.

Non-scope:

- Runtime architecture changes.
- Auth removal.
- Queue replacement.
- Billing removal.

Done:

- A fresh reader understands the intended local architecture.
- Docs no longer present Vercel, Neon, Clerk, Inngest, and R2 as required for v1 local usage.
- Quickstart names the commands needed to install, configure, run DB, run app, and later run the worker.

### Phase 2: Single-User Local Auth Removal

Goal: run the application without Clerk or login.

Scope:

- Replace auth resolution with a default local user.
- Update page and API session helpers for local mode.
- Remove Clerk middleware/runtime usage from the v1 path.
- Remove auth pages/routes from the v1 main path. Delete them unless a phase spec explicitly keeps non-runtime archival code.
- Update tests that currently assume Clerk-backed auth.

Done:

- User can open the app and use protected areas without signing in.
- API routes resolve ownership through the default local user.
- Clerk env vars are no longer required to run local v1.
- `.env.example` no longer requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, or `CLERK_WEBHOOK_SIGNING_SECRET`.
- The v1 app/API/proxy path no longer imports Clerk runtime modules.

### Phase 3: Billing/Credits Removal

Goal: remove internal monetization gates from the local product.

Scope:

- Remove credit checks from generate, analyze, storyboard, character sheet, image generation, and retry paths.
- Remove credit deduction and refund calls from the pipeline.
- Remove pricing, payment, checkout, and credit UI from the v1 main path.
- Replace user-facing credit/billing copy with local generation/status copy.
- Keep schema cleanup conservative unless a phase-specific spec approves removing tables.

Done:

- No user-facing action is blocked by PanelMint credits.
- The app no longer asks local users to buy credits.
- Generation cost responsibility is explained as the user's WaveSpeed API usage.
- Generation, retry, analyze, storyboard, character sheet, and panel image paths no longer call `checkCredits`, `deductCredits`, or `refundCredits`.
- Pricing/payment routes are removed from navigation and unavailable from the v1 user journey.

### Phase 4: BYOK Provider Simplification

Goal: make WaveSpeed configuration local and unambiguous before queue/worker refactoring.

Scope:

- Load provider config from `.env` only.
- Remove DB-stored user API key flow.
- Remove Advanced API key Settings UI.
- Remove `/api/user/api-key` from the local v1 path.
- Remove encryption requirements if no remaining runtime feature needs encrypted secrets.
- Update provider tests and docs.

Done:

- `WAVESPEED_API_KEY` is the only key source.
- The app does not store user API keys in the database.
- Settings no longer implies a platform-managed key fallback.
- Runtime provider config no longer reads or writes `user.apiKey` or `user.apiProvider`.
- `ENCRYPTION_SECRET` is not required unless a remaining non-provider feature explicitly needs it.

### Phase 5: Local Worker Queue

Goal: replace Inngest with a local worker that can handle long-running generation jobs.

Scope:

- Design and implement a DB-backed queue contract.
- Make `enqueue*` functions write jobs to the database.
- Add a worker command such as `npm run worker`.
- Implement job claiming, idempotency, retries, failure recording, and cancellation behavior.
- Preserve analyze, storyboard, character sheet, image generation, retry, and status flows.
- Design worker provider usage against the final `.env`-only `WAVESPEED_API_KEY` contract.
- Ensure generated images use local storage in the worker/runtime path and are served after app restart.
- Remove Inngest from the primary runtime path after replacement.

Done:

- Comic generation works with `npm run dev` and `npm run worker`.
- Worker can resume or retry failed work without duplicating completed panels.
- UI can show queued/running/failed/completed pipeline states without Inngest.
- The v1 app/worker runtime path no longer imports Inngest modules.
- The quickstart no longer requires `npm run inngest:dev`.
- Generated image files survive app restart and load from local storage.

### Phase 6: Open-Source Polish

Goal: make the repository ready to publish publicly.

Scope:

- Remove unused dependencies left by prior phases.
- Clean stale tests and docs.
- Make health checks reflect local architecture.
- Add sample manuscript or example workflow.
- Add `CONTRIBUTING.md` if still missing.
- Add issue templates only if useful.
- Verify final install, test, build, and local generation path.

Done:

- `npm test` passes.
- `npm run build` passes.
- Fresh-clone setup is documented and verified.
- The repo no longer contains primary-path requirements for Clerk, Inngest, R2, Neon, Vercel, or payment.

## 9. Dependencies And Order

Phase 1 should happen first because it establishes the public contract and avoids documenting stale SaaS assumptions.

Phases 2 and 3 can be done before Phase 4 so local user/session and Settings surfaces are reduced before provider simplification.

Phase 4 should happen before the worker replacement so the worker does not inherit DB-stored API key behavior.

Phase 5 is the highest-risk phase and should have the most detailed phase spec.

Phase 6 should happen last, after dependency usage is clear.

## 10. Risks

Auth removal has wide blast radius because many routes and pages use `requireAuth`, `requirePageSession`, or `useAuth`.

Billing removal can leave stale UI, copy, tests, or hidden gates if it is treated as a simple backend-only change.

The local worker is the largest technical risk. It touches queue semantics, long-running image polling, panel fanout, idempotency, cancellation, retry, and pipeline progress.

Provider simplification must avoid two competing key sources. Local v1 should not support both `.env` and DB-stored keys.

Schema cleanup should be conservative. Removing tables too early can increase migration risk without improving the user experience.

## 11. Whole-Roadmap Definition Of Done

A fresh clone can run locally with:

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma db push
npm run dev
npm run worker
```

The user can create a comic, review analysis, review storyboard, generate panel images, and use the reader/editor flow without Clerk, Inngest, R2, Neon, Vercel, or payment setup.

The only required external service for generation is WaveSpeed through the user's own `WAVESPEED_API_KEY`.

Generated image assets are stored locally.

The README, `.env.example`, health check, and setup docs describe the same local architecture.

`npm test` and `npm run build` pass.

The repository contains an MIT license at the root.

## 12. Phase Spec Template

Each phase spec should include:

- Goal.
- Current behavior.
- Target behavior.
- Files and modules likely affected.
- Data flow changes.
- Error handling.
- Test strategy.
- Migration or compatibility notes.
- Definition of done.

Each phase implementation plan should be written only after its phase spec is approved.
