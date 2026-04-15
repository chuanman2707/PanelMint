import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'

export interface RateLimitConfig {
    windowSeconds: number
    maxRequests: number
}

export interface RateLimitOptions {
    onRedisError?: 'fail_open' | 'local_fallback' | 'fail_closed'
}

// -- Presets --

/** Login: 5 requests per 60 seconds per IP */
export const AUTH_LOGIN_LIMIT: RateLimitConfig = { windowSeconds: 60, maxRequests: 5 }

/** Signup: 3 requests per 60 seconds per IP */
export const AUTH_SIGNUP_LIMIT: RateLimitConfig = { windowSeconds: 60, maxRequests: 3 }

/** Generate comic: 3 requests per 60 seconds per user */
export const GENERATE_LIMIT: RateLimitConfig = { windowSeconds: 60, maxRequests: 3 }

/** Image generation: 2 requests per 60 seconds per user */
export const IMAGE_GEN_LIMIT: RateLimitConfig = { windowSeconds: 60, maxRequests: 2 }

/** Retry failed images: 2 requests per 60 seconds per user */
export const RETRY_LIMIT: RateLimitConfig = { windowSeconds: 60, maxRequests: 2 }

// -- Core --

const localFallbackWindows = new Map<string, number[]>()
const CLEANUP_SAMPLE_RATE = 0.02

function buildRateLimitResponse(retryAfterSeconds: number, status = 429) {
    return NextResponse.json(
        {
            error: status === 429 ? 'Too many requests' : 'Rate limit backend unavailable',
            retryAfter: retryAfterSeconds,
        },
        {
            status,
            headers: {
                'Retry-After': String(retryAfterSeconds),
            },
        },
    )
}

function checkLocalFallback(key: string, now: number, config: RateLimitConfig): NextResponse | null {
    const windowMs = config.windowSeconds * 1000
    const cutoff = now - windowMs
    const entries = (localFallbackWindows.get(key) ?? []).filter((timestamp) => timestamp > cutoff)

    if (entries.length >= config.maxRequests) {
        const retryAfterMs = Math.max((entries[0] ?? now) + windowMs - now, 0)
        return buildRateLimitResponse(Math.ceil(retryAfterMs / 1000))
    }

    entries.push(now)
    localFallbackWindows.set(key, entries)
    return null
}

function getWindowStart(now: number, config: RateLimitConfig): Date {
    const windowMs = config.windowSeconds * 1000
    return new Date(Math.floor(now / windowMs) * windowMs)
}

async function incrementFixedWindow(
    action: string,
    identifier: string,
    config: RateLimitConfig,
    now: number,
): Promise<number> {
    const scope = `rl:${action}:${identifier}`
    const windowStart = getWindowStart(now, config)
    const expiresAt = new Date(windowStart.getTime() + (config.windowSeconds * 2 * 1000))

    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO rate_limit_windows (
            id,
            scope,
            window_start,
            count,
            expires_at,
            created_at,
            updated_at
        )
        VALUES (
            ${crypto.randomUUID()},
            ${scope},
            ${windowStart},
            1,
            ${expiresAt},
            NOW(),
            NOW()
        )
        ON CONFLICT (scope, window_start)
        DO UPDATE
        SET
            count = rate_limit_windows.count + 1,
            expires_at = EXCLUDED.expires_at,
            updated_at = NOW()
        RETURNING count
    `

    if (Math.random() < CLEANUP_SAMPLE_RATE) {
        void prisma.rateLimitWindow.deleteMany({
            where: { expiresAt: { lt: new Date(now) } },
        }).catch(() => {})
    }

    return rows[0]?.count ?? 1
}

/**
 * Check rate limit via Postgres atomic fixed window.
 * Returns null if within limit, or a 429 NextResponse if exceeded.
 */
export async function checkRateLimit(
    action: string,
    identifier: string,
    config: RateLimitConfig,
    options?: RateLimitOptions,
): Promise<NextResponse | null> {
    const now = Date.now()

    try {
        const count = await incrementFixedWindow(action, identifier, config, now)

        if (count > config.maxRequests) {
            const nextWindowStart = getWindowStart(now, config).getTime() + (config.windowSeconds * 1000)
            const retryAfterMs = Math.max(nextWindowStart - now, 0)
            return buildRateLimitResponse(Math.ceil(retryAfterMs / 1000))
        }

        return null
    } catch (err) {
        const mode = options?.onRedisError ?? 'fail_open'
        const fallbackKey = `rl:${action}:${identifier}`

        if (mode === 'local_fallback') {
            console.warn(`[RateLimit] Durable store unavailable for ${action}; using local fallback`, err)
            return checkLocalFallback(fallbackKey, now, config)
        }

        if (mode === 'fail_closed') {
            console.error(`[RateLimit] Durable store unavailable for ${action}; failing closed`, err)
            return buildRateLimitResponse(config.windowSeconds, 503)
        }

        console.warn(`[RateLimit] Durable store unavailable for ${action}; failing open`, err)
        return null
    }
}

// -- IP extraction --

/**
 * Extract real client IP from request headers.
 * Prefer x-real-ip when present because the hosting platform can set it directly.
 * Fall back to the first x-forwarded-for entry for environments that only expose that chain.
 */
export function getClientIp(req: NextRequest): string {
    const realIp = req.headers.get('x-real-ip')
    if (realIp) return realIp.trim()

    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) {
        const parts = forwarded.split(',').map(s => s.trim()).filter(Boolean)
        if (parts.length > 0) return parts[0]
    }

    return '127.0.0.1'
}
