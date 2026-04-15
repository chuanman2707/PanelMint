import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getArtStylePrompt: vi.fn(),
    acquire: vi.fn(),
    upload: vi.fn(),
    logUsage: vi.fn(),
}))

vi.mock('@/lib/ai/prompts', () => ({
    getArtStylePrompt: mocks.getArtStylePrompt,
    PROMPTS: {
        buildPageImagePrompt: `Style: {style}
Scene Context:
{scene_context}
Characters:
{character_canon}
Panel:
{enriched_panel_blocks}`,
    },
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
        mocks.getArtStylePrompt.mockReturnValue('manga')
        mocks.acquire.mockResolvedValue(undefined)
        mocks.upload.mockResolvedValue('/generated/panel.png')
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
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

        const imageAsset = await generatePanelImage({
            panelId: 'panel-2',
            description: 'Hero reveal',
            characters: ['Thanh Thu'],
            shotType: 'medium',
            location: 'forest',
            sourceExcerpt: 'Thanh Thu steps into the forest clearing.',
            mustKeep: ['No text', 'Single character only'],
            artStyle: 'webtoon',
            referenceImages: ['https://cdn.example.com/ref.png'],
            imageModelTier: 'premium',
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
            userId: 'user-1',
            episodeId: 'episode-1',
        })

        expect(imageAsset).toEqual({
            imageUrl: '/generated/panel.png',
            storageKey: 'user-1/episode-1/panel-2.png',
        })
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(mocks.upload).toHaveBeenCalled()
        expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-kontext-pro/multi')
        const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { prompt: string }
        expect(submitBody.prompt).toContain('Source excerpt: Thanh Thu steps into the forest clearing.')
        expect(submitBody.prompt).toContain('Visible characters: Thanh Thu')
        expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('https://cdn.example.com/ref.png')
    })

    it('throws ContentFilterError when wavespeed reports content filtering', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                code: 0,
                data: { id: 'task-filter' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { status: 'failed', error: 'content filter triggered' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(generatePanelImage({
            panelId: 'panel-1',
            description: 'Blocked prompt',
            characters: [],
            shotType: 'closeup',
            location: 'room',
            artStyle: 'manga',
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })).rejects.toBeInstanceOf(ContentFilterError)
    })

    it('keeps the no-text rule after trimming long prompts', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                code: 0,
                data: { id: 'task-2' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { status: 'completed', outputs: ['https://cdn.example.com/panel.png'] },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(Buffer.from('image-bytes'), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        await generatePanelImage({
            panelId: 'panel-3',
            description: 'Crowded city street',
            characters: ['Aoi'],
            shotType: 'wide',
            location: 'city',
            sourceExcerpt: 'Aoi walks through the city at sunset.',
            mustKeep: ['No speech bubbles', 'Keep sunset lighting'],
            artStyle: 'webtoon',
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { prompt: string }
        expect(submitBody.prompt).toContain('Generate ONLY the visual scene.')
        expect(submitBody.prompt.endsWith('The image must contain ONLY visual elements.')).toBe(true)
        expect(submitBody.prompt.length).toBeLessThanOrEqual(1500)
    })

    it('keeps the deterministic image prompt under the provider limit', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                code: 0,
                data: { id: 'task-3' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { status: 'completed', outputs: ['https://cdn.example.com/panel.png'] },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(Buffer.from('image-bytes'), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        const longText = 'A'.repeat(6_000)
        const longCanon = ['Hero: ' + 'B'.repeat(2_500), 'Mentor: ' + 'C'.repeat(2_500)].join('\n\n')
        const longMustKeep = ['D'.repeat(1_500), 'E'.repeat(1_500), 'F'.repeat(1_500)]

        await generatePanelImage({
            panelId: 'panel-4',
            description: longText,
            characters: ['Hero', 'Mentor'],
            shotType: 'wide',
            location: 'ancient temple',
            sourceExcerpt: longText,
            mustKeep: longMustKeep,
            artStyle: 'webtoon',
            characterCanon: longCanon,
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { prompt: string }
        expect(submitBody.prompt.length).toBeLessThanOrEqual(1500)
        expect(submitBody.prompt).toContain('Source excerpt:')
        expect(submitBody.prompt).toContain('Must keep:')
        expect(submitBody.prompt).toContain('Generate ONLY the visual scene.')
    })

    it('uses the standard tier model instead of seedream and skips multi-ref payloads', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                code: 0,
                data: { id: 'task-standard' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { status: 'completed', outputs: ['https://cdn.example.com/standard.png'] },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(Buffer.from('image-bytes'), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        await generatePanelImage({
            panelId: 'panel-standard',
            description: 'A lone swordsman waiting under lantern light.',
            characters: ['Linh'],
            shotType: 'medium',
            location: 'market gate',
            artStyle: 'manga',
            imageModelTier: 'standard',
            referenceImages: ['https://cdn.example.com/ref.png'],
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo')
        const submitBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { images?: string[] }
        expect(submitBody.images).toBeUndefined()
    })

    it('keeps polling long-running wavespeed image jobs past the old 120s cap', async () => {
        vi.useFakeTimers()

        let pollCount = 0
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === 'https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo') {
                return new Response(JSON.stringify({
                    code: 0,
                    data: { id: 'task-long-image' },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            if (url === 'https://api.wavespeed.ai/api/v3/predictions/task-long-image') {
                pollCount += 1

                if (pollCount < 25) {
                    return new Response(JSON.stringify({
                        data: { status: 'processing' },
                    }), { status: 200, headers: { 'content-type': 'application/json' } })
                }

                return new Response(JSON.stringify({
                    data: {
                        status: 'completed',
                        outputs: ['https://cdn.example.com/long-panel.png'],
                    },
                }), { status: 200, headers: { 'content-type': 'application/json' } })
            }

            return new Response(Buffer.from('image-bytes'), { status: 200 })
        })
        vi.stubGlobal('fetch', fetchMock)

        const imagePromise = generatePanelImage({
            panelId: 'panel-long',
            description: 'The hero reaches the mountain gate after a long climb.',
            characters: ['Hero'],
            shotType: 'wide',
            location: 'mountain gate',
            artStyle: 'webtoon',
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        await vi.runAllTimersAsync()

        await expect(imagePromise).resolves.toEqual({
            imageUrl: '/generated/panel.png',
            storageKey: 'panel-long.png',
        })
        expect(pollCount).toBeGreaterThanOrEqual(25)
        expect(fetchMock.mock.calls.filter(([url]) => String(url) === 'https://api.wavespeed.ai/api/v3/wavespeed-ai/z-image/turbo')).toHaveLength(1)
    })

    it('does not fall back to seedream when a premium request retries', async () => {
        const fetchMock = vi.fn()
            .mockRejectedValueOnce(new Error('temporary upstream failure'))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                code: 0,
                data: { id: 'task-premium-retry' },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                data: { status: 'completed', outputs: ['https://cdn.example.com/premium-retry.png'] },
            }), { status: 200, headers: { 'content-type': 'application/json' } }))
            .mockResolvedValueOnce(new Response(Buffer.from('image-bytes'), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        await generatePanelImage({
            panelId: 'panel-premium-retry',
            description: 'A cloaked figure turning back toward the moon.',
            characters: ['Khanh'],
            shotType: 'wide',
            location: 'cliff edge',
            artStyle: 'webtoon',
            imageModelTier: 'premium',
            referenceImages: ['https://cdn.example.com/ref.png'],
            providerConfig: {
                provider: 'wavespeed',
                apiKey: 'wavespeed-key',
                llmModel: 'bytedance-seed/seed-1.6-flash',
                imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
                imageFallbackModel: 'bytedance/seedream-v4',
                baseUrl: 'https://api.wavespeed.ai/api/v3',
            },
        })

        expect(fetchMock.mock.calls.filter(([url]) => String(url) === 'https://api.wavespeed.ai/api/v3/wavespeed-ai/flux-kontext-pro/multi').length).toBeGreaterThanOrEqual(2)
        expect(fetchMock.mock.calls.some(([url]) => String(url) === 'https://api.wavespeed.ai/api/v3/bytedance/seedream-v4')).toBe(false)
    })
})
