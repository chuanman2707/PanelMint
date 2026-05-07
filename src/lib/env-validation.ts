const STARTUP_REQUIRED = ['DATABASE_URL'] as const
const GENERATION_REQUIRED = ['WAVESPEED_API_KEY'] as const

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
