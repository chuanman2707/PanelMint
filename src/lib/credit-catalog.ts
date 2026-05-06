export const ACCOUNT_TIERS = ['free', 'paid'] as const
export type AccountTier = (typeof ACCOUNT_TIERS)[number]

import { getStoryboardPanelBudget } from '@/lib/prompt-budget'

export const IMAGE_MODEL_TIERS = ['standard', 'premium'] as const
export type ImageModelTier = (typeof IMAGE_MODEL_TIERS)[number]

export const STARTER_CREDITS = 300

export const CREDIT_PACKAGES = {
    starter: {
        id: 'starter',
        name: 'Starter',
        priceUsd: 4.99,
        credits: 8000,
        savingsLabel: null,
    },
    creator: {
        id: 'creator',
        name: 'Creator',
        priceUsd: 14.99,
        credits: 27600,
        savingsLabel: 'Save 15%',
    },
    publisher: {
        id: 'publisher',
        name: 'Publisher',
        priceUsd: 49.99,
        credits: 100000,
        savingsLabel: 'Save 25% (Best Value)',
    },
} as const

export const ACTION_CREDIT_COSTS = {
    llm_generation: 80,
    standard_image: 40,
    premium_image: 250,
} as const

export function normalizeAccountTier(value?: string | null): AccountTier {
    return value === 'paid' ? 'paid' : 'free'
}

export function normalizeImageModelTier(value?: string | null): ImageModelTier {
    return value === 'premium' ? 'premium' : 'standard'
}

export function canAccessPremium(accountTier: AccountTier): boolean {
    return accountTier === 'paid'
}

export function getImageGenerationCreditCost(imageTier: ImageModelTier): number {
    return imageTier === 'premium'
        ? ACTION_CREDIT_COSTS.premium_image
        : ACTION_CREDIT_COSTS.standard_image
}

export function getImageGenerationReason(imageTier: ImageModelTier) {
    return imageTier === 'premium'
        ? 'premium_image_generation'
        : 'standard_image_generation'
}

export function estimateGenerationCredits(
    pageCount: number,
    imageTier: ImageModelTier,
    manuscriptChars = 0,
): number {
    const { targetTotalPanels } = getStoryboardPanelBudget({
        manuscriptChars,
        pageCount,
    })

    return (ACTION_CREDIT_COSTS.llm_generation * 2)
        + (targetTotalPanels * getImageGenerationCreditCost(imageTier))
}
