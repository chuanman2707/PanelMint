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
        const backing = Buffer.alloc(16)
        backing.write('image', 4)
        mocks.read.mockResolvedValue({
            buffer: backing.subarray(4, 9),
            contentType: 'image/png',
        })

        const refs = await prepareWaveSpeedReferenceImages([
            { storageKey: 'characters/aoi.png', imageUrl: '/api/storage/characters/aoi.png' },
        ], providerConfig)

        expect(refs).toEqual(['https://wavespeed.media/ref.png'])
        const [url, init] = vi.mocked(fetch).mock.calls[0]
        expect(String(url)).toBe('https://api.wavespeed.ai/api/v3/media/upload/binary')
        expect(init?.method).toBe('POST')
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer ws-key' })
        expect(init?.body).toBeInstanceOf(FormData)
        const file = (init?.body as FormData).get('file') as File
        expect(file.name).toBe('aoi.png')
        expect(file.type).toBe('image/png')
        await expect(file.text()).resolves.toBe('image')
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

    it('passes through remote public URLs only', async () => {
        const refs = await prepareWaveSpeedReferenceImages([
            { imageUrl: 'https://cdn.example.com/ref.png' },
            { imageUrl: 'https://fcdn.example.com/ref.png' },
            { imageUrl: 'http://localhost:3000/api/storage/ref.png' },
            { imageUrl: 'http://localhost./api/storage/ref.png' },
            { imageUrl: 'http://0.0.0.0/ref.png' },
            { imageUrl: 'http://127.0.0.1/ref.png' },
            { imageUrl: 'http://10.0.0.5/ref.png' },
            { imageUrl: 'http://172.16.0.5/ref.png' },
            { imageUrl: 'http://192.168.1.5/ref.png' },
            { imageUrl: 'http://[fc00::1]/ref.png' },
            { imageUrl: 'http://[fd12::1]/ref.png' },
            { imageUrl: 'http://[fe80::1]/ref.png' },
            { imageUrl: 'http://[fe90::1]/ref.png' },
            { imageUrl: 'http://[fea0::1]/ref.png' },
            { imageUrl: 'http://[febf::1]/ref.png' },
            { imageUrl: 'http://[::ffff:127.0.0.1]/ref.png' },
        ], providerConfig)

        expect(refs).toEqual([
            'https://cdn.example.com/ref.png',
            'https://fcdn.example.com/ref.png',
        ])
        expect(fetch).not.toHaveBeenCalled()
        expect(mocks.read).not.toHaveBeenCalled()
    })
})
