import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        episode: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        character: {
            create: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
        location: {
            create: vi.fn(),
        },
        page: {
            create: vi.fn(),
        },
        panel: {
            create: vi.fn(),
        },
    },
    analyzeCharactersAndLocations: vi.fn(),
    splitIntoPagesWithPanels: vi.fn(),
    getProviderConfig: vi.fn(),
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

import { runAnalyzeStep, runStoryboardStep } from '@/lib/pipeline/orchestrator'

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
    })

    it('completes analysis without blocking on extra character enhancement calls', async () => {
        await runAnalyzeStep({
            projectId: 'project-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            text: 'A training day at the academy.',
            artStyle: 'manhua',
            pageCount: 5,
        })

        expect(mocks.analyzeCharactersAndLocations).toHaveBeenCalledWith(
            'A training day at the academy.',
            expect.objectContaining({
                provider: 'wavespeed',
                apiKey: 'api-key',
            }),
        )
        expect(mocks.generateCharacterSheet).not.toHaveBeenCalled()
        expect(mocks.generateCharacterDescription).not.toHaveBeenCalled()
        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
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

    it('retries analysis work when a stale job left the episode analyzing', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'analyzing' })

        await runAnalyzeStep({
            projectId: 'project-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            text: 'A training day at the academy.',
            artStyle: 'manhua',
            pageCount: 5,
        })

        expect(mocks.analyzeCharactersAndLocations).toHaveBeenCalled()
        expect(mocks.prisma.episode.update).toHaveBeenLastCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'review_analysis', progress: 25 },
        })
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith(expect.objectContaining({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'analyze',
            status: 'completed',
        }))
    })

    it('persists WAVESPEED_API_KEY setup errors without stale Settings copy', async () => {
        mocks.getProviderConfig.mockRejectedValueOnce(
            new Error('WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.'),
        )

        await runAnalyzeStep({
            projectId: 'project-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            text: 'A training day at the academy.',
            artStyle: 'manhua',
            pageCount: 5,
        })

        expect(mocks.prisma.episode.update).toHaveBeenCalledWith({
            where: { id: 'episode-1' },
            data: {
                status: 'error',
                error: 'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.',
            },
        })
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'analyze',
            status: 'failed',
            metadata: {
                error: 'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.',
            },
        })
        expect(mocks.analyzeCharactersAndLocations).not.toHaveBeenCalled()
    })

    it('does not start analysis when the episode was already cancelled', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'error' })

        await runAnalyzeStep({
            projectId: 'project-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            text: 'A training day at the academy.',
            artStyle: 'manhua',
            pageCount: 5,
        })

        expect(mocks.getProviderConfig).not.toHaveBeenCalled()
        expect(mocks.analyzeCharactersAndLocations).not.toHaveBeenCalled()
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'analyze',
            status: 'cancelled',
        })
    })

    it('does not persist analysis output when cancellation happens during provider work', async () => {
        mocks.prisma.episode.findUnique
            .mockResolvedValueOnce({ status: 'queued' })
            .mockResolvedValueOnce({ status: 'error' })

        await runAnalyzeStep({
            projectId: 'project-1',
            episodeId: 'episode-1',
            userId: 'user-1',
            text: 'A training day at the academy.',
            artStyle: 'manhua',
            pageCount: 5,
        })

        expect(mocks.prisma.character.create).not.toHaveBeenCalled()
        expect(mocks.prisma.location.create).not.toHaveBeenCalled()
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'analyze',
            status: 'cancelled',
        })
    })

    it('does not start storyboard when the episode was already cancelled', async () => {
        mocks.prisma.episode.findUniqueOrThrow.mockResolvedValue({
            id: 'episode-1',
            projectId: 'project-1',
            status: 'error',
            project: {
                userId: 'user-1',
            },
        })

        await runStoryboardStep('episode-1')

        expect(mocks.getProviderConfig).not.toHaveBeenCalled()
        expect(mocks.splitIntoPagesWithPanels).not.toHaveBeenCalled()
        expect(mocks.prisma.episode.update).not.toHaveBeenCalled()
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'storyboard',
            status: 'cancelled',
        })
    })

    it('does not persist storyboard output when cancellation happens during provider work', async () => {
        mocks.prisma.episode.findUniqueOrThrow.mockResolvedValue({
            id: 'episode-1',
            projectId: 'project-1',
            status: 'storyboarding',
            novelText: 'A training day at the academy.',
            pageCount: 1,
            project: {
                userId: 'user-1',
            },
        })
        mocks.prisma.character.findMany.mockResolvedValue([
            {
                name: 'Linh',
                aliases: null,
                description: 'brief',
            },
        ])
        mocks.splitIntoPagesWithPanels.mockResolvedValue([
            {
                summary: 'Training day',
                content: 'A scene',
                characters: ['Linh'],
                location: 'Academy',
                dialogue: [],
                sceneContext: {},
                panels: [{
                    shotType: 'wide',
                    description: 'Linh trains',
                    dialogue: null,
                    characters: ['Linh'],
                    location: 'Academy',
                    sourceExcerpt: 'Linh trains',
                    mustKeep: [],
                    mood: null,
                    lighting: null,
                }],
            },
        ])
        mocks.prisma.episode.findUnique.mockResolvedValueOnce({ status: 'error' })

        await runStoryboardStep('episode-1')

        expect(mocks.prisma.page.create).not.toHaveBeenCalled()
        expect(mocks.prisma.panel.create).not.toHaveBeenCalled()
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'episode-1',
            userId: 'user-1',
            step: 'storyboard',
            status: 'cancelled',
        })
    })
})
