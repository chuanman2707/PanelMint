import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    cancelEpisodePipelineJobs: vi.fn(),
    syncPipelineRunState: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
        episode: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        panel: {
            updateMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/queue', () => ({
    cancelEpisodePipelineJobs: mocks.cancelEpisodePipelineJobs,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    syncPipelineRunState: mocks.syncPipelineRunState,
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { POST } from './route'

describe('POST /api/generate/[runId]/cancel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({ episode: { id: 'ep-1' }, error: null })
        mocks.cancelEpisodePipelineJobs.mockResolvedValue(2)
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'queued' })
        mocks.prisma.$transaction.mockImplementation(async (input: unknown) => input(mocks.prisma))
    })

    it('cancels an owned local episode', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/cancel', { method: 'POST' }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.syncPipelineRunState).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user-1',
            runStatus: 'cancelled',
        }))
        expect(mocks.prisma.panel.updateMany).toHaveBeenCalledWith({
            where: {
                page: { episodeId: 'ep-1' },
                status: { in: ['queued', 'generating'] },
            },
            data: { status: 'error' },
        })
        expect(mocks.prisma.episode.update.mock.invocationCallOrder[0])
            .toBeLessThan(mocks.cancelEpisodePipelineJobs.mock.invocationCallOrder[0])
        expect(mocks.recordPipelineEvent).toHaveBeenCalledWith({
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'cancelled',
            status: 'cancelled',
            metadata: { cancelledJobs: 2 },
        })
    })
})
