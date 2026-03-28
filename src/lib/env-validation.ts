const CORE_REQUIRED = ['DATABASE_URL', 'ENCRYPTION_SECRET'] as const
const PROD_PLATFORM_REQUIRED = [
    'WAVESPEED_API_KEY',
    'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SIGNING_SECRET',
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
] as const
const OPTIONAL_R2_GROUP = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
] as const

export interface EnvValidationReport {
    ready: boolean
    requiredMissing: string[]
    warnings: string[]
    checks: Record<string, 'configured' | 'missing' | 'optional'>
}

function hasValue(key: string): boolean {
    return Boolean(process.env[key]?.trim())
}

export function getEnvValidationReport(): EnvValidationReport {
    const requiredMissing: string[] = [...CORE_REQUIRED]
        .filter((key) => !hasValue(key))

    if (process.env.NODE_ENV === 'production') {
        requiredMissing.push(...PROD_PLATFORM_REQUIRED.filter((key) => !hasValue(key)))
    }

    const anyR2Configured = OPTIONAL_R2_GROUP.some((key) => hasValue(key))
    if (anyR2Configured) {
        requiredMissing.push(...OPTIONAL_R2_GROUP.filter((key) => !hasValue(key)))
    }

    const warnings: string[] = []
    if (process.env.NODE_ENV === 'production' && !hasValue('ALLOWED_ORIGINS')) {
        warnings.push('ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.')
    }

    const checks: EnvValidationReport['checks'] = {}
    for (const key of CORE_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of PROD_PLATFORM_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of OPTIONAL_R2_GROUP) {
        checks[key] = hasValue(key) ? 'configured' : 'optional'
    }
    checks.ALLOWED_ORIGINS = hasValue('ALLOWED_ORIGINS') ? 'configured' : 'optional'
    checks.OPENROUTER_API_KEY = hasValue('OPENROUTER_API_KEY') ? 'configured' : 'optional'
    checks.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = hasValue('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') ? 'configured' : 'missing'
    checks.CLERK_SECRET_KEY = hasValue('CLERK_SECRET_KEY') ? 'configured' : 'missing'
    checks.CLERK_WEBHOOK_SIGNING_SECRET = hasValue('CLERK_WEBHOOK_SIGNING_SECRET') ? 'configured' : 'missing'

    return {
        ready: requiredMissing.length === 0,
        requiredMissing: [...new Set(requiredMissing)],
        warnings,
        checks,
    }
}

/**
 * Crash fast on startup if required env vars are missing.
 * Call once from prisma.ts so it fires on first import.
 */
export function validateEnv(): void {
    const report = getEnvValidationReport()
    if (!report.ready) {
        throw new Error(
            `[Startup] Missing required env vars: ${report.requiredMissing.join(', ')}\n` +
            'Copy .env.example to .env and set the required values.',
        )
    }
}
