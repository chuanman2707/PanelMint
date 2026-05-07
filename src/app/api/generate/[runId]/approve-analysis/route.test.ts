import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    enqueueStoryboard: vi.fn(),
    enqueueCharacterSheets: vi.fn(),
    syncPipelineRunState: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        $transaction: vi.fn(),
        character: {
            findMany: vi.fn(),
            update: vi.fn(),
        },
        location: {
            findMany: vi.fn(),
            update: vi.fn(),
        },
        episode: {
            update: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
}))

vi.mock('@/lib/queue', () => ({
    enqueueStoryboard: mocks.enqueueStoryboard,
    enqueueCharacterSheets: mocks.enqueueCharacterSheets,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    syncPipelineRunState: mocks.syncPipelineRunState,
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { POST } from './route'

describe('POST /api/generate/[runId]/approve-analysis', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(mocks.prisma)
            }

            return Promise.all(input as Promise<unknown>[])
        })
        mocks.getLocalEpisode.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'review_analysis' },
            error: null,
        })
        mocks.prisma.character.findMany.mockResolvedValue([{ id: 'char-1' }])
        mocks.prisma.location.findMany.mockResolvedValue([{ id: 'loc-1' }])
        mocks.prisma.character.update.mockResolvedValue({})
        mocks.prisma.location.update.mockResolvedValue({})
        mocks.prisma.episode.update.mockResolvedValue({})
        mocks.enqueueStoryboard.mockResolvedValue({})
        mocks.enqueueCharacterSheets.mockResolvedValue({})
        mocks.syncPipelineRunState.mockResolvedValue(undefined)
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
    })

    it('returns 400 for invalid analysis payloads', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-analysis', {
                method: 'POST',
                body: JSON.stringify({
                    characters: [{ id: 'char-1', name: '' }],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(400)
        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
        expect(mocks.enqueueStoryboard).not.toHaveBeenCalled()
    })

    it('updates validated characters and locations before enqueuing storyboard', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-analysis', {
                method: 'POST',
                body: JSON.stringify({
                    characters: [
                        {
                            id: 'char-1',
                            name: 'Aoi',
                            aliases: 'The Hero',
                            description: 'Lead protagonist',
                        },
                    ],
                    locations: [
                        {
                            id: 'loc-1',
                            name: 'Neo City',
                            description: 'Main setting',
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: {
                name: 'Aoi',
                aliases: 'The Hero',
                description: 'Lead protagonist',
            },
        })
        expect(mocks.prisma.location.update).toHaveBeenCalledWith({
            where: { id: 'loc-1' },
            data: {
                name: 'Neo City',
                description: 'Main setting',
            },
        })
        expect(mocks.enqueueStoryboard).toHaveBeenCalledWith('ep-1')
        expect(mocks.enqueueCharacterSheets).toHaveBeenCalledWith('ep-1')
    })

    it('returns 404 when a child resource does not belong to the verified episode project', async () => {
        mocks.prisma.character.findMany.mockResolvedValue([])

        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-analysis', {
                method: 'POST',
                body: JSON.stringify({
                    characters: [
                        {
                            id: 'char-foreign',
                            name: 'Aoi',
                            aliases: null,
                            description: 'Lead protagonist',
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(404)
        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
        expect(mocks.enqueueStoryboard).not.toHaveBeenCalled()
        expect(mocks.enqueueCharacterSheets).not.toHaveBeenCalled()
    })

    it('reverts to review_analysis when storyboard enqueue fails after approval updates', async () => {
        mocks.enqueueStoryboard.mockRejectedValue(new Error('Local queue unavailable'))

        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-analysis', {
                method: 'POST',
                body: JSON.stringify({
                    characters: [
                        {
                            id: 'char-1',
                            name: 'Aoi',
                            aliases: null,
                            description: 'Lead protagonist',
                        },
                    ],
                    locations: [
                        {
                            id: 'loc-1',
                            name: 'Neo City',
                            description: 'Main setting',
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            error: 'Local queue unavailable',
        })
        expect(mocks.prisma.episode.update).toHaveBeenCalledWith({
            where: { id: 'ep-1' },
            data: { status: 'review_analysis', progress: 25 },
        })
        expect(mocks.syncPipelineRunState).toHaveBeenCalledWith(
            expect.objectContaining({
                episodeId: 'ep-1',
                userId: 'user-1',
                episodeStatus: 'review_analysis',
                runStatus: 'paused',
                currentStep: 'review_analysis',
            }),
        )
        expect(mocks.recordPipelineEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                episodeId: 'ep-1',
                userId: 'user-1',
                step: 'review_analysis',
                status: 'failed',
                metadata: expect.objectContaining({
                    failureType: 'storyboard_enqueue',
                }),
            }),
        )
    })
})
