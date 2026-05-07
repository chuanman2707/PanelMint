# PanelMint

PanelMint is an AI-assisted text-to-comic generator.

This repository has been cleaned to center on one production stack:

- Next.js 16 + React 19 frontend
- Single local workspace owner, with no hosted identity service in OSS v1
- Neon Postgres via Prisma
- Local worker background queue
- Cloudflare R2 object storage

## Local setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

The app runs at `http://localhost:3000`.

Run the local worker in a second terminal to process queued generation jobs:

```bash
npm run worker
```

Optional local Postgres helper:

```bash
docker compose up -d
```

That helper is only for disposable local development. The intended deployment contract is Vercel + Neon + local single-user runtime + local worker queue + R2.

## Useful checks

```bash
npm test
npm run build
curl http://localhost:3000/api/health
```

## TDD Workflow

Use the local red-green-refactor loop for behavior changes in `src/app`, `src/lib`, `src/app/api`, `src/components`, and `src/hooks`.

1. Write or update the failing test first.
2. Run that targeted test and confirm the failure.
3. Make the smallest implementation that passes.
4. Rerun the targeted test, then the owning folder suite when it exists, otherwise the closest relevant suite or the full suite.
5. Run broader repo checks when the change crosses multiple areas or needs extra confidence before opening a PR.

## Required env vars

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon/Postgres runtime connection string. |
| `DIRECT_URL` | Optional | Direct Postgres connection for migrations. |
| `WAVESPEED_API_KEY` | Yes for generation | Your WaveSpeed API key from `.env`; used for both LLM and image generation. |
| `WAVESPEED_BASE_URL` | Optional | Defaults to `https://api.wavespeed.ai/api/v3`; override only for a WaveSpeed-compatible proxy. |
| `ALLOWED_ORIGINS` | Optional | Extra trusted origins for mutating requests. |

Optional R2 group:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

If any R2 variable is set, the whole group must be configured.

## Where To Get Each Key

1. Copy the template and open it for editing:

```bash
cp .env.example .env
```

2. Fill the values in this order:

| Variable | Where to get it | What to paste |
| --- | --- | --- |
| `DATABASE_URL` | Neon Dashboard -> your project -> `Connect` | The pooled connection string. Prefer the host with `-pooler` in it. Keep the database name aligned with the actual Neon database, which is usually `neondb` by default. |
| `DIRECT_URL` | Neon Dashboard -> your project -> `Connect` | The direct Postgres connection string for Prisma migrations. Prisma CLI in this repo prefers this value when it is set. Do not use the `-pooler` host here. |
| `WAVESPEED_API_KEY` | WaveSpeed -> API Keys | Generate one key and paste it into `.env`. PanelMint does not store provider keys in the database. |
| `WAVESPEED_BASE_URL` | `.env.example` default | Leave as-is unless you route requests through a WaveSpeed-compatible proxy. |
| `ALLOWED_ORIGINS` | Your app domains | Comma-separated origins allowed to make mutating cross-origin requests. |

3. Recommended local/dev values:

- `ALLOWED_ORIGINS=http://localhost:3000`
- If you use local Docker Postgres instead of Neon during development, swap `DATABASE_URL` and `DIRECT_URL` to the commented localhost examples in `.env.example`.
- If you use the current Neon setup for this repo, the database name is `neondb` even though the Neon project is called `panelmint`.

4. Quick verification after saving `.env`:

```bash
npx prisma generate
npx prisma db push
npm run dev
npm run worker
curl http://localhost:3000/api/health
```

## Notes

- `runId` in the public API still maps to `episode.id`.
- Durable pipeline state lives in `pipeline_runs` and `pipeline_events`.
- Coarse UI state still mirrors `episodes.status`, `episodes.progress`, and `episodes.error`.
- Credit transactions use operation-level idempotency.
- Legacy Supabase, Redis worker, and multi-repo wrapper artifacts were intentionally removed from the main repository contract.
