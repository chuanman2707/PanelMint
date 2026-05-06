import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/api-handler'
import { getOrCreateLocalUser } from '@/lib/local-user'

export const GET = apiHandler(async () => {
    const user = await getOrCreateLocalUser()
    return NextResponse.json({ user })
})
