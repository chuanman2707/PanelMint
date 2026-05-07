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
        prisma: {
            episode: {
                findUnique: vi.fn(),
                findUniqueOrThrow: vi.fn(),
                update: vi.fn(),
            },
            character: {
                findMany: vi.fn(),
            },
            panel: {
                findMany: vi.fn(),
                findUnique: vi.fn(),
                update: vi.fn(),
                updateMany: vi.fn(),
                count: vi.fn(),
            },
        },
        getProviderConfig: vi.fn(),
        collectPanelReferenceImages: vi.fn(),
        buildCharacterCanon: vi.fn(),
        recordPipelineEvent: vi.fn(),
        syncPipelineRunState: vi.fn(),
        generatePanelImage: vi.fn(),
        ContentFilterError: MockContentFilterError,
        ServiceError: MockServiceError,
    }
})

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/pipeline/analyze', () => ({
    analyzeCharactersAndLocations: vi.fn(),
    splitIntoPagesWithPanels: vi.fn(),
}))

vi.mock('@/lib/ai/character-design', () => ({
    generateCharacterDescription: vi.fn(),
    generateCharacterSheet: vi.fn(),
}))

vi.mock('@/lib/pipeline/reference-images', () => ({
    collectPanelReferenceImages: mocks.collectPanelReferenceImages,
}))

vi.mock('@/lib/pipeline/character-canon', () => ({
    buildCharacterCanon: mocks.buildCharacterCanon,
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
}))

vi.mock('@/lib/pipeline/image-gen', () => ({
    generatePanelImage: mocks.generatePanelImage,
    ContentFilterError: mocks.ContentFilterError,
    ServiceError: mocks.ServiceError,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    recordPipelineEvent: mocks.recordPipelineEvent,
    syncPipelineRunState: mocks.syncPipelineRunState,
}))

import { runImageGenStep } from '@/lib/pipeline/orchestrator'

describe('runImageGenStep', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mocks.prisma.episode.findUniqueOrThrow.mockResolvedValue({
            id: 'episode-1',
            status: 'review_storyboard',
            project: {
                userId: 'user-1',
                artStyle: 'webtoon',
            },
            projectId: 'project-1',
        })
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'imaging' })
        mocks.prisma.character.findMany.mockResolvedValue([
            {
                id: 'char-1',
                name: 'Anh Minh',
                identityJson: null,
                imageUrl: '/chars/minh.png',
                appearances: [],
            },
        ])
        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'api-key',
            llmModel: 'bytedance-seed/seed-1.6-flash',
            imageModel: 'wavespeed-ai/flux-kontext-pro/multi',
            imageFallbackModel: 'bytedance/seedream-v4',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })
        mocks.collectPanelReferenceImages.mockReturnValue([])
        mocks.buildCharacterCanon.mockReturnValue([])
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
        mocks.syncPipelineRunState.mockResolvedValue(undefined)
        mocks.prisma.episode.update.mockResolvedValue({})
        mocks.prisma.panel.findUnique.mockResolvedValue({ generationAttempt: 1 })
        mocks.prisma.panel.update.mockResolvedValue({})
        mocks.prisma.panel.updateMany.mockResolvedValue({ count: 1 })
    })

    it('marks content-filtered panels and still completes when no retryable panels remain', async () => {
        mocks.prisma.panel.findMany.mockResolvedValue([
            {
                id: 'panel-1',
                characters: JSON.stringify(['Anh Minh']),
                approvedPrompt: 'blocked prompt',
                description: 'blocked prompt',
                shotType: 'wide',
                location: 'city',
                mood: null,
                lighting: null,
                page: {
                    sceneContext: null,
                    characters: JSON.stringify(['Anh Minh']),
                },
            },
        ])
        mocks.collectPanelReferenceImages.mockResolvedValue([])
        mocks.generatePanelImage.mockRejectedValue(
            new mocks.ContentFilterError('blocked by policy'),
        )
        mocks.prisma.panel.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)

        await runImageGenStep('episode-1', ['panel-1'])

        expect(mocks.prisma.character.findMany).toHaveBeenCalledWith({
            where: { projectId: 'project-1' },
            include: {
                appearances: {
                    where: { isDefault: true },
                    select: { imageUrl: true, storageKey: true, isDefault: true },
                },
            },
        })
        expect(mocks.prisma.panel.update).toHaveBeenCalledWith({
            where: { id: 'panel-1' },
            data: { status: 'content_filtered' },
        })
        expect(mocks.prisma.episode.update).toHaveBeenLastCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'done', progress: 100 },
        })
    })

    it('returns the episode to storyboard review when retryable panels still remain', async () => {
        mocks.prisma.panel.findMany.mockResolvedValue([
            {
                id: 'panel-2',
                characters: JSON.stringify(['Anh Minh']),
                approvedPrompt: 'fight scene',
                description: 'fight scene',
                shotType: 'medium',
                location: 'bridge',
                mood: null,
                lighting: null,
                page: {
                    sceneContext: null,
                    characters: JSON.stringify(['Anh Minh']),
                },
            },
        ])
        mocks.collectPanelReferenceImages.mockResolvedValue([])
        mocks.generatePanelImage.mockRejectedValue(new Error('upstream timeout'))
        mocks.prisma.panel.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)

        await runImageGenStep('episode-1', ['panel-2'])

        expect(mocks.prisma.panel.update).toHaveBeenCalledWith({
            where: { id: 'panel-2' },
            data: { status: 'error' },
        })
        expect(mocks.prisma.episode.update).toHaveBeenLastCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'review_storyboard', progress: 50 },
        })
    })

    it('does not mark a child image job done when sibling panels still remain', async () => {
        mocks.prisma.panel.findMany.mockResolvedValue([])
        mocks.prisma.panel.count
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1)

        await runImageGenStep('episode-1', ['panel-1'])

        expect(mocks.prisma.episode.update).not.toHaveBeenCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'done', progress: 100 },
        })
        expect(mocks.prisma.episode.update).toHaveBeenLastCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'imaging', progress: 73 },
        })
    })

    it('does not overwrite cancellation when a panel is skipped after provider work', async () => {
        mocks.prisma.panel.findMany.mockResolvedValue([
            {
                id: 'panel-1',
                characters: JSON.stringify(['Anh Minh']),
                approvedPrompt: 'fight scene',
                description: 'fight scene',
                shotType: 'medium',
                location: 'bridge',
                mood: null,
                lighting: null,
                page: {
                    sceneContext: null,
                    characters: JSON.stringify(['Anh Minh']),
                },
            },
        ])
        mocks.prisma.episode.findUnique
            .mockResolvedValueOnce({ status: 'imaging' })
            .mockResolvedValueOnce({ status: 'imaging' })
            .mockResolvedValueOnce({ status: 'error' })
            .mockResolvedValueOnce({ status: 'error' })
        mocks.generatePanelImage.mockResolvedValue({
            imageUrl: '/api/storage/users/user-1/episodes/episode-1/panels/panel-1.png',
            storageKey: 'users/user-1/episodes/episode-1/panels/panel-1.png',
        })

        await runImageGenStep('episode-1', ['panel-1'])

        expect(mocks.prisma.episode.update).toHaveBeenCalledWith({
            where: { id: 'episode-1' },
            data: { status: 'imaging', progress: 50 },
        })
        expect(mocks.prisma.episode.update).toHaveBeenCalledTimes(1)
        expect(mocks.prisma.panel.count).not.toHaveBeenCalled()
    })
})
