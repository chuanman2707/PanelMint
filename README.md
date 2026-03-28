# WeOweo

WeOweo is an AI-assisted text-to-comic generator.

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
| `WAVESPEED_API_KEY` | Yes for production | Default managed image provider key. |
| `OPENROUTER_API_KEY` | Optional | Optional managed LLM routing key. |
| `ALLOWED_ORIGINS` | Optional | Extra trusted origins for mutating requests. |

Optional R2 group:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL`

If any R2 variable is set, the whole group must be configured.

## Notes

- `runId` in the public API still maps to `episode.id`.
- Durable pipeline state lives in `pipeline_runs` and `pipeline_events`.
- Coarse UI state still mirrors `episodes.status`, `episodes.progress`, and `episodes.error`.
- Credit transactions use operation-level idempotency.
- Legacy Supabase, Redis worker, and multi-repo wrapper artifacts were intentionally removed from the main repository contract.
