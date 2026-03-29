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
                ENCRYPTION_SECRET: 'configured',
                WAVESPEED_API_KEY: 'configured',
                NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'configured',
                CLERK_SECRET_KEY: 'configured',
                CLERK_WEBHOOK_SIGNING_SECRET: 'configured',
                INNGEST_EVENT_KEY: 'configured',
                INNGEST_SIGNING_KEY: 'configured',
                R2_ACCOUNT_ID: 'optional',
                R2_ACCESS_KEY_ID: 'optional',
                R2_SECRET_ACCESS_KEY: 'optional',
                R2_BUCKET_NAME: 'optional',
                R2_PUBLIC_URL: 'optional',
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
                notes: ['The default deployment target is Vercel + Neon Postgres + Clerk + Inngest.'],
            },
            checks: {
                runtime: {
                    queue: 'inngest',
                    auth: 'clerk',
                },
            },
        })
    })

    it('returns degraded when required env is missing', async () => {
        mocks.getEnvValidationReport.mockReturnValue({
            ready: false,
            requiredMissing: ['INNGEST_EVENT_KEY'],
            warnings: ['ALLOWED_ORIGINS is empty'],
            checks: {
                DATABASE_URL: 'configured',
                ENCRYPTION_SECRET: 'configured',
                WAVESPEED_API_KEY: 'missing',
                NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'configured',
                CLERK_SECRET_KEY: 'configured',
                CLERK_WEBHOOK_SIGNING_SECRET: 'configured',
                INNGEST_EVENT_KEY: 'missing',
                INNGEST_SIGNING_KEY: 'configured',
                R2_ACCOUNT_ID: 'optional',
                R2_ACCESS_KEY_ID: 'optional',
                R2_SECRET_ACCESS_KEY: 'optional',
                R2_BUCKET_NAME: 'optional',
                R2_PUBLIC_URL: 'optional',
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
                missingRequiredEnv: ['INNGEST_EVENT_KEY'],
            },
        })
    })
})
