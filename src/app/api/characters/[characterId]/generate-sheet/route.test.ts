import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    providerSetupError: 'WAVESPEED_API_KEY is required for WaveSpeed generation. Set it in .env.',
    getOrCreateLocalUser: vi.fn(),
    getLocalCharacter: vi.fn(),
    getProviderConfig: vi.fn(),
    generateCharacterSheet: vi.fn(),
    prisma: {
        character: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalCharacter: mocks.getLocalCharacter,
}))

vi.mock('@/lib/api-config', () => ({
    getProviderConfig: mocks.getProviderConfig,
    WAVESPEED_PROVIDER_SETUP_ERROR: mocks.providerSetupError,
    isProviderSetupError: (error: unknown) =>
        error instanceof Error && error.message === mocks.providerSetupError,
}))

vi.mock('@/lib/ai/character-design', () => ({
    generateCharacterSheet: mocks.generateCharacterSheet,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { POST } from './route'

describe('POST /api/characters/[characterId]/generate-sheet', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalCharacter.mockResolvedValue({ character: { id: 'char-1' }, error: null })
        mocks.getProviderConfig.mockResolvedValue({ apiKey: 'ws-key', provider: 'wavespeed' })
        mocks.generateCharacterSheet.mockResolvedValue({
            imageUrl: '/api/storage/users/user-1/episodes/episode-1/panels/char-char-1.png',
            storageKey: 'users/user-1/episodes/episode-1/panels/char-char-1.png',
        })
        mocks.prisma.character.findUnique.mockResolvedValue({
            id: 'char-1',
            name: 'Aoi',
            description: 'Hero',
            project: { artStyle: 'manga' },
        })
    })

    it('generates a sheet for a character owned by the local owner', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/characters/char-1/generate-sheet', { method: 'POST' }),
            { params: Promise.resolve({ characterId: 'char-1' }) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalCharacter).toHaveBeenCalledWith('user-1', 'char-1')
        expect(mocks.getProviderConfig).toHaveBeenCalledWith('user-1')
        expect(mocks.generateCharacterSheet).toHaveBeenCalledWith(
            'char-1',
            'Hero',
            'manga',
            expect.anything(),
            'user-1',
        )
        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: {
                imageUrl: '/api/storage/users/user-1/episodes/episode-1/panels/char-char-1.png',
                storageKey: 'users/user-1/episodes/episode-1/panels/char-char-1.png',
            },
        })
        await expect(response.json()).resolves.toEqual({
            imageUrl: '/api/storage/users/user-1/episodes/episode-1/panels/char-char-1.png',
        })
    })

    it('returns local WaveSpeed setup guidance when the provider key is missing', async () => {
        mocks.getProviderConfig.mockRejectedValue(
            new Error(mocks.providerSetupError),
        )

        const response = await POST(
            new NextRequest('http://localhost/api/characters/char-1/generate-sheet', { method: 'POST' }),
            { params: Promise.resolve({ characterId: 'char-1' }) },
        )

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            error: mocks.providerSetupError,
            code: 'SERVICE_UNAVAILABLE',
        })
        expect(mocks.generateCharacterSheet).not.toHaveBeenCalled()
        expect(mocks.prisma.character.update).not.toHaveBeenCalled()
    })
})
