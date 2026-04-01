import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

interface StorageRouteContext {
    params: Promise<{ key?: string[] }>
}

export async function GET(request: NextRequest, context: StorageRouteContext) {
    const { key } = await context.params

    if (!key?.length) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const storageKey = key
        .map((segment) => decodeURIComponent(segment))
        .join('/')
    const targetUrl = await getStorage().getSignedUrl(storageKey)

    return NextResponse.redirect(new URL(targetUrl, request.url))
}
