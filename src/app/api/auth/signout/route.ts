import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'

export const POST = apiHandler(async () => {
    return NextResponse.json({
        ok: true,
        provider: 'clerk',
        message: 'Sign out is handled by the Clerk client.',
    })
})
