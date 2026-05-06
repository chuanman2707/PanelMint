import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
    prisma: {
        panel: {
            findFirst: vi.fn(),
        },
        speechBubble: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
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

import { POST } from './route'

describe('POST /api/editor/[episodeId]/save-bubbles', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({ episode: { id: 'ep-1' }, error: null })
        mocks.prisma.panel.findFirst.mockResolvedValue({ id: 'panel-1' })
    })

    it('saves bubbles for an episode owned by the local owner', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/editor/ep-1/save-bubbles', {
                method: 'POST',
                body: JSON.stringify({
                    panelId: 'panel-1',
                    bubbles: [{
                        bubbleIndex: 0,
                        speaker: null,
                        content: 'Hello',
                        bubbleType: 'speech',
                        positionX: 0.5,
                        positionY: 0.5,
                        width: 0.3,
                        height: 0.2,
                    }],
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.prisma.speechBubble.createMany).toHaveBeenCalled()
    })
})
