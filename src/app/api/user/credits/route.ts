import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { ACTION_CREDIT_COSTS, CREDIT_PACKAGES } from '@/lib/billing'

function describeReason(reason: string): string {
    switch (reason) {
        case 'purchase':
            return 'Credit purchase'
        case 'starter_bonus':
            return 'Welcome bonus'
        case 'chapter_analysis':
            return 'Analyze chapter'
        case 'storyboard_generation':
            return 'Storyboard generation'
        case 'character_sheet_generation':
            return 'Character sheet'
        case 'standard_image_generation':
            return 'Standard image'
        case 'premium_image_generation':
            return 'Premium image'
        case 'refund':
            return 'Refund'
        default:
            return reason.replace(/_/g, ' ')
    }
}

export const GET = apiHandler(async () => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const [user, transactions] = await Promise.all([
        prisma.user.findUnique({
            where: { id: auth.user.id },
            select: {
                credits: true,
                accountTier: true,
                lifetimePurchasedCredits: true,
            },
        }),
        prisma.creditTransaction.findMany({
            where: { userId: auth.user.id },
            orderBy: { createdAt: 'desc' },
            take: 30,
            select: {
                id: true,
                amount: true,
                reason: true,
                balance: true,
                createdAt: true,
                providerTxId: true,
            },
        }),
    ])

    return NextResponse.json({
        balance: user?.credits ?? 0,
        accountTier: user?.accountTier ?? 'free',
        lifetimePurchasedCredits: user?.lifetimePurchasedCredits ?? 0,
        priceBook: {
            llmGeneration: ACTION_CREDIT_COSTS.llm_generation,
            standardImage: ACTION_CREDIT_COSTS.standard_image,
            premiumImage: ACTION_CREDIT_COSTS.premium_image,
        },
        packages: Object.values(CREDIT_PACKAGES),
        transactions: transactions.map((transaction) => ({
            id: transaction.id,
            amount: transaction.amount,
            balance: transaction.balance,
            reason: transaction.reason,
            label: describeReason(transaction.reason),
            createdAt: transaction.createdAt,
            providerTxId: transaction.providerTxId,
            direction: transaction.amount >= 0 ? 'credit' : 'debit',
        })),
    })
})
