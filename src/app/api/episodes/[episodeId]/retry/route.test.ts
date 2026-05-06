import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    checkRateLimit: vi.fn(),
    checkCredits: vi.fn(),
    enqueueImageGen: vi.fn(),
    syncPipelineRunState: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
        episode: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        panel: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
}))

vi.mock('@/lib/api-rate-limit', () => ({
    RETRY_LIMIT: { windowSeconds: 60, maxRequests: 2 },
    checkRateLimit: mocks.checkRateLimit,
}))

vi.mock('@/lib/billing', () => ({
    checkCredits: mocks.checkCredits,
    getImageGenerationCreditCost: (tier: 'standard' | 'premium') => tier === 'premium' ? 250 : 40,
    normalizeImageModelTier: (tier?: string | null) => tier === 'premium' ? 'premium' : 'standard',
}))

vi.mock('@/lib/queue', () => ({
    enqueueImageGen: mocks.enqueueImageGen,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    syncPipelineRunState: mocks.syncPipelineRunState,
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { POST } from './route'

describe('POST /api/episodes/[episodeId]/retry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'review_storyboard' },
            error: null,
        })
        mocks.checkRateLimit.mockResolvedValue(null)
        mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(mocks.prisma)
            }

            return Promise.all(input as Promise<unknown>[])
        })
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            project: { id: 'project-1', imageModel: 'standard' },
        })
        mocks.prisma.panel.findMany.mockResolvedValue([
            { id: 'panel-1' },
            { id: 'panel-2' },
        ])
        mocks.prisma.episode.update.mockResolvedValue({})
        mocks.prisma.panel.updateMany.mockResolvedValue({ count: 2 })
        mocks.enqueueImageGen.mockResolvedValue([])
        mocks.syncPipelineRunState.mockResolvedValue(undefined)
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
    })

    it('returns 402 when the user lacks credits for the retry set', async () => {
        mocks.checkCredits.mockResolvedValue(false)

        const response = await POST(
            new NextRequest('http://localhost/api/episodes/ep-1/retry', { method: 'POST' }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(402)
        expect(mocks.enqueueImageGen).not.toHaveBeenCalled()
    })

    it('queues failed panels for retry when credits are available', async () => {
        mocks.checkCredits.mockResolvedValue(true)

        const response = await POST(
            new NextRequest('http://localhost/api/episodes/ep-1/retry', { method: 'POST' }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.prisma.episode.update).toHaveBeenCalledWith({
            where: { id: 'ep-1' },
            data: { status: 'imaging', progress: 50, error: null },
        })
        expect(mocks.prisma.panel.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['panel-1', 'panel-2'] } },
            data: { status: 'queued' },
        })
        expect(mocks.enqueueImageGen).toHaveBeenCalledWith('ep-1', ['panel-1', 'panel-2'])
    })

    it('retries only the requested panel ids when a subset is provided', async () => {
        mocks.checkCredits.mockResolvedValue(true)
        mocks.prisma.panel.findMany
            .mockResolvedValueOnce([{ id: 'panel-2' }])
            .mockResolvedValueOnce([{ id: 'panel-2' }])

        const response = await POST(
            new NextRequest('http://localhost/api/episodes/ep-1/retry', {
                method: 'POST',
                body: JSON.stringify({ panelIds: ['panel-2'] }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.panel.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                id: { in: ['panel-2'] },
                page: { episodeId: 'ep-1' },
            },
            select: { id: true },
        })
        expect(mocks.prisma.panel.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                page: { episodeId: 'ep-1' },
                status: { in: ['error', 'pending', 'content_filtered', 'generating'] },
                approved: true,
                id: { in: ['panel-2'] },
            },
            orderBy: [{ page: { pageIndex: 'asc' } }, { panelIndex: 'asc' }],
            select: { id: true },
        })
        expect(mocks.enqueueImageGen).toHaveBeenCalledWith('ep-1', ['panel-2'])
    })

    it('returns 400 when retry body is invalid', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/episodes/ep-1/retry', {
                method: 'POST',
                body: JSON.stringify({ panelIds: [''] }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(400)
        expect(mocks.prisma.panel.findMany).not.toHaveBeenCalled()
        expect(mocks.enqueueImageGen).not.toHaveBeenCalled()
    })
})
