import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
    getOrCreateLocalUser: vi.fn(),
    getLocalProject: vi.fn(),
    prisma: {
        character: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
    },
}))

vi.mock('@/lib/local-user', () => ({
    getOrCreateLocalUser: mocks.getOrCreateLocalUser,
    getLocalProject: mocks.getLocalProject,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: mocks.prisma,
}))

import { GET, POST } from './route'

describe('api/characters', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.getOrCreateLocalUser.mockResolvedValue({ id: 'user-1' })
        mocks.getLocalProject.mockResolvedValue({ error: null })
        mocks.prisma.character.findMany.mockResolvedValue([])
        mocks.prisma.character.create.mockResolvedValue({
            id: 'char-1',
            projectId: 'project-1',
            name: 'Aoi',
            description: 'Hero',
        })
    })

    it('returns 400 when the create body is missing required fields', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/characters', {
                method: 'POST',
                body: JSON.stringify({ projectId: 'project-1' }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(400)
        expect(mocks.prisma.character.create).not.toHaveBeenCalled()
    })

    it('creates a character with validated payload', async () => {
        const response = await POST(
            new NextRequest('http://localhost/api/characters', {
                method: 'POST',
                body: JSON.stringify({
                    projectId: 'project-1',
                    name: 'Aoi',
                    description: ' Hero ',
                }),
                headers: { 'content-type': 'application/json' },
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalProject).toHaveBeenCalledWith('user-1', 'project-1')
        expect(mocks.prisma.character.create).toHaveBeenCalledWith({
            data: {
                projectId: 'project-1',
                name: 'Aoi',
                description: 'Hero',
            },
        })
    })

    it('lists characters for an owned project', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/characters?projectId=project-1', {
                method: 'GET',
            }),
            { params: Promise.resolve({}) },
        )

        expect(response.status).toBe(200)
        expect(mocks.getLocalProject).toHaveBeenCalledWith('user-1', 'project-1')
        expect(mocks.prisma.character.findMany).toHaveBeenCalledWith({
            where: { projectId: 'project-1' },
            include: { appearances: { orderBy: { appearanceIndex: 'asc' } } },
            orderBy: { createdAt: 'asc' },
        })
    })
})
