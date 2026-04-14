import { prisma } from '@/lib/prisma'
import { getProviderConfig } from '@/lib/api-config'
import { generateCharacterSheet } from '@/lib/ai/character-design'
import { WAVESPEED_IMAGE_POLL_TIMEOUT_MS } from '@/lib/pipeline/image-gen'
import {
    ACTION_CREDIT_COSTS,
    deductCredits,
    refundCredits,
} from '@/lib/billing'
import { recordPipelineEvent } from './run-state'

const CHARACTER_SHEET_TIMEOUT_MS = WAVESPEED_IMAGE_POLL_TIMEOUT_MS + (3 * 60_000)

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)

        promise
            .then((value) => {
                clearTimeout(timer)
                resolve(value)
            })
            .catch((error) => {
                clearTimeout(timer)
                reject(error)
            })
    })
}

export async function getCharacterSheetDispatchPayloads(episodeId: string) {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
            id: true,
            projectId: true,
            project: {
                select: {
                    userId: true,
                },
            },
        },
    })

    if (!episode?.project.userId) {
        throw new Error(`Episode ${episodeId} is missing a project owner.`)
    }

    const characters = await prisma.character.findMany({
        where: {
            projectId: episode.projectId,
            description: { not: null },
        },
        select: { id: true },
    })

    return {
        userId: episode.project.userId,
        characterIds: characters.map((character) => character.id),
    }
}

export async function runCharacterSheetStep(input: {
    episodeId: string
    userId: string
    characterId: string
    attempt?: number
}): Promise<void> {
    const { episodeId, userId, characterId } = input
    const attempt = input.attempt ?? 1

    const character = await prisma.character.findUnique({
        where: { id: characterId },
        include: {
            project: {
                select: {
                    userId: true,
                    artStyle: true,
                },
            },
        },
    })

    if (!character || character.project.userId !== userId) {
        return
    }

    if (!character.description || character.imageUrl) {
        return
    }

    const operationKey = `character_sheet:${episodeId}:${character.id}:${attempt}`
    const refundOperationKey = `refund:${operationKey}`
    let charged = false

    await recordPipelineEvent({
        episodeId,
        userId,
        step: `character_sheet:${character.id}`,
        status: 'started',
        metadata: {
            characterId: character.id,
            characterName: character.name,
        },
    })

    try {
        const providerConfig = await getProviderConfig(userId)

        const didCharge = await deductCredits(
            userId,
            ACTION_CREDIT_COSTS.standard_image,
            'character_sheet_generation',
            episodeId,
            { operationKey },
        )
        if (!didCharge) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `character_sheet:${character.id}`,
                status: 'skipped',
                metadata: {
                    attempt,
                    characterId: character.id,
                    characterName: character.name,
                    reason: 'duplicate_credit_operation',
                },
                creditOperationKey: operationKey,
            })
            return
        }
        charged = true

        const { imageUrl, storageKey } = await withTimeout(
            generateCharacterSheet(
                character.id,
                character.description,
                character.project.artStyle,
                providerConfig,
                userId,
                episodeId,
            ),
            CHARACTER_SHEET_TIMEOUT_MS,
            `Character sheet generation for ${character.name}`,
        )

        if (!imageUrl) {
            throw new Error(`Character sheet returned no image for ${character.name}`)
        }

        await prisma.character.update({
            where: { id: character.id },
            data: { imageUrl, storageKey },
        })

        await recordPipelineEvent({
            episodeId,
            userId,
            step: `character_sheet:${character.id}`,
            status: 'completed',
            metadata: {
                characterId: character.id,
                characterName: character.name,
                attempt,
                imageUrl,
                storageKey,
            },
            creditOperationKey: operationKey,
        })
    } catch (err) {
        if (charged) {
            await refundCredits(
                userId,
                ACTION_CREDIT_COSTS.standard_image,
                `character sheet failed: ${character.name}`,
                episodeId,
                { operationKey: refundOperationKey },
            ).catch(console.error)
        }

        await recordPipelineEvent({
            episodeId,
            userId,
            step: `character_sheet:${character.id}`,
            status: 'failed',
            metadata: {
                characterId: character.id,
                characterName: character.name,
                attempt,
                error: err instanceof Error ? err.message : 'Unknown character sheet failure',
            },
            creditOperationKey: operationKey,
        }).catch(console.error)
    }
}
