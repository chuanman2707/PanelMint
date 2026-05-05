# PanelMint OSS Phase 1 Foundation Design

Date: 2026-05-05
Status: Draft for review
Owner: Binhan

## 1. Goal

Phase 1 makes the repository read as a local-first open-source application before deeper runtime refactors begin.

The phase establishes the public setup contract for PanelMint OSS v1: a single local user runs the Next.js app against local Docker Postgres, configures WaveSpeed through their own `WAVESPEED_API_KEY`, and follows the roadmap as the remaining SaaS runtime dependencies are removed in later phases.

This is a documentation and repository metadata phase. It does not change runtime behavior.

## 2. Current Behavior

The repository currently reads as a hosted SaaS application. The primary README describes the stack as Next.js, Clerk, Neon Postgres, Inngest, and Cloudflare R2. Local Docker Postgres is presented as a disposable helper, not the default OSS database setup.

The current `.env.example` leads with Neon connection strings and includes Clerk, Inngest, R2, encryption, and WaveSpeed variables. This reflects the current transitional runtime more than the intended OSS v1 contract.

There is no root `LICENSE` file. Contribution and test instructions exist in README and testing docs, but they are not framed around a fresh OSS local setup.

## 3. Target Behavior

A fresh reader should understand that PanelMint OSS v1 is intended to be cloned and run locally.

The primary setup path should be:

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma db push
npm run dev
```

The README should state that WaveSpeed is the only required external service for generation in the OSS v1 target, configured through `WAVESPEED_API_KEY` in `.env`.

The README may mention `npm run worker` as the planned local worker command from the master roadmap, but it must not imply the command is implemented during Phase 1 if the package script does not exist yet.

The docs should no longer present Vercel, Neon, Clerk, Inngest, Cloudflare R2, or payments as required for the OSS v1 local setup. If existing runtime gaps require mentioning them, those mentions must be clearly labeled as transitional and scheduled for later phase cleanup.

## 4. Scope

Phase 1 should include:

- Add a root MIT `LICENSE`.
- Rewrite `README.md` around local-first OSS setup.
- Update `.env.example` so Docker Postgres and WaveSpeed BYOK are the primary examples.
- Update Docker setup comments/docs so local Postgres is the default OSS database path, not a legacy helper.
- Add or update quickstart, troubleshooting, contribution, and test instructions.
- Remove SaaS-first positioning from primary docs.
- Add a short migration note explaining that Phase 1 updates the public setup contract while runtime cleanup happens in Phases 2 through 5.

## 5. Non-Scope

Phase 1 must not:

- Remove Clerk or change authentication behavior.
- Replace Inngest or add the local worker.
- Remove billing, credits, checkout, or pricing behavior.
- Remove Cloudflare R2 runtime code.
- Change provider key resolution.
- Change Prisma schema or migrations.
- Change API routes, UI behavior, generation flow, or storage behavior.
- Remove dependencies from `package.json`.

Those runtime changes belong to later phase specs and implementation plans.

## 6. Documentation Architecture

`README.md` is the main entrypoint for people cloning the repository. It should contain the product description, local quickstart, required env vars, Docker Postgres instructions, verification commands, troubleshooting, contribution guidance, test commands, and the migration note.

`.env.example` should be local-first. The default `DATABASE_URL` and `DIRECT_URL` examples should point at the Docker Compose Postgres service. `WAVESPEED_API_KEY` should be the primary AI provider key. Any Clerk, Inngest, R2, or encryption variables retained for the current transitional runtime must be grouped and labeled so readers do not treat them as OSS v1 requirements.

`docker-compose.yml` should describe Postgres as the local OSS database dependency. It should not say the default deployment is Vercel, Neon, Clerk, Inngest, or R2.

`LICENSE` should be a standard MIT license at the repository root.

Contribution and test guidance should stay in `README.md` for this phase unless implementation makes the README too large. If that happens, Phase 1 may add a small `CONTRIBUTING.md`, but this is optional rather than required.

## 7. Reader Flow

The intended documentation flow is:

1. A new reader opens README and sees PanelMint described as a local-first OSS comic generator.
2. They copy `.env.example` to `.env`.
3. They start Docker Postgres with `docker compose up -d`.
4. They run Prisma generation and schema sync.
5. They start the app with `npm run dev`.
6. They verify the app or health endpoint.
7. They understand that WaveSpeed generation requires their own `WAVESPEED_API_KEY`.
8. If they hit a runtime gap from ongoing migration, troubleshooting points them at the roadmap phases rather than requiring a hosted SaaS stack.

## 8. Error Handling And Troubleshooting

README troubleshooting should cover:

- Docker Postgres is not running or the port is unavailable.
- Prisma cannot connect to `DATABASE_URL`.
- `WAVESPEED_API_KEY` is missing or invalid.
- `/api/health` fails.
- A command referenced in the roadmap, such as the future worker command, is not available yet during Phase 1.
- Current runtime still references Clerk, Inngest, or R2 before their cleanup phases.

Troubleshooting should be direct and local-first. It should not route the user into setting up Vercel, Neon, Clerk, Inngest, or R2 as the normal OSS v1 path.

## 9. Risks

The main documentation risk is overpromising. Phase 1 should present the OSS v1 target clearly, but it must not claim every runtime dependency has already been removed.

A second risk is preserving SaaS-first language. If README or `.env.example` still makes hosted services look required for local OSS use, Phase 1 has not achieved its goal.

A third risk is deleting transitional environment variables too aggressively. If the current runtime still needs a variable before later phases remove that dependency, `.env.example` may keep it with a transitional label.

## 10. Test Strategy

Phase 1 changes are docs and metadata only, so runtime tests are optional unless implementation touches runtime files.

Required verification:

```bash
git diff --check
rg -n "Vercel|Neon|Clerk|Inngest|R2|Cloudflare|payment|credits" README.md .env.example docker-compose.yml docs/superpowers/specs/2026-05-05-panelmint-oss-phase-1-foundation-design.md
```

The `rg` check is not expected to return zero results. It is used to verify that any remaining provider mentions are framed as non-required, transitional, or later-phase cleanup.

Recommended verification:

```bash
npm run lint
```

If runtime files are changed despite the non-scope boundary, the implementation must run the relevant targeted tests and explain why runtime edits were necessary.

## 11. Migration And Compatibility Notes

Phase 1 is intentionally transitional. It updates the public contract before runtime code has fully caught up.

The README should include a short migration note stating that auth removal, billing removal, provider simplification, local storage, and local worker replacement are handled in later roadmap phases.

No database migration is required for Phase 1.

## 12. Likely Files Affected

Expected:

- `README.md`
- `.env.example`
- `docker-compose.yml`
- `LICENSE`

Optional:

- `CONTRIBUTING.md`

No `src/**`, `prisma/**`, or package dependency changes are expected in Phase 1.

## 13. Definition Of Done

Phase 1 is done when:

- Root `LICENSE` exists and contains the MIT license.
- README presents PanelMint as a local-first OSS application.
- README quickstart names the commands needed to install dependencies, configure env, start Docker Postgres, sync Prisma, and run the app.
- README explains that `npm run worker` is a later local-worker command if it is not implemented yet.
- `.env.example` leads with local Docker Postgres and `WAVESPEED_API_KEY`.
- Docker Compose comments no longer describe local Postgres as a legacy helper.
- Vercel, Neon, Clerk, Inngest, R2, and payment services are not presented as required for OSS v1 local setup.
- Troubleshooting covers common local setup failures and migration gaps.
- Contribution and test instructions are available to a fresh OSS contributor.
- Required verification commands pass or any failures are documented with a clear reason.
