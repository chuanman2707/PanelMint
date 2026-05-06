import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCharacterSheet } from '@/lib/ai/character-design'
import { getProviderConfig } from '@/lib/api-config'
import { getLocalCharacter, getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'

// POST /api/characters/[characterId]/generate-sheet — Generate character reference image
export const POST = apiHandler(async (_request, context) => {
    const localUser = await getOrCreateLocalUser()

    const { characterId } = await context.params
    const ownership = await getLocalCharacter(localUser.id, characterId)
    if (ownership.error) return ownership.error

    const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: { project: true },
    })

    if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (!character.description) {
        return NextResponse.json({ error: 'Character needs a description first' }, { status: 400 })
    }

    const providerConfig = await getProviderConfig(localUser.id)
    const { imageUrl, storageKey } = await generateCharacterSheet(
        character.id,
        character.description,
        character.project.artStyle,
        providerConfig,
        localUser.id,
    )

    if (!imageUrl) {
        throw new Error(`Character sheet returned no image for ${character.name}`)
    }

    await prisma.character.update({
        where: { id: characterId },
        data: { imageUrl, storageKey },
    })

    return NextResponse.json({ imageUrl })
})
