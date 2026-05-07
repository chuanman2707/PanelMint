const STARTUP_REQUIRED = ['DATABASE_URL'] as const
const GENERATION_REQUIRED = ['WAVESPEED_API_KEY'] as const
const PROD_QUEUE_REQUIRED = [
    'INNGEST_EVENT_KEY',
    'INNGEST_SIGNING_KEY',
] as const
const OPTIONAL_R2_REQUIRED = [
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
] as const
const OPTIONAL_R2_OPTIONAL = ['R2_PUBLIC_URL'] as const

export interface EnvValidationReport {
    ready: boolean
    requiredMissing: string[]
    warnings: string[]
    checks: Record<string, 'configured' | 'missing' | 'optional'>
}

function hasValue(key: string): boolean {
    return Boolean(process.env[key]?.trim())
}

function missing(keys: readonly string[]): string[] {
    return keys.filter((key) => !hasValue(key))
}

export function getEnvValidationReport(): EnvValidationReport {
    const requiredMissing: string[] = [
        ...missing(STARTUP_REQUIRED),
        ...missing(GENERATION_REQUIRED),
    ]

    if (process.env.NODE_ENV === 'production') {
        requiredMissing.push(...missing(PROD_QUEUE_REQUIRED))
    }

    const anyR2Configured = [...OPTIONAL_R2_REQUIRED, ...OPTIONAL_R2_OPTIONAL].some((key) => hasValue(key))
    if (anyR2Configured) {
        requiredMissing.push(...missing(OPTIONAL_R2_REQUIRED))
    }

    const warnings: string[] = []
    if (process.env.NODE_ENV === 'production' && !hasValue('ALLOWED_ORIGINS')) {
        warnings.push('ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.')
    }

    const checks: EnvValidationReport['checks'] = {}
    for (const key of STARTUP_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of GENERATION_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of PROD_QUEUE_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'missing'
    }
    for (const key of OPTIONAL_R2_REQUIRED) {
        checks[key] = hasValue(key) ? 'configured' : 'optional'
    }
    for (const key of OPTIONAL_R2_OPTIONAL) {
        checks[key] = hasValue(key) ? 'configured' : 'optional'
    }
    checks.ALLOWED_ORIGINS = hasValue('ALLOWED_ORIGINS') ? 'configured' : 'optional'

    return {
        ready: requiredMissing.length === 0,
        requiredMissing: [...new Set(requiredMissing)],
        warnings,
        checks,
    }
}

export function validateEnv(): void {
    const requiredMissing = missing(STARTUP_REQUIRED)
    if (requiredMissing.length > 0) {
        throw new Error(
            `[Startup] Missing required env vars: ${requiredMissing.join(', ')}\n` +
            'Copy .env.example to .env and set the required values.',
        )
    }
}
