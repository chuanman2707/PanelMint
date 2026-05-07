import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type DbClient = Prisma.TransactionClient | typeof prisma

export type PipelineRunStatus =
    | 'pending'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled'

export type PipelineEventStatus =
    | 'queued'
    | 'started'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'skipped'

function getDb(client?: Prisma.TransactionClient): DbClient {
    return client ?? prisma
}

function toMetadataJson(metadata?: Record<string, unknown>): string | null {
    return metadata ? JSON.stringify(metadata) : null
}

function defaultRunStateFromEpisodeStatus(episodeStatus: string): {
    status: PipelineRunStatus
    currentStep: string | null
    completedAt: Date | null
} {
    switch (episodeStatus) {
        case 'queued':
            return { status: 'pending', currentStep: 'analyze', completedAt: null }
        case 'analyzing':
            return { status: 'running', currentStep: 'analyze', completedAt: null }
        case 'review_analysis':
            return { status: 'paused', currentStep: 'review_analysis', completedAt: null }
        case 'storyboarding':
            return { status: 'running', currentStep: 'storyboard', completedAt: null }
        case 'review_storyboard':
            return { status: 'paused', currentStep: 'review_storyboard', completedAt: null }
        case 'imaging':
            return { status: 'running', currentStep: 'image_gen', completedAt: null }
        case 'done':
            return { status: 'completed', currentStep: 'image_gen', completedAt: new Date() }
        case 'error':
            return { status: 'failed', currentStep: null, completedAt: new Date() }
        default:
            return { status: 'pending', currentStep: null, completedAt: null }
    }
}

async function ensurePipelineRun(
    db: DbClient,
    input: {
        episodeId: string
        userId: string
        status: PipelineRunStatus
        currentStep?: string | null
        error?: string | null
        completedAt?: Date | null
    },
) {
    return db.pipelineRun.upsert({
        where: { episodeId: input.episodeId },
        create: {
            episodeId: input.episodeId,
            userId: input.userId,
            status: input.status,
            currentStep: input.currentStep ?? null,
            error: input.error ?? null,
            completedAt: input.completedAt ?? null,
        },
        update: {
            userId: input.userId,
            status: input.status,
            currentStep: input.currentStep ?? null,
            error: input.error ?? null,
            completedAt: input.completedAt ?? null,
        },
    })
}

export async function syncPipelineRunState(input: {
    episodeId: string
    userId: string
    episodeStatus: string
    runStatus?: PipelineRunStatus
    currentStep?: string | null
    error?: string | null
    completedAt?: Date | null
    client?: Prisma.TransactionClient
}): Promise<void> {
    const db = getDb(input.client)
    const fallback = defaultRunStateFromEpisodeStatus(input.episodeStatus)

    await ensurePipelineRun(db, {
        episodeId: input.episodeId,
        userId: input.userId,
        status: input.runStatus ?? fallback.status,
        currentStep: input.currentStep === undefined ? fallback.currentStep : input.currentStep,
        error: input.error ?? null,
        completedAt: input.completedAt === undefined ? fallback.completedAt : input.completedAt,
    })
}

export async function recordPipelineEvent(input: {
    episodeId: string
    userId: string
    step: string
    status: PipelineEventStatus
    metadata?: Record<string, unknown>
    client?: Prisma.TransactionClient
}): Promise<void> {
    const db = getDb(input.client)
    const run = await ensurePipelineRun(db, {
        episodeId: input.episodeId,
        userId: input.userId,
        status: input.status === 'queued' ? 'pending' : 'running',
        currentStep: input.step,
        completedAt: null,
    })

    await db.pipelineEvent.create({
        data: {
            runId: run.id,
            step: input.step,
            status: input.status,
            metadata: toMetadataJson(input.metadata),
            completedAt: input.status === 'started' ? null : new Date(),
        },
    })
}
