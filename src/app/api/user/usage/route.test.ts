import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    prisma: {
        usageRecord: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { GET } from './route'

describe('GET /api/user/usage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
    })

    it('clamps the limit and returns the next cursor when more records exist', async () => {
        mocks.prisma.usageRecord.findMany.mockResolvedValue([
            {
                id: 'usage-1',
                type: 'llm_generation',
                model: 'seed-1.6',
                tokens: 1200,
                cost: 80,
                createdAt: new Date('2026-04-03T02:00:00.000Z'),
            },
            {
                id: 'usage-2',
                type: 'image_generation',
                model: 'wavespeed',
                tokens: 0,
                cost: 40,
                createdAt: new Date('2026-04-03T01:00:00.000Z'),
            },
        ])

        const response = await GET(
            new NextRequest('http://localhost/api/user/usage?limit=1'),
            { params: Promise.resolve({}) },
        )

        expect(mocks.prisma.usageRecord.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            orderBy: { createdAt: 'desc' },
            take: 2,
        })

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            items: [
                {
                    id: 'usage-1',
                    type: 'llm_generation',
                    model: 'seed-1.6',
                    tokens: 1200,
                    cost: 80,
                    createdAt: new Date('2026-04-03T02:00:00.000Z').toISOString(),
                },
            ],
            nextCursor: 'usage-1',
        })
    })

    it('uses the cursor when continuing a paginated history query', async () => {
        mocks.prisma.usageRecord.findMany.mockResolvedValue([])

        await GET(
            new NextRequest('http://localhost/api/user/usage?cursor=usage-9&limit=5'),
            { params: Promise.resolve({}) },
        )

        expect(mocks.prisma.usageRecord.findMany).toHaveBeenCalledWith({
            where: { userId: 'user-1' },
            orderBy: { createdAt: 'desc' },
            take: 6,
            cursor: { id: 'usage-9' },
            skip: 1,
        })
    })
})
