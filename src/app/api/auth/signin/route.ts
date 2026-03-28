import { NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, AUTH_LOGIN_LIMIT } from '@/lib/api-rate-limit'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { signinRequestSchema } from '@/lib/validators/user'

export const POST = apiHandler(async (request) => {
    const rateLimited = await checkRateLimit('auth:login', getClientIp(request), AUTH_LOGIN_LIMIT, {
        onRedisError: 'local_fallback',
    })
    if (rateLimited) return rateLimited

    await parseJsonBody(request, signinRequestSchema)

    return NextResponse.json(
        {
            error: 'Password sign-in now runs in the Clerk browser flow. Open /auth/signin to continue.',
            provider: 'clerk',
        },
        { status: 410 },
    )
})
