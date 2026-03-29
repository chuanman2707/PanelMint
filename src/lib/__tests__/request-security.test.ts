import { afterEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { AppError } from '../errors'
import { assertTrustedRequestOrigin } from '../request-security'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
const mutableEnv = process.env as Record<string, string | undefined>

function createRequest(
    method: string,
    headers?: Record<string, string>,
) {
    return new NextRequest('https://app.panelmint.test/api/example', {
        method,
        headers,
    })
}

afterEach(() => {
    mutableEnv.NODE_ENV = ORIGINAL_NODE_ENV
    mutableEnv.ALLOWED_ORIGINS = ORIGINAL_ALLOWED_ORIGINS
})

describe('assertTrustedRequestOrigin', () => {
    it('allows safe methods without origin headers', () => {
        mutableEnv.NODE_ENV = 'production'
        expect(() => assertTrustedRequestOrigin(createRequest('GET'))).not.toThrow()
    })

    it('allows same-origin POST requests', () => {
        mutableEnv.NODE_ENV = 'production'
        expect(() => assertTrustedRequestOrigin(createRequest('POST', {
            origin: 'https://app.panelmint.test',
        }))).not.toThrow()
    })

    it('allows referer fallback when origin is absent', () => {
        mutableEnv.NODE_ENV = 'production'
        expect(() => assertTrustedRequestOrigin(createRequest('POST', {
            referer: 'https://app.panelmint.test/editor',
        }))).not.toThrow()
    })

    it('allows explicitly configured alternate origins', () => {
        mutableEnv.NODE_ENV = 'production'
        mutableEnv.ALLOWED_ORIGINS = 'https://beta.panelmint.test, https://app.panelmint.test'
        expect(() => assertTrustedRequestOrigin(createRequest('POST', {
            origin: 'https://beta.panelmint.test',
        }))).not.toThrow()
    })

    it('rejects invalid origins in production', () => {
        mutableEnv.NODE_ENV = 'production'
        expect(() => assertTrustedRequestOrigin(createRequest('POST', {
            origin: 'https://evil.test',
        }))).toThrowError(AppError)
    })

    it('rejects missing origin metadata in production', () => {
        mutableEnv.NODE_ENV = 'production'
        expect(() => assertTrustedRequestOrigin(createRequest('POST'))).toThrowError(AppError)
    })

    it('allows missing origin metadata outside production', () => {
        mutableEnv.NODE_ENV = 'development'
        expect(() => assertTrustedRequestOrigin(createRequest('POST'))).not.toThrow()
    })
})
