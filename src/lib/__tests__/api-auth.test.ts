import { describe, it, expect, vi, beforeEach } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
    redirectMock: vi.fn((path: string) => {
        throw new Error(`REDIRECT:${path}`)
    }),
}))

const mocks = vi.hoisted(() => ({
    clerkAuth: vi.fn(),
    clerkClient: vi.fn(),
    findDomainUserByAuthUserId: vi.fn(),
    syncDomainUserFromAuthUser: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({
    auth: mocks.clerkAuth,
    clerkClient: mocks.clerkClient,
}))

vi.mock('@/lib/auth', () => ({
    findDomainUserByAuthUserId: mocks.findDomainUserByAuthUserId,
    syncDomainUserFromAuthUser: mocks.syncDomainUserFromAuthUser,
}))

vi.mock('next/navigation', () => ({
    redirect: redirectMock,
}))

vi.mock('@/lib/prisma', () => ({
    prisma: {
        episode: { findFirst: vi.fn() },
        project: { findFirst: vi.fn() },
        character: { findFirst: vi.fn() },
    },
}))

import { requireAuth, requirePageSession, requireEpisodeOwner, requireProjectOwner, requireCharacterOwner } from '../api-auth'
import { prisma } from '../prisma'

const mockClerkAuth = vi.mocked(mocks.clerkAuth)
const mockClerkClient = vi.mocked(mocks.clerkClient)
const mockFindDomainUserByAuthUserId = vi.mocked(mocks.findDomainUserByAuthUserId)
const mockSyncDomainUserFromAuthUser = vi.mocked(mocks.syncDomainUserFromAuthUser)

describe('requireAuth', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockClerkAuth.mockResolvedValue({
            isAuthenticated: false,
            userId: null,
        } as never)
        mockClerkClient.mockResolvedValue({
            users: {
                getUser: vi.fn(),
            },
        } as never)
    })

    it('returns 401 when the current session user is missing', async () => {
        const result = await requireAuth()
        expect(result.error).not.toBeNull()
        expect(result.user).toBeNull()

        const body = await result.error!.json()
        expect(body.error).toBe('Unauthorized')
    })

    it('returns user when the session is valid', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'test@test.com',
            name: 'Test',
            credits: 300,
            accountTier: 'free',
        }

        mockClerkAuth.mockResolvedValue({
            isAuthenticated: true,
            userId: 'auth-1',
        } as never)
        mockFindDomainUserByAuthUserId.mockResolvedValue(mockUser)

        const result = await requireAuth()
        expect(result.error).toBeNull()
        expect(result.user).toEqual(mockUser)
    })

    it('hydrates from Clerk when the domain user is missing', async () => {
        const mockUser = {
            id: 'user-1',
            email: 'test@test.com',
            name: 'Test',
            credits: 300,
            accountTier: 'free',
        }

        mockClerkAuth.mockResolvedValue({
            isAuthenticated: true,
            userId: 'auth-1',
        } as never)
        mockFindDomainUserByAuthUserId.mockResolvedValue(null)
        mockClerkClient.mockResolvedValue({
            users: {
                getUser: vi.fn().mockResolvedValue({
                    id: 'auth-1',
                    emailAddresses: [{ id: 'email-1', emailAddress: 'test@test.com' }],
                    primaryEmailAddressId: 'email-1',
                    firstName: 'Test',
                    lastName: null,
                    unsafeMetadata: { name: 'Test' },
                }),
            },
        } as never)
        mockSyncDomainUserFromAuthUser.mockResolvedValue(mockUser)

        const result = await requireAuth()
        expect(result.error).toBeNull()
        expect(result.user).toEqual(mockUser)
        expect(mockSyncDomainUserFromAuthUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'auth-1' }))
    })
})

describe('requirePageSession', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockClerkAuth.mockResolvedValue({
            isAuthenticated: false,
            userId: null,
        } as never)
    })

    it('redirects to signin when the page has no session', async () => {
        await expect(requirePageSession('/editor/ep-1')).rejects.toThrow('REDIRECT:/auth/signin?from=%2Feditor%2Fep-1')
    })
})

describe('requireEpisodeOwner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 404 when episode not found', async () => {
        vi.mocked(prisma.episode.findFirst).mockResolvedValue(null)

        const result = await requireEpisodeOwner('user-1', 'bad-id')
        expect(result.error).not.toBeNull()

        const body = await result.error!.json()
        expect(body.error).toBe('Not found')
    })

    it('returns 404 when user does not own the episode', async () => {
        vi.mocked(prisma.episode.findFirst).mockResolvedValue(null)

        const result = await requireEpisodeOwner('user-1', 'ep-1')
        expect(result.error).not.toBeNull()

        const body = await result.error!.json()
        expect(body.error).toBe('Not found')
    })

    it('should return episode when user is the owner', async () => {
        const mockEpisode = {
            id: 'ep-1',
            projectId: 'project-1',
            status: 'review_storyboard',
        }
        vi.mocked(prisma.episode.findFirst).mockResolvedValue(mockEpisode as never)

        const result = await requireEpisodeOwner('user-1', 'ep-1')
        expect(result.error).toBeNull()
        expect(result.episode).toEqual(mockEpisode)
    })
})

describe('requireProjectOwner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should return 404 when project not found', async () => {
        vi.mocked(prisma.project.findFirst).mockResolvedValue(null)

        const result = await requireProjectOwner('user-1', 'bad-id')
        expect(result.error).not.toBeNull()
    })

    it('returns 404 when user does not own the project', async () => {
        vi.mocked(prisma.project.findFirst).mockResolvedValue(null)

        const result = await requireProjectOwner('user-1', 'proj-1')
        expect(result.error).not.toBeNull()
    })

    it('should return project when user is owner', async () => {
        vi.mocked(prisma.project.findFirst).mockResolvedValue({
            id: 'proj-1',
            userId: 'user-1',
        } as never)

        const result = await requireProjectOwner('user-1', 'proj-1')
        expect(result.error).toBeNull()
        expect(result.project).toEqual({ id: 'proj-1', userId: 'user-1' })
    })
})

describe('requireCharacterOwner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns 404 for a character belonging to another user', async () => {
        vi.mocked(prisma.character.findFirst).mockResolvedValue(null)

        const result = await requireCharacterOwner('user-1', 'char-1')
        expect(result.error).not.toBeNull()
    })

    it('should return character for owner', async () => {
        const mockChar = { id: 'char-1', projectId: 'proj-1' }
        vi.mocked(prisma.character.findFirst).mockResolvedValue(mockChar as never)

        const result = await requireCharacterOwner('user-1', 'char-1')
        expect(result.error).toBeNull()
        expect(result.character).toEqual(mockChar)
    })
})
