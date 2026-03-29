import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    grantCredits: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/billing', async () => {
    const actual = await vi.importActual<typeof import('@/lib/billing')>('@/lib/billing')

    return {
        ...actual,
        grantCredits: mocks.grantCredits,
    }
})

import { POST } from './route'

describe('POST /api/user/credits/dev-topup', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.NODE_ENV = 'development'
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
        mocks.grantCredits.mockResolvedValue(undefined)
    })

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV
    })

    it('returns 401 when the user is not authenticated', async () => {
        mocks.requireAuth.mockResolvedValue({
            user: null,
            error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
        })

        const response = await POST(
            new NextRequest('http://localhost/api/user/credits/dev-topup', {
                method: 'POST',
                body: JSON.stringify({ packageId: 'starter' }),
                headers: {
                    'content-type': 'application/json',
                    origin: 'http://localhost',
                },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(401)
        expect(mocks.grantCredits).not.toHaveBeenCalled()
    })

    it('blocks the helper in production', async () => {
        process.env.NODE_ENV = 'production'

        const response = await POST(
            new NextRequest('http://localhost/api/user/credits/dev-topup', {
                method: 'POST',
                body: JSON.stringify({ packageId: 'starter' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(403)
        expect(mocks.grantCredits).not.toHaveBeenCalled()
    })

    it('grants the selected credit package in development', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/user/credits/dev-topup', {
                method: 'POST',
                body: JSON.stringify({ packageId: 'creator' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.grantCredits).toHaveBeenCalledWith('user-1', 27600, 'purchase', {
            accountTier: 'paid',
            incrementLifetimePurchasedCredits: true,
        })
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            packageId: 'creator',
            creditsAdded: 27600,
            accountTier: 'paid',
        })
    })

    it('rejects unknown package ids', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/user/credits/dev-topup', {
                method: 'POST',
                body: JSON.stringify({ packageId: 'enterprise' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(400)
        expect(mocks.grantCredits).not.toHaveBeenCalled()
    })
})
