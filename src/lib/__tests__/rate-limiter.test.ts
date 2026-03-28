import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { RateLimiter } from '@/lib/utils/rate-limiter'

describe('RateLimiter', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-26T00:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('allows an immediate burst up to max tokens', async () => {
        const limiter = new RateLimiter(2)

        await expect(limiter.acquire()).resolves.toBeUndefined()
        await expect(limiter.acquire()).resolves.toBeUndefined()
    })

    it('refills tokens over time', async () => {
        const limiter = new RateLimiter(60) // 1 token per second

        await limiter.acquire()
        const acquirePromise = limiter.acquire()

        await vi.advanceTimersByTimeAsync(1000)

        await expect(acquirePromise).resolves.toBeUndefined()
    })

    it('times out when no token becomes available before the timeout', async () => {
        const limiter = new RateLimiter(1)

        await limiter.acquire()
        const acquirePromise = limiter.acquire({ timeoutMs: 500 })
        const assertion = expect(acquirePromise).rejects.toThrow('Rate limiter acquire timed out after 500ms')

        await vi.advanceTimersByTimeAsync(500)

        await assertion
    })
})
