import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    ACTION_CREDIT_COSTS,
    CREDIT_PACKAGES,
    FREE_SIGNUP_CREDITS,
    estimatePipelineCost,
    InsufficientCreditsError,
    canAccessPremium,
    getImageGenerationCreditCost,
    normalizeAccountTier,
} from '@/lib/billing'

const { prismaMock } = vi.hoisted(() => {
    const prisma = {
        user: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
        },
        creditTransaction: {
            create: vi.fn(),
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(),
    }

    prisma.$transaction.mockImplementation(async (input: unknown) => {
        if (typeof input === 'function') {
            return input(prisma)
        }

        return Promise.all(input as Promise<unknown>[])
    })

    return { prismaMock: prisma }
})

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}))

import { prisma } from '@/lib/prisma'
import { checkCredits, deductCredits, getCreditBalance, grantCredits, refundCredits } from '@/lib/billing'

const mockUser = prisma.user as unknown as {
    findUnique: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
}

const mockCreditTx = prisma.creditTransaction as unknown as {
    create: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
}

beforeEach(() => {
    vi.clearAllMocks()
    mockCreditTx.findUnique.mockResolvedValue(null)
})

describe('credit catalog', () => {
    it('exposes the locked package pricing and signup bonus', () => {
        expect(FREE_SIGNUP_CREDITS).toBe(300)
        expect(CREDIT_PACKAGES.starter.credits).toBe(8000)
        expect(CREDIT_PACKAGES.creator.credits).toBe(27600)
        expect(CREDIT_PACKAGES.publisher.credits).toBe(100000)
    })

    it('exposes the new action costs and tier helpers', () => {
        expect(ACTION_CREDIT_COSTS.llm_generation).toBe(80)
        expect(ACTION_CREDIT_COSTS.standard_image).toBe(40)
        expect(ACTION_CREDIT_COSTS.premium_image).toBe(250)
        expect(getImageGenerationCreditCost('standard')).toBe(40)
        expect(getImageGenerationCreditCost('premium')).toBe(250)
        expect(canAccessPremium(normalizeAccountTier('free'))).toBe(false)
        expect(canAccessPremium(normalizeAccountTier('paid'))).toBe(true)
    })
})

describe('estimatePipelineCost', () => {
    it('calculates a conservative estimate for standard image generation', () => {
        expect(estimatePipelineCost(10)).toBe(160 + 10 * 40)
    })

    it('calculates a conservative estimate for premium image generation', () => {
        expect(estimatePipelineCost(4, 'premium')).toBe(160 + 4 * 250)
    })
})

describe('checkCredits', () => {
    it('returns true when sufficient', async () => {
        mockUser.findUnique.mockResolvedValue({ credits: 300 })
        expect(await checkCredits('user1', 80)).toBe(true)
    })

    it('returns false when insufficient', async () => {
        mockUser.findUnique.mockResolvedValue({ credits: 39 })
        expect(await checkCredits('user1', 40)).toBe(false)
    })
})

describe('getCreditBalance', () => {
    it('returns the saved credit balance', async () => {
        mockUser.findUnique.mockResolvedValue({ credits: 240 })
        expect(await getCreditBalance('user1')).toBe(240)
    })
})

describe('deductCredits', () => {
    it('deducts credits and creates a transaction', async () => {
        mockUser.updateMany.mockResolvedValue({ count: 1 })
        mockUser.findUnique.mockResolvedValue({ credits: 260 })
        mockCreditTx.create.mockResolvedValue({})

        await deductCredits('user1', 40, 'standard_image_generation', 'ep1')

        expect(mockUser.updateMany).toHaveBeenCalledWith({
            where: { id: 'user1', credits: { gte: 40 } },
            data: { credits: { decrement: 40 } },
        })
        expect(mockCreditTx.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user1',
                amount: -40,
                reason: 'standard_image_generation',
                balance: 260,
                episodeId: 'ep1',
            }),
        })
    })

    it('uses optimistic concurrency', async () => {
        mockUser.updateMany.mockResolvedValue({ count: 1 })
        mockUser.findUnique.mockResolvedValue({ credits: 220 })
        mockCreditTx.create.mockResolvedValue({})

        await deductCredits('user1', 80, 'chapter_analysis')

        const call = mockUser.updateMany.mock.calls[0][0]
        expect(call.where.credits).toEqual({ gte: 80 })
    })

    it('throws InsufficientCreditsError when balance is too low', async () => {
        mockUser.updateMany.mockResolvedValue({ count: 0 })
        mockUser.findUnique.mockResolvedValue({ credits: 12 })

        await expect(deductCredits('user1', 80, 'chapter_analysis')).rejects.toThrow(InsufficientCreditsError)
    })
})

describe('grantCredits', () => {
    it('grants starter bonus credits and records the new balance', async () => {
        mockUser.update.mockResolvedValue({ credits: 300 })
        mockCreditTx.create.mockResolvedValue({})

        await grantCredits('user1', 300, 'starter_bonus')

        expect(mockUser.update).toHaveBeenCalledWith({
            where: { id: 'user1' },
            data: { credits: { increment: 300 } },
            select: { credits: true },
        })
        expect(mockCreditTx.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user1',
                amount: 300,
                reason: 'starter_bonus',
                balance: 300,
            }),
        })
    })

    it('upgrades the account on purchase when requested', async () => {
        mockUser.update.mockResolvedValue({ credits: 8300 })
        mockCreditTx.create.mockResolvedValue({})

        await grantCredits('user1', 8000, 'purchase', {
            providerTxId: 'polar_123',
            accountTier: 'paid',
            incrementLifetimePurchasedCredits: true,
        })

        expect(mockUser.update).toHaveBeenCalledWith({
            where: { id: 'user1' },
            data: {
                credits: { increment: 8000 },
                accountTier: 'paid',
                lifetimePurchasedCredits: { increment: 8000 },
            },
            select: { credits: true },
        })
    })
})

describe('refundCredits', () => {
    it('adds credits back and writes a refund transaction', async () => {
        mockUser.update.mockResolvedValue({ credits: 300 })
        mockCreditTx.create.mockResolvedValue({})

        await refundCredits('user1', 40, 'panel gen failed', 'ep1')

        expect(mockUser.update).toHaveBeenCalledWith({
            where: { id: 'user1' },
            data: { credits: { increment: 40 } },
            select: { credits: true },
        })
        expect(mockCreditTx.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user1',
                amount: 40,
                reason: 'refund',
                balance: 300,
                episodeId: 'ep1',
            }),
        })
    })
})

describe('InsufficientCreditsError', () => {
    it('keeps the required and available values on the error', () => {
        const err = new InsufficientCreditsError(250, 120)
        expect(err.required).toBe(250)
        expect(err.available).toBe(120)
        expect(err.message).toContain('250')
        expect(err.message).toContain('120')
    })
})
