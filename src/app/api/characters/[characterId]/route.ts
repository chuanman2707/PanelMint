import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireCharacterOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { updateCharacterRequestSchema } from '@/lib/validators/characters'

// GET /api/characters/[characterId]
export const GET = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { characterId } = await context.params
    const ownership = await requireCharacterOwner(auth.user.id, characterId)
    if (ownership.error) return ownership.error

    const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: { appearances: { orderBy: { appearanceIndex: 'asc' } } },
    })
    if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(character)
})

// PUT /api/characters/[characterId] — Update description
export const PUT = apiHandler(async (request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { characterId } = await context.params
    const ownership = await requireCharacterOwner(auth.user.id, characterId)
    if (ownership.error) return ownership.error

    const { description, name } = await parseJsonBody(request, updateCharacterRequestSchema)

    const character = await prisma.character.update({
        where: { id: characterId },
        data: {
            ...(description !== undefined ? { description } : {}),
            ...(name !== undefined ? { name } : {}),
        },
    })

    return NextResponse.json(character)
})

// DELETE /api/characters/[characterId]
export const DELETE = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { characterId } = await context.params
    const ownership = await requireCharacterOwner(auth.user.id, characterId)
    if (ownership.error) return ownership.error

    await prisma.character.delete({ where: { id: characterId } })
    return NextResponse.json({ success: true })
})
