import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    prisma: {
        episode: {
            findUnique: vi.fn(),
        },
        character: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
    getProviderConfig: vi.fn(),
    generateCharacterSheet: vi.fn(),
    recordPipelineEvent: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
}))

vi.mock('@/lib/ai/character-design', () => ({
    generateCharacterSheet: mocks.generateCharacterSheet,
}))

vi.mock('@/lib/pipeline/run-state', () => ({
    recordPipelineEvent: mocks.recordPipelineEvent,
}))

import {
    getCharacterSheetDispatchPayloads,
    runCharacterSheetStep,
} from '@/lib/pipeline/character-sheet-step'

describe('character sheet step', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.prisma.episode.findUnique.mockResolvedValue({ status: 'imaging' })
        mocks.recordPipelineEvent.mockResolvedValue(undefined)
        mocks.prisma.character.update.mockResolvedValue({})
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('builds dispatch payloads from episode project characters', async () => {
        mocks.prisma.episode.findUnique.mockResolvedValue({
            id: 'ep-1',
            projectId: 'project-1',
            project: {
                userId: 'user-1',
            },
        })
        mocks.prisma.character.findMany.mockResolvedValue([
            { id: 'char-1' },
            { id: 'char-2' },
        ])

        await expect(getCharacterSheetDispatchPayloads('ep-1')).resolves.toEqual({
            userId: 'user-1',
            characterIds: ['char-1', 'char-2'],
        })
    })

    it('updates the character image when sheet generation succeeds', async () => {
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'hero',
            imageUrl: null,
            project: {
                userId: 'user-1',
                artStyle: 'manhwa',
            },
        })
        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'key',
            llmModel: 'seed',
            imageModel: 'flux',
            imageFallbackModel: 'seedream',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })
        mocks.generateCharacterSheet.mockResolvedValue({
            imageUrl: '/chars/aoi.png',
            storageKey: 'characters/aoi.png',
        })

        await runCharacterSheetStep({
            episodeId: 'ep-1',
            userId: 'user-1',
            characterId: 'char-1',
        })

        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: { imageUrl: '/chars/aoi.png', storageKey: 'characters/aoi.png' },
        })
        expect(mocks.recordPipelineEvent).toHaveBeenNthCalledWith(1, {
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'character_sheet:char-1',
            status: 'started',
            metadata: {
                attempt: 1,
                characterId: 'char-1',
                characterName: 'Aoi',
            },
        })
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'character_sheet:char-1',
            status: 'completed',
            metadata: {
                characterId: 'char-1',
                characterName: 'Aoi',
                attempt: 1,
                imageUrl: '/chars/aoi.png',
                storageKey: 'characters/aoi.png',
            },
        })
    })

    it('waits for long-running character sheet generation beyond the old 90s timeout', async () => {
        vi.useFakeTimers()

        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'hero',
            imageUrl: null,
            project: {
                userId: 'user-1',
                artStyle: 'manhwa',
            },
        })
        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'key',
            llmModel: 'seed',
            imageModel: 'flux',
            imageFallbackModel: 'seedream',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })
        mocks.generateCharacterSheet.mockImplementation(() => new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    imageUrl: '/chars/aoi-delayed.png',
                    storageKey: 'characters/aoi-delayed.png',
                })
            }, 95_000)
        }))

        const runPromise = runCharacterSheetStep({
            episodeId: 'ep-1',
            userId: 'user-1',
            characterId: 'char-1',
        })

        await vi.advanceTimersByTimeAsync(95_000)
        await runPromise

        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: { imageUrl: '/chars/aoi-delayed.png', storageKey: 'characters/aoi-delayed.png' },
        })
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'character_sheet:char-1',
            status: 'completed',
            metadata: {
                characterId: 'char-1',
                characterName: 'Aoi',
                attempt: 1,
                imageUrl: '/chars/aoi-delayed.png',
                storageKey: 'characters/aoi-delayed.png',
            },
        })
    })

    it('records failure when sheet generation fails', async () => {
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'hero',
            imageUrl: null,
            project: {
                userId: 'user-1',
                artStyle: 'manhwa',
            },
        })
        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'key',
            llmModel: 'seed',
            imageModel: 'flux',
            imageFallbackModel: 'seedream',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })
        mocks.generateCharacterSheet.mockRejectedValue(new Error('upstream timeout'))

        await expect(runCharacterSheetStep({
            episodeId: 'ep-1',
            userId: 'user-1',
            characterId: 'char-1',
        })).rejects.toThrow('upstream timeout')

        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'character_sheet:char-1',
            status: 'failed',
            metadata: {
                characterId: 'char-1',
                characterName: 'Aoi',
                attempt: 1,
                error: 'upstream timeout',
            },
        })
    })

    it('records provider config failures', async () => {
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'hero',
            imageUrl: null,
            project: {
                userId: 'user-1',
                artStyle: 'manhwa',
            },
        })
        mocks.getProviderConfig.mockRejectedValue(new Error('missing provider key'))

        await expect(runCharacterSheetStep({
            episodeId: 'ep-1',
            userId: 'user-1',
            characterId: 'char-1',
        })).rejects.toThrow('missing provider key')

        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'character_sheet:char-1',
            status: 'failed',
            metadata: {
                attempt: 1,
                characterId: 'char-1',
                characterName: 'Aoi',
                error: 'missing provider key',
            },
        })
    })

    it('does not update character output when cancellation happens during generation', async () => {
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'hero',
            imageUrl: null,
            project: {
                userId: 'user-1',
                artStyle: 'manhwa',
            },
        })
        mocks.prisma.episode.findUnique
            .mockResolvedValueOnce({ status: 'imaging' })
            .mockResolvedValueOnce({ status: 'error' })
        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'key',
            llmModel: 'seed',
            imageModel: 'flux',
            imageFallbackModel: 'seedream',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
            userId: 'user-1',
        })
        mocks.generateCharacterSheet.mockResolvedValue({
            imageUrl: '/chars/aoi.png',
            storageKey: 'characters/aoi.png',
        })

        await runCharacterSheetStep({
            episodeId: 'ep-1',
            userId: 'user-1',
            characterId: 'char-1',
        })

        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
        expect(mocks.recordPipelineEvent).toHaveBeenLastCalledWith({
            episodeId: 'ep-1',
            userId: 'user-1',
            step: 'character_sheet:char-1',
            status: 'cancelled',
            metadata: {
                attempt: 1,
                characterId: 'char-1',
                characterName: 'Aoi',
            },
        })
    })
})
