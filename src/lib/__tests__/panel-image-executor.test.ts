import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
    class MockContentFilterError extends Error {
        constructor(message: string) {
            super(message)
            this.name = 'ContentFilterError'
        }
    }

    class MockServiceError extends Error {
        constructor(message: string) {
            super(message)
            this.name = 'ServiceError'
        }
    }

    return {
        deductCredits: vi.fn(),
        refundCredits: vi.fn(),
        recordPipelineEvent: vi.fn(),
        prisma: {
            episode: {
                findUnique: vi.fn(),
            },
            panel: {
                findUnique: vi.fn(),
                update: vi.fn(),
                updateMany: vi.fn(),
            },
        },
        buildCharacterCanon: vi.fn(),
        generatePanelImage: vi.fn(),
        collectPanelReferenceImages: vi.fn(),
        ContentFilterError: MockContentFilterError,
        ServiceError: MockServiceError,
    }
})

vi.mock('@/lib/billing', () => ({
    deductCredits: mocks.deductCredits,
    refundCredits: mocks.refundCredits,
    getImageGenerationCreditCost: (tier: 'standard' | 'premium') => tier === 'premium' ? 250 : 40,
    getImageGenerationReason: (tier: 'standard' | 'premium') =>
        tier === 'premium' ? 'premium_image_generation' : 'standard_image_generation',
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/pipeline/character-canon', () => ({
    buildCharacterCanon: mocks.buildCharacterCanon,
}))

vi.mock('@/lib/pipeline/image-gen', () => ({
    generatePanelImage: mocks.generatePanelImage,
    ContentFilterError: mocks.ContentFilterError,
    ServiceError: mocks.ServiceError,
}))

vi.mock('@/lib/pipeline/reference-images', () => ({
    collectPanelReferenceImages: mocks.collectPanelReferenceImages,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import { executePanelImageGeneration } from '@/lib/pipeline/panel-image-executor'

const providerConfig = {
    provider: 'wavespeed' as const,
    apiKey: 'api-key',
    llmModel: 'bytedance-seed/seed-1.6-flash',
    imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
    imageFallbackModel: 'bytedance/seedream-v4',
    baseUrl: 'https://api.wavespeed.ai/api/v3',
}

const panel = {
    id: 'panel-1',
    approvedPrompt: 'hero shot',
    description: 'hero shot',
    shotType: 'wide',
    characters: JSON.stringify(['Aoi']),
    location: 'roof',
    mood: 'tense',
    lighting: 'sunset',
}

const dbCharacters = [{
    id: 'char-1',
    name: 'Aoi',
    description: 'Lead hero',
    identityJson: null,
    imageUrl: '/chars/aoi.png',
    appearances: [],
}]

describe('executePanelImageGeneration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'imaging' })
        mocks.prisma.panel.findUnique.mockResolvedValue({ generationAttempt: 1 })
        mocks.prisma.panel.update.mockResolvedValue({})
        mocks.prisma.panel.updateMany.mockResolvedValue({ count: 1 })
        mocks.deductCredits.mockResolvedValue(true)
        mocks.refundCredits.mockResolvedValue(undefined)
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
        mocks.collectPanelReferenceImages.mockResolvedValue(['/refs/aoi.png'])
        mocks.buildCharacterCanon.mockReturnValue('Aoi: Lead hero')
    })

    it('marks the panel done after a successful generation', async () => {
        mocks.generatePanelImage.mockResolvedValue({
            imageUrl: '/generated/panel-1.png',
            storageKey: 'user-1/episode-1/panel-1.png',
        })

        const result = await executePanelImageGeneration({
            panel,
            dbCharacters,
            providerConfig,
            artStyle: 'webtoon',
            imageModelTier: 'standard',
            userId: 'user-1',
            episodeId: 'episode-1',
        })

        expect(result).toBe('done')
        expect(mocks.deductCredits).toHaveBeenCalledWith(
            'user-1',
            40,
            'standard_image_generation',
            'episode-1',
            { operationKey: 'image:panel-1:1' },
        )
        expect(mocks.prisma.panel.updateMany).toHaveBeenCalledWith({
            where: {
                id: 'panel-1',
                imageUrl: null,
                status: { in: ['pending', 'error', 'queued', 'generating'] },
            },
            data: {
                status: 'generating',
                generationAttempt: { increment: 1 },
            },
        })
        expect(mocks.prisma.panel.update).toHaveBeenNthCalledWith(1, {
            where: { id: 'panel-1' },
            data: {
                imageUrl: '/generated/panel-1.png',
                storageKey: 'user-1/episode-1/panel-1.png',
                status: 'done',
            },
        })
    })

    it('marks the panel content_filtered and refunds on content filter errors', async () => {
        mocks.generatePanelImage.mockRejectedValue(new mocks.ContentFilterError('blocked'))

        const result = await executePanelImageGeneration({
            panel,
            dbCharacters,
            providerConfig,
            artStyle: 'webtoon',
            imageModelTier: 'standard',
            userId: 'user-1',
            episodeId: 'episode-1',
        })

        expect(result).toBe('content_filtered')
        expect(mocks.prisma.panel.update).toHaveBeenLastCalledWith({
            where: { id: 'panel-1' },
            data: { status: 'content_filtered' },
        })
        expect(mocks.refundCredits).toHaveBeenCalledWith(
            'user-1',
            40,
            'panel gen failed: panel-1',
            'episode-1',
            { operationKey: 'refund:image:panel-1:1' },
        )
    })

    it('rethrows service errors after refunding the panel credit', async () => {
        mocks.generatePanelImage.mockRejectedValue(new mocks.ServiceError('provider down'))

        await expect(executePanelImageGeneration({
            panel,
            dbCharacters,
            providerConfig,
            artStyle: 'webtoon',
            imageModelTier: 'standard',
            userId: 'user-1',
            episodeId: 'episode-1',
        })).rejects.toThrow('provider down')

        expect(mocks.refundCredits).toHaveBeenCalledWith(
            'user-1',
            40,
            'service error',
            'episode-1',
            { operationKey: 'refund:image:panel-1:1' },
        )
    })

    it('marks generic failures as error and tolerates malformed panel characters', async () => {
        mocks.generatePanelImage.mockRejectedValue(new Error('timeout'))

        const result = await executePanelImageGeneration({
            panel: {
                ...panel,
                characters: '{bad-json',
            },
            dbCharacters,
            providerConfig,
            artStyle: 'webtoon',
            imageModelTier: 'standard',
            userId: 'user-1',
            episodeId: 'episode-1',
        })

        expect(result).toBe('error')
        expect(mocks.collectPanelReferenceImages).toHaveBeenCalledWith([], dbCharacters)
        expect(mocks.buildCharacterCanon).toHaveBeenCalledWith(dbCharacters, [])
        expect(mocks.prisma.panel.update).toHaveBeenLastCalledWith({
            where: { id: 'panel-1' },
            data: { status: 'error' },
        })
        expect(mocks.refundCredits).toHaveBeenCalledWith(
            'user-1',
            40,
            'panel gen failed: panel-1',
            'episode-1',
            { operationKey: 'refund:image:panel-1:1' },
        )
    })
})
