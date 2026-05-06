import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiHandler } from '@/lib/api-handler'
import { getEnvValidationReport } from '@/lib/env-validation'

export const GET = apiHandler(async () => {
    const envReport = getEnvValidationReport()
    let databaseStatus: 'ok' | 'error' = 'ok'

    const checks: Promise<unknown>[] = [
        prisma.$queryRaw`SELECT 1`.catch(() => { databaseStatus = 'error' }),
    ]

    await Promise.allSettled(checks)

    const ready = envReport.ready
        && databaseStatus === 'ok'
    const status = ready ? 'ready' : 'degraded'

    return NextResponse.json(
        {
            status,
            timestamp: new Date().toISOString(),
            checks: {
                database: databaseStatus,
                env: envReport.checks,
                runtime: {
                    deployment: process.env.VERCEL ? 'vercel' : 'local',
                    queue: 'inngest',
                    identity: 'local-single-user',
                },
            },
            details: {
                missingRequiredEnv: envReport.requiredMissing,
                warnings: envReport.warnings,
                notes: [
                    'Local single-user runtime. Auth is disabled for OSS v1.',
                ],
            },
        },
        { status: ready ? 200 : 503 },
    )
})
