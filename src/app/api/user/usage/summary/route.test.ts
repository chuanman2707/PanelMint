import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    prisma: {
        usageRecord: {
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

describe('GET /api/user/usage/summary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.prisma.usageRecord.findMany.mockResolvedValue([
            { type: 'llm_call', model: 'seed', tokens: 120, cost: 0.02 },
            { type: 'image_gen', model: 'flux', tokens: null, cost: 0.08 },
        ])
    })

    it('summarizes usage for the local owner', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/user/usage/summary'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.prisma.usageRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ userId: 'user-1' }),
        }))
        await expect(response.json()).resolves.toMatchObject({
            llmCalls: 1,
            imageGens: 1,
            totalTokens: 120,
            totalCost: 0.1,
        })
    })
})
