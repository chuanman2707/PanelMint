import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    callLLM: vi.fn(),
    getArtStylePrompt: vi.fn(),
    acquire: vi.fn(),
    upload: vi.fn(),
    logUsage: vi.fn(),
}))

vi.mock('@/lib/ai/llm', () => ({
    callLLM: mocks.callLLM,
}))

vi.mock('@/lib/ai/prompts', () => ({
    getArtStylePrompt: mocks.getArtStylePrompt,
}))

vi.mock('@/lib/utils/rate-limiter', () => ({
    imageRateLimiter: {
        acquire: mocks.acquire,
    },
}))

vi.mock('@/lib/storage', () => ({
    getStorage: () => ({
        upload: mocks.upload,
    }),
    buildStorageKey: (userId: string, episodeId: string, panelId: string) =>
        `${userId}/${episodeId}/${panelId}.png`,
}))

vi.mock('@/lib/usage', () => ({
    logUsage: mocks.logUsage,
}))

import { ContentFilterError, generatePanelImage } from '@/lib/pipeline/image-gen'

describe('generatePanelImage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.callLLM.mockResolvedValue('cinematic frame')
        mocks.getArtStylePrompt.mockReturnValue('manga')
        mocks.acquire.mockResolvedValue(undefined)
        mocks.upload.mockResolvedValue('/generated/panel.png')
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('generates an image through the legacy provider path and stores it', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                choices: [{ message: { images: [{ image_url: { url: 'https://cdn.example.com/panel.png' } }] } }],
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(Buffer.from('image-bytes'), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        const imageUrl = await generatePanelImage({
            panelId: 'panel-1',
            description: 'A duel at sunset',
            characters: ['Anh Minh'],
            shotType: 'wide',
            location: 'bridge',
            artStyle: 'manga',
            providerConfig: {
                provider: 'openrouter',
                apiKey: 'api-key',
                llmModel: 'gemini',
                imageModel: 'seedream',
                baseUrl: 'https://openrouter.ai/api/v1',
            },
            userId: 'user-1',
            episodeId: 'episode-1',
        })

        expect(imageUrl).toBe('/generated/panel.png')
        expect(mocks.acquire).toHaveBeenCalled()
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(mocks.upload).toHaveBeenCalled()
        expect(mocks.logUsage).toHaveBeenCalled()
    })

    it('throws ContentFilterError when the legacy provider reports content filtering', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({
                choices: [{ finish_reason: 'content_filter', message: {} }],
            }), { status: 200, headers: { 'content-type': 'application/json' } }),
        )
        vi.stubGlobal('fetch', fetchMock)

        await expect(generatePanelImage({
            panelId: 'panel-1',
            description: 'Blocked prompt',
            characters: [],
            shotType: 'closeup',
            location: 'room',
            artStyle: 'manga',
            providerConfig: {
                provider: 'openrouter',
                apiKey: 'api-key',
                llmModel: 'gemini',
                imageModel: 'seedream',
                baseUrl: 'https://openrouter.ai/api/v1',
            },
        })).rejects.toBeInstanceOf(ContentFilterError)
    })

    it('generates an image through the wavespeed path', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                code: 0,
                data: { id: 'task-1' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { status: 'completed', outputs: ['https://cdn.example.com/panel.png'] },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(Buffer.from('image-bytes'), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        const imageUrl = await generatePanelImage({
            panelId: 'panel-2',
            description: 'Hero reveal',
            characters: ['Thanh Thu'],
            shotType: 'medium',
            location: 'forest',
            artStyle: 'webtoon',
            referenceImages: ['https://cdn.example.com/ref.png'],
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmApiKey: 'openrouter-key',
                llmModel: 'gemini',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
            userId: 'user-1',
            episodeId: 'episode-1',
        })

        expect(imageUrl).toBe('/generated/panel.png')
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(mocks.upload).toHaveBeenCalled()
    })
})
