import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
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

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { deleteEpisodeForProject } from '@/lib/episodes/delete-episode'

describe('deleteEpisodeForProject', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('deletes the parent project when the deleted episode was the final chapter', async () => {
        mocks.prisma.episode.count.mockResolvedValue(0)

        await deleteEpisodeForProject({ episodeId: 'ep-1', projectId: 'project-1' })

        expect(mocks.prisma.episode.delete).toHaveBeenCalledWith({
            where: { id: 'ep-1' },
        })
        expect(mocks.prisma.project.delete).toHaveBeenCalledWith({
            where: { id: 'project-1' },
        })
    })

    it('keeps the project when other episodes still exist', async () => {
        mocks.prisma.episode.count.mockResolvedValue(2)

        await deleteEpisodeForProject({ episodeId: 'ep-2', projectId: 'project-2' })

        expect(mocks.prisma.project.delete).not.toHaveBeenCalled()
    })
})
