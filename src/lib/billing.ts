/**
 * Credit system — pay-as-you-go billing.
 * Uses optimistic concurrency (updateMany + gte) instead of SELECT FOR UPDATE.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
    ACCOUNT_TIERS,
    ACTION_CREDIT_COSTS,
    canAccessPremium,
    CREDIT_PACKAGES,
    FREE_SIGNUP_CREDITS,
    getImageGenerationCreditCost,
    getImageGenerationReason,
    normalizeAccountTier,
    normalizeImageModelTier,
    type AccountTier,
    type ImageModelTier,
} from '@/lib/credit-catalog'

export {
    ACCOUNT_TIERS,
    ACTION_CREDIT_COSTS,
    canAccessPremium,
    CREDIT_PACKAGES,
    FREE_SIGNUP_CREDITS,
    getImageGenerationCreditCost,
    getImageGenerationReason,
    normalizeAccountTier,
    normalizeImageModelTier,
}
export type { AccountTier, ImageModelTier }

export type CreditReason =
    | 'purchase'
    | 'chapter_analysis'
    | 'storyboard_generation'
    | 'character_sheet_generation'
    | 'standard_image_generation'
    | 'premium_image_generation'
    | 'refund'
    | 'starter_bonus'

export class InsufficientCreditsError extends Error {
    public readonly required: number
    public readonly available: number

    constructor(required: number, available: number) {
        super(`Insufficient credits: need ${required}, have ${available}. Purchase more credits to continue.`)
        this.name = 'InsufficientCreditsError'
        this.required = required
        this.available = available
    }
}

function isUniqueConstraintConflict(err: unknown): err is Prisma.PrismaClientKnownRequestError {
    return Boolean(
        err
        && typeof err === 'object'
        && 'code' in err
        && (err as { code?: string }).code === 'P2002',
    )
}

/**
 * Check if user has enough credits.
 */
export async function checkCredits(userId: string, required: number): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
    })
    return (user?.credits ?? 0) >= required
}

/**
 * Get current credit balance.
 */
export async function getCreditBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true },
    })
    return user?.credits ?? 0
}

/**
 * Get current account tier.
 */
export async function getAccountTier(userId: string): Promise<AccountTier> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountTier: true },
    })
    return normalizeAccountTier(user?.accountTier)
}

/**
 * Deduct credits using optimistic concurrency.
 * Safe against race conditions without SELECT FOR UPDATE.
 */
export async function deductCredits(
    userId: string,
    amount: number,
    reason: CreditReason,
    episodeId?: string,
    options?: {
        operationKey?: string | null
    },
): Promise<void> {
    try {
        await prisma.$transaction(async (tx) => {
            const result = await tx.user.updateMany({
                where: { id: userId, credits: { gte: amount } },
                data: { credits: { decrement: amount } },
            })

            if (result.count === 0) {
                if (options?.operationKey) {
                    const existing = await tx.creditTransaction.findUnique({
                        where: { operationKey: options.operationKey },
                        select: { id: true },
                    })

                    if (existing) {
                        return
                    }
                }

                const balance = await tx.user.findUnique({
                    where: { id: userId },
                    select: { credits: true },
                })
                throw new InsufficientCreditsError(amount, balance?.credits ?? 0)
            }

            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { credits: true },
            })

            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount: -amount,
                    reason,
                    balance: user?.credits ?? 0,
                    episodeId: episodeId ?? null,
                    operationKey: options?.operationKey ?? null,
                },
            })
        })
    } catch (err) {
        if (options?.operationKey && isUniqueConstraintConflict(err)) {
            return
        }
        throw err
    }
}

/**
 * Grant credits and create a transaction record.
 */
export async function grantCredits(
    userId: string,
    amount: number,
    reason: Extract<CreditReason, 'purchase' | 'starter_bonus'>,
    options?: {
        episodeId?: string
        providerTxId?: string | null
        operationKey?: string | null
        accountTier?: AccountTier
        incrementLifetimePurchasedCredits?: boolean
    },
): Promise<void> {
    const data: {
        credits: { increment: number }
        accountTier?: AccountTier
        lifetimePurchasedCredits?: { increment: number }
    } = {
        credits: { increment: amount },
    }

    if (options?.accountTier) {
        data.accountTier = options.accountTier
    }

    if (options?.incrementLifetimePurchasedCredits) {
        data.lifetimePurchasedCredits = { increment: amount }
    }

    try {
        await prisma.$transaction(async (tx) => {
            if (options?.providerTxId) {
                const existingByProvider = await tx.creditTransaction.findUnique({
                    where: { providerTxId: options.providerTxId },
                    select: { id: true },
                })

                if (existingByProvider) {
                    return
                }
            }

            if (options?.operationKey) {
                const existingByOperation = await tx.creditTransaction.findUnique({
                    where: { operationKey: options.operationKey },
                    select: { id: true },
                })

                if (existingByOperation) {
                    return
                }
            }

            const user = await tx.user.update({
                where: { id: userId },
                data,
                select: { credits: true },
            })

            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount,
                    reason,
                    balance: user.credits,
                    episodeId: options?.episodeId ?? null,
                    providerTxId: options?.providerTxId ?? null,
                    operationKey: options?.operationKey ?? null,
                },
            })
        })
    } catch (err) {
        if ((options?.providerTxId || options?.operationKey) && isUniqueConstraintConflict(err)) {
            return
        }
        throw err
    }
}

/**
 * Refund credits (e.g. when panel generation fails).
 */
export async function refundCredits(
    userId: string,
    amount: number,
    reason: string,
    episodeId?: string,
    options?: {
        operationKey?: string | null
    },
): Promise<void> {
    try {
        await prisma.$transaction(async (tx) => {
            if (options?.operationKey) {
                const existing = await tx.creditTransaction.findUnique({
                    where: { operationKey: options.operationKey },
                    select: { id: true },
                })

                if (existing) {
                    return
                }
            }

            const user = await tx.user.update({
                where: { id: userId },
                data: { credits: { increment: amount } },
                select: { credits: true },
            })

            await tx.creditTransaction.create({
                data: {
                    userId,
                    amount,
                    reason: 'refund',
                    balance: user.credits,
                    episodeId: episodeId ?? null,
                    operationKey: options?.operationKey ?? null,
                },
            })
        })
    } catch (err) {
        if (options?.operationKey && isUniqueConstraintConflict(err)) {
            return
        }
        throw err
    }

    console.log(`[Billing] Refunded ${amount} credits to user ${userId}: ${reason}`)
}

/**
 * Estimate total credits needed for a pipeline run.
 * This is intentionally conservative: 2 LLM steps + N images.
 */
export function estimatePipelineCost(panelCount: number, imageTier: ImageModelTier = 'standard'): number {
    return (
        ACTION_CREDIT_COSTS.llm_generation * 2
        + (panelCount * getImageGenerationCreditCost(imageTier))
    )
}
