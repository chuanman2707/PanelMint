import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    checkRateLimit: vi.fn(),
    getClientIp: vi.fn(),
}))

vi.mock('@/lib/api-rate-limit', () => ({
    AUTH_SIGNUP_LIMIT: { windowSeconds: 60, maxRequests: 3 },
    checkRateLimit: mocks.checkRateLimit,
    getClientIp: mocks.getClientIp,
}))

import { POST } from './route'

describe('POST /api/auth/signup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.checkRateLimit.mockResolvedValue(null)
        mocks.getClientIp.mockReturnValue('127.0.0.1')
    })

    it('returns a migration notice for legacy signup API callers', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/auth/signup', {
                method: 'POST',
                body: JSON.stringify({
                    email: 'founder@example.com',
                    password: 'strong-password-123',
                    name: 'Founder',
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(410)
        await expect(response.json()).resolves.toMatchObject({
            provider: 'clerk',
            error: 'Account creation now runs in the Clerk browser flow. Open /auth/signup to continue.',
        })
    })
})
