# PanelMint OSS Phase 5 Local Worker And Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Inngest and Cloudflare R2 with a Postgres-backed local worker queue and local file storage under `PANELMINT_STORAGE_DIR`.

**Architecture:** Keep Next.js API routes as the control layer and keep the existing pipeline step functions as business logic. Replace `src/lib/queue.ts` internals with DB job writes, add a local worker process that atomically claims jobs, and convert storage to local-only serving through `/api/storage/...`. For WaveSpeed reference images, upload local files to WaveSpeed Media Upload as transient provider inputs instead of passing local URLs.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/Postgres, Vitest, Node `fs/promises`, `tsx`, WaveSpeed REST API, GitNexus MCP.

---

## Safety Rules

- Before editing any existing function, class, method, or route handler, run GitNexus impact with `direction: "upstream"` and `includeTests: true`.
- If GitNexus returns HIGH or CRITICAL, report direct callers and affected flows before editing.
- Use `apply_patch` for manual edits.
- Commit after every task with only that task's files staged.
- Before each commit, run `mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "staged" })`.
- Do not reintroduce Inngest, R2, AWS SDK, or cloud storage fallback.
- Do not persist WaveSpeed Media Upload URLs as PanelMint storage state.

## File Structure

Create:

- `src/lib/queue/repository.ts` - durable DB job creation, atomic claim, completion, retry, cancellation.
- `src/lib/queue/handlers.ts` - maps claimed jobs to pipeline functions.
- `src/lib/queue/worker.ts` - local worker loop and worker lifecycle.
- `src/lib/queue/fanout.ts` - image and character-sheet fanout helpers shared by queue adapter and handlers.
- `src/lib/pipeline/wavespeed-media.ts` - transient WaveSpeed Media Upload helper for local reference images.
- `scripts/worker.ts` - `npm run worker` entrypoint.
- `src/lib/__tests__/queue-repository.test.ts`
- `src/lib/__tests__/queue-adapter.test.ts`
- `src/lib/__tests__/queue-handlers.test.ts`
- `src/lib/__tests__/queue-worker.test.ts`
- `src/lib/__tests__/wavespeed-media.test.ts`
- `src/app/api/storage/[...key]/route.test.ts`

Modify:

- `prisma/schema.prisma`
- `prisma/postgres-baseline.sql`
- `prisma/migrations/20260330104038_init/migration.sql`
- `src/lib/queue.ts`
- `src/lib/storage.ts`
- `src/app/api/storage/[...key]/route.ts`
- `src/lib/pipeline/reference-images.ts`
- `src/lib/pipeline/panel-image-executor.ts`
- `src/lib/pipeline/image-gen.ts`
- `src/lib/ai/character-design.ts`
- `src/app/api/characters/[characterId]/generate-sheet/route.test.ts`
- `src/lib/env-validation.ts`
- `src/lib/__tests__/env-validation.test.ts`
- `src/app/api/health/route.ts`
- `src/app/api/health/route.test.ts`
- `src/lib/__tests__/storage.test.ts`
- `src/lib/__tests__/reference-images.test.ts`
- `src/lib/__tests__/image-gen-flow.test.ts`
- `src/lib/__tests__/image-gen-runtime-budget.test.ts`
- `src/app/api/generate/[runId]/cancel/route.test.ts`
- `.env.example`
- `README.md`
- `package.json`
- package lockfile

Delete:

- `src/lib/inngest/client.ts`
- `src/lib/inngest/functions.ts`
- `src/app/api/inngest/route.ts`

---

### Task 1: Add Pipeline Job Schema

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `prisma/postgres-baseline.sql`
- Modify: `prisma/migrations/20260330104038_init/migration.sql`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "PipelineRun", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: GitNexus may not resolve Prisma model symbols. If it returns "not found", continue and document that this task changes schema artifacts only.

- [ ] **Step 2: Update Prisma schema**

In `prisma/schema.prisma`, add relations:

```prisma
model User {
  id           String        @id @default(uuid())
  email        String        @unique
  name         String?
  preferences  String?       @db.Text
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @default(now()) @updatedAt
  projects     Project[]
  pipelineRuns PipelineRun[]
  pipelineJobs PipelineJob[]

  @@map("users")
}

model Episode {
  id           String        @id @default(uuid())
  projectId    String
  name         String
  novelText    String?       @db.Text
  pageCount    Int?
  format       String        @default("webtoon")
  status       String        @default("pending")
  progress     Int           @default(0)
  error        String?       @db.Text
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @default(now()) @updatedAt
  project      Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pages        Page[]
  pipelineRun  PipelineRun?
  pipelineJobs PipelineJob[]

  @@index([projectId])
  @@map("episodes")
}
```

Replace `PipelineRun` to remove Inngest:

```prisma
model PipelineRun {
  id          String          @id @default(uuid())
  episodeId   String          @unique
  userId      String
  status      String          @default("pending")
  currentStep String?         @map("current_step")
  startedAt   DateTime        @default(now()) @map("started_at")
  completedAt DateTime?       @map("completed_at")
  error       String?         @db.Text
  updatedAt   DateTime        @default(now()) @updatedAt
  episode     Episode         @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  user        User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  events      PipelineEvent[]

  @@index([userId])
  @@index([status])
  @@map("pipeline_runs")
}
```

Add new model after `PipelineEvent`:

```prisma
model PipelineJob {
  id          String    @id @default(uuid())
  episodeId   String    @map("episode_id")
  userId      String    @map("user_id")
  type        String
  payload     String    @db.Text
  status      String    @default("queued")
  attempts    Int       @default(0)
  maxAttempts Int       @default(3) @map("max_attempts")
  availableAt DateTime  @default(now()) @map("available_at")
  lockedAt    DateTime? @map("locked_at")
  lockedBy    String?   @map("locked_by")
  lastError   String?   @map("last_error") @db.Text
  dedupeKey   String    @map("dedupe_key")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @default(now()) @updatedAt @map("updated_at")
  episode     Episode   @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([status, availableAt])
  @@index([lockedAt])
  @@index([episodeId])
  @@index([dedupeKey, status])
  @@map("pipeline_jobs")
}
```

- [ ] **Step 3: Update SQL baseline and init migration**

In both `prisma/postgres-baseline.sql` and `prisma/migrations/20260330104038_init/migration.sql`:

Remove:

```sql
"inngest_run_id" TEXT,
CREATE UNIQUE INDEX "pipeline_runs_inngest_run_id_key" ON "pipeline_runs"("inngest_run_id");
```

Add after `pipeline_events`:

```sql
CREATE TABLE "pipeline_jobs" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pipeline_jobs_pkey" PRIMARY KEY ("id")
);
```

Add indexes after pipeline event indexes:

```sql
CREATE INDEX "pipeline_jobs_status_available_at_idx" ON "pipeline_jobs"("status", "available_at");
CREATE INDEX "pipeline_jobs_locked_at_idx" ON "pipeline_jobs"("locked_at");
CREATE INDEX "pipeline_jobs_episode_id_idx" ON "pipeline_jobs"("episode_id");
CREATE INDEX "pipeline_jobs_dedupe_key_status_idx" ON "pipeline_jobs"("dedupe_key", "status");
CREATE UNIQUE INDEX "pipeline_jobs_active_dedupe_key_key" ON "pipeline_jobs"("dedupe_key") WHERE "status" IN ('queued', 'running');
```

Add foreign keys near other pipeline foreign keys:

```sql
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pipeline_jobs" ADD CONSTRAINT "pipeline_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Validate schema**

Run:

```bash
npx prisma validate
npx prisma generate
```

Expected: both pass.

- [ ] **Step 5: Commit**

Run GitNexus detect changes, then:

```bash
git add prisma/schema.prisma prisma/postgres-baseline.sql prisma/migrations/20260330104038_init/migration.sql
git commit -m "refactor: add local pipeline job schema"
```

---

### Task 2: Add Queue Repository

**Files:**

- Create: `src/lib/__tests__/queue-repository.test.ts`
- Create: `src/lib/queue/repository.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/queue-repository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        pipelineJob: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        $queryRaw: vi.fn(),
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import {
    cancelEpisodeJobs,
    claimPipelineJobs,
    completePipelineJob,
    enqueuePipelineJob,
    failPipelineJob,
} from '@/lib/queue/repository'

describe('queue repository', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns an active duplicate job instead of creating another one', async () => {
        mocks.prisma.pipelineJob.findFirst.mockResolvedValue({ id: 'job-existing' })

        await expect(enqueuePipelineJob({
            episodeId: 'ep-1',
            userId: 'user-1',
            type: 'analyze',
            payload: { episodeId: 'ep-1' },
            dedupeKey: 'analyze:ep-1',
        })).resolves.toEqual({ id: 'job-existing' })

        expect(mocks.prisma.pipelineJob.create).not.toHaveBeenCalled()
    })

    it('creates a queued job with serialized payload', async () => {
        mocks.prisma.pipelineJob.findFirst.mockResolvedValue(null)
        mocks.prisma.pipelineJob.create.mockResolvedValue({ id: 'job-new' })

        await enqueuePipelineJob({
            episodeId: 'ep-1',
            userId: 'user-1',
            type: 'storyboard',
            payload: { episodeId: 'ep-1' },
            dedupeKey: 'storyboard:ep-1',
            maxAttempts: 5,
        })

        expect(mocks.prisma.pipelineJob.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                episodeId: 'ep-1',
                userId: 'user-1',
                type: 'storyboard',
                payload: JSON.stringify({ episodeId: 'ep-1' }),
                status: 'queued',
                dedupeKey: 'storyboard:ep-1',
                maxAttempts: 5,
            }),
        })
    })

    it('claims jobs through one raw atomic query', async () => {
        mocks.prisma.$queryRaw.mockResolvedValue([{ id: 'job-1', attempts: 1 }])

        await expect(claimPipelineJobs({
            workerId: 'worker-1',
            limit: 2,
            staleAfterMs: 60_000,
        })).resolves.toEqual([{ id: 'job-1', attempts: 1 }])

        expect(mocks.prisma.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('marks failed jobs for retry when attempts remain', async () => {
        await failPipelineJob({
            jobId: 'job-1',
            error: new Error('network'),
            attempts: 1,
            maxAttempts: 3,
            retryDelayMs: 5_000,
        })

        expect(mocks.prisma.pipelineJob.update).toHaveBeenCalledWith({
            where: { id: 'job-1' },
            data: expect.objectContaining({
                status: 'queued',
                lockedAt: null,
                lockedBy: null,
                lastError: 'network',
            }),
        })
    })

    it('cancels active jobs for an episode', async () => {
        mocks.prisma.pipelineJob.updateMany.mockResolvedValue({ count: 3 })

        await expect(cancelEpisodeJobs('ep-1')).resolves.toBe(3)

        expect(mocks.prisma.pipelineJob.updateMany).toHaveBeenCalledWith({
            where: {
                episodeId: 'ep-1',
                status: { in: ['queued', 'running'] },
            },
            data: expect.objectContaining({
                status: 'cancelled',
                lockedAt: null,
                lockedBy: null,
            }),
        })
    })

    it('marks jobs succeeded', async () => {
        await completePipelineJob('job-1')

        expect(mocks.prisma.pipelineJob.update).toHaveBeenCalledWith({
            where: { id: 'job-1' },
            data: expect.objectContaining({
                status: 'succeeded',
                lockedAt: null,
                lockedBy: null,
            }),
        })
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/__tests__/queue-repository.test.ts
```

Expected: FAIL because `@/lib/queue/repository` does not exist.

- [ ] **Step 3: Implement repository**

Create `src/lib/queue/repository.ts`:

```ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type PipelineJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type PipelineJobType =
    | 'analyze'
    | 'storyboard'
    | 'character-sheets-parent'
    | 'character-sheet'
    | 'image-generation-parent'
    | 'image-panel'

export interface PipelineJobRecord {
    id: string
    episodeId: string
    userId: string
    type: PipelineJobType
    payload: string
    status: PipelineJobStatus
    attempts: number
    maxAttempts: number
    availableAt: Date
    lockedAt: Date | null
    lockedBy: string | null
    lastError: string | null
    dedupeKey: string
}

export interface EnqueuePipelineJobInput {
    episodeId: string
    userId: string
    type: PipelineJobType
    payload: Record<string, unknown>
    dedupeKey: string
    maxAttempts?: number
    availableAt?: Date
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export async function enqueuePipelineJob(input: EnqueuePipelineJobInput) {
    const active = await prisma.pipelineJob.findFirst({
        where: {
            dedupeKey: input.dedupeKey,
            status: { in: ['queued', 'running'] },
        },
    })

    if (active) return active

    try {
        return await prisma.pipelineJob.create({
            data: {
                episodeId: input.episodeId,
                userId: input.userId,
                type: input.type,
                payload: JSON.stringify(input.payload),
                status: 'queued',
                attempts: 0,
                maxAttempts: input.maxAttempts ?? 3,
                availableAt: input.availableAt ?? new Date(),
                dedupeKey: input.dedupeKey,
            },
        })
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const duplicate = await prisma.pipelineJob.findFirst({
                where: {
                    dedupeKey: input.dedupeKey,
                    status: { in: ['queued', 'running'] },
                },
            })
            if (duplicate) return duplicate
        }
        throw error
    }
}

export async function claimPipelineJobs(input: {
    workerId: string
    limit: number
    staleAfterMs: number
}): Promise<PipelineJobRecord[]> {
    const staleBefore = new Date(Date.now() - input.staleAfterMs)

    return prisma.$queryRaw<PipelineJobRecord[]>`
        WITH next_jobs AS (
            SELECT id
            FROM pipeline_jobs
            WHERE (
                (status = 'queued' AND available_at <= NOW())
                OR (status = 'running' AND locked_at IS NOT NULL AND locked_at < ${staleBefore})
            )
            AND attempts < max_attempts
            ORDER BY available_at ASC, created_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT ${input.limit}
        )
        UPDATE pipeline_jobs
        SET
            status = 'running',
            locked_at = NOW(),
            locked_by = ${input.workerId},
            attempts = attempts + 1,
            updated_at = NOW()
        WHERE id IN (SELECT id FROM next_jobs)
        RETURNING
            id,
            episode_id AS "episodeId",
            user_id AS "userId",
            type,
            payload,
            status,
            attempts,
            max_attempts AS "maxAttempts",
            available_at AS "availableAt",
            locked_at AS "lockedAt",
            locked_by AS "lockedBy",
            last_error AS "lastError",
            dedupe_key AS "dedupeKey"
    `
}

export async function completePipelineJob(jobId: string): Promise<void> {
    await prisma.pipelineJob.update({
        where: { id: jobId },
        data: {
            status: 'succeeded',
            lockedAt: null,
            lockedBy: null,
            lastError: null,
        },
    })
}

export async function failPipelineJob(input: {
    jobId: string
    error: unknown
    attempts: number
    maxAttempts: number
    retryDelayMs: number
}): Promise<void> {
    const lastError = getErrorMessage(input.error)
    const canRetry = input.attempts < input.maxAttempts

    await prisma.pipelineJob.update({
        where: { id: input.jobId },
        data: canRetry
            ? {
                status: 'queued',
                availableAt: new Date(Date.now() + input.retryDelayMs),
                lockedAt: null,
                lockedBy: null,
                lastError,
            }
            : {
                status: 'failed',
                lockedAt: null,
                lockedBy: null,
                lastError,
            },
    })
}

export async function cancelEpisodeJobs(episodeId: string): Promise<number> {
    const result = await prisma.pipelineJob.updateMany({
        where: {
            episodeId,
            status: { in: ['queued', 'running'] },
        },
        data: {
            status: 'cancelled',
            lockedAt: null,
            lockedBy: null,
        },
    })

    return result.count
}
```

- [ ] **Step 4: Run targeted test**

Run:

```bash
npm test -- src/lib/__tests__/queue-repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run GitNexus detect changes, then:

```bash
git add src/lib/__tests__/queue-repository.test.ts src/lib/queue/repository.ts
git commit -m "feat: add local queue repository"
```

---

### Task 3: Replace Public Queue Adapter

**Files:**

- Create: `src/lib/__tests__/queue-adapter.test.ts`
- Create: `src/lib/queue/fanout.ts`
- Modify: `src/lib/queue.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "enqueueAnalyze", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "enqueueStoryboard", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "enqueueCharacterSheets", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "enqueueImageGen", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "cancelEpisodePipelineJobs", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: LOW risk with direct route callers. If not LOW, stop and report.

- [ ] **Step 2: Write failing adapter tests**

Create `src/lib/__tests__/queue-adapter.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    enqueuePipelineJob: vi.fn(),
    cancelEpisodeJobs: vi.fn(),
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
        panel: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/queue/repository', () => ({
    enqueuePipelineJob: mocks.enqueuePipelineJob,
    cancelEpisodeJobs: mocks.cancelEpisodeJobs,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import {
    cancelEpisodePipelineJobs,
    enqueueAnalyze,
    enqueueCharacterSheets,
    enqueueImageGen,
    enqueueStoryboard,
} from '@/lib/queue'

describe('queue adapter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.enqueuePipelineJob.mockResolvedValue({ id: 'job-1' })
        mocks.cancelEpisodeJobs.mockResolvedValue(2)
        mocks.prisma.episode.findUnique.mockResolvedValue({
            project: { userId: 'user-1' },
        })
        mocks.prisma.panel.findMany.mockResolvedValue([
            { id: 'panel-2', generationAttempt: 2 },
            { id: 'panel-1', generationAttempt: 0 },
        ])
    })

    it('enqueues analyze jobs in Postgres', async () => {
        await enqueueAnalyze({
            episodeId: 'ep-1',
            userId: 'user-1',
            projectId: 'project-1',
            text: 'chapter',
            artStyle: 'webtoon',
            pageCount: 12,
        })

        expect(mocks.enqueuePipelineJob).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'ep-1',
            userId: 'user-1',
            type: 'analyze',
            dedupeKey: 'analyze:ep-1',
        }))
    })

    it('enqueues storyboard and character parent jobs', async () => {
        await enqueueStoryboard('ep-1')
        await enqueueCharacterSheets('ep-1')

        expect(mocks.enqueuePipelineJob).toHaveBeenNthCalledWith(1, expect.objectContaining({
            type: 'storyboard',
            dedupeKey: 'storyboard:ep-1',
        }))
        expect(mocks.enqueuePipelineJob).toHaveBeenNthCalledWith(2, expect.objectContaining({
            type: 'character-sheets-parent',
            dedupeKey: 'character-sheets-parent:ep-1',
        }))
    })

    it('deduplicates panel ids and builds stable image parent dedupe key', async () => {
        await enqueueImageGen('ep-1', ['panel-1', 'panel-2', 'panel-1'])

        expect(mocks.enqueuePipelineJob).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'ep-1',
            userId: 'user-1',
            type: 'image-generation-parent',
            payload: {
                episodeId: 'ep-1',
                panelIds: ['panel-1', 'panel-2'],
            },
            dedupeKey: 'image-generation-parent:ep-1:panel-1,panel-2',
        }))
    })

    it('returns no jobs for empty image panel list', async () => {
        await expect(enqueueImageGen('ep-1', [])).resolves.toEqual([])
        expect(mocks.enqueuePipelineJob).not.toHaveBeenCalled()
    })

    it('cancels active jobs through repository', async () => {
        await expect(cancelEpisodePipelineJobs('ep-1')).resolves.toBe(2)
        expect(mocks.cancelEpisodeJobs).toHaveBeenCalledWith('ep-1')
    })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
npm test -- src/lib/__tests__/queue-adapter.test.ts
```

Expected: FAIL because `src/lib/queue.ts` still imports Inngest.

- [ ] **Step 4: Create fanout helper**

Create `src/lib/queue/fanout.ts`:

```ts
import { prisma } from '@/lib/prisma'

export function getUniqueIds(values: string[] | undefined): string[] {
    if (!values?.length) return []
    return [...new Set(values.filter(Boolean))]
}

export async function getEpisodeOwner(episodeId: string): Promise<string> {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
            project: {
                select: { userId: true },
            },
        },
    })

    if (!episode?.project.userId) {
        throw new Error(`Episode ${episodeId} is missing a project owner.`)
    }

    return episode.project.userId
}
```

- [ ] **Step 5: Replace queue adapter**

Replace `src/lib/queue.ts` with:

```ts
import { enqueuePipelineJob, cancelEpisodeJobs } from '@/lib/queue/repository'
import { getEpisodeOwner, getUniqueIds } from '@/lib/queue/fanout'

export type PipelineJobData =
    | {
        type: 'analyze'
        episodeId: string
        userId: string
        projectId: string
        text: string
        artStyle: string
        pageCount: number
      }
    | { type: 'storyboard'; episodeId: string }
    | { type: 'character-sheets-parent'; episodeId: string }
    | { type: 'character-sheet'; episodeId: string; userId: string; characterId: string }
    | { type: 'image-generation-parent'; episodeId: string; panelIds: string[] }
    | { type: 'image-panel'; episodeId: string; userId: string; panelId: string }

export async function enqueueAnalyze(
    data: Omit<Extract<PipelineJobData, { type: 'analyze' }>, 'type'>,
) {
    return enqueuePipelineJob({
        episodeId: data.episodeId,
        userId: data.userId,
        type: 'analyze',
        payload: data,
        dedupeKey: `analyze:${data.episodeId}`,
        maxAttempts: 2,
    })
}

export async function enqueueStoryboard(episodeId: string) {
    const userId = await getEpisodeOwner(episodeId)
    return enqueuePipelineJob({
        episodeId,
        userId,
        type: 'storyboard',
        payload: { episodeId },
        dedupeKey: `storyboard:${episodeId}`,
        maxAttempts: 2,
    })
}

export async function enqueueCharacterSheets(episodeId: string) {
    const userId = await getEpisodeOwner(episodeId)
    return enqueuePipelineJob({
        episodeId,
        userId,
        type: 'character-sheets-parent',
        payload: { episodeId },
        dedupeKey: `character-sheets-parent:${episodeId}`,
        maxAttempts: 2,
    })
}

export async function enqueueImageGen(episodeId: string, panelIds?: string[]) {
    const uniquePanelIds = getUniqueIds(panelIds)
    if (uniquePanelIds.length === 0) return []

    const userId = await getEpisodeOwner(episodeId)
    const stablePanelKey = [...uniquePanelIds].sort().join(',')

    return enqueuePipelineJob({
        episodeId,
        userId,
        type: 'image-generation-parent',
        payload: {
            episodeId,
            panelIds: uniquePanelIds,
        },
        dedupeKey: `image-generation-parent:${episodeId}:${stablePanelKey}`,
        maxAttempts: 2,
    })
}

export async function cancelEpisodePipelineJobs(episodeId: string) {
    return cancelEpisodeJobs(episodeId)
}
```

- [ ] **Step 6: Run targeted tests**

Run:

```bash
npm test -- src/lib/__tests__/queue-adapter.test.ts src/app/api/generate/route.test.ts src/app/api/generate/[runId]/generate-images/route.test.ts src/app/api/episodes/[episodeId]/retry/route.test.ts src/app/api/generate/[runId]/cancel/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run GitNexus detect changes, then:

```bash
git add src/lib/__tests__/queue-adapter.test.ts src/lib/queue/fanout.ts src/lib/queue.ts src/app/api/generate/route.test.ts src/app/api/generate/[runId]/generate-images/route.test.ts src/app/api/episodes/[episodeId]/retry/route.test.ts src/app/api/generate/[runId]/cancel/route.test.ts
git commit -m "refactor: enqueue pipeline jobs locally"
```

---

### Task 4: Add Worker Handlers And Worker Script

**Files:**

- Create: `src/lib/__tests__/queue-handlers.test.ts`
- Create: `src/lib/__tests__/queue-worker.test.ts`
- Create: `src/lib/queue/handlers.ts`
- Create: `src/lib/queue/worker.ts`
- Create: `scripts/worker.ts`
- Modify: `package.json`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "runAnalyzeStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "runStoryboardStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "runCharacterSheetStep", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "runImageGenStep", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: LOW risk direct Inngest caller. If not, report.

- [ ] **Step 2: Write failing handler tests**

Create `src/lib/__tests__/queue-handlers.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    runAnalyzeStep: vi.fn(),
    runStoryboardStep: vi.fn(),
    runImageGenStep: vi.fn(),
    getCharacterSheetDispatchPayloads: vi.fn(),
    runCharacterSheetStep: vi.fn(),
    enqueuePipelineJob: vi.fn(),
}))

vi.mock('@/lib/pipeline/orchestrator', () => ({
    runAnalyzeStep: mocks.runAnalyzeStep,
    runStoryboardStep: mocks.runStoryboardStep,
    runImageGenStep: mocks.runImageGenStep,
}))

vi.mock('@/lib/pipeline/character-sheet-step', () => ({
    getCharacterSheetDispatchPayloads: mocks.getCharacterSheetDispatchPayloads,
    runCharacterSheetStep: mocks.runCharacterSheetStep,
}))

vi.mock('@/lib/queue/repository', () => ({
    enqueuePipelineJob: mocks.enqueuePipelineJob,
}))

import { handlePipelineJob } from '@/lib/queue/handlers'
import type { PipelineJobRecord } from '@/lib/queue/repository'

function job(type: PipelineJobRecord['type'], payload: Record<string, unknown>): PipelineJobRecord {
    return {
        id: `job-${type}`,
        episodeId: 'ep-1',
        userId: 'user-1',
        type,
        payload: JSON.stringify(payload),
        status: 'running',
        attempts: 1,
        maxAttempts: 3,
        availableAt: new Date(),
        lockedAt: new Date(),
        lockedBy: 'worker-1',
        lastError: null,
        dedupeKey: `${type}:ep-1`,
    }
}

describe('handlePipelineJob', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getCharacterSheetDispatchPayloads.mockResolvedValue({
            userId: 'user-1',
            characterIds: ['char-1', 'char-2'],
        })
        mocks.enqueuePipelineJob.mockResolvedValue({ id: 'child-job' })
    })

    it('runs analyze payloads', async () => {
        await handlePipelineJob(job('analyze', {
            episodeId: 'ep-1',
            userId: 'user-1',
            projectId: 'project-1',
            text: 'chapter',
            artStyle: 'webtoon',
            pageCount: 12,
        }))

        expect(mocks.runAnalyzeStep).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'ep-1',
            text: 'chapter',
        }))
    })

    it('fans out character sheet jobs', async () => {
        await handlePipelineJob(job('character-sheets-parent', { episodeId: 'ep-1' }))

        expect(mocks.enqueuePipelineJob).toHaveBeenCalledTimes(2)
        expect(mocks.enqueuePipelineJob).toHaveBeenCalledWith(expect.objectContaining({
            type: 'character-sheet',
            dedupeKey: 'character-sheet:ep-1:char-1',
        }))
    })

    it('runs one image panel job', async () => {
        await handlePipelineJob(job('image-panel', {
            episodeId: 'ep-1',
            userId: 'user-1',
            panelId: 'panel-1',
        }))

        expect(mocks.runImageGenStep).toHaveBeenCalledWith('ep-1', ['panel-1'])
    })
})
```

- [ ] **Step 3: Write failing worker loop tests**

Create `src/lib/__tests__/queue-worker.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    claimPipelineJobs: vi.fn(),
    completePipelineJob: vi.fn(),
    failPipelineJob: vi.fn(),
    handlePipelineJob: vi.fn(),
}))

vi.mock('@/lib/queue/repository', () => ({
    claimPipelineJobs: mocks.claimPipelineJobs,
    completePipelineJob: mocks.completePipelineJob,
    failPipelineJob: mocks.failPipelineJob,
}))

vi.mock('@/lib/queue/handlers', () => ({
    handlePipelineJob: mocks.handlePipelineJob,
}))

import { runWorkerOnce } from '@/lib/queue/worker'

describe('queue worker', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('claims and completes jobs', async () => {
        const job = { id: 'job-1', attempts: 1, maxAttempts: 3 }
        mocks.claimPipelineJobs.mockResolvedValue([job])
        mocks.handlePipelineJob.mockResolvedValue(undefined)

        await runWorkerOnce({ workerId: 'worker-1', claimLimit: 1, staleAfterMs: 60_000 })

        expect(mocks.handlePipelineJob).toHaveBeenCalledWith(job)
        expect(mocks.completePipelineJob).toHaveBeenCalledWith('job-1')
    })

    it('records retryable job failures', async () => {
        const error = new Error('boom')
        const job = { id: 'job-1', attempts: 1, maxAttempts: 3 }
        mocks.claimPipelineJobs.mockResolvedValue([job])
        mocks.handlePipelineJob.mockRejectedValue(error)

        await runWorkerOnce({ workerId: 'worker-1', claimLimit: 1, staleAfterMs: 60_000 })

        expect(mocks.failPipelineJob).toHaveBeenCalledWith({
            jobId: 'job-1',
            error,
            attempts: 1,
            maxAttempts: 3,
            retryDelayMs: 5_000,
        })
    })
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
npm test -- src/lib/__tests__/queue-handlers.test.ts src/lib/__tests__/queue-worker.test.ts
```

Expected: FAIL because worker files do not exist.

- [ ] **Step 5: Implement handlers**

Create `src/lib/queue/handlers.ts`:

```ts
import {
    runAnalyzeStep,
    runImageGenStep,
    runStoryboardStep,
} from '@/lib/pipeline/orchestrator'
import {
    getCharacterSheetDispatchPayloads,
    runCharacterSheetStep,
} from '@/lib/pipeline/character-sheet-step'
import { enqueuePipelineJob, type PipelineJobRecord } from '@/lib/queue/repository'

function parsePayload<T>(job: PipelineJobRecord): T {
    return JSON.parse(job.payload) as T
}

export async function handlePipelineJob(job: PipelineJobRecord): Promise<void> {
    switch (job.type) {
        case 'analyze': {
            await runAnalyzeStep(parsePayload(job))
            return
        }
        case 'storyboard': {
            const payload = parsePayload<{ episodeId: string }>(job)
            await runStoryboardStep(payload.episodeId)
            return
        }
        case 'character-sheets-parent': {
            const payload = parsePayload<{ episodeId: string }>(job)
            const dispatch = await getCharacterSheetDispatchPayloads(payload.episodeId)
            await Promise.all(dispatch.characterIds.map((characterId) =>
                enqueuePipelineJob({
                    episodeId: payload.episodeId,
                    userId: dispatch.userId,
                    type: 'character-sheet',
                    payload: {
                        episodeId: payload.episodeId,
                        userId: dispatch.userId,
                        characterId,
                    },
                    dedupeKey: `character-sheet:${payload.episodeId}:${characterId}`,
                    maxAttempts: 2,
                }),
            ))
            return
        }
        case 'character-sheet': {
            await runCharacterSheetStep(parsePayload(job))
            return
        }
        case 'image-generation-parent': {
            const payload = parsePayload<{ episodeId: string; panelIds: string[] }>(job)
            await Promise.all(payload.panelIds.map((panelId) =>
                enqueuePipelineJob({
                    episodeId: payload.episodeId,
                    userId: job.userId,
                    type: 'image-panel',
                    payload: {
                        episodeId: payload.episodeId,
                        userId: job.userId,
                        panelId,
                    },
                    dedupeKey: `image-panel:${payload.episodeId}:${panelId}`,
                    maxAttempts: 2,
                }),
            ))
            return
        }
        case 'image-panel': {
            const payload = parsePayload<{ episodeId: string; panelId: string }>(job)
            await runImageGenStep(payload.episodeId, [payload.panelId])
            return
        }
        default: {
            const exhaustive: never = job.type
            throw new Error(`Unsupported pipeline job type: ${exhaustive}`)
        }
    }
}
```

- [ ] **Step 6: Implement worker loop**

Create `src/lib/queue/worker.ts`:

```ts
import { randomUUID } from 'crypto'
import { hostname } from 'os'
import {
    claimPipelineJobs,
    completePipelineJob,
    failPipelineJob,
    type PipelineJobRecord,
} from '@/lib/queue/repository'
import { handlePipelineJob } from '@/lib/queue/handlers'

const DEFAULT_CLAIM_LIMIT = 3
const DEFAULT_STALE_AFTER_MS = 15 * 60_000
const DEFAULT_POLL_INTERVAL_MS = 1_000
const BASE_RETRY_DELAY_MS = 5_000

export function createWorkerId(): string {
    return `${hostname()}:${process.pid}:${randomUUID()}`
}

export function getRetryDelayMs(job: Pick<PipelineJobRecord, 'attempts'>): number {
    return BASE_RETRY_DELAY_MS * Math.max(1, job.attempts)
}

export async function runWorkerOnce(input: {
    workerId: string
    claimLimit?: number
    staleAfterMs?: number
}): Promise<number> {
    const jobs = await claimPipelineJobs({
        workerId: input.workerId,
        limit: input.claimLimit ?? DEFAULT_CLAIM_LIMIT,
        staleAfterMs: input.staleAfterMs ?? DEFAULT_STALE_AFTER_MS,
    })

    await Promise.all(jobs.map(async (job) => {
        try {
            await handlePipelineJob(job)
            await completePipelineJob(job.id)
        } catch (error) {
            await failPipelineJob({
                jobId: job.id,
                error,
                attempts: job.attempts,
                maxAttempts: job.maxAttempts,
                retryDelayMs: getRetryDelayMs(job),
            })
        }
    }))

    return jobs.length
}

export async function runWorkerLoop(input: {
    workerId?: string
    pollIntervalMs?: number
    signal?: AbortSignal
} = {}): Promise<void> {
    const workerId = input.workerId ?? createWorkerId()
    const pollIntervalMs = input.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

    console.log(`[Worker] started ${workerId}`)

    while (!input.signal?.aborted) {
        const count = await runWorkerOnce({ workerId })
        if (count === 0) {
            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
        }
    }

    console.log(`[Worker] stopped ${workerId}`)
}
```

- [ ] **Step 7: Add script entrypoint and package script**

Create `scripts/worker.ts`:

```ts
import { runWorkerLoop } from '@/lib/queue/worker'

const controller = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`[Worker] received ${signal}`)
        controller.abort()
    })
}

runWorkerLoop({ signal: controller.signal }).catch((error) => {
    console.error('[Worker] fatal error', error)
    process.exitCode = 1
})
```

In `package.json`, add:

```json
"worker": "tsx scripts/worker.ts"
```

- [ ] **Step 8: Run targeted tests**

Run:

```bash
npm test -- src/lib/__tests__/queue-handlers.test.ts src/lib/__tests__/queue-worker.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run GitNexus detect changes, then:

```bash
git add src/lib/__tests__/queue-handlers.test.ts src/lib/__tests__/queue-worker.test.ts src/lib/queue/handlers.ts src/lib/queue/worker.ts scripts/worker.ts package.json
git commit -m "feat: add local pipeline worker"
```

---

### Task 5: Remove Inngest Runtime And Env Readiness

**Files:**

- Modify: `src/lib/env-validation.ts`
- Modify: `src/lib/__tests__/env-validation.test.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/api/health/route.test.ts`
- Modify: `src/lib/__tests__/image-gen-runtime-budget.test.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`
- Delete: `src/lib/inngest/client.ts`
- Delete: `src/lib/inngest/functions.ts`
- Delete: `src/app/api/inngest/route.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.api_impact({ repo: "weoweo", file: "src/app/api/inngest/route.ts" })
mcp__gitnexus__.impact({ repo: "weoweo", target: "getEnvValidationReport", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: `/api/inngest` has no app consumers. If API impact reports real consumers, stop and report.

- [ ] **Step 2: Update tests first**

Update env/health/runtime tests so they expect local queue:

```ts
// src/lib/__tests__/image-gen-runtime-budget.test.ts
import { describe, expect, it } from 'vitest'
import { WAVESPEED_IMAGE_POLL_TIMEOUT_MS } from '@/lib/pipeline/image-gen'

describe('WaveSpeed image runtime budget', () => {
    it('keeps panel polling inside the local worker stale-lock window', () => {
        expect(WAVESPEED_IMAGE_POLL_TIMEOUT_MS).toBeLessThan(15 * 60_000)
    })
})
```

In `src/app/api/health/route.test.ts`, remove all `INNGEST_*` and `R2_*` expected env checks and change:

```ts
runtime: {
    queue: 'local-worker',
    identity: 'local-single-user',
}
```

In `src/lib/__tests__/env-validation.test.ts`, remove tests that require Inngest production env and R2 env groups.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/__tests__/env-validation.test.ts src/app/api/health/route.test.ts src/lib/__tests__/image-gen-runtime-budget.test.ts
```

Expected: FAIL while code still reports Inngest/R2.

- [ ] **Step 4: Update env validation and health**

In `src/lib/env-validation.ts`, remove `PROD_QUEUE_REQUIRED`, `OPTIONAL_R2_REQUIRED`, and `OPTIONAL_R2_OPTIONAL`. Keep only startup/generation env and `ALLOWED_ORIGINS` warning.

In `src/app/api/health/route.ts`, change runtime queue to:

```ts
runtime: {
    deployment: process.env.VERCEL ? 'vercel' : 'local',
    queue: 'local-worker',
    identity: 'local-single-user',
},
```

- [ ] **Step 5: Delete Inngest files and package entries**

Delete:

```text
src/lib/inngest/client.ts
src/lib/inngest/functions.ts
src/app/api/inngest/route.ts
```

In `package.json`, remove:

```json
"inngest:dev": "npx --ignore-scripts=false inngest-cli@latest dev -u http://localhost:3000/api/inngest"
```

Remove dependency:

```json
"inngest": "^4.1.0"
```

Run the package manager install command used by the repo to update the lockfile:

```bash
npm install
```

- [ ] **Step 6: Update docs/env**

In `.env.example`, remove:

```text
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
# INNGEST_DEV=1
```

In `README.md`, replace all Inngest setup with local worker instructions.

- [ ] **Step 7: Run targeted verification**

Run:

```bash
npm test -- src/lib/__tests__/env-validation.test.ts src/app/api/health/route.test.ts src/lib/__tests__/image-gen-runtime-budget.test.ts
rg -n "inngest|Inngest|INNGEST_|inngest:dev" src prisma scripts README.md .env.example package.json
```

Expected: tests pass; `rg` returns no active matches.

- [ ] **Step 8: Commit**

Run GitNexus detect changes, then:

```bash
git add src/lib/env-validation.ts src/lib/__tests__/env-validation.test.ts src/app/api/health/route.ts src/app/api/health/route.test.ts src/lib/__tests__/image-gen-runtime-budget.test.ts .env.example README.md package.json package-lock.json src/lib/inngest/client.ts src/lib/inngest/functions.ts src/app/api/inngest/route.ts
git commit -m "refactor: remove inngest runtime"
```

---

### Task 6: Replace R2 With Safe Local Storage

**Files:**

- Modify: `src/lib/storage.ts`
- Modify: `src/lib/__tests__/storage.test.ts`
- Modify: `src/app/api/storage/[...key]/route.ts`
- Create: `src/app/api/storage/[...key]/route.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "getStorage", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.api_impact({ repo: "weoweo", file: "src/app/api/storage/[...key]/route.ts" })
```

Expected: `getStorage` CRITICAL. Report direct callers and proceed because this is approved Phase 5 scope.

- [ ] **Step 2: Write storage tests first**

Replace `src/lib/__tests__/storage.test.ts` with tests that assert safe local behavior:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import {
    LocalStorageProvider,
    buildStorageKey,
    buildStorageProxyUrl,
    createStorageProvider,
    getContentTypeForStorageKey,
    normalizeStorageKey,
} from '@/lib/storage'

vi.mock('fs/promises')

describe('local storage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubEnv('PANELMINT_STORAGE_DIR', '/tmp/panelmint-generated')
        vi.mocked(mkdir).mockResolvedValue(undefined as unknown as string)
        vi.mocked(writeFile).mockResolvedValue(undefined)
        vi.mocked(readFile).mockResolvedValue(Buffer.from('image'))
        vi.mocked(stat).mockResolvedValue({ isFile: () => true } as never)
        vi.mocked(unlink).mockResolvedValue(undefined)
    })

    it('normalizes safe relative keys', () => {
        expect(normalizeStorageKey('users/u/episodes/e/panel.png')).toBe('users/u/episodes/e/panel.png')
    })

    it('rejects path traversal and absolute keys', () => {
        expect(() => normalizeStorageKey('../secret.png')).toThrow('Invalid storage key')
        expect(() => normalizeStorageKey('/tmp/secret.png')).toThrow('Invalid storage key')
    })

    it('uploads under PANELMINT_STORAGE_DIR and returns the normalized key', async () => {
        const provider = new LocalStorageProvider()
        await expect(provider.upload(Buffer.from('image'), 'users/u/panel.png')).resolves.toBe('users/u/panel.png')
        expect(writeFile).toHaveBeenCalled()
    })

    it('reads local files with content type', async () => {
        const provider = new LocalStorageProvider()
        await expect(provider.read('users/u/panel.png')).resolves.toMatchObject({
            contentType: 'image/png',
            buffer: expect.any(Buffer),
        })
    })

    it('builds storage proxy URLs', () => {
        expect(buildStorageProxyUrl('users/u/panel 1.png')).toBe('/api/storage/users/u/panel%201.png')
    })

    it('maps image extensions to content type', () => {
        expect(getContentTypeForStorageKey('a.webp')).toBe('image/webp')
        expect(getContentTypeForStorageKey('a.txt')).toBe('application/octet-stream')
    })

    it('always creates local storage provider', () => {
        expect(createStorageProvider()).toBeInstanceOf(LocalStorageProvider)
    })

    it('builds nested panel storage keys', () => {
        expect(buildStorageKey('user-1', 'episode-1', 'panel-1')).toMatch(
            /^users\/user-1\/episodes\/episode-1\/panels\/panel-1-.+\\.png$/,
        )
    })
})
```

- [ ] **Step 3: Write storage route tests**

Create `src/app/api/storage/[...key]/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    read: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
    getStorage: () => ({ read: mocks.read }),
}))

import { GET } from './route'

describe('GET /api/storage/[...key]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.read.mockResolvedValue({
            buffer: Buffer.from('image-bytes'),
            contentType: 'image/png',
        })
    })

    it('serves local storage bytes', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/storage/users/u/panel.png'),
            { params: Promise.resolve({ key: ['users', 'u', 'panel.png'] }) },
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('image/png')
        expect(mocks.read).toHaveBeenCalledWith('users/u/panel.png')
    })

    it('returns 404 for missing keys', async () => {
        mocks.read.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }))

        const response = await GET(
            new NextRequest('http://localhost/api/storage/users/u/missing.png'),
            { params: Promise.resolve({ key: ['users', 'u', 'missing.png'] }) },
        )

        expect(response.status).toBe(404)
    })
})
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/__tests__/storage.test.ts src/app/api/storage/[...key]/route.test.ts
```

Expected: FAIL because storage API still uses `/generated`/signed URL redirect.

- [ ] **Step 5: Replace storage implementation**

Replace `src/lib/storage.ts` with local-only provider. Preserve exported names used by callers:

```ts
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises'
import { join, resolve, sep } from 'path'
import { randomUUID } from 'crypto'

export interface StoredFile {
    buffer: Buffer
    contentType: string
}

export interface StorageProvider {
    upload(buffer: Buffer, key: string, options?: { contentType?: string }): Promise<string>
    read(key: string): Promise<StoredFile>
    getSignedUrl(key: string): Promise<string>
    delete(key: string): Promise<void>
}

const IMAGE_CONTENT_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
}

export function getStorageBaseDir(): string {
    return resolve(process.env.PANELMINT_STORAGE_DIR?.trim() || join(process.cwd(), '.panelmint', 'generated'))
}

export function normalizeStorageKey(key: string): string {
    const normalized = key.replace(/\\\\/g, '/').replace(/^\\/+/, '')
    if (!normalized || normalized.includes('..') || normalized.startsWith('/')) {
        throw new Error('Invalid storage key')
    }
    return normalized
}

export function resolveStoragePath(key: string): string {
    const baseDir = getStorageBaseDir()
    const normalizedKey = normalizeStorageKey(key)
    const filePath = resolve(baseDir, normalizedKey)
    if (filePath !== baseDir && !filePath.startsWith(`${baseDir}${sep}`)) {
        throw new Error('Invalid storage key')
    }
    return filePath
}

export function getContentTypeForStorageKey(key: string): string {
    const extension = key.split('.').pop()?.toLowerCase() || ''
    return IMAGE_CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

export function buildStorageKey(userId: string, episodeId: string, panelId: string, extension = 'png'): string {
    const safeExtension = IMAGE_CONTENT_TYPES[extension.toLowerCase()] ? extension.toLowerCase() : 'png'
    return `users/${userId}/episodes/${episodeId}/panels/${panelId}-${randomUUID()}.${safeExtension}`
}

export function buildStorageProxyUrl(key: string): string {
    return `/api/storage/${normalizeStorageKey(key).split('/').map(encodeURIComponent).join('/')}`
}

export class LocalStorageProvider implements StorageProvider {
    async upload(buffer: Buffer, key: string): Promise<string> {
        const normalizedKey = normalizeStorageKey(key)
        const filePath = resolveStoragePath(normalizedKey)
        await mkdir(filePath.slice(0, filePath.lastIndexOf(sep)), { recursive: true })
        await writeFile(filePath, buffer)
        return normalizedKey
    }

    async read(key: string): Promise<StoredFile> {
        const normalizedKey = normalizeStorageKey(key)
        const filePath = resolveStoragePath(normalizedKey)
        const fileStat = await stat(filePath)
        if (!fileStat.isFile()) throw new Error('Not found')
        return {
            buffer: await readFile(filePath),
            contentType: getContentTypeForStorageKey(normalizedKey),
        }
    }

    async getSignedUrl(key: string): Promise<string> {
        return buildStorageProxyUrl(key)
    }

    async delete(key: string): Promise<void> {
        try {
            await unlink(resolveStoragePath(key))
        } catch {
            // Missing local files are already deleted for app purposes.
        }
    }
}

let provider: StorageProvider | null = null

export function createStorageProvider(): StorageProvider {
    return new LocalStorageProvider()
}

export function getStorage(): StorageProvider {
    if (!provider) provider = createStorageProvider()
    return provider
}
```

- [ ] **Step 6: Replace storage route**

Replace `src/app/api/storage/[...key]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

interface StorageRouteContext {
    params: Promise<{ key?: string[] }>
}

export async function GET(_request: NextRequest, context: StorageRouteContext) {
    const { key } = await context.params

    if (!key?.length) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
        const storageKey = key.map((segment) => decodeURIComponent(segment)).join('/')
        const file = await getStorage().read(storageKey)
        return new NextResponse(file.buffer, {
            status: 200,
            headers: {
                'Content-Type': file.contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
}
```

- [ ] **Step 7: Run storage tests**

Run:

```bash
npm test -- src/lib/__tests__/storage.test.ts src/app/api/storage/[...key]/route.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run GitNexus detect changes, then:

```bash
git add src/lib/storage.ts src/lib/__tests__/storage.test.ts src/app/api/storage/[...key]/route.ts src/app/api/storage/[...key]/route.test.ts
git commit -m "refactor: serve generated assets from local storage"
```

---

### Task 7: Fix Image URL And WaveSpeed Reference Handling

**Files:**

- Create: `src/lib/__tests__/wavespeed-media.test.ts`
- Create: `src/lib/pipeline/wavespeed-media.ts`
- Modify: `src/lib/pipeline/reference-images.ts`
- Modify: `src/lib/__tests__/reference-images.test.ts`
- Modify: `src/lib/pipeline/panel-image-executor.ts`
- Modify: `src/lib/pipeline/image-gen.ts`
- Modify: `src/lib/__tests__/image-gen-flow.test.ts`
- Modify: `src/lib/ai/character-design.ts`
- Modify: `src/app/api/characters/[characterId]/generate-sheet/route.test.ts`

- [ ] **Step 1: Run impact checks**

Run:

```text
mcp__gitnexus__.impact({ repo: "weoweo", target: "collectPanelReferenceImages", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "generatePanelImage", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "generateCharacterSheet", direction: "upstream", includeTests: true, maxDepth: 3 })
mcp__gitnexus__.impact({ repo: "weoweo", target: "executePanelImageGeneration", direction: "upstream", includeTests: true, maxDepth: 3 })
```

Expected: image/storage paths may be MEDIUM/HIGH. Report blast radius if HIGH/CRITICAL before editing.

- [ ] **Step 2: Write WaveSpeed media tests**

Create `src/lib/__tests__/wavespeed-media.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    read: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
    getStorage: () => ({ read: mocks.read }),
}))

import { prepareWaveSpeedReferenceImages } from '@/lib/pipeline/wavespeed-media'

describe('prepareWaveSpeedReferenceImages', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.read.mockResolvedValue({
            buffer: Buffer.from('image'),
            contentType: 'image/png',
        })
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            data: { download_url: 'https://wavespeed.media/ref.png' },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))
    })

    it('uploads local storage references to WaveSpeed media upload', async () => {
        const refs = await prepareWaveSpeedReferenceImages([
            { storageKey: 'characters/aoi.png', imageUrl: '/api/storage/characters/aoi.png' },
        ], {
            provider: 'wavespeed',
            apiKey: 'ws-key',
            llmModel: 'llm',
            imageModel: 'image',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })

        expect(refs).toEqual(['https://wavespeed.media/ref.png'])
        const [url, init] = vi.mocked(fetch).mock.calls[0]
        expect(String(url)).toBe('https://api.wavespeed.ai/api/v3/media/upload/binary')
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer ws-key' })
    })

    it('does not pass local browser URLs to WaveSpeed', async () => {
        const refs = await prepareWaveSpeedReferenceImages([
            { imageUrl: '/api/storage/characters/aoi.png' },
            { imageUrl: '/generated/aoi.png' },
            { imageUrl: '/Users/binhan/aoi.png' },
        ], {
            provider: 'wavespeed',
            apiKey: 'ws-key',
            llmModel: 'llm',
            imageModel: 'image',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })

        expect(refs).toEqual([])
        expect(fetch).not.toHaveBeenCalled()
    })
})
```

- [ ] **Step 3: Update reference image tests**

Change `src/lib/__tests__/reference-images.test.ts` so `collectPanelReferenceImages` returns reference objects:

```ts
expect(refs).toEqual([
    { imageUrl: '/appearances/minh-default.png', storageKey: 'appearances/minh-default.png' },
    { imageUrl: '/generated/char-2.png', storageKey: 'characters/thanh-thu.png' },
])
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/__tests__/wavespeed-media.test.ts src/lib/__tests__/reference-images.test.ts
```

Expected: FAIL because helper does not exist and reference images still return strings.

- [ ] **Step 5: Add WaveSpeed media helper**

Create `src/lib/pipeline/wavespeed-media.ts`:

```ts
import type { ProviderConfig } from '@/lib/api-config'
import { getStorage } from '@/lib/storage'

export interface ReferenceImageCandidate {
    imageUrl: string | null
    storageKey?: string | null
}

function isRemoteUrl(value: string): boolean {
    return value.startsWith('https://') || value.startsWith('http://')
}

function isLocalUrl(value: string): boolean {
    return value.startsWith('/api/storage/')
        || value.startsWith('/generated/')
        || value.startsWith('/')
}

async function uploadReferenceToWaveSpeed(
    reference: ReferenceImageCandidate,
    config: ProviderConfig,
): Promise<string | null> {
    if (!reference.storageKey) return null

    const file = await getStorage().read(reference.storageKey)
    const formData = new FormData()
    formData.append('file', new Blob([file.buffer], { type: file.contentType }), reference.storageKey.split('/').pop() || 'reference.png')

    const response = await fetch(`${config.baseUrl}/media/upload/binary`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
        },
        body: formData,
    })

    if (!response.ok) {
        console.warn(`[WaveSpeed] reference upload failed: ${response.status}`)
        return null
    }

    const data = await response.json() as {
        data?: { download_url?: string }
    }

    return data.data?.download_url ?? null
}

export async function prepareWaveSpeedReferenceImages(
    references: ReferenceImageCandidate[],
    config: ProviderConfig,
): Promise<string[]> {
    const urls: string[] = []

    for (const reference of references) {
        if (reference.storageKey) {
            const uploadedUrl = await uploadReferenceToWaveSpeed(reference, config)
            if (uploadedUrl) urls.push(uploadedUrl)
        } else if (reference.imageUrl && isRemoteUrl(reference.imageUrl) && !isLocalUrl(reference.imageUrl)) {
            urls.push(reference.imageUrl)
        }

        if (urls.length === 5) break
    }

    return urls
}
```

- [ ] **Step 6: Update reference collection**

In `src/lib/pipeline/reference-images.ts`, remove `getStorage().getSignedUrl` usage. Export `ReferenceImageCandidate` and return reference objects:

```ts
import type { ReferenceImageCandidate } from './wavespeed-media'

async function resolveReferenceImage(reference: StoredImageReference | null): Promise<ReferenceImageCandidate | null> {
    if (!reference) return null
    return {
        imageUrl: reference.imageUrl,
        storageKey: reference.storageKey,
    }
}
```

Change `collectPanelReferenceImages` return type:

```ts
export async function collectPanelReferenceImages(
    panelCharacterNames: string[],
    projectCharacters: CharacterWithImage[],
): Promise<ReferenceImageCandidate[]> {
```

- [ ] **Step 7: Prepare references before image generation**

In `src/lib/pipeline/panel-image-executor.ts`, after `providerConfig` is available:

```ts
const referenceCandidates = await collectPanelReferenceImages(panelCharNames, dbCharacters)
const referenceImages = await prepareWaveSpeedReferenceImages(referenceCandidates, providerConfig)
```

Import:

```ts
import { prepareWaveSpeedReferenceImages } from './wavespeed-media'
```

- [ ] **Step 8: Make stored image URL derived from storageKey**

In `src/lib/pipeline/image-gen.ts`, update `downloadAndSave`:

```ts
const storedKey = await storage.upload(buffer, key, { contentType: 'image/png' })
return {
    imageUrl: buildStorageProxyUrl(storedKey),
    storageKey: storedKey,
}
```

If Task 6 added content-type detection extension support, preserve it and pass the detected content type.

- [ ] **Step 9: Update tests for image URL contract**

Update image generation and character sheet route tests to expect:

```ts
imageUrl: '/api/storage/users/user-1/episodes/episode-1/panels/panel-1.png'
```

and never `/generated/...`.

- [ ] **Step 10: Run targeted tests**

Run:

```bash
npm test -- src/lib/__tests__/wavespeed-media.test.ts src/lib/__tests__/reference-images.test.ts src/lib/__tests__/image-gen-flow.test.ts src/lib/__tests__/panel-image-executor.test.ts src/app/api/characters/[characterId]/generate-sheet/route.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run GitNexus detect changes, then:

```bash
git add src/lib/__tests__/wavespeed-media.test.ts src/lib/pipeline/wavespeed-media.ts src/lib/pipeline/reference-images.ts src/lib/__tests__/reference-images.test.ts src/lib/pipeline/panel-image-executor.ts src/lib/pipeline/image-gen.ts src/lib/__tests__/image-gen-flow.test.ts src/lib/__tests__/panel-image-executor.test.ts src/lib/ai/character-design.ts src/app/api/characters/[characterId]/generate-sheet/route.test.ts
git commit -m "refactor: use local storage with wavespeed media handoff"
```

---

### Task 8: Remove R2 Dependencies And Docs

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`
- Modify: package lockfile

- [ ] **Step 1: Remove R2 env docs**

From `.env.example`, remove:

```text
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=panelmint
R2_PUBLIC_URL=
```

Add:

```text
# Local generated asset storage
# Defaults to .panelmint/generated when empty.
PANELMINT_STORAGE_DIR=.panelmint/generated
```

- [ ] **Step 2: Update README**

README must say:

```text
Generated images are stored locally under PANELMINT_STORAGE_DIR, defaulting to .panelmint/generated.
Run npm run worker in a second terminal while npm run dev is running.
```

Remove any text saying Cloudflare R2 is part of the runtime stack.

- [ ] **Step 3: Remove AWS dependencies**

Run:

```bash
npm uninstall @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 4: Verify no R2/AWS matches**

Run:

```bash
rg -n "R2_|Cloudflare R2|@aws-sdk|s3-request-presigner|R2StorageProvider" src prisma scripts README.md .env.example package.json package-lock.json
```

Expected: no active matches.

- [ ] **Step 5: Commit**

Run GitNexus detect changes, then:

```bash
git add .env.example README.md package.json package-lock.json
git commit -m "refactor: remove r2 storage dependencies"
```

---

### Task 9: Final Verification And Cleanup

**Files:**

- Modify only files required by failed verification.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run active-path cleanup scans**

Run:

```bash
rg -n "inngest|Inngest|INNGEST_|R2_|Cloudflare R2|@aws-sdk|s3-request-presigner|R2StorageProvider|inngest:dev" src prisma scripts README.md .env.example package.json package-lock.json
rg -n "/generated/|R2 public URL|signed URL|platform storage" src README.md .env.example
```

Expected: no active matches except historical docs outside searched paths.

- [ ] **Step 4: Run GitNexus change detection**

Run:

```text
mcp__gitnexus__.detect_changes({ repo: "weoweo", scope: "all" })
```

Expected: affected scope matches queue/storage replacement.

- [ ] **Step 5: Commit verification fixes if needed**

If cleanup fixes were required, run:

```bash
git status --short
```

Stage only the concrete Phase 5 files shown by that command, then run:

```bash
git commit -m "test: finish local worker storage verification"
```

If no files changed, do not create an empty commit.
