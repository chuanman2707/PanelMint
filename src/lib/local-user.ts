import { NextResponse } from 'next/server'
import { decrypt, encrypt, isEncrypted } from './crypto'
import { prisma } from './prisma'

export const LOCAL_USER_EMAIL = 'local@panelmint.dev'
export const LOCAL_USER_NAME = 'Local Creator'

export interface LocalUser {
    id: string
    email: string
    name: string | null
}

function mapLocalUser(user: LocalUser): LocalUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
    }
}

function buildNotFoundResponse() {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function isUniqueConstraintConflict(err: unknown): boolean {
    return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002'
}

export async function getOrCreateLocalUser(): Promise<LocalUser> {
    try {
        return await prisma.$transaction(async (tx) => {
            const deterministicOwner = await tx.user.findUnique({
                where: { email: LOCAL_USER_EMAIL },
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            })

            if (deterministicOwner) {
                return mapLocalUser(deterministicOwner)
            }

            const existingUsers = await tx.user.findMany({
                take: 2,
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            })

            if (existingUsers.length === 1) {
                return mapLocalUser(existingUsers[0])
            }

            const created = await tx.user.create({
                data: {
                    email: LOCAL_USER_EMAIL,
                    name: LOCAL_USER_NAME,
                },
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            })

            return mapLocalUser(created)
        })
    } catch (err) {
        if (!isUniqueConstraintConflict(err)) {
            throw err
        }

        const deterministicOwner = await prisma.user.findUnique({
            where: { email: LOCAL_USER_EMAIL },
            select: {
                id: true,
                email: true,
                name: true,
            },
        })

        if (deterministicOwner) {
            return mapLocalUser(deterministicOwner)
        }

        throw err
    }
}

export async function getLocalEpisode(localUserId: string, episodeId: string) {
    const episode = await prisma.episode.findFirst({
        where: {
            id: episodeId,
            project: { userId: localUserId },
        },
        select: {
            id: true,
            projectId: true,
            status: true,
        },
    })

    if (!episode) {
        return { episode: null, error: buildNotFoundResponse() }
    }

    return { episode, error: null }
}

export async function getLocalProject(localUserId: string, projectId: string) {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId: localUserId,
        },
        select: { id: true, userId: true },
    })

    if (!project) {
        return { project: null, error: buildNotFoundResponse() }
    }

    return { project, error: null }
}

export async function getLocalCharacter(localUserId: string, characterId: string) {
    const character = await prisma.character.findFirst({
        where: {
            id: characterId,
            project: { userId: localUserId },
        },
        select: {
            id: true,
            projectId: true,
        },
    })

    if (!character) {
        return { character: null, error: buildNotFoundResponse() }
    }

    return { character, error: null }
}

export async function getLocalUserApiKey(userId: string): Promise<string | null> {
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
        console.error('[LocalUser] Failed to decrypt API key - possible key corruption or wrong ENCRYPTION_SECRET', err)
        return null
    }
}

export async function setLocalUserApiKey(userId: string, apiKey: string | null, provider?: string) {
    await prisma.user.update({
        where: { id: userId },
        data: {
            apiKey: apiKey ? encrypt(apiKey) : null,
            apiProvider: provider ?? null,
        },
    })
}

export async function getLocalUserPreferences(userId: string) {
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

export async function setLocalUserPreferences(userId: string, preferences: Record<string, unknown>) {
    await prisma.user.update({
        where: { id: userId },
        data: { preferences: JSON.stringify(preferences) },
    })
}
