import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueImageGen } from '@/lib/queue'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { checkRateLimit, IMAGE_GEN_LIMIT } from '@/lib/api-rate-limit'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { generateImagesRequestSchema } from '@/lib/validators/pipeline'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'
import { findMissingReferenceCharacters } from '@/lib/pipeline/reference-images'
import {
    checkCredits,
    getImageGenerationCreditCost,
    normalizeImageModelTier,
} from '@/lib/billing'
import { AppError } from '@/lib/errors'

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

export const POST = apiHandler(async (request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const rateLimited = await checkRateLimit('image-gen', auth.user.id, IMAGE_GEN_LIMIT)
    if (rateLimited) return rateLimited

    const { runId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, runId)
    if (ownership.error) return ownership.error

    const episode = await prisma.episode.findUnique({
        where: { id: runId },
        include: {
            project: {
                select: {
                    id: true,
                    imageModel: true,
                },
            },
        },
    })

    if (!episode) {
        return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    if (!['review_storyboard', 'imaging', 'done'].includes(episode.status)) {
        return NextResponse.json(
            { error: `Cannot generate images in status: ${episode.status}` },
            { status: 400 }
        )
    }

    const { panelIds } = await parseJsonBody(
        request,
        generateImagesRequestSchema,
        { allowEmptyBody: true },
    )
    const requestedPanelIds = panelIds ? [...new Set(panelIds)] : null

    if (requestedPanelIds?.length) {
        const accessiblePanels = await prisma.panel.findMany({
            where: {
                id: { in: requestedPanelIds },
                page: { episodeId: runId },
            },
            select: { id: true },
        })

        if (accessiblePanels.length !== requestedPanelIds.length) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
    }

    const panels = await prisma.panel.findMany({
        where: {
            page: { episodeId: runId },
            approved: true,
            imageUrl: null,
            status: { in: ['pending', 'error', 'content_filtered'] },
            ...(requestedPanelIds ? { id: { in: requestedPanelIds } } : {}),
        },
        select: {
            id: true,
            characters: true,
        },
    })

    if (panels.length === 0) {
        return NextResponse.json({
            error: 'No panels need image generation. Approve panels first.',
        }, { status: 400 })
    }

    const imageModelTier = normalizeImageModelTier(episode.project?.imageModel)
    if (imageModelTier === 'premium') {
        const projectCharacters = await prisma.character.findMany({
            where: { projectId: episode.project.id },
            select: {
                name: true,
                imageUrl: true,
                storageKey: true,
                appearances: {
                    where: { isDefault: true },
                    select: { imageUrl: true, storageKey: true, isDefault: true },
                },
            },
        })

        const missingReferenceCharacters = [...new Set(
            panels.flatMap((panel) =>
                findMissingReferenceCharacters(
                    parsePanelCharacterNames(panel.characters),
                    projectCharacters,
                )
            ),
        )]

        if (missingReferenceCharacters.length > 0) {
            return NextResponse.json({
                error: 'Character sheets are still generating. Please wait for reference images before rendering panels.',
                missingCharacters: missingReferenceCharacters,
            }, { status: 409 })
        }
    }

    const totalCreditCost = panels.length * getImageGenerationCreditCost(imageModelTier)
    const hasCredits = await checkCredits(auth.user.id, totalCreditCost)
    if (!hasCredits) {
        throw new AppError(
            'Insufficient credits. Purchase more credits to generate these images.',
            402,
        )
    }

    await prisma.$transaction(async (tx) => {
        await tx.episode.update({
            where: { id: runId },
            data: { status: 'imaging', progress: 50, error: null },
        })

        await tx.panel.updateMany({
            where: { id: { in: panels.map((panel) => panel.id) } },
            data: { status: 'queued' },
        })

        await syncPipelineRunState({
            episodeId: runId,
            userId: auth.user.id,
            episodeStatus: 'imaging',
            runStatus: 'running',
            currentStep: 'image_gen',
            client: tx,
        })

        await recordPipelineEvent({
            episodeId: runId,
            userId: auth.user.id,
            step: 'image_gen',
            status: 'queued',
            metadata: {
                panelCount: panels.length,
                panelIds: panels.map((panel) => panel.id),
            },
            client: tx,
        })
    })

    await enqueueImageGen(runId, panels.map((panel) => panel.id))

    return NextResponse.json({
        ok: true,
        generating: panels.length,
        message: `Generating ${panels.length} panel images`,
    })
})
