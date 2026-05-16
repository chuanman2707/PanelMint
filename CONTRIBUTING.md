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
