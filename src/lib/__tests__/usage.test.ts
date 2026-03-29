import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
    prisma: {
        usageRecord: {
            create: vi.fn().mockResolvedValue({ id: 'test-id' }),
        },
    },
}))

import { logUsage } from '@/lib/usage'
import { prisma } from '@/lib/prisma'

describe('logUsage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates a usage record for LLM call', async () => {
        await logUsage({
            userId: 'user-1',
            type: 'llm_call',
            model: 'bytedance-seed/seed-1.6-flash',
            tokens: 1500,
        })

        expect(prisma.usageRecord.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                type: 'llm_call',
                model: 'bytedance-seed/seed-1.6-flash',
                tokens: 1500,
            }),
        })
    })

    it('creates a usage record for image gen', async () => {
        await logUsage({
            userId: 'user-1',
            type: 'image_gen',
            model: 'flux-kontext-pro-multi',
            metadata: JSON.stringify({ panelId: 'p1' }),
        })

        expect(prisma.usageRecord.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                type: 'image_gen',
                model: 'flux-kontext-pro-multi',
            }),
        })
    })

    it('does not throw on failure (fire-and-forget)', async () => {
        vi.mocked(prisma.usageRecord.create).mockRejectedValueOnce(new Error('DB down'))

        await logUsage({
            userId: 'user-1',
            type: 'llm_call',
            model: 'test',
        })
    })
})
