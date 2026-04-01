import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateCharacterSheet } from '@/lib/ai/character-design'
import { getProviderConfig } from '@/lib/api-config'
import { requireAuth, requireCharacterOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { ACTION_CREDIT_COSTS, deductCredits, refundCredits } from '@/lib/billing'

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

    const providerConfig = await getProviderConfig(auth.user.id)
    const operationKey = `manual_character_sheet:${character.id}:${Date.now()}`
    const refundOperationKey = `refund:${operationKey}`
    let charged = false

    try {
        const didCharge = await deductCredits(
            auth.user.id,
            ACTION_CREDIT_COSTS.standard_image,
            'character_sheet_generation',
            undefined,
            { operationKey },
        )
        if (!didCharge) {
            return NextResponse.json({ error: 'Duplicate character sheet request' }, { status: 409 })
        }
        charged = true

        const { imageUrl, storageKey } = await generateCharacterSheet(
            character.id,
            character.description,
            character.project.artStyle,
            providerConfig,
            auth.user.id,
        )

        if (!imageUrl) {
            throw new Error(`Character sheet returned no image for ${character.name}`)
        }

        await prisma.character.update({
            where: { id: characterId },
            data: { imageUrl, storageKey },
        })

        return NextResponse.json({ imageUrl })
    } catch (error) {
        if (charged) {
            await refundCredits(
                auth.user.id,
                ACTION_CREDIT_COSTS.standard_image,
                `character sheet failed: ${character.name}`,
                undefined,
                { operationKey: refundOperationKey },
            ).catch(console.error)
        }

        throw error
    }
})
