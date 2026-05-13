import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        pipelineRun: {
            findUnique: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
        },
        pipelineEvent: {
            create: vi.fn(),
        },
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { recordPipelineEvent } from '@/lib/pipeline/run-state'

describe('recordPipelineEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.prisma.pipelineRun.findUnique.mockResolvedValue({
            id: 'run-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            status: 'running',
        })
        mocks.prisma.pipelineRun.update.mockResolvedValue({
            id: 'run-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            status: 'running',
        })
        mocks.prisma.pipelineRun.upsert.mockResolvedValue({
            id: 'run-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            status: 'running',
        })
        mocks.prisma.pipelineEvent.create.mockResolvedValue({})
    })

    it('does not downgrade a completed run when recording a completed step event', async () => {
        mocks.prisma.pipelineRun.findUnique.mockResolvedValue({
            id: 'run-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            status: 'completed',
        })

        await recordPipelineEvent({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'image_gen',
            status: 'completed',
        })

        expect(mocks.prisma.pipelineRun.update).not.toHaveBeenCalled()
        expect(mocks.prisma.pipelineRun.upsert).not.toHaveBeenCalled()
        expect(mocks.prisma.pipelineEvent.create).toHaveBeenCalledWith({
            data: {
                runId: 'run-1',
                step: 'image_gen',
                status: 'completed',
                metadata: null,
                completedAt: expect.any(Date),
            },
        })
    })

    it('does not downgrade a cancelled run when recording the cancellation event', async () => {
        mocks.prisma.pipelineRun.findUnique.mockResolvedValue({
            id: 'run-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            status: 'cancelled',
        })

        await recordPipelineEvent({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'cancelled',
            status: 'cancelled',
        })

        expect(mocks.prisma.pipelineRun.update).not.toHaveBeenCalled()
        expect(mocks.prisma.pipelineRun.upsert).not.toHaveBeenCalled()
        expect(mocks.prisma.pipelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                runId: 'run-1',
                step: 'cancelled',
                status: 'cancelled',
            }),
        }))
    })

    it('updates an active run when recording a started event', async () => {
        await recordPipelineEvent({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'image_gen',
            status: 'started',
        })

        expect(mocks.prisma.pipelineRun.update).toHaveBeenCalledWith({
            where: { episodeId: 'episode-1' },
            data: {
                userId: 'user-1',
                status: 'running',
                currentStep: 'image_gen',
                error: null,
                completedAt: null,
            },
        })
        expect(mocks.prisma.pipelineEvent.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                runId: 'run-1',
                step: 'image_gen',
                status: 'started',
                completedAt: null,
            }),
        }))
    })
})
