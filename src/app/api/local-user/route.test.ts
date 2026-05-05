import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
}))

import { GET } from './route'

describe('GET /api/local-user', () => {
    it('returns the local owner without a session', async () => {
        mocks.getOrCreateLocalUser.mockResolvedValue({
            id: 'local-user-1',
            email: 'local@panelmint.dev',
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        const response = await GET(
            new NextRequest('http://localhost/api/local-user'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toEqual({
            user: {
                id: 'local-user-1',
                email: 'local@panelmint.dev',
                name: 'Local Creator',
                credits: 300,
                accountTier: 'free',
            },
        })
    })
})
