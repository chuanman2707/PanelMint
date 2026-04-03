# PanelMint

PanelMint is an AI-assisted text-to-comic generator.

This repository has been cleaned to center on one production stack:

- Next.js 16 + React 19 frontend
- Clerk authentication
- Neon Postgres via Prisma
- Inngest background workflows
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

Optional local Postgres helper:

```bash
docker compose up -d
```

That helper is only for disposable local development. The intended deployment contract is Vercel + Neon + Clerk + Inngest + R2.

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
4. Rerun the targeted test, then the owning folder suite.
5. Run broader repo checks when the change crosses multiple areas or needs extra confidence before opening a PR.

## Required env vars

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon/Postgres runtime connection string. |
| `DIRECT_URL` | Optional | Direct Postgres connection for migrations. |
| `ENCRYPTION_SECRET` | Yes for production | Encrypts stored user API keys. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser key. |
| `CLERK_SECRET_KEY` | Yes | Clerk server key. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Yes | Verifies Clerk webhooks. |
| `INNGEST_EVENT_KEY` | Yes | Sends Inngest events. |
| `INNGEST_SIGNING_KEY` | Yes | Verifies Inngest endpoint calls. |
| `WAVESPEED_API_KEY` | Yes for production | Managed provider key for both LLM and image generation. |
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
| `ENCRYPTION_SECRET` | Generate locally | A long random secret, for example `openssl rand -base64 32`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard -> `API Keys` | The publishable key, usually prefixed with `pk_test_` or `pk_live_`. |
| `CLERK_SECRET_KEY` | Clerk Dashboard -> `API Keys` | The secret key, usually prefixed with `sk_test_` or `sk_live_`. |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk Dashboard -> `Webhooks` | Create an endpoint pointing at `/api/webhooks/clerk`, then copy its signing secret (`whsec_...`). |
| `INNGEST_EVENT_KEY` | Inngest Dashboard -> target environment | Create or copy the environment Event Key. |
| `INNGEST_SIGNING_KEY` | Inngest Dashboard -> target environment -> `Signing Key` | Copy the signing key for the same Inngest environment. |
| `WAVESPEED_API_KEY` | WaveSpeed -> API Keys | Generate one server-side API key and use it as the platform-managed key. |
| `ALLOWED_ORIGINS` | Your app domains | Comma-separated origins allowed to make mutating cross-origin requests. |

3. Recommended local/dev values:

- `ALLOWED_ORIGINS=http://localhost:3000`
- For local Inngest dev server, leave `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` blank and uncomment `INNGEST_DEV=1`.
- If you use local Docker Postgres instead of Neon during development, swap `DATABASE_URL` and `DIRECT_URL` to the commented localhost examples in `.env.example`.
- If you use the current Neon setup for this repo, the database name is `neondb` even though the Neon project is called `panelmint`.

4. Exact endpoints for this repo:

- Clerk webhook URL: `http://localhost:3000/api/webhooks/clerk` in local dev, or `https://your-domain.com/api/webhooks/clerk` in production.
- Inngest serve URL: `http://localhost:3000/api/inngest` in local dev, or `https://your-domain.com/api/inngest` in production.

5. Quick verification after saving `.env`:

```bash
npx prisma generate
npx prisma db push
npm run dev
curl http://localhost:3000/api/health
```

## Notes

- `runId` in the public API still maps to `episode.id`.
- Durable pipeline state lives in `pipeline_runs` and `pipeline_events`.
- Coarse UI state still mirrors `episodes.status`, `episodes.progress`, and `episodes.error`.
- Credit transactions use operation-level idempotency.
- Legacy Supabase, Redis worker, and multi-repo wrapper artifacts were intentionally removed from the main repository contract.
