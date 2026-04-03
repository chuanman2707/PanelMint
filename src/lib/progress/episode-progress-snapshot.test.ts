import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { getEpisodeProgressSnapshot } from './episode-progress-snapshot'

describe('getEpisodeProgressSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when the episode does not exist', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue(null)

        await expect(getEpisodeProgressSnapshot('episode-1')).resolves.toBeNull()
        expect(mocks.prisma.episode.findUnique).toHaveBeenCalledWith({
            where: { id: 'episode-1' },
            select: {
                status: true,
                progress: true,
                error: true,
            },
        })
    })

    it('returns the minimal progress snapshot for an existing episode', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({
            status: 'imaging',
            progress: 72,
            error: null,
        })

        await expect(getEpisodeProgressSnapshot('episode-2')).resolves.toEqual({
            status: 'imaging',
            progress: 72,
            error: null,
        })
    })
})
