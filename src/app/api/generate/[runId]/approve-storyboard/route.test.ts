import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireEpisodeOwner: vi.fn(),
    recordPipelineEvent: vi.fn(),
    prisma: {
        panel: {
            findMany: vi.fn(),
            update: vi.fn(),
        },
    },
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
    requireEpisodeOwner: mocks.requireEpisodeOwner,
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
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
        mocks.requireEpisodeOwner.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'review_storyboard' },
            error: null,
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
})
