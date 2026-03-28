import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { passwordUpdateRequestSchema } from '@/lib/validators/user'

export const POST = apiHandler(async (request) => {
    await parseJsonBody(request, passwordUpdateRequestSchema)

    return NextResponse.json(
        {
            error: 'Password updates now run in the Clerk browser flow. Open /auth/reset-password to continue.',
            provider: 'clerk',
        },
        { status: 410 },
    )
})
