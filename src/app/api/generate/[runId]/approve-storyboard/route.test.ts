import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
        panel: {
            findMany: vi.fn(),
            update: vi.fn(),
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

vi.mock('@/lib/pipeline/run-state', () => ({
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { POST } from './route'

describe('POST /api/generate/[runId]/approve-storyboard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'review_storyboard' },
            error: null,
        })
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            status: 'review_storyboard',
            progress: 50,
            pages: [],
        })
        mocks.prisma.panel.findMany.mockResolvedValue([{ id: 'panel-1' }])
        mocks.prisma.panel.update.mockResolvedValue({})
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
    })

    it('updates only verified storyboard panels for the episode', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-storyboard', {
                method: 'POST',
                body: JSON.stringify({
                    panels: [
                        {
                            id: 'panel-1',
                            approved: true,
                            editedPrompt: 'tight rooftop close-up',
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.prisma.panel.findMany).toHaveBeenCalledWith({
            where: {
                id: { in: ['panel-1'] },
                page: { episodeId: 'ep-1' },
            },
            select: { id: true },
        })
        expect(mocks.prisma.panel.update).toHaveBeenCalledWith({
            where: { id: 'panel-1' },
            data: {
                approved: true,
                approvedPrompt: 'tight rooftop close-up',
            },
        })
    })

    it('returns 404 when any requested panel does not belong to the episode', async () => {
        mocks.prisma.panel.findMany.mockResolvedValue([])

        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-storyboard', {
                method: 'POST',
                body: JSON.stringify({
                    panels: [
                        {
                            id: 'panel-foreign',
                            approved: true,
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(404)
        expect(mocks.prisma.panel.update).not.toHaveBeenCalled()
    })

    it('rejects edited prompts that exceed the API limit', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-storyboard', {
                method: 'POST',
                body: JSON.stringify({
                    panels: [
                        {
                            id: 'panel-1',
                            approved: true,
                            editedPrompt: 'x'.repeat(3_001),
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toMatchObject({
            error: 'panels.0.editedPrompt: editedPrompt must be 3000 characters or fewer',
        })
        expect(mocks.prisma.panel.findMany).not.toHaveBeenCalled()
        expect(mocks.prisma.panel.update).not.toHaveBeenCalled()
    })

    it('allows saving storyboard changes for stranded imaging runs that have fallen back to review', async () => {
        mocks.getLocalEpisode.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'imaging' },
            error: null,
        })
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            status: 'imaging',
            progress: 88,
            pages: [
                {
                    panels: [
                        {
                            approved: true,
                            imageUrl: null,
                            status: 'generating',
                            updatedAt: new Date('2026-04-14T10:16:00.000Z'),
                        },
                        {
                            approved: true,
                            imageUrl: '/img/panel-2.png',
                            status: 'done',
                            updatedAt: new Date('2026-04-14T10:05:00.000Z'),
                        },
                    ],
                },
            ],
        })

        const response = await POST(
            new NextRequest('http://localhost/api/generate/ep-1/approve-storyboard', {
                method: 'POST',
                body: JSON.stringify({
                    panels: [
                        {
                            id: 'panel-1',
                            approved: true,
                            editedPrompt: 'tight rooftop close-up',
                        },
                    ],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ runId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.panel.update).toHaveBeenCalledWith({
            where: { id: 'panel-1' },
            data: {
                approved: true,
                approvedPrompt: 'tight rooftop close-up',
            },
        })
    })
})
