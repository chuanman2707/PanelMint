import { beforeEach, describe, expect, it, vi } from 'vitest'

const notFoundMock = vi.hoisted(() => vi.fn(() => {
    throw new Error('NOT_FOUND')
}))

const mocks = vi.hoisted(() => ({
    requirePageSession: vi.fn(),
    prisma: {
        episode: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('@/lib/api-auth', () => ({
    requirePageSession: mocks.requirePageSession,
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
        mocks.requirePageSession.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.episode.findFirst.mockResolvedValue({
            id: 'ep-1',
            name: 'Chapter 1',
            pages: [],
        })
    })

    it('queries the episode through the verified owner boundary', async () => {
        await EditorPage({
            params: Promise.resolve({ episodeId: 'ep-1' }),
        })

        expect(mocks.requirePageSession).toHaveBeenCalledWith('/editor/ep-1')
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
