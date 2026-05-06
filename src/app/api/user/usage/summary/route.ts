import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'

export const GET = apiHandler(async () => {
    const localUser = await getOrCreateLocalUser()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const records = await prisma.usageRecord.findMany({
        where: {
            userId: localUser.id,
            createdAt: { gte: startOfMonth },
        },
        select: { type: true, model: true, tokens: true, cost: true },
    })

    const llmCalls = records.filter((r) => r.type === 'llm_call').length
    const imageGens = records.filter((r) => r.type === 'image_gen').length
    const totalTokens = records.reduce((sum, r) => sum + (r.tokens ?? 0), 0)
    const totalCost = records.reduce((sum, r) => sum + (r.cost ?? 0), 0)

    return NextResponse.json({
        period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
        llmCalls,
        imageGens,
        totalTokens,
        totalCost,
    })
})
