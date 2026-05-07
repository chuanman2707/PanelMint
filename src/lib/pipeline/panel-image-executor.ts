import type { ProviderConfig } from '@/lib/api-config'
import { prisma } from '@/lib/prisma'
import { buildCharacterCanon } from './character-canon'
import { generatePanelImage, ContentFilterError, ServiceError } from './image-gen'
import { collectPanelReferenceImages } from './reference-images'
import { prepareWaveSpeedReferenceImages } from './wavespeed-media'
import { recordPipelineEvent } from './run-state'

interface CharacterAppearance {
    imageUrl: string | null
    storageKey?: string | null
    isDefault: boolean
}

interface PanelCharacter {
    id: string
    name: string
    description: string | null
    identityJson: string | null
    imageUrl: string | null
    storageKey?: string | null
    appearances: CharacterAppearance[]
}

interface PanelRecord {
    id: string
    approvedPrompt: string | null
    description: string | null
    shotType: string | null
    characters: string | null
    location: string | null
    sourceExcerpt?: string | null
    mustKeep?: string | null
    mood: string | null
    lighting: string | null
}

export type PanelExecutionResult = 'done' | 'content_filtered' | 'error' | 'skipped'

interface ExecutePanelImageGenerationInput {
    panel: PanelRecord
    dbCharacters: PanelCharacter[]
    providerConfig: ProviderConfig
    artStyle: string
    userId: string
    episodeId: string
}

function parsePanelCharacterNames(rawCharacters: string | null): string[] {
    if (!rawCharacters) return []

    try {
        const parsed = JSON.parse(rawCharacters) as unknown
        return Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
            : []
    } catch {
        return []
    }
}

function parseMustKeep(rawMustKeep: string | null | undefined): string[] {
    if (!rawMustKeep) return []

    try {
        const parsed = JSON.parse(rawMustKeep) as unknown
        return Array.isArray(parsed)
            ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            : []
    } catch {
        return []
    }
}

async function episodeCancellationRequested(episodeId: string): Promise<boolean> {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: { status: true },
    })

    return episode?.status === 'error'
}

export async function executePanelImageGeneration({
    panel,
    dbCharacters,
    providerConfig,
    artStyle,
    userId,
    episodeId,
}: ExecutePanelImageGenerationInput): Promise<PanelExecutionResult> {
    const panelCharNames = parsePanelCharacterNames(panel.characters)
    const referenceCandidates = await collectPanelReferenceImages(panelCharNames, dbCharacters)
    const panelCharCanon = buildCharacterCanon(dbCharacters, panelCharNames)
    const mustKeep = parseMustKeep(panel.mustKeep)

    if (await episodeCancellationRequested(episodeId)) {
        return 'skipped'
    }

    const reservation = await prisma.panel.updateMany({
        where: {
            id: panel.id,
            imageUrl: null,
            status: { in: ['pending', 'error', 'queued', 'generating'] },
        },
        data: {
            status: 'generating',
            generationAttempt: { increment: 1 },
        },
    })

    if (reservation.count === 0) {
        return 'skipped'
    }

    const reservedPanel = await prisma.panel.findUnique({
        where: { id: panel.id },
        select: { generationAttempt: true },
    })
    const generationAttempt = reservedPanel?.generationAttempt ?? 1

    await recordPipelineEvent({
        episodeId,
        userId,
        step: `image_panel:${panel.id}`,
        status: 'started',
        metadata: {
            attempt: generationAttempt,
            panelId: panel.id,
        },
    })

    try {
        const referenceImages = await prepareWaveSpeedReferenceImages(referenceCandidates, providerConfig)
        const imageAsset = await generatePanelImage({
            panelId: panel.id,
            description: panel.approvedPrompt || panel.description || '',
            characters: panelCharNames,
            shotType: panel.shotType || 'medium',
            location: panel.location || '',
            sourceExcerpt: panel.sourceExcerpt,
            mustKeep,
            artStyle,
            characterCanon: panelCharCanon,
            referenceImages,
            mood: panel.mood || undefined,
            lighting: panel.lighting || undefined,
            providerConfig,
            userId,
            episodeId,
        })

        if (await episodeCancellationRequested(episodeId)) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `image_panel:${panel.id}`,
                status: 'cancelled',
                metadata: {
                    attempt: generationAttempt,
                    panelId: panel.id,
                },
            })
            return 'skipped'
        }

        await prisma.panel.update({
            where: { id: panel.id },
            data: {
                imageUrl: imageAsset.imageUrl,
                storageKey: imageAsset.storageKey,
                status: 'done',
            },
        })

        await recordPipelineEvent({
            episodeId,
            userId,
            step: `image_panel:${panel.id}`,
            status: 'completed',
            metadata: {
                attempt: generationAttempt,
                imageUrl: imageAsset.imageUrl,
                storageKey: imageAsset.storageKey,
                panelId: panel.id,
            },
        })

        return 'done'
    } catch (err) {
        if (await episodeCancellationRequested(episodeId)) {
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `image_panel:${panel.id}`,
                status: 'cancelled',
                metadata: {
                    attempt: generationAttempt,
                    panelId: panel.id,
                },
            })
            return 'skipped'
        }

        if (err instanceof ContentFilterError) {
            await prisma.panel.update({
                where: { id: panel.id },
                data: { status: 'content_filtered' },
            })
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `image_panel:${panel.id}`,
                status: 'failed',
                metadata: {
                    attempt: generationAttempt,
                    error: err.message,
                    failureType: 'content_filter',
                    panelId: panel.id,
                },
            })
            return 'content_filtered'
        }

        if (err instanceof ServiceError) {
            await prisma.panel.update({
                where: { id: panel.id },
                data: { status: 'error' },
            })
            await recordPipelineEvent({
                episodeId,
                userId,
                step: `image_panel:${panel.id}`,
                status: 'failed',
                metadata: {
                    attempt: generationAttempt,
                    error: err.message,
                    failureType: 'service_error',
                    panelId: panel.id,
                },
            })
            throw err
        }

        await prisma.panel.update({
            where: { id: panel.id },
            data: { status: 'error' },
        })
        await recordPipelineEvent({
            episodeId,
            userId,
            step: `image_panel:${panel.id}`,
            status: 'failed',
            metadata: {
                attempt: generationAttempt,
                error: err instanceof Error ? err.message : 'Unknown panel generation failure',
                failureType: 'generic',
                panelId: panel.id,
            },
        })
        return 'error'
    }
}
