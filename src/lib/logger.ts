import { AsyncLocalStorage } from 'async_hooks'

type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
    level: LogLevel
    module: string
    message: string
    timestamp: string
    requestId?: string
    data?: Record<string, unknown>
}

// AsyncLocalStorage for request-scoped context (request ID)
const requestIdStorage = new AsyncLocalStorage<string>()

export function runWithRequestId<T>(id: string, fn: () => T): T {
    return requestIdStorage.run(id, fn)
}

export function getRequestId(): string | undefined {
    return requestIdStorage.getStore()
}

/** @deprecated Use runWithRequestId instead for proper async context */
export function setRequestId(id: string) {
    // No-op — kept for backward compatibility during migration
    // Use runWithRequestId() to properly scope request IDs
}

/**
 * Create a scoped logger for a module.
 * Automatically redacts sensitive data (apiKey, secret, etc.)
 *
 * Usage:
 *   const log = createLogger('Pipeline')
 *   log.info('Starting analysis...')
 *   log.error('Failed', { episodeId, error: err.message })
 */

const REDACT_KEYS = ['key', 'secret', 'authorization', 'token', 'password']

function redactSensitive(data: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase()
        if (REDACT_KEYS.some(k => lowerKey.includes(k)) && typeof value === 'string') {
            redacted[key] = '[REDACTED]'
        } else {
            redacted[key] = value
        }
    }
    return redacted
}

export function createLogger(module: string) {
    function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
        const entry: LogEntry = {
            level,
            module,
            message,
            timestamp: new Date().toISOString(),
            requestId: getRequestId(),
            data: data ? redactSensitive(data) : undefined,
        }

        const prefix = entry.requestId
            ? `[${entry.timestamp}] [${module}] [${entry.requestId}]`
            : `[${entry.timestamp}] [${module}]`

        const safeData = data ? redactSensitive(data) : ''

        switch (level) {
            case 'info':
                console.log(prefix, message, safeData)
                break
            case 'warn':
                console.warn(prefix, message, safeData)
                break
            case 'error':
                console.error(prefix, message, safeData)
                break
        }
    }

    return {
        info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
        warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
        error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
    }
}
