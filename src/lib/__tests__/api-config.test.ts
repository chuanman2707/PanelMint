import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        user: {
            findUnique: vi.fn(),
        },
    },
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import {
    getProviderConfig,
    WAVESPEED_PROVIDER_SETUP_ERROR,
} from '@/lib/api-config'

describe('getProviderConfig', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
        vi.clearAllMocks()
    })

    it('loads WaveSpeed config from environment variables only', async () => {
        vi.stubEnv('WAVESPEED_API_KEY', '  ws-env-key  ')
        vi.stubEnv('LLM_MODEL', ' custom-llm ')
        vi.stubEnv('IMAGE_MODEL', ' custom-image ')
        vi.stubEnv('IMAGE_FALLBACK_MODEL', '')

        await expect(getProviderConfig('user-1')).resolves.toEqual({
            provider: 'wavespeed',
            apiKey: 'ws-env-key',
            llmModel: 'custom-llm',
            imageModel: 'custom-image',
            imageFallbackModel: 'bytedance/seedream-v4',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })

        expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('throws a local setup error when WAVESPEED_API_KEY is missing', async () => {
        vi.stubEnv('WAVESPEED_API_KEY', '')

        await expect(getProviderConfig('user-1')).rejects.toThrow(WAVESPEED_PROVIDER_SETUP_ERROR)
        expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('uses default models when optional model environment variables are blank', async () => {
        vi.stubEnv('WAVESPEED_API_KEY', 'ws-env-key')
        vi.stubEnv('LLM_MODEL', '   ')
        vi.stubEnv('IMAGE_MODEL', '   ')
        vi.stubEnv('IMAGE_FALLBACK_MODEL', '   ')

        await expect(getProviderConfig()).resolves.toMatchObject({
            llmModel: 'bytedance-seed/seed-1.6-flash',
            imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
            imageFallbackModel: 'bytedance/seedream-v4',
        })

        expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled()
    })
})
