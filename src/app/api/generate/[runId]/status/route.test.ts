import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
        character: {
            findMany: vi.fn(),
        },
        location: {
            findMany: vi.fn(),
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

import { GET } from './route'

describe('GET /api/generate/[runId]/status', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-15T01:30:00.000Z'))
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'imaging' },
            error: null,
        })
        mocks.prisma.character.findMany.mockResolvedValue([])
        mocks.prisma.location.findMany.mockResolvedValue([])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns done when imaging is stale but every approved panel already finished', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            projectId: 'project-1',
            status: 'imaging',
            progress: 50,
            error: null,
            pageCount: 2,
            project: {},
            pages: [
                {
                    id: 'page-1',
                    pageIndex: 0,
                    panels: [
                        { id: 'panel-1', status: 'done', approved: true, imageUrl: '/img/1.png' },
                        { id: 'panel-2', status: 'done', approved: true, imageUrl: '/img/2.png' },
                    ],
                },
            ],
        })

        const response = await GET(new Request('http://localhost'), {
            params: Promise.resolve({ runId: 'ep-1' }),
        })

        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        await expect(response.json()).resolves.toMatchObject({
            phase: 'done',
            progress: 100,
            totalPanels: 2,
            completedPanels: 2,
        })
    })

    it('returns review_storyboard when imaging is stale and no active panel work remains', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            projectId: 'project-1',
            status: 'imaging',
            progress: 72,
            error: null,
            pageCount: 2,
            project: {},
            pages: [
                {
                    id: 'page-1',
                    pageIndex: 0,
                    panels: [
                        {
                            id: 'panel-1',
                            panelIndex: 0,
                            description: 'panel',
                            shotType: 'wide',
                            characters: '[]',
                            location: 'court',
                            approved: true,
                            approvedPrompt: 'panel',
                            status: 'error',
                            imageUrl: null,
                            sourceExcerpt: null,
                            mustKeep: null,
                            mood: null,
                            lighting: null,
                        },
                        {
                            id: 'panel-2',
                            panelIndex: 1,
                            description: 'panel',
                            shotType: 'close-up',
                            characters: '[]',
                            location: 'court',
                            approved: true,
                            approvedPrompt: 'panel',
                            status: 'done',
                            imageUrl: '/img/2.png',
                            sourceExcerpt: null,
                            mustKeep: null,
                            mood: null,
                            lighting: null,
                        },
                    ],
                },
            ],
        })

        const response = await GET(new Request('http://localhost'), {
            params: Promise.resolve({ runId: 'ep-1' }),
        })

        await expect(response.json()).resolves.toMatchObject({
            phase: 'review_storyboard',
            progress: 50,
            totalPanels: 2,
            completedPanels: 1,
            panels: [
                expect.objectContaining({ id: 'panel-1', status: 'error' }),
                expect.objectContaining({ id: 'panel-2', status: 'done' }),
            ],
        })
    })

    it('treats long-stale generating panels as stranded work instead of active imaging', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            projectId: 'project-1',
            status: 'imaging',
            progress: 88,
            error: null,
            pageCount: 1,
            project: {},
            pages: [
                {
                    id: 'page-1',
                    pageIndex: 0,
                    panels: [
                        {
                            id: 'panel-stale',
                            panelIndex: 0,
                            description: 'panel',
                            shotType: 'wide',
                            characters: '[]',
                            location: 'court',
                            approved: true,
                            approvedPrompt: 'panel',
                            status: 'generating',
                            imageUrl: null,
                            sourceExcerpt: null,
                            mustKeep: null,
                            mood: null,
                            lighting: null,
                            updatedAt: new Date('2026-04-14T10:16:00.000Z'),
                        },
                    ],
                },
            ],
        })

        const response = await GET(new Request('http://localhost'), {
            params: Promise.resolve({ runId: 'ep-1' }),
        })

        await expect(response.json()).resolves.toMatchObject({
            phase: 'review_storyboard',
            progress: 50,
            totalPanels: 1,
            completedPanels: 0,
            panels: [
                expect.objectContaining({ id: 'panel-stale', status: 'generating' }),
            ],
        })
    })
})
