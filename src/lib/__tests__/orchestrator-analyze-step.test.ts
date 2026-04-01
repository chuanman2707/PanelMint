import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        episode: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        character: {
            create: vi.fn(),
            update: vi.fn(),
        },
        location: {
            create: vi.fn(),
        },
    },
    analyzeCharactersAndLocations: vi.fn(),
    splitIntoPagesWithPanels: vi.fn(),
    getProviderConfig: vi.fn(),
    checkCredits: vi.fn(),
    deductCredits: vi.fn(),
    recordPipelineEvent: vi.fn(),
    syncPipelineRunState: vi.fn(),
    generateCharacterDescription: vi.fn(),
    generateCharacterSheet: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/pipeline/analyze', () => ({
    analyzeCharactersAndLocations: mocks.analyzeCharactersAndLocations,
    splitIntoPagesWithPanels: mocks.splitIntoPagesWithPanels,
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
}))

vi.mock('@/lib/billing', () => ({
    ACTION_CREDIT_COSTS: {
        llm_generation: 80,
        standard_image: 40,
        premium_image: 250,
    },
    checkCredits: mocks.checkCredits,
    deductCredits: mocks.deductCredits,
    getImageGenerationCreditCost: (tier: 'standard' | 'premium') => tier === 'premium' ? 250 : 40,
    normalizeImageModelTier: (tier?: string | null) => tier === 'premium' ? 'premium' : 'standard',
    InsufficientCreditsError: class InsufficientCreditsError extends Error {
        constructor(required: number, available: number) {
            super(`Insufficient credits: need ${required}, have ${available}.`)
        }
    },
}))

vi.mock('@/lib/ai/character-design', () => ({
    generateCharacterDescription: mocks.generateCharacterDescription,
    generateCharacterSheet: mocks.generateCharacterSheet,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    recordPipelineEvent: mocks.recordPipelineEvent,
    syncPipelineRunState: mocks.syncPipelineRunState,
}))

vi.mock('@/lib/pipeline/panel-image-executor', () => ({
    executePanelImageGeneration: vi.fn(),
}))

vi.mock('@/lib/pipeline/image-gen', () => ({
    ServiceError: class ServiceError extends Error {},
}))

import { runAnalyzeStep } from '@/lib/pipeline/orchestrator'

describe('runAnalyzeStep', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'api-key',
            llmModel: 'seed-1.6-flash',
            imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
            imageFallbackModel: 'bytedance/seedream-v4',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })
        mocks.checkCredits.mockResolvedValue(true)
        mocks.deductCredits.mockResolvedValue(undefined)
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'queued' })
        mocks.prisma.episode.update.mockResolvedValue({})
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
        mocks.syncPipelineRunState.mockResolvedValue(undefined)
        mocks.prisma.character.create.mockResolvedValue({
            id: 'char-1',
            name: 'Linh',
            description: 'brief',
        })
        mocks.prisma.character.update.mockResolvedValue({})
        mocks.prisma.location.create.mockResolvedValue({})
        mocks.analyzeCharactersAndLocations.mockResolvedValue({
            characters: [
                {
                    name: 'Linh',
                    aliases: null,
                    description: 'brief',
                    identityAnchor: {
                        ageRange: '20-25',
                        gender: 'female',
                        bodyBuild: 'lean',
                        hairSignature: 'long black hair',
                        faceSignature: 'sharp eyes',
                        outfitDefault: 'blue robe',
                    },
                },
            ],
            locations: [
                {
                    name: 'Academy',
                    description: 'training grounds',
                },
            ],
        })
        mocks.generateCharacterDescription.mockResolvedValue({
            description: 'enhanced description',
            identityJson: {
                name: 'Linh',
                ageRange: '20-25',
                gender: 'female',
                bodyBuild: 'lean',
                hairColor: 'black',
                hairStyle: 'long',
                eyeColor: 'brown',
                skinTone: 'fair',
                clothing: 'blue robe',
                distinctiveFeatures: ['sharp eyes'],
                visualPrompt: 'enhanced description',
            },
        })
    })

    it('completes analysis without generating character sheets inline', async () => {
        await runAnalyzeStep({
            projectId: 'project-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            text: 'A training day at the academy.',
            artStyle: 'manhua',
            pageCount: 5,
        })

        expect(mocks.checkCredits).toHaveBeenCalledTimes(1)
        expect(mocks.deductCredits).toHaveBeenCalledTimes(1)
        expect(mocks.deductCredits).toHaveBeenCalledWith(
            'user-1',
            80,
            'chapter_analysis',
            'episode-1',
            { operationKey: 'analyze:episode-1' },
        )
        expect(mocks.generateCharacterSheet).not.toHaveBeenCalled()
        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: {
                description: 'enhanced description',
                identityJson: JSON.stringify({
                    name: 'Linh',
                    ageRange: '20-25',
                    gender: 'female',
                    bodyBuild: 'lean',
                    hairColor: 'black',
                    hairStyle: 'long',
                    eyeColor: 'brown',
                    skinTone: 'fair',
                    clothing: 'blue robe',
                    distinctiveFeatures: ['sharp eyes'],
                    visualPrompt: 'enhanced description',
                }),
            },
        })
        expect(mocks.prisma.episode.update).toHaveBeenLastCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'review_analysis', progress: 25 },
        })
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'analyze',
            status: 'completed',
            metadata: {
                characterCount: 1,
                locationCount: 1,
            },
        })
    })
})
