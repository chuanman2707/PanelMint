import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, AUTH_SIGNUP_LIMIT } from '@/lib/api-rate-limit'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { signupRequestSchema } from '@/lib/validators/user'

export const POST = apiHandler(async (request) => {
    const rateLimited = await checkRateLimit('auth:signup', getClientIp(request), AUTH_SIGNUP_LIMIT, {
        onRedisError: 'local_fallback',
    })
    if (rateLimited) return rateLimited

    await parseJsonBody(request, signupRequestSchema)

    return NextResponse.json(
        {
            error: 'Account creation now runs in the Clerk browser flow. Open /auth/signup to continue.',
            provider: 'clerk',
        },
        { status: 410 },
    )
})
