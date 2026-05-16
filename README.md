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
docker compose up -d --wait
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
docker compose up -d --wait
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
