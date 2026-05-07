import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from '@/lib/storage'

interface StorageRouteContext {
    params: Promise<{ key?: string[] }>
}

export async function GET(_request: NextRequest, context: StorageRouteContext) {
    const { key } = await context.params

    if (!key?.length) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    try {
        const storageKey = key
            .map((segment) => decodeURIComponent(segment))
            .join('/')
        const file = await getStorage().read(storageKey)

        return new NextResponse(file.buffer, {
            status: 200,
            headers: {
                'Content-Type': file.contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
}
