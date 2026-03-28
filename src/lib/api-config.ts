/**
 * API Config — Multi-Provider BYOK
 *
 * Supports: OpenRouter + NVIDIA NIM (both OpenAI-compatible)
 * Reads user's provider + encrypted key from DB, returns full config.
 */

import { prisma } from './prisma'
import { decrypt, isEncrypted } from './crypto'

export type ApiProvider = 'openrouter' | 'nvidia' | 'wavespeed'

export interface ProviderConfig {
    provider: ApiProvider
    apiKey: string
    /** Separate API key for LLM calls (wavespeed uses OpenRouter for LLM) */
    llmApiKey?: string
    llmModel: string
    imageModel: string
    baseUrl: string
    /** wavespeed.ai fallback image model (e.g. seedream-v4) */
    imageFallbackModel?: string
    userId?: string
}

const PROVIDER_DEFAULTS: Record<ApiProvider, Omit<ProviderConfig, 'apiKey'>> = {
    openrouter: {
        provider: 'openrouter',
        llmModel: 'google/gemini-2.5-flash',
        imageModel: 'bytedance-seed/seedream-4.5',
        baseUrl: 'https://openrouter.ai/api/v1',
    },
    nvidia: {
        provider: 'nvidia',
        llmModel: 'nvidia/nemotron-3-super-120b-a12b',
        imageModel: 'black-forest-labs/flux.1-dev',
        baseUrl: 'https://integrate.api.nvidia.com/v1',
    },
    wavespeed: {
        provider: 'wavespeed',
        llmModel: 'google/gemini-2.5-flash', // LLM still via OpenRouter
        imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
        imageFallbackModel: 'bytedance/seedream-v4',
        baseUrl: 'https://api.wavespeed.ai/api/v3',
    },
}

/**
 * Get full provider config for a user (provider + decrypted key + models).
 *
 * wavespeed provider uses platform-managed keys:
 * - WAVESPEED_API_KEY env var for image gen
 * - OPENROUTER_API_KEY env var for LLM calls (or Gemini fallback)
 * User doesn't need their own API key — they pay with credits.
 */
export async function getProviderConfig(userId: string): Promise<ProviderConfig> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apiKey: true, apiProvider: true },
    })

    const provider = (user?.apiProvider as ApiProvider) ?? 'wavespeed'
    const defaults = PROVIDER_DEFAULTS[provider]
    if (!defaults) {
        throw new Error(`Unknown provider: ${provider}`)
    }

    // Platform-managed keys for wavespeed (pay-as-you-go credits model)
    if (provider === 'wavespeed') {
        const wavespeedKey = process.env.WAVESPEED_API_KEY
        if (!wavespeedKey) {
            throw new Error('WAVESPEED_API_KEY not configured on platform.')
        }
        // For LLM, wavespeed config carries the OpenRouter key
        // (llm.ts handles routing to OpenRouter URL automatically)
        const llmKey = process.env.OPENROUTER_API_KEY || wavespeedKey
        return { ...defaults, apiKey: wavespeedKey, llmApiKey: llmKey, userId }
    }

    // BYOK path for openrouter/nvidia
    const raw = user?.apiKey
    if (!raw) {
        throw new Error('API_KEY_MISSING: Please configure your API key in Settings.')
    }

    let apiKey: string
    if (isEncrypted(raw)) {
        apiKey = decrypt(raw)
    } else {
        apiKey = raw // Legacy plaintext — backward compat
    }

    return { ...defaults, apiKey, userId }
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
        openrouter: {
            name: 'OpenRouter',
            description: 'Pay-per-use. Best quality & reliability.',
            llmModel: 'Gemini 2.5 Flash',
            imageModel: 'SeedReam 4.5',
            pricing: '~$0.003/image',
            risk: 'none' as const,
            setupUrl: 'https://openrouter.ai/keys',
        },
        nvidia: {
            name: 'NVIDIA NIM',
            description: 'FREE but experimental. Rate-limited.',
            llmModel: 'Nemotron 3 Super 120B',
            imageModel: 'FLUX.1 Dev',
            pricing: 'Free (rate-limited)',
            risk: 'Account may be suspended if abused.' as const,
            setupUrl: 'https://build.nvidia.com',
        },
        wavespeed: {
            name: 'WaveSpeed AI',
            description: 'Pay-per-use. FLUX Kontext multi-ref for character consistency.',
            llmModel: 'Gemini 2.5 Flash (via OpenRouter)',
            imageModel: 'FLUX Kontext Pro Multi',
            pricing: '~$0.006-0.04/image',
            risk: 'none' as const,
            setupUrl: 'https://wavespeed.ai/accesskey',
        },
    }
    return info[provider]
}
