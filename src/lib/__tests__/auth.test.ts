import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => {
    const prisma = {
        $transaction: vi.fn(),
        user: {
            findFirst: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
        },
        creditTransaction: {
            create: vi.fn(),
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

vi.mock('@/lib/crypto', () => ({
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    isEncrypted: vi.fn(() => false),
}))

vi.mock('@/lib/billing', () => ({
    FREE_SIGNUP_CREDITS: 300,
}))

import { syncDomainUserFromAuthUser } from '@/lib/auth'

describe('syncDomainUserFromAuthUser', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        prismaMock.$transaction.mockImplementation(async (input: unknown) => {
            if (typeof input === 'function') {
                return input(prismaMock)
            }

            return Promise.all(input as Promise<unknown>[])
        })
    })

    it('rejects email collisions when the email is already linked to another auth identity', async () => {
        prismaMock.user.findFirst.mockResolvedValue({
            id: 'user-1',
            email: 'ceo@company.com',
            name: 'CEO',
            credits: 300,
            accountTier: 'free',
            authUserId: 'user_1',
        })

        await expect(syncDomainUserFromAuthUser({
            id: 'user_2',
            primaryEmailAddressId: 'email-1',
            emailAddresses: [{ id: 'email-1', emailAddress: 'ceo@company.com' }],
            firstName: 'Mallory',
        })).rejects.toThrow('Account takeover prevented')

        expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('updates an existing unlinked user when the email matches', async () => {
        prismaMock.user.findFirst.mockResolvedValue({
            id: 'user-1',
            email: 'ceo@company.com',
            name: 'CEO',
            credits: 300,
            accountTier: 'free',
            authUserId: null,
        })
        prismaMock.user.update.mockResolvedValue({
            id: 'user-1',
            email: 'ceo@company.com',
            name: 'Mallory',
            credits: 300,
            accountTier: 'free',
        })

        await expect(syncDomainUserFromAuthUser({
            id: 'user_2',
            primaryEmailAddressId: 'email-1',
            emailAddresses: [{ id: 'email-1', emailAddress: 'ceo@company.com' }],
            firstName: 'Mallory',
        })).resolves.toEqual({
            id: 'user-1',
            email: 'ceo@company.com',
            name: 'Mallory',
            credits: 300,
            accountTier: 'free',
        })

        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: {
                email: 'ceo@company.com',
                authUserId: 'user_2',
                name: 'Mallory',
            },
            select: {
                id: true,
                email: true,
                name: true,
                credits: true,
                accountTier: true,
            },
        })
    })
})
