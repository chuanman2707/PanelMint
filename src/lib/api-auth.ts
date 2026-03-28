import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { auth as clerkAuth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from './prisma'
import {
    findDomainUserByAuthUserId,
    syncDomainUserFromAuthUser,
    type SessionUser,
} from './auth'

type AuthSuccess = { user: SessionUser; error: null }
type AuthFailure = { user: null; error: NextResponse }
type AuthResult = AuthSuccess | AuthFailure

function buildUnauthorizedResponse() {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function buildSigninPath(fromPath: string) {
    const params = new URLSearchParams()
    params.set('from', fromPath)
    return `/auth/signin?${params.toString()}`
}

async function resolveVerifiedUser(): Promise<SessionUser | null> {
    const { isAuthenticated, userId } = await clerkAuth()

    if (!isAuthenticated || !userId) {
        return null
    }

    const existingDomainUser = await findDomainUserByAuthUserId(userId)
    if (existingDomainUser) {
        return existingDomainUser
    }

    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    return syncDomainUserFromAuthUser(clerkUser)
}

export async function requireAuth(): Promise<AuthResult> {
    const user = await resolveVerifiedUser()
    if (!user) {
        return {
            user: null,
            error: buildUnauthorizedResponse(),
        }
    }

    return { user, error: null }
}

export async function requirePageSession(fromPath: string): Promise<SessionUser> {
    const user = await resolveVerifiedUser()
    if (!user) {
        redirect(buildSigninPath(fromPath))
    }

    return user
}

export async function requireEpisodeOwner(userId: string, episodeId: string) {
    const episode = await prisma.episode.findFirst({
        where: {
            id: episodeId,
            project: { userId },
        },
        select: {
            id: true,
            projectId: true,
            status: true,
        },
    })

    if (!episode) {
        return { episode: null, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }

    return { episode, error: null }
}

export async function requireProjectOwner(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        select: { id: true, userId: true },
    })

    if (!project) {
        return { project: null, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }

    return { project, error: null }
}

export async function requireCharacterOwner(userId: string, characterId: string) {
    const character = await prisma.character.findFirst({
        where: {
            id: characterId,
            project: { userId },
        },
        select: {
            id: true,
            projectId: true,
        },
    })

    if (!character) {
        return { character: null, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
    }

    return { character, error: null }
}
