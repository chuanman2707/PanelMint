import { prisma } from '@/lib/prisma'

export interface UsageInput {
    userId: string
    type: 'llm_call' | 'image_gen'
    model: string
    tokens?: number
    cost?: number
    metadata?: string
}

export async function logUsage(input: UsageInput): Promise<void> {
    try {
        await prisma.usageRecord.create({
            data: {
                userId: input.userId,
                type: input.type,
                model: input.model,
                tokens: input.tokens ?? null,
                cost: input.cost ?? null,
                metadata: input.metadata ?? null,
            },
        })
    } catch (err) {
        console.warn('[Usage] Failed to log usage record:', err)
    }
}
