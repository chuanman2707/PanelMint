import { NextRequest, NextResponse } from 'next/server'
import { buildErrorResponse } from './errors'
import { assertTrustedRequestOrigin } from './request-security'

type RouteContext = { params: Promise<Record<string, string>> }

type HandlerFn = (
    request: NextRequest,
    context: RouteContext,
) => Promise<NextResponse>

/**
 * Wraps an API route handler with:
 * - Structured error handling (AppError → proper HTTP response)
 * - Prisma error detection (P2002 → 409)
 * - Catch-all for unexpected errors → 500
 *
 * Usage:
 *   export const GET = apiHandler(async (req, ctx) => { ... })
 *   export const POST = apiHandler(async (req, ctx) => { ... })
 */
export function apiHandler(handler: HandlerFn): HandlerFn {
    return async (request: NextRequest, context: RouteContext) => {
        try {
            assertTrustedRequestOrigin(request)
            return await handler(request, context)
        } catch (err) {
            return buildErrorResponse(err)
        }
    }
}
