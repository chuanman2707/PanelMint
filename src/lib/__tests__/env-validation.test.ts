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
        expect(report.checks.ENCRYPTION_SECRET).toBeUndefined()
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

    it('requires the rest of the R2 credentials once any R2 variable is configured', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-key')
        vi.stubEnv('R2_ACCOUNT_ID', 'account-id')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toEqual(
            expect.arrayContaining([
                'R2_ACCESS_KEY_ID',
                'R2_SECRET_ACCESS_KEY',
                'R2_BUCKET_NAME',
            ]),
        )
        expect(report.checks.R2_ACCOUNT_ID).toBe('configured')
        expect(report.checks.R2_PUBLIC_URL).toBe('optional')
    })

    it('marks production queue readiness as missing when Inngest credentials are blank', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-key')
        vi.stubEnv('INNGEST_EVENT_KEY', '')
        vi.stubEnv('INNGEST_SIGNING_KEY', '')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toEqual(
            expect.arrayContaining([
                'INNGEST_EVENT_KEY',
                'INNGEST_SIGNING_KEY',
            ]),
        )
        expect(report.checks.INNGEST_EVENT_KEY).toBe('missing')
        expect(report.checks.INNGEST_SIGNING_KEY).toBe('missing')
    })

    it('keeps production origin warnings separate from readiness', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-key')
        vi.stubEnv('INNGEST_EVENT_KEY', 'event-key')
        vi.stubEnv('INNGEST_SIGNING_KEY', 'signing-key')
        vi.stubEnv('ALLOWED_ORIGINS', '')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(true)
        expect(report.warnings).toContain(
            'ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.',
        )
    })
})
