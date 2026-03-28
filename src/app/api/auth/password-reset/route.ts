import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { passwordResetRequestSchema } from '@/lib/validators/user'

export const POST = apiHandler(async (request) => {
    await parseJsonBody(request, passwordResetRequestSchema)

    return NextResponse.json(
        {
            error: 'Password reset now runs in the Clerk browser flow. Open /auth/reset-password to continue.',
            provider: 'clerk',
        },
        { status: 410 },
    )
})
