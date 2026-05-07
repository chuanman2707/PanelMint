/**
 * WaveSpeed provider configuration for the local OSS runtime.
 *
 * WAVESPEED_API_KEY in .env is the only runtime API key source.
 */

export type ApiProvider = 'wavespeed'

export interface ProviderConfig {
    provider: ApiProvider
    apiKey: string
    llmModel: string
    imageModel: string
    baseUrl: string
    userId?: string
}

export const WAVESPEED_PROVIDER_SETUP_ERROR =
    'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.'

const WAVESPEED_BASE_URL = 'https://api.wavespeed.ai/api/v3'
const DEFAULT_LLM_MODEL = 'bytedance-seed/seed-1.6-flash'
const DEFAULT_IMAGE_MODEL = 'wavespeed-ai/flux-kontext-pro/multi'

function readEnvValue(key: string): string | null {
    const value = process.env[key]?.trim()
    return value || null
}

export async function getProviderConfig(userId?: string): Promise<ProviderConfig> {
    const apiKey = readEnvValue('WAVESPEED_API_KEY')
    if (!apiKey) {
        throw new Error(WAVESPEED_PROVIDER_SETUP_ERROR)
    }

    return {
        provider: 'wavespeed',
        apiKey,
        llmModel: readEnvValue('LLM_MODEL') ?? DEFAULT_LLM_MODEL,
        imageModel: readEnvValue('IMAGE_MODEL') ?? DEFAULT_IMAGE_MODEL,
        baseUrl: WAVESPEED_BASE_URL,
        ...(userId ? { userId } : {}),
    }
}

export function getProviderInfo(provider: ApiProvider) {
    const info = {
        wavespeed: {
            name: 'WaveSpeed AI',
            description: 'Unified provider for text generation and multi-reference image generation.',
            llmModel: 'Seed 1.6 Flash',
            imageModel: 'FLUX Kontext Pro Multi',
            configuration: 'Configured with WAVESPEED_API_KEY in .env',
            risk: 'none' as const,
            setupUrl: 'https://wavespeed.ai/accesskey',
        },
    }
    return info[provider]
}
