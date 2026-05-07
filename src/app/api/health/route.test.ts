import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    prisma: {
        $queryRaw: vi.fn(),
    },
    getEnvValidationReport: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/env-validation', () => ({
    getEnvValidationReport: mocks.getEnvValidationReport,
}))

import { GET } from './route'

describe('GET /api/health', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.prisma.$queryRaw.mockResolvedValue([{ 1: 1 }])
        mocks.getEnvValidationReport.mockReturnValue({
            ready: true,
            requiredMissing: [],
            warnings: [],
            checks: {
                DATABASE_URL: 'configured',
                WAVESPEED_API_KEY: 'configured',
                ALLOWED_ORIGINS: 'configured',
            },
        })
    })

    it('returns ready when dependencies and env are healthy', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/health'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
            status: 'ready',
            details: {
                missingRequiredEnv: [],
                notes: ['Local single-user runtime. Auth is disabled for OSS v1.'],
            },
            checks: {
                runtime: {
                    queue: 'local-worker',
                    identity: 'local-single-user',
                },
            },
        })
    })

    it('returns degraded when generation env is missing', async () => {
        mocks.getEnvValidationReport.mockReturnValue({
            ready: false,
            requiredMissing: ['WAVESPEED_API_KEY'],
            warnings: ['ALLOWED_ORIGINS is empty'],
            checks: {
                DATABASE_URL: 'configured',
                WAVESPEED_API_KEY: 'missing',
                ALLOWED_ORIGINS: 'optional',
            },
        })

        const response = await GET(
            new NextRequest('http://localhost/api/health'),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toMatchObject({
            status: 'degraded',
            details: {
                missingRequiredEnv: ['WAVESPEED_API_KEY'],
            },
            checks: {
                env: {
                    WAVESPEED_API_KEY: 'missing',
                },
            },
        })
    })
})
