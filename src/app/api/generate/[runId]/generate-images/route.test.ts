import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    checkRateLimit: vi.fn(),
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
    IMAGE_GEN_LIMIT: { windowSeconds: 60, maxRequests: 2 },
    checkRateLimit: mocks.checkRateLimit,
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

describe('POST /api/generate/[runId]/generate-images', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(mocks.prisma)
            }

            return Promise.all(input as Promise<unknown>[])
        })
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'review_storyboard' },
            error: null,
        })
        mocks.checkRateLimit.mockResolvedValue(null)
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            status: 'review_storyboard',
        })
        mocks.prisma.episode.update.mockResolvedValue({})
        mocks.prisma.panel.updateMany.mockResolvedValue({ count: 1 })
        mocks.prisma.panel.findMany
            .mockResolvedValueOnce([{ id: 'panel-1' }])
            .mockResolvedValueOnce([{ id: 'panel-1' }])
        mocks.enqueueImageGen.mockResolvedValue([])
        mocks.syncPipelineRunState.mockResolvedValue(undefined)
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
    })

    it('filters by panelIds and queues those panel ids', async () => {
        const request = new NextRequest('http://localhost/api/generate/ep-1/generate-images', {
            method: 'POST',
            body: JSON.stringify({ panelIds: ['panel-1'] }),
            headers: { 'content-type': 'application/json' },
        })

        const response = await POST(
            request,
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.prisma.episode.findUnique).toHaveBeenCalledWith({
            where: { id: 'ep-1' },
        })
        expect(mocks.prisma.panel.findMany).toHaveBeenNthCalledWith(1, {
            where: {
                id: { in: ['panel-1'] },
                page: { episodeId: 'ep-1' },
            },
            select: { id: true },
        })
        expect(mocks.prisma.panel.findMany).toHaveBeenNthCalledWith(2, {
            where: {
                page: { episodeId: 'ep-1' },
                approved: true,
                imageUrl: null,
                status: { in: ['pending', 'error', 'content_filtered'] },
                id: { in: ['panel-1'] },
            },
            select: {
                id: true,
            },
        })
        expect(mocks.enqueueImageGen).toHaveBeenCalledWith('ep-1', ['panel-1'])
    })

    it('queues rendering even when character sheets are missing', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            status: 'review_storyboard',
        })

        const request = new NextRequest('http://localhost/api/generate/ep-1/generate-images', {
            method: 'POST',
            body: JSON.stringify({ panelIds: ['panel-1'] }),
            headers: { 'content-type': 'application/json' },
        })

        const response = await POST(
            request,
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.enqueueImageGen).toHaveBeenCalledWith('ep-1', ['panel-1'])
    })
})
