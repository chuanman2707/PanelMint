import { prisma } from './prisma'
import { encrypt, decrypt, isEncrypted } from './crypto'
import { FREE_SIGNUP_CREDITS } from './billing'

const EXTERNAL_AUTH_PASSWORD_PLACEHOLDER = '__external_auth_managed__'

type MetadataRecord = Record<string, unknown> | null | undefined

interface AuthEmailAddress {
    id?: string | null
    emailAddress?: string | null
    email_address?: string | null
}

export interface ExternalAuthUser {
    id: string
    primaryEmailAddressId?: string | null
    primary_email_address_id?: string | null
    emailAddresses?: AuthEmailAddress[]
    email_addresses?: AuthEmailAddress[]
    firstName?: string | null
    first_name?: string | null
    lastName?: string | null
    last_name?: string | null
    fullName?: string | null
    username?: string | null
    unsafeMetadata?: MetadataRecord
    unsafe_metadata?: MetadataRecord
}

export interface SessionUser {
    id: string
    email: string
    name: string | null
    credits: number
    accountTier: string
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

function mapSessionUser(user: {
    id: string
    email: string
    name: string | null
    credits: number
    accountTier: string
}): SessionUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        accountTier: user.accountTier,
    }
}

function getAuthMetadata(authUser: ExternalAuthUser): MetadataRecord {
    return authUser.unsafeMetadata ?? authUser.unsafe_metadata
}

function extractDisplayName(authUser: ExternalAuthUser): string | null {
    const metadataName = getAuthMetadata(authUser)?.name
    if (typeof metadataName === 'string' && metadataName.trim()) {
        return metadataName.trim()
    }

    if (typeof authUser.fullName === 'string' && authUser.fullName.trim()) {
        return authUser.fullName.trim()
    }

    const firstName = authUser.firstName ?? authUser.first_name ?? null
    const lastName = authUser.lastName ?? authUser.last_name ?? null
    const joinedName = [firstName, lastName].filter(Boolean).join(' ').trim()
    if (joinedName) {
        return joinedName
    }

    if (typeof authUser.username === 'string' && authUser.username.trim()) {
        return authUser.username.trim()
    }

    return null
}

function getPrimaryEmailAddressId(authUser: ExternalAuthUser): string | null {
    return authUser.primaryEmailAddressId ?? authUser.primary_email_address_id ?? null
}

function getAuthEmailAddresses(authUser: ExternalAuthUser): AuthEmailAddress[] {
    return authUser.emailAddresses ?? authUser.email_addresses ?? []
}

function extractPrimaryEmail(authUser: ExternalAuthUser): string | null {
    const primaryEmailAddressId = getPrimaryEmailAddressId(authUser)
    const emailAddresses = getAuthEmailAddresses(authUser)

    const primaryEmailAddress = primaryEmailAddressId
        ? emailAddresses.find((emailAddress) => emailAddress.id === primaryEmailAddressId)
        : emailAddresses[0]

    const rawEmail = primaryEmailAddress?.emailAddress ?? primaryEmailAddress?.email_address ?? null
    return rawEmail ? normalizeEmail(rawEmail) : null
}

export async function createUser(
    email: string,
    _password: string,
    name?: string,
    options?: {
        authUserId?: string | null
        passwordHash?: string | null
    },
): Promise<SessionUser> {
    const normalizedEmail = normalizeEmail(email)
    const displayName = name?.trim() || null
    const passwordHash = options?.passwordHash ?? EXTERNAL_AUTH_PASSWORD_PLACEHOLDER

    return prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({
            where: {
                OR: [
                    { email: normalizedEmail },
                    ...(options?.authUserId ? [{ authUserId: options.authUserId }] : []),
                ],
            },
            select: {
                id: true,
                email: true,
                name: true,
                credits: true,
                accountTier: true,
                authUserId: true,
            },
        })

        if (existing) {
            const updated = await tx.user.update({
                where: { id: existing.id },
                data: {
                    email: normalizedEmail,
                    name: displayName ?? existing.name,
                    authUserId: options?.authUserId ?? existing.authUserId,
                    passwordHash,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    credits: true,
                    accountTier: true,
                },
            })

            return mapSessionUser(updated)
        }

        const created = await tx.user.create({
            data: {
                email: normalizedEmail,
                name: displayName,
                authUserId: options?.authUserId ?? null,
                passwordHash,
                credits: FREE_SIGNUP_CREDITS,
                accountTier: 'free',
                lifetimePurchasedCredits: 0,
            },
            select: {
                id: true,
                email: true,
                name: true,
                credits: true,
                accountTier: true,
            },
        })

        await tx.creditTransaction.create({
            data: {
                userId: created.id,
                amount: FREE_SIGNUP_CREDITS,
                reason: 'starter_bonus',
                balance: created.credits,
                operationKey: `starter_bonus:${options?.authUserId ?? created.id}`,
            },
        })

        return mapSessionUser(created)
    })
}

export async function syncDomainUserFromAuthUser(authUser: ExternalAuthUser): Promise<SessionUser> {
    const email = extractPrimaryEmail(authUser)
    if (!email) {
        throw new Error('Authenticated user is missing a primary email address.')
    }

    return prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({
            where: {
                OR: [
                    { authUserId: authUser.id },
                    { email },
                ],
            },
            select: {
                id: true,
                email: true,
                name: true,
                credits: true,
                accountTier: true,
                authUserId: true,
            },
        })

        if (existing) {
            if (existing.authUserId && existing.authUserId !== authUser.id) {
                throw new Error('Account takeover prevented: Email linked to another identity.')
            }

            const updated = await tx.user.update({
                where: { id: existing.id },
                data: {
                    email,
                    authUserId: authUser.id,
                    name: extractDisplayName(authUser) ?? existing.name,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    credits: true,
                    accountTier: true,
                },
            })

            return mapSessionUser(updated)
        }

        const created = await tx.user.create({
            data: {
                email,
                authUserId: authUser.id,
                name: extractDisplayName(authUser),
                passwordHash: EXTERNAL_AUTH_PASSWORD_PLACEHOLDER,
                credits: FREE_SIGNUP_CREDITS,
                accountTier: 'free',
                lifetimePurchasedCredits: 0,
            },
            select: {
                id: true,
                email: true,
                name: true,
                credits: true,
                accountTier: true,
            },
        })

        await tx.creditTransaction.create({
            data: {
                userId: created.id,
                amount: FREE_SIGNUP_CREDITS,
                reason: 'starter_bonus',
                balance: created.credits,
                operationKey: `starter_bonus:${authUser.id}`,
            },
        })

        return mapSessionUser(created)
    })
}

export async function findDomainUserByAuthUserId(authUserId: string): Promise<SessionUser | null> {
    const user = await prisma.user.findFirst({
        where: { authUserId },
        select: {
            id: true,
            email: true,
            name: true,
            credits: true,
            accountTier: true,
        },
    })

    return user ? mapSessionUser(user) : null
}

export async function getUserApiKey(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { apiKey: true },
    })
    const raw = user?.apiKey ?? null
    if (!raw) return null

    if (!isEncrypted(raw)) return raw

    try {
        return decrypt(raw)
    } catch (err) {
        console.error('[Auth] Failed to decrypt API key — possible key corruption or wrong ENCRYPTION_SECRET', err)
        return null
    }
}

export async function setUserApiKey(userId: string, apiKey: string | null, provider?: string) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            apiKey: apiKey ? encrypt(apiKey) : null,
            apiProvider: provider ?? null,
        },
    })
}

export async function getUserPreferences(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
    })
    if (!user?.preferences) return null
    try {
        return JSON.parse(user.preferences)
    } catch {
        return null
    }
}

export async function setUserPreferences(userId: string, preferences: Record<string, unknown>) {
    await prisma.user.update({
        where: { id: userId },
        data: { preferences: JSON.stringify(preferences) },
    })
}
