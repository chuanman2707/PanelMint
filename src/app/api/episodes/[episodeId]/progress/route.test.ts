import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireEpisodeOwner: vi.fn(),
    getEpisodeProgressSnapshot: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
    requireEpisodeOwner: mocks.requireEpisodeOwner,
}))

vi.mock('@/lib/progress/episode-progress-snapshot', () => ({
    getEpisodeProgressSnapshot: mocks.getEpisodeProgressSnapshot,
}))

import { GET } from './route'

describe('GET /api/episodes/[episodeId]/progress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
        mocks.requireEpisodeOwner.mockResolvedValue({
            episode: { id: 'ep-1' },
            error: null,
        })
        mocks.getEpisodeProgressSnapshot.mockResolvedValue({
            status: 'analyzing',
            progress: 15,
            error: null,
        })
    })

    it('returns a snapshot stream without Redis pub/sub', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/episodes/ep-1/progress'),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/event-stream')
        const text = await response.text()
        expect(text).toContain('"status":"analyzing"')
        expect(text).toContain('"progress":15')
    })

    it('returns 404 when the episode snapshot does not exist', async () => {
        mocks.getEpisodeProgressSnapshot.mockResolvedValue(null)

        const response = await GET(
            new NextRequest('http://localhost/api/episodes/ep-1/progress'),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(404)
    })
})
