import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalEpisode: vi.fn(),
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

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalEpisode: mocks.getLocalEpisode,
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
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalEpisode.mockResolvedValue({
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
        expect(mocks.getLocalEpisode).toHaveBeenCalledWith('user-1', 'ep-1')
        expect(mocks.deleteEpisodeForProject).toHaveBeenCalledWith({
            episodeId: 'ep-1',
            projectId: 'project-1',
        })
    })
})
