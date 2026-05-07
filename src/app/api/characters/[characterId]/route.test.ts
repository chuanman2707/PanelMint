import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    providerSetupError: 'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.',
    getOrCreateLocalUser: vi.fn(),
    getLocalCharacter: vi.fn(),
    getProviderConfig: vi.fn(),
    generateCharacterDescription: vi.fn(),
    prisma: {
        character: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalCharacter: mocks.getLocalCharacter,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
    WAVESPEED_PROVIDER_SETUP_ERROR: mocks.providerSetupError,
    isProviderSetupError: (error: unknown) =>
        error instanceof Error && error.message === mocks.providerSetupError,
}))

vi.mock('@/lib/ai/character-design', () => ({
    generateCharacterDescription: mocks.generateCharacterDescription,
}))

import { PUT } from './route'

describe('PUT /api/characters/[characterId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalCharacter.mockResolvedValue({ character: { id: 'char-1' }, error: null })
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'Old description',
        })
        mocks.getProviderConfig.mockResolvedValue({
            provider: 'wavespeed',
            apiKey: 'key',
            llmModel: 'seed',
            imageModel: 'flux',
            imageFallbackModel: 'seedream',
            baseUrl: 'https://api.wavespeed.ai/api/v3',
        })
        mocks.generateCharacterDescription.mockResolvedValue({
            description: 'Hero',
            identityJson: {
                name: 'Aoi',
                ageRange: '20-25',
                gender: 'female',
                bodyBuild: 'lean',
                hairColor: 'black',
                hairStyle: 'long',
                eyeColor: 'brown',
                skinTone: 'fair',
                clothing: 'combat suit',
                distinctiveFeatures: ['scar'],
                visualPrompt: 'Hero',
            },
        })
        mocks.prisma.character.update.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'Hero',
        })
    })

    it('returns 400 when no update fields are provided', async () => {
        const response = await PUT(
            new NextRequest('http://localhost/api/characters/char-1', {
                method: 'PUT',
                body: JSON.stringify({}),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ characterId: 'char-1' }) },
        )

        expect(response.status).toBe(400)
        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
    })

    it('returns 400 when name is blank after trimming', async () => {
        const response = await PUT(
            new NextRequest('http://localhost/api/characters/char-1', {
                method: 'PUT',
                body: JSON.stringify({ name: '   ' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ characterId: 'char-1' }) },
        )

        expect(response.status).toBe(400)
        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
    })

    it('updates validated character fields', async () => {
        const response = await PUT(
            new NextRequest('http://localhost/api/characters/char-1', {
                method: 'PUT',
                body: JSON.stringify({ name: ' Aoi ', description: ' Hero ' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({ characterId: 'char-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalCharacter).toHaveBeenCalledWith('user-1', 'char-1')
        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: {
                name: 'Aoi',
                description: 'Hero',
                identityJson: JSON.stringify({
                    name: 'Aoi',
                    ageRange: '20-25',
                    gender: 'female',
                    bodyBuild: 'lean',
                    hairColor: 'black',
                    hairStyle: 'long',
                    eyeColor: 'brown',
                    skinTone: 'fair',
                    clothing: 'combat suit',
                    distinctiveFeatures: ['scar'],
                    visualPrompt: 'Hero',
                }),
            },
        })
    })
})
