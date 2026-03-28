import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { requireAuth } from '@/lib/api-auth'

export const GET = apiHandler(async () => {
    const auth = await requireAuth()
    if (auth.error || !auth.user) {
        return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user: auth.user })
})
