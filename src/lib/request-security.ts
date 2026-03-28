import { NextRequest } from 'next/server'
import { AppError } from './errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function parseConfiguredOrigins(): string[] {
    const raw = process.env.ALLOWED_ORIGINS
    if (!raw) return []
    return raw
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean)
}

function getRequestOriginCandidate(request: NextRequest): string | null {
    const origin = request.headers.get('origin')
    if (origin) return origin

    const referer = request.headers.get('referer')
    if (!referer) return null

    try {
        return new URL(referer).origin
    } catch {
        return null
    }
}

export function assertTrustedRequestOrigin(request: NextRequest) {
    if (process.env.NODE_ENV === 'test') return

    const method = request.method.toUpperCase()
    if (SAFE_METHODS.has(method)) return

    const candidateOrigin = getRequestOriginCandidate(request)
    if (!candidateOrigin) {
        if (process.env.NODE_ENV === 'production') {
            throw AppError.forbidden('Origin header is required for mutating requests')
        }
        return
    }

    const allowedOrigins = new Set<string>([
        request.nextUrl.origin,
        ...parseConfiguredOrigins(),
    ])

    if (!allowedOrigins.has(candidateOrigin)) {
        throw AppError.forbidden('Invalid request origin')
    }
}

