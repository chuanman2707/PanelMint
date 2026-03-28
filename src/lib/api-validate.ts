import type { ZodType } from 'zod'
import { AppError } from './errors'

function formatIssues(issues: Array<{ path?: PropertyKey[]; message: string }>): string {
    const first = issues[0]
    if (!first) return 'Invalid request body'

    const path = first.path?.length
        ? `${first.path.join('.')}: `
        : ''

    return `${path}${first.message}`
}

export async function parseJsonBody<T>(
    request: Request,
    schema: ZodType<T>,
    options?: { allowEmptyBody?: boolean },
): Promise<T> {
    let body: unknown

    try {
        body = await request.json()
    } catch {
        if (options?.allowEmptyBody) {
            body = {}
        } else {
            throw AppError.badRequest('Invalid JSON body')
        }
    }

    const result = schema.safeParse(body)
    if (!result.success) {
        throw AppError.badRequest(formatIssues(result.error.issues))
    }

    return result.data
}
