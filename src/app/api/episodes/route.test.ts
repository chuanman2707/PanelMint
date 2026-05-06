import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    prisma: {
        episode: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { GET } from './route'

describe('GET /api/episodes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.episode.findMany.mockResolvedValue([])
    })

    it('lists episodes for the local owner', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/episodes'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.episode.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { project: { userId: 'user-1' } },
        }))
    })
})
