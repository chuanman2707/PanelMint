import { beforeEach, describe, expect, it, vi } from 'vitest'

const notFoundMock = vi.hoisted(() => vi.fn(() => {
    throw new Error('NOT_FOUND')
}))

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    prisma: {
        episode: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/components/editor/CanvasEditor', () => ({
    CanvasEditor: () => null,
}))

vi.mock('next/navigation', () => ({
    notFound: notFoundMock,
}))

import EditorPage from './page'

describe('EditorPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.episode.findFirst.mockResolvedValue({
            id: 'ep-1',
            name: 'Chapter 1',
            pages: [],
        })
    })

    it('queries the episode through the local owner boundary', async () => {
        await EditorPage({
            params: Promise.resolve({ episodeId: 'ep-1' }),
        })

        expect(mocks.getOrCreateLocalUser).toHaveBeenCalled()
        expect(mocks.prisma.episode.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 'ep-1',
                    project: { userId: 'user-1' },
                },
            }),
        )
    })

    it('returns notFound when the episode is missing or belongs to someone else', async () => {
        mocks.prisma.episode.findFirst.mockResolvedValue(null)

        await expect(EditorPage({
            params: Promise.resolve({ episodeId: 'ep-404' }),
        })).rejects.toThrow('NOT_FOUND')
    })
})
