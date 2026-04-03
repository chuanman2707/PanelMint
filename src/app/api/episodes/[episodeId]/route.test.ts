import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireEpisodeOwner: vi.fn(),
    deleteEpisodeForProject: vi.fn(),
    prisma: {
        episode: {
            delete: vi.fn(),
            count: vi.fn(),
        },
        project: {
            delete: vi.fn(),
        },
    },
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
    requireEpisodeOwner: mocks.requireEpisodeOwner,
}))

vi.mock('@/lib/episodes/delete-episode', () => ({
    deleteEpisodeForProject: mocks.deleteEpisodeForProject,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { DELETE } from './route'

describe('DELETE /api/episodes/[episodeId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
        mocks.requireEpisodeOwner.mockResolvedValue({
            episode: { id: 'ep-1', projectId: 'project-1', status: 'done' },
            error: null,
        })
        mocks.prisma.episode.delete.mockResolvedValue({})
        mocks.prisma.episode.count.mockResolvedValue(1)
        mocks.prisma.project.delete.mockResolvedValue({})
        mocks.deleteEpisodeForProject.mockResolvedValue(undefined)
    })

    it('deletes the episode through the shared domain helper', async () => {
        const response = await DELETE(
            new NextRequest('http://localhost/api/episodes/ep-1', { method: 'DELETE' }),
            { params: Promise.resolve({ episodeId: 'ep-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.deleteEpisodeForProject).toHaveBeenCalledWith({
            episodeId: 'ep-1',
            projectId: 'project-1',
        })
    })
})
