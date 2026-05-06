import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        $queryRaw: vi.fn(),
        rateLimitWindow: {
            deleteMany: vi.fn(),
        },
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}))

import {
    checkRateLimit,
    AUTH_LOGIN_LIMIT,
    AUTH_SIGNUP_LIMIT,
    GENERATE_LIMIT,
    IMAGE_GEN_LIMIT,
    RETRY_LIMIT,
    getClientIp,
} from '../api-rate-limit'

describe('API Rate Limiter (Postgres)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-28T12:00:15.000Z'))
        prismaMock.$queryRaw.mockResolvedValue([{ count: 1 }])
        prismaMock.rateLimitWindow.deleteMany.mockResolvedValue({ count: 0 })
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns null when under the limit', async () => {
        prismaMock.$queryRaw.mockResolvedValue([{ count: 1 }])

        const result = await checkRateLimit('test', 'user-1', AUTH_LOGIN_LIMIT)
        expect(result).toBeNull()
    })

    it('returns 429 NextResponse when over the limit', async () => {
        prismaMock.$queryRaw.mockResolvedValue([{ count: 6 }])

        const result = await checkRateLimit('test', 'user-2', AUTH_LOGIN_LIMIT)
        expect(result).not.toBeNull()
        expect(result!.status).toBe(429)
    })

    it('returns null (fail-open) when Postgres is unavailable', async () => {
        prismaMock.$queryRaw.mockRejectedValue(new Error('database unavailable'))

        const result = await checkRateLimit('test', 'user-3', AUTH_LOGIN_LIMIT)
        expect(result).toBeNull()
    })

    it('falls back to a local limiter when the durable store is unavailable', async () => {
        prismaMock.$queryRaw.mockRejectedValue(new Error('database unavailable'))

        const first = await checkRateLimit('auth:login', 'fallback-user', AUTH_LOGIN_LIMIT, {
            onRedisError: 'local_fallback',
        })
        const second = await checkRateLimit('auth:login', 'fallback-user', AUTH_LOGIN_LIMIT, {
            onRedisError: 'local_fallback',
        })
        const third = await checkRateLimit('auth:login', 'fallback-user', AUTH_LOGIN_LIMIT, {
            onRedisError: 'local_fallback',
        })
        const fourth = await checkRateLimit('auth:login', 'fallback-user', AUTH_LOGIN_LIMIT, {
            onRedisError: 'local_fallback',
        })
        const fifth = await checkRateLimit('auth:login', 'fallback-user', AUTH_LOGIN_LIMIT, {
            onRedisError: 'local_fallback',
        })
        const sixth = await checkRateLimit('auth:login', 'fallback-user', AUTH_LOGIN_LIMIT, {
            onRedisError: 'local_fallback',
        })

        expect(first).toBeNull()
        expect(second).toBeNull()
        expect(third).toBeNull()
        expect(fourth).toBeNull()
        expect(fifth).toBeNull()
        expect(sixth?.status).toBe(429)
    })

    it('sets Retry-After header in seconds when limited', async () => {
        prismaMock.$queryRaw.mockResolvedValue([{ count: 6 }])

        const result = await checkRateLimit('test', 'user-4', AUTH_LOGIN_LIMIT)
        expect(result!.headers.get('Retry-After')).toBe('45')
    })

    it('exports correct preset configs', () => {
        expect(AUTH_LOGIN_LIMIT.maxRequests).toBe(5)
        expect(AUTH_LOGIN_LIMIT.windowSeconds).toBe(60)
        expect(AUTH_SIGNUP_LIMIT.maxRequests).toBe(3)
        expect(GENERATE_LIMIT.maxRequests).toBe(3)
        expect(IMAGE_GEN_LIMIT.maxRequests).toBe(2)
        expect(RETRY_LIMIT.maxRequests).toBe(2)
    })

    it('prefers x-real-ip over x-forwarded-for when both are present', () => {
        const request = new NextRequest('http://localhost/api/generate', {
            headers: {
                'x-forwarded-for': '203.0.113.10, 10.0.0.2',
                'x-real-ip': '198.51.100.7',
            },
        })

        expect(getClientIp(request)).toBe('198.51.100.7')
    })

    it('falls back to the first x-forwarded-for entry when x-real-ip is absent', () => {
        const request = new NextRequest('http://localhost/api/generate', {
            headers: {
                'x-forwarded-for': '203.0.113.10, 10.0.0.2',
            },
        })

        expect(getClientIp(request)).toBe('203.0.113.10')
    })

    it('returns localhost when no forwarding headers are present', () => {
        const request = new NextRequest('http://localhost/api/generate')

        expect(getClientIp(request)).toBe('127.0.0.1')
    })
})
