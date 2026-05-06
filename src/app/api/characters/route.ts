import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocalProject, getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { createCharacterRequestSchema } from '@/lib/validators/characters'

// GET /api/characters?projectId=xxx — List characters for a project
export const GET = apiHandler(async (request) => {
    const localUser = await getOrCreateLocalUser()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

    const ownership = await getLocalProject(localUser.id, projectId)
    if (ownership.error) return ownership.error

    const characters = await prisma.character.findMany({
        where: { projectId },
        include: { appearances: { orderBy: { appearanceIndex: 'asc' } } },
        orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(characters)
})

// POST /api/characters — Create a character manually
export const POST = apiHandler(async (request) => {
    const localUser = await getOrCreateLocalUser()

    const { projectId, name, description } = await parseJsonBody(request, createCharacterRequestSchema)

    const ownership = await getLocalProject(localUser.id, projectId)
    if (ownership.error) return ownership.error

    const character = await prisma.character.create({
        data: {
            projectId,
            name,
            description: description ?? undefined,
        },
    })

    return NextResponse.json(character)
})
