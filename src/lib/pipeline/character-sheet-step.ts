import { prisma } from '@/lib/prisma'
import { getProviderConfig } from '@/lib/api-config'
import { generateCharacterSheet } from '@/lib/ai/character-design'
import { WAVESPEED_IMAGE_POLL_TIMEOUT_MS } from '@/lib/pipeline/image-gen'
import { recordPipelineEvent } from './run-state'

const CHARACTER_SHEET_TIMEOUT_MS = WAVESPEED_IMAGE_POLL_TIMEOUT_MS + (3 * 60_000)

async function episodeCancellationRequested(episodeId: string): Promise<boolean> {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: { status: true },
    })

    return episode?.status === 'error'
}

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

    await recordPipelineEvent({
        episodeId,
        userId,
        step: `character_sheet:${character.id}`,
        status: 'started',
        metadata: {
            attempt,
            characterId: character.id,
            characterName: character.name,
        },
    })

    try {
        if (await episodeCancellationRequested(episodeId)) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `character_sheet:${character.id}`,
                status: 'cancelled',
                metadata: {
                    attempt,
                    characterId: character.id,
                    characterName: character.name,
                },
            })
            return
        }

        const providerConfig = await getProviderConfig(userId)

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

        if (await episodeCancellationRequested(episodeId)) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `character_sheet:${character.id}`,
                status: 'cancelled',
                metadata: {
                    attempt,
                    characterId: character.id,
                    characterName: character.name,
                },
            })
            return
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
        })
    } catch (err) {
        if (await episodeCancellationRequested(episodeId)) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `character_sheet:${character.id}`,
                status: 'cancelled',
                metadata: {
                    attempt,
                    characterId: character.id,
                    characterName: character.name,
                },
            }).catch(console.error)
            return
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
        }).catch(console.error)
        throw err
    }
}
