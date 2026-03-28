import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    requireCharacterOwner: vi.fn(),
    prisma: {
        character: {
            findUnique: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
    },
}))

vi.mock('@/lib/api-auth', () => ({
    requireAuth: mocks.requireAuth,
    requireCharacterOwner: mocks.requireCharacterOwner,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { PUT } from './route'

describe('PUT /api/characters/[characterId]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' }, error: null })
        mocks.requireCharacterOwner.mockResolvedValue({ character: { id: 'char-1' }, error: null })
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
        expect(mocks.prisma.character.update).toHaveBeenCalledWith({
            where: { id: 'char-1' },
            data: {
                name: 'Aoi',
                description: 'Hero',
            },
        })
    })
})
