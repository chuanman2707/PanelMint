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

        expect(mocks.prisma.pipelineJob.findFirst).toHaveBeenCalledWith({
            where: {
                activeDedupeKey: 'analyze:ep-1',
                status: { in: ['queued', 'running'] },
            },
        })
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
                activeDedupeKey: 'storyboard:ep-1',
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
        const sql = String(mocks.prisma.$queryRaw.mock.calls[0]?.[0]?.sql ?? '')
        expect(sql).toContain('FOR UPDATE SKIP LOCKED')
        expect(sql).toContain('expired_final_attempts')
        expect(sql).toContain('attempts >= max_attempts')
        expect(sql).toContain("status = 'failed'")
    })

    it('marks failed jobs for retry when attempts remain', async () => {
        mocks.prisma.pipelineJob.updateMany.mockResolvedValue({ count: 1 })

        await expect(failPipelineJob({
            jobId: 'job-1',
            workerId: 'worker-1',
            error: new Error('network'),
            attempts: 1,
            maxAttempts: 3,
            retryDelayMs: 5_000,
        })).resolves.toBe(true)

        expect(mocks.prisma.pipelineJob.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                status: 'running',
                lockedBy: 'worker-1',
            },
            data: expect.objectContaining({
                status: 'queued',
                lockedAt: null,
                lockedBy: null,
                lastError: 'network',
                activeDedupeKey: undefined,
            }),
        })
    })

    it('clears active dedupe when a failed job has no attempts left', async () => {
        mocks.prisma.pipelineJob.updateMany.mockResolvedValue({ count: 1 })

        await expect(failPipelineJob({
            jobId: 'job-1',
            workerId: 'worker-1',
            error: new Error('network'),
            attempts: 3,
            maxAttempts: 3,
            retryDelayMs: 5_000,
        })).resolves.toBe(true)

        expect(mocks.prisma.pipelineJob.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                status: 'running',
                lockedBy: 'worker-1',
            },
            data: expect.objectContaining({
                status: 'failed',
                lockedAt: null,
                lockedBy: null,
                lastError: 'network',
                activeDedupeKey: null,
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
                activeDedupeKey: null,
            }),
        })
    })

    it('marks jobs succeeded', async () => {
        mocks.prisma.pipelineJob.updateMany.mockResolvedValue({ count: 1 })

        await expect(completePipelineJob({
            jobId: 'job-1',
            workerId: 'worker-1',
        })).resolves.toBe(true)

        expect(mocks.prisma.pipelineJob.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'job-1',
                status: 'running',
                lockedBy: 'worker-1',
            },
            data: expect.objectContaining({
                status: 'succeeded',
                lockedAt: null,
                lockedBy: null,
                activeDedupeKey: null,
            }),
        })
    })

    it('does not complete a job owned by another worker', async () => {
        mocks.prisma.pipelineJob.updateMany.mockResolvedValue({ count: 0 })

        await expect(completePipelineJob({
            jobId: 'job-1',
            workerId: 'worker-old',
        })).resolves.toBe(false)
    })
})
