import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    checkRateLimit: vi.fn(),
    parseJsonBody: vi.fn(),
    enqueueAnalyze: vi.fn(),
    syncPipelineRunState: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
        episode: {
            findFirst: vi.fn(),
        },
        project: {
            create: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

vi.mock('@/lib/api-rate-limit', () => ({
    GENERATE_LIMIT: { windowSeconds: 60, maxRequests: 2 },
    checkRateLimit: mocks.checkRateLimit,
}))

vi.mock('@/lib/api-validate', () => ({
    parseJsonBody: mocks.parseJsonBody,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/queue', () => ({
    enqueueAnalyze: mocks.enqueueAnalyze,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    syncPipelineRunState: mocks.syncPipelineRunState,
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { POST } from './route'

describe('POST /api/generate', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.checkRateLimit.mockResolvedValue(null)
        mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(mocks.prisma)
            }

            return Promise.all(input as Promise<unknown>[])
        })
        mocks.parseJsonBody.mockResolvedValue({
            text: 'A dramatic chapter opening',
            artStyle: 'webtoon',
            pageCount: 12,
        })
        mocks.prisma.episode.findFirst.mockResolvedValue(null)
        mocks.prisma.project.create.mockResolvedValue({
            id: 'project-1',
            episodes: [{ id: 'episode-1' }],
        })
        mocks.enqueueAnalyze.mockResolvedValue(undefined)
        mocks.syncPipelineRunState.mockResolvedValue(undefined)
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
    })

    it('starts generation without requiring a user BYOK API key', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate', {
                method: 'POST',
                body: JSON.stringify({ text: 'chapter' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.project.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                artStyle: 'webtoon',
            }),
            include: { episodes: true },
        })
        const projectCreateData = mocks.prisma.project.create.mock.calls[0][0].data
        expect(projectCreateData).not.toHaveProperty('imageModel')
        expect(mocks.enqueueAnalyze).toHaveBeenCalledWith(expect.objectContaining({
            episodeId: 'episode-1',
            userId: 'user-1',
        }))
    })

})
