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

export type PipelineJobRecord = {
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

export type EnqueuePipelineJobInput = {
    episodeId: string
    userId: string
    type: PipelineJobType
    payload: unknown
    dedupeKey: string
    maxAttempts?: number
    availableAt?: Date
}

type ClaimPipelineJobsInput = {
    workerId: string
    limit: number
    staleAfterMs: number
}

type FailPipelineJobInput = {
    jobId: string
    workerId: string
    error: unknown
    attempts: number
    maxAttempts: number
    retryDelayMs: number
}

type CompletePipelineJobInput = {
    jobId: string
    workerId: string
}

const ACTIVE_JOB_STATUSES = ['queued', 'running'] as const

async function findActiveDuplicate(dedupeKey: string): Promise<PipelineJobRecord | null> {
    return prisma.pipelineJob.findFirst({
        where: {
            dedupeKey,
            status: { in: [...ACTIVE_JOB_STATUSES] },
        },
    }) as Promise<PipelineJobRecord | null>
}

function isUniqueConflict(error: unknown): boolean {
    return typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'P2002'
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export async function enqueuePipelineJob(
    input: EnqueuePipelineJobInput,
): Promise<PipelineJobRecord> {
    const existingJob = await findActiveDuplicate(input.dedupeKey)
    if (existingJob) return existingJob

    try {
        return await prisma.pipelineJob.create({
            data: {
                episodeId: input.episodeId,
                userId: input.userId,
                type: input.type,
                payload: JSON.stringify(input.payload),
                status: 'queued',
                dedupeKey: input.dedupeKey,
                maxAttempts: input.maxAttempts ?? 3,
                availableAt: input.availableAt ?? new Date(),
            },
        }) as PipelineJobRecord
    } catch (error) {
        if (!isUniqueConflict(error)) throw error

        const duplicateJob = await findActiveDuplicate(input.dedupeKey)
        if (duplicateJob) return duplicateJob

        throw error
    }
}

export async function claimPipelineJobs(
    input: ClaimPipelineJobsInput,
): Promise<PipelineJobRecord[]> {
    const staleBefore = new Date(Date.now() - input.staleAfterMs)

    return prisma.$queryRaw<PipelineJobRecord[]>(Prisma.sql`
        WITH expired_final_attempts AS (
            UPDATE pipeline_jobs
            SET status = 'failed',
                locked_at = NULL,
                locked_by = NULL,
                last_error = 'Worker lost final attempt before completing job.',
                updated_at = NOW()
            WHERE status = 'running'
              AND locked_at <= ${staleBefore}
              AND attempts >= max_attempts
            RETURNING id
        ),
        candidates AS (
            SELECT id
            FROM pipeline_jobs
            WHERE attempts < max_attempts
              AND (
                (status = 'queued' AND available_at <= NOW())
                OR (status = 'running' AND locked_at <= ${staleBefore})
              )
            ORDER BY available_at ASC, created_at ASC
            LIMIT ${input.limit}
            FOR UPDATE SKIP LOCKED
        )
        UPDATE pipeline_jobs AS job
        SET status = 'running',
            locked_at = NOW(),
            locked_by = ${input.workerId},
            attempts = job.attempts + 1,
            last_error = NULL,
            updated_at = NOW()
        FROM candidates
        WHERE job.id = candidates.id
        RETURNING
            job.id,
            job.episode_id AS "episodeId",
            job.user_id AS "userId",
            job.type,
            job.payload,
            job.status,
            job.attempts,
            job.max_attempts AS "maxAttempts",
            job.available_at AS "availableAt",
            job.locked_at AS "lockedAt",
            job.locked_by AS "lockedBy",
            job.last_error AS "lastError",
            job.dedupe_key AS "dedupeKey"
    `)
}

export async function completePipelineJob(input: CompletePipelineJobInput): Promise<boolean> {
    const result = await prisma.pipelineJob.updateMany({
        where: {
            id: input.jobId,
            status: 'running',
            lockedBy: input.workerId,
        },
        data: {
            status: 'succeeded',
            lockedAt: null,
            lockedBy: null,
            lastError: null,
        },
    })

    return result.count === 1
}

export async function failPipelineJob(input: FailPipelineJobInput): Promise<boolean> {
    const shouldRetry = input.attempts < input.maxAttempts

    const result = await prisma.pipelineJob.updateMany({
        where: {
            id: input.jobId,
            status: 'running',
            lockedBy: input.workerId,
        },
        data: {
            status: shouldRetry ? 'queued' : 'failed',
            availableAt: shouldRetry
                ? new Date(Date.now() + input.retryDelayMs)
                : undefined,
            lockedAt: null,
            lockedBy: null,
            lastError: errorMessage(input.error),
        },
    })

    return result.count === 1
}

export async function cancelEpisodeJobs(episodeId: string): Promise<number> {
    const result = await prisma.pipelineJob.updateMany({
        where: {
            episodeId,
            status: { in: [...ACTIVE_JOB_STATUSES] },
        },
        data: {
            status: 'cancelled',
            lockedAt: null,
            lockedBy: null,
        },
    })

    return result.count
}
