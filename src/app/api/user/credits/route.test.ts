import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
        creditTransaction: {
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

describe('GET /api/user/credits', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
        mocks.prisma.user.findUnique.mockResolvedValue({
            credits: 7420,
            accountTier: 'paid',
            lifetimePurchasedCredits: 8000,
        })
        mocks.prisma.creditTransaction.findMany.mockResolvedValue([
            {
                id: 'tx-1',
                amount: 8000,
                reason: 'purchase',
                balance: 8000,
                createdAt: new Date('2026-03-26T10:00:00Z'),
                providerTxId: 'polar_123',
            },
            {
                id: 'tx-2',
                amount: -80,
                reason: 'storyboard_generation',
                balance: 7920,
                createdAt: new Date('2026-03-26T10:02:00Z'),
                providerTxId: null,
            },
        ])
    })

    it('returns the package catalog and real credit transactions', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/user/credits', {
                method: 'GET',
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            balance: 7420,
            accountTier: 'paid',
            packages: expect.arrayContaining([
                expect.objectContaining({ id: 'starter', credits: 8000 }),
                expect.objectContaining({ id: 'creator', credits: 27600 }),
                expect.objectContaining({ id: 'publisher', credits: 100000 }),
            ]),
            transactions: expect.arrayContaining([
                expect.objectContaining({
                    id: 'tx-1',
                    label: 'Credit purchase',
                    direction: 'credit',
                }),
                expect.objectContaining({
                    id: 'tx-2',
                    label: 'Storyboard generation',
                    direction: 'debit',
                }),
            ]),
        })
    })
})
