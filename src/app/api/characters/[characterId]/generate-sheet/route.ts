import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCharacterSheet } from '@/lib/ai/character-design'
import { requireAuth, requireCharacterOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

// POST /api/characters/[characterId]/generate-sheet — Generate character reference image
export const POST = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { characterId } = await context.params
    const ownership = await requireCharacterOwner(auth.user.id, characterId)
    if (ownership.error) return ownership.error

    const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: { project: true },
    })

    if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!character.description) {
        return NextResponse.json({ error: 'Character needs a description first' }, { status: 400 })
    }

    const { imageUrl } = await generateCharacterSheet(
        character.id,
        character.description,
        character.project.artStyle,
        undefined,
        auth.user.id,
    )

    await prisma.character.update({
        where: { id: characterId },
        data: { imageUrl },
    })

    return NextResponse.json({ imageUrl })
})
