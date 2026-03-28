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
                    auth: 'clerk',
                },
            },
            details: {
                missingRequiredEnv: envReport.requiredMissing,
                warnings: envReport.warnings,
                notes: [
                    'The default deployment target is Vercel + Neon Postgres + Clerk + Inngest.',
                ],
            },
        },
        { status: ready ? 200 : 503 },
    )
})
