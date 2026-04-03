import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
    assertTrustedRequestOrigin: vi.fn(),
    buildErrorResponse: vi.fn(),
}))

vi.mock('@/lib/request-security', () => ({
    assertTrustedRequestOrigin: mocks.assertTrustedRequestOrigin,
}))

vi.mock('@/lib/errors', () => ({
    buildErrorResponse: mocks.buildErrorResponse,
}))

import { apiHandler } from '@/lib/api-handler'

describe('apiHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('validates request origin before invoking the wrapped handler', async () => {
        const handler = vi.fn(async () => NextResponse.json({ ok: true }))
        const wrapped = apiHandler(handler)
        const request = new NextRequest('http://localhost/api/test')
        const context = { params: Promise.resolve({ id: '123' }) }

        const response = await wrapped(request, context)

        expect(response.status).toBe(200)
        expect(mocks.assertTrustedRequestOrigin).toHaveBeenCalledWith(request)
        expect(handler).toHaveBeenCalledWith(request, context)
    })

    it('returns the shared error response when the wrapped handler throws', async () => {
        const error = new Error('boom')
        const errorResponse = NextResponse.json({ error: 'boom' }, { status: 500 })
        const handler = vi.fn(async () => {
            throw error
        })
        const wrapped = apiHandler(handler)

        mocks.buildErrorResponse.mockReturnValue(errorResponse)

        const response = await wrapped(new NextRequest('http://localhost/api/test'), {
            params: Promise.resolve({}),
        })

        expect(mocks.buildErrorResponse).toHaveBeenCalledWith(error)
        expect(response).toBe(errorResponse)
    })
})
