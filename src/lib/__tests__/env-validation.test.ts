import { afterEach, describe, expect, it, vi } from 'vitest'

import { getEnvValidationReport, validateEnv } from '@/lib/env-validation'

describe('env-validation', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('marks production as not ready when platform credentials are missing', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('ENCRYPTION_SECRET', 'secret')

        const report = getEnvValidationReport()

        expect(report.ready).toBe(false)
        expect(report.requiredMissing).toContain('WAVESPEED_API_KEY')
        expect(report.warnings).toContain(
            'ALLOWED_ORIGINS is empty; only same-origin mutating requests will be accepted.',
        )
    })

    it('requires the rest of the R2 credentials once any R2 variable is configured', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', 'postgres://db')
        vi.stubEnv('ENCRYPTION_SECRET', 'secret')
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

    it('throws a startup error listing all missing required environment variables', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('DATABASE_URL', '')
        vi.stubEnv('ENCRYPTION_SECRET', '')

        expect(() => validateEnv()).toThrowError(
            '[Startup] Missing required env vars: DATABASE_URL, ENCRYPTION_SECRET',
        )
    })
})
