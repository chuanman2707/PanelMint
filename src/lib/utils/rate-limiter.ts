/**
 * Simple rate limiter using token bucket algorithm.
 * Limits to N operations per time window.
 */
export class RateLimiter {
    private tokens: number
    private readonly maxTokens: number
    private readonly refillInterval: number // ms per token
    private readonly acquireTimeoutMs: number
    private lastRefill: number

    constructor(maxPerMinute: number, options?: { acquireTimeoutMs?: number }) {
        this.maxTokens = maxPerMinute
        this.tokens = maxPerMinute
        this.refillInterval = 60_000 / maxPerMinute
        this.acquireTimeoutMs = options?.acquireTimeoutMs ?? Number.POSITIVE_INFINITY
        this.lastRefill = Date.now()
    }

    private refill() {
        const now = Date.now()
        const elapsed = now - this.lastRefill
        const tokensToAdd = Math.floor(elapsed / this.refillInterval)
        if (tokensToAdd > 0) {
            this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd)
            this.lastRefill = now
        }
    }

    async acquire(options?: { timeoutMs?: number }): Promise<void> {
        const timeoutMs = options?.timeoutMs ?? this.acquireTimeoutMs
        const startedAt = Date.now()

        while (true) {
            this.refill()
            if (this.tokens > 0) {
                this.tokens--
                return
            }

            const waitTime = Math.max(0, this.refillInterval - (Date.now() - this.lastRefill))
            const elapsed = Date.now() - startedAt
            if (Number.isFinite(timeoutMs) && elapsed + waitTime > timeoutMs) {
                throw new Error(`Rate limiter acquire timed out after ${timeoutMs}ms`)
            }

            console.log(`[RateLimiter] Waiting ${Math.ceil(waitTime / 1000)}s for rate limit...`)
            await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
    }
}

// Global image gen rate limiter: 10 images per minute
export const imageRateLimiter = new RateLimiter(
    parseInt(process.env.IMAGE_RATE_LIMIT ?? '10', 10),
    {
        acquireTimeoutMs: parseInt(process.env.IMAGE_RATE_LIMIT_TIMEOUT_MS ?? '120000', 10),
    },
)
