import { afterEach, describe, expect, it, vi } from 'vitest'

import { getEnvValidationReport, validateEnv } from '@/lib/env-validation'

describe('env-validation', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('marks generation as not ready when WAVESPEED_API_KEY is missing', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', '')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toContain('WAVESPEED_API_KEY')
        expect(report.checks.DATABASE_URL).toBe('configured')
        expect(report.checks.WAVESPEED_API_KEY).toBe('missing')
    })

    it('does not crash startup validation when only WAVESPEED_API_KEY is missing', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', '')

        expect(() => validateEnv()).not.toThrow()
    })

    it('throws a startup error only for true startup requirements', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', '')
        vi.stubEnv('WAVESPEED_API_KEY', '')

        expect(() => validateEnv()).toThrowError(
            '[Startup] Missing required env vars: DATABASE_URL',
        )
    })

    it('keeps production origin warnings separate from readiness', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-key')
        vi.stubEnv('ALLOWED_ORIGINS', '')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(true)
        expect(report.warnings).toContain(
            'ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.',
        )
    })
})
