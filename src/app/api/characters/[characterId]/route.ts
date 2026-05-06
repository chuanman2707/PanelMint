import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocalCharacter, getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { getProviderConfig } from '@/lib/api-config'
import { generateCharacterDescription } from '@/lib/ai/character-design'
import { updateCharacterRequestSchema } from '@/lib/validators/characters'

// GET /api/characters/[characterId]
export const GET = apiHandler(async (_request, context) => {
    const localUser = await getOrCreateLocalUser()

    const { characterId } = await context.params
    const ownership = await getLocalCharacter(localUser.id, characterId)
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
    const localUser = await getOrCreateLocalUser()

    const { characterId } = await context.params
    const ownership = await getLocalCharacter(localUser.id, characterId)
    if (ownership.error) return ownership.error

    const { description, name } = await parseJsonBody(request, updateCharacterRequestSchema)
    const currentCharacter = await prisma.character.findUnique({
        where: { id: characterId },
        select: {
            id: true,
            name: true,
            description: true,
        },
    })

    if (!currentCharacter) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const nextName = name ?? currentCharacter.name
    const nextDescription = description ?? currentCharacter.description
    let identityJson: string | null | undefined

    if (description !== undefined) {
        identityJson = null

        if (nextDescription) {
            try {
                const providerConfig = await getProviderConfig(localUser.id)
                const generated = await generateCharacterDescription(
                    nextName,
                    nextDescription,
                    nextDescription,
                    providerConfig,
                )
                identityJson = JSON.stringify(generated.identityJson)
            } catch (error) {
                console.warn('[Characters] Failed to regenerate identity anchor after description edit:', error)
            }
        }
    }

    const character = await prisma.character.update({
        where: { id: characterId },
        data: {
            ...(description !== undefined ? { description } : {}),
            ...(name !== undefined ? { name } : {}),
            ...(identityJson !== undefined ? { identityJson } : {}),
        },
    })

    return NextResponse.json(character)
})

// DELETE /api/characters/[characterId]
export const DELETE = apiHandler(async (_request, context) => {
    const localUser = await getOrCreateLocalUser()

    const { characterId } = await context.params
    const ownership = await getLocalCharacter(localUser.id, characterId)
    if (ownership.error) return ownership.error

    await prisma.character.delete({ where: { id: characterId } })
    return NextResponse.json({ success: true })
})
