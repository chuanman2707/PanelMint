import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'

export const GET = apiHandler(async (request) => {
    const localUser = await getOrCreateLocalUser()

    const url = new URL(request.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
    const cursor = url.searchParams.get('cursor') || undefined

    const records = await prisma.usageRecord.findMany({
        where: { userId: localUser.id },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = records.length > limit
    const items = hasMore ? records.slice(0, limit) : records

    return NextResponse.json({
        items: items.map((r) => ({
            id: r.id,
            type: r.type,
            model: r.model,
            tokens: r.tokens,
            cost: r.cost,
            createdAt: r.createdAt,
        })),
        nextCursor: hasMore ? items[items.length - 1].id : null,
    })
})
