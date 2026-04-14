/**
 * API Config
 *
 * The production contract is WaveSpeed-only for both LLM and image generation.
 * Users may optionally store their own WaveSpeed key, otherwise the platform
 * key from WAVESPEED_API_KEY is used.
 */

import { prisma } from './prisma'
import { decrypt, isEncrypted } from './crypto'

export type ApiProvider = 'wavespeed'

export interface ProviderConfig {
    provider: ApiProvider
    apiKey: string
    llmModel: string
    imageModel: string
    baseUrl: string
    /** wavespeed.ai fallback image model when multi-ref generation is unavailable */
    imageFallbackModel?: string
    userId?: string
}

const PROVIDER_DEFAULTS: Record<ApiProvider, Omit<ProviderConfig, 'apiKey'>> = {
    wavespeed: {
        provider: 'wavespeed',
        llmModel: 'bytedance-seed/seed-1.6-flash',
        imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
        baseUrl: 'https://api.wavespeed.ai/api/v3',
    },
}

/**
 * Get the effective WaveSpeed config for a user.
 *
 * Preference order:
 * 1. User-provided WaveSpeed key saved in the DB
 * 2. Platform-managed WAVESPEED_API_KEY env var
 */
export async function getProviderConfig(userId: string): Promise<ProviderConfig> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apiKey: true, apiProvider: true },
    })

    const provider: ApiProvider = 'wavespeed'
    const defaults = PROVIDER_DEFAULTS[provider]
    const raw = user?.apiKey
    if (raw) {
        const apiKey = isEncrypted(raw) ? decrypt(raw) : raw
        return { ...defaults, apiKey, userId }
    }

    const platformKey = process.env.WAVESPEED_API_KEY?.trim()
    if (!platformKey) {
        throw new Error('WAVESPEED_API_KEY not configured on platform.')
    }
    return { ...defaults, apiKey: platformKey, userId }
}

/**
 * Quick check: does user have an API key? (no decryption)
 */
export async function hasApiKey(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apiKey: true },
    })
    return !!user?.apiKey
}

/**
 * Get provider info for display (pricing, setup URL, risk level).
 */
export function getProviderInfo(provider: ApiProvider) {
    const info = {
        wavespeed: {
            name: 'WaveSpeed AI',
            description: 'Unified provider for text generation and multi-reference image generation.',
            llmModel: 'Seed 1.6 Flash',
            imageModel: 'FLUX Kontext Pro Multi',
            pricing: 'Project-configured',
            risk: 'none' as const,
            setupUrl: 'https://wavespeed.ai/accesskey',
        },
    }
    return info[provider]
}
