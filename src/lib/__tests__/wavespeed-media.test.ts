import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    read: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
    getStorage: () => ({ read: mocks.read }),
}))

import { prepareWaveSpeedReferenceImages } from '@/lib/pipeline/wavespeed-media'

describe('prepareWaveSpeedReferenceImages', () => {
    const providerConfig = {
        provider: 'wavespeed' as const,
        apiKey: 'ws-key',
        llmModel: 'llm',
        imageModel: 'image',
        baseUrl: 'https://api.wavespeed.ai/api/v3',
    }

    beforeEach(() => {
        vi.clearAllMocks()
        mocks.read.mockResolvedValue({
            buffer: Buffer.from('image'),
            contentType: 'image/png',
        })
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
            data: { download_url: 'https://wavespeed.media/ref.png' },
        }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
        })))
    })

    it('uploads local storage references to WaveSpeed media upload', async () => {
        const refs = await prepareWaveSpeedReferenceImages([
            { storageKey: 'characters/aoi.png', imageUrl: '/api/storage/characters/aoi.png' },
        ], providerConfig)

        expect(refs).toEqual(['https://wavespeed.media/ref.png'])
        const [url, init] = vi.mocked(fetch).mock.calls[0]
        expect(String(url)).toBe('https://api.wavespeed.ai/api/v3/media/upload/binary')
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer ws-key' })
        expect(init?.body).toBeInstanceOf(FormData)
    })

    it('does not pass local browser URLs to WaveSpeed', async () => {
        const refs = await prepareWaveSpeedReferenceImages([
            { imageUrl: '/api/storage/characters/aoi.png' },
            { imageUrl: '/generated/aoi.png' },
            { imageUrl: '/Users/binhan/aoi.png' },
        ], providerConfig)

        expect(refs).toEqual([])
        expect(fetch).not.toHaveBeenCalled()
        expect(mocks.read).not.toHaveBeenCalled()
    })
})
