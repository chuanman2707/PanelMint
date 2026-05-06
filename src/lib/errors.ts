import { NextResponse } from 'next/server'

/** Typed error codes for structured API responses */
export const ErrorCode = {
    BAD_REQUEST: 'BAD_REQUEST',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode]

/** Application error with HTTP status code */
export class AppError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code: ErrorCodeType = ErrorCode.INTERNAL_ERROR,
        public retryAfter?: number,
    ) {
        super(message)
        this.name = 'AppError'
    }

    static badRequest(message: string) {
        return new AppError(message, 400, ErrorCode.BAD_REQUEST)
    }

    static forbidden(message = 'Forbidden') {
        return new AppError(message, 403, ErrorCode.FORBIDDEN)
    }

    static notFound(resource = 'Resource') {
        return new AppError(`${resource} not found`, 404, ErrorCode.NOT_FOUND)
    }

    static conflict(message: string) {
        return new AppError(message, 409, ErrorCode.CONFLICT)
    }

    static tooManyRequests(retryAfter?: number) {
        const err = new AppError('Too many requests', 429, ErrorCode.RATE_LIMITED, retryAfter)
        return err
    }
}

/** Build a structured error response from any error */
export function buildErrorResponse(err: unknown): NextResponse {
    if (err instanceof AppError) {
        const headers: Record<string, string> = {}
        if (err.retryAfter != null) {
            headers['Retry-After'] = String(err.retryAfter)
        }
        return NextResponse.json(
            {
                error: err.message,
                code: err.code,
            },
            { status: err.statusCode, headers },
        )
    }

    // Prisma unique constraint violation
    if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
    ) {
        return NextResponse.json(
            { error: 'Resource already exists', code: ErrorCode.CONFLICT },
            { status: 409 },
        )
    }

    // Generic error
    console.error('[API Error]', err)
    return NextResponse.json(
        { error: 'Internal server error', code: ErrorCode.INTERNAL_ERROR },
        { status: 500 },
    )
}
