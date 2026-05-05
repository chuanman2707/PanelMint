import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => {
    const prisma = {
        $transaction: vi.fn(),
        user: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            findFirst: vi.fn(),
        },
        creditTransaction: {
            create: vi.fn(),
        },
        episode: {
            findFirst: vi.fn(),
        },
        project: {
            findFirst: vi.fn(),
        },
        character: {
            findFirst: vi.fn(),
        },
    }

    prisma.$transaction.mockImplementation(async (input: unknown) => {
        if (typeof input === 'function') {
            return input(prisma)
        }
        return Promise.all(input as Promise<unknown>[])
    })

    return { prismaMock: prisma }
})

vi.mock('@/lib/prisma', () => ({
    prisma: prismaMock,
}))

vi.mock('@/lib/billing', () => ({
    FREE_SIGNUP_CREDITS: 300,
}))

import {
    getLocalCharacter,
    getLocalEpisode,
    getLocalProject,
    getOrCreateLocalUser,
    LOCAL_USER_EMAIL,
} from '@/lib/local-user'

describe('getOrCreateLocalUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMock.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(prismaMock)
            }
            return Promise.all(input as Promise<unknown>[])
        })
    })

    it('returns the deterministic local owner when it already exists', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        await expect(getOrCreateLocalUser()).resolves.toEqual({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('reuses the only existing user to preserve local projects', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.findMany.mockResolvedValue([
            {
                id: 'existing-user-1',
                email: 'old@example.com',
                name: 'Existing Creator',
                credits: 120,
                accountTier: 'paid',
            },
        ])

        await expect(getOrCreateLocalUser()).resolves.toMatchObject({
            id: 'existing-user-1',
            email: 'old@example.com',
        })

        expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('creates a deterministic local owner when no reusable owner exists', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.findMany.mockResolvedValue([])
        prismaMock.user.create.mockResolvedValue({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        await expect(getOrCreateLocalUser()).resolves.toMatchObject({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            credits: 300,
        })

        expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                email: LOCAL_USER_EMAIL,
                name: 'Local Creator',
                authUserId: null,
                passwordHash: '__local_owner__',
                credits: 300,
                accountTier: 'free',
                lifetimePurchasedCredits: 0,
            }),
        }))
        expect(prismaMock.creditTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'local-user-1',
                amount: 300,
                reason: 'starter_bonus',
                balance: 300,
                operationKey: 'starter_bonus:local-user-1',
            }),
        })
    })

    it('creates a deterministic local owner when multiple existing users are present', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.findMany.mockResolvedValue([
            {
                id: 'existing-user-1',
                email: 'first@example.com',
                name: 'First Creator',
                credits: 120,
                accountTier: 'paid',
            },
            {
                id: 'existing-user-2',
                email: 'second@example.com',
                name: 'Second Creator',
                credits: 80,
                accountTier: 'free',
            },
        ])
        prismaMock.user.create.mockResolvedValue({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        await expect(getOrCreateLocalUser()).resolves.toMatchObject({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
        })

        expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                email: LOCAL_USER_EMAIL,
                passwordHash: '__local_owner__',
            }),
        }))
    })

    it('returns the deterministic local owner when concurrent creation hits a unique conflict', async () => {
        prismaMock.$transaction.mockRejectedValueOnce({ code: 'P2002' })
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        await expect(getOrCreateLocalUser()).resolves.toEqual({
            id: 'local-user-1',
            email: LOCAL_USER_EMAIL,
            name: 'Local Creator',
            credits: 300,
            accountTier: 'free',
        })

        expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({
            where: { email: LOCAL_USER_EMAIL },
        }))
    })
})

describe('local ownership helpers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 404-style errors for missing local episode ownership', async () => {
        prismaMock.episode.findFirst.mockResolvedValue(null)

        const result = await getLocalEpisode('user-1', 'episode-404')

        expect(result.episode).toBeNull()
        expect(result.error?.status).toBe(404)
    })

    it('returns owned records for episode, project, and character lookups', async () => {
        prismaMock.episode.findFirst.mockResolvedValue({ id: 'ep-1', projectId: 'project-1', status: 'queued' })
        prismaMock.project.findFirst.mockResolvedValue({ id: 'project-1', userId: 'user-1' })
        prismaMock.character.findFirst.mockResolvedValue({ id: 'char-1', projectId: 'project-1' })

        await expect(getLocalEpisode('user-1', 'ep-1')).resolves.toMatchObject({
            episode: { id: 'ep-1' },
            error: null,
        })
        expect(prismaMock.episode.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: 'ep-1',
                project: { userId: 'user-1' },
            },
        }))

        await expect(getLocalProject('user-1', 'project-1')).resolves.toMatchObject({
            project: { id: 'project-1' },
            error: null,
        })
        expect(prismaMock.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: 'project-1',
                userId: 'user-1',
            },
        }))

        await expect(getLocalCharacter('user-1', 'char-1')).resolves.toMatchObject({
            character: { id: 'char-1' },
            error: null,
        })
        expect(prismaMock.character.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                id: 'char-1',
                project: { userId: 'user-1' },
            },
        }))
    })
})
