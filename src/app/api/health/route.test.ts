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
        const body = await response.json()
        expect(body).toMatchObject({
            status: 'ready',
            details: {
                missingRequiredEnv: [],
                notes: [
                    'Local single-user runtime. Auth is disabled for OSS v1.',
                    'Generated assets are stored on the local filesystem.',
                ],
            },
            checks: {
                runtime: {
                    app: 'nextjs',
                    queue: 'local-worker',
                    identity: 'local-single-user',
                    storage: 'local-filesystem',
                },
            },
        })
        expect(body.checks.runtime).not.toHaveProperty('deployment')
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
