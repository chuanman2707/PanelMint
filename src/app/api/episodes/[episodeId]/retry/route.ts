import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueImageGen } from '@/lib/queue'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { checkRateLimit, RETRY_LIMIT } from '@/lib/api-rate-limit'
import { AppError } from '@/lib/errors'
import {
    checkCredits,
    getImageGenerationCreditCost,
    normalizeImageModelTier,
} from '@/lib/billing'
import { parseJsonBody } from '@/lib/api-validate'
import { retryRequestSchema } from '@/lib/validators/pipeline'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'

export const POST = apiHandler(async (request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const rateLimited = await checkRateLimit('retry-images', auth.user.id, RETRY_LIMIT)
    if (rateLimited) return rateLimited

    const { episodeId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, episodeId)
    if (ownership.error) return ownership.error

    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        include: {
            project: { select: { id: true, imageModel: true } },
        },
    })

    if (!episode) {
        return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    const { panelIds } = await parseJsonBody(
        request,
        retryRequestSchema,
        { allowEmptyBody: true },
    )
    const requestedPanelIds = panelIds ? [...new Set(panelIds)] : null

    if (requestedPanelIds?.length) {
        const accessiblePanels = await prisma.panel.findMany({
            where: {
                id: { in: requestedPanelIds },
                page: { episodeId },
            },
            select: { id: true },
        })

        if (accessiblePanels.length !== requestedPanelIds.length) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
    }

    const failedPanels = await prisma.panel.findMany({
        where: {
            page: { episodeId },
            status: { in: ['error', 'pending'] },
            approved: true,
            ...(requestedPanelIds ? { id: { in: requestedPanelIds } } : {}),
        },
        orderBy: [{ page: { pageIndex: 'asc' } }, { panelIndex: 'asc' }],
        select: { id: true },
    })

    if (failedPanels.length === 0) {
        return NextResponse.json({ message: 'No failed panels to retry', retried: 0 })
    }

    const imageModelTier = normalizeImageModelTier(episode.project.imageModel)
    const totalCreditCost = failedPanels.length * getImageGenerationCreditCost(imageModelTier)
    const hasCredits = await checkCredits(auth.user.id, totalCreditCost)
    if (!hasCredits) {
        throw new AppError(
            'Insufficient credits. Purchase more credits to retry failed panels.',
            402,
        )
    }

    await prisma.$transaction(async (tx) => {
        await tx.episode.update({
            where: { id: episodeId },
            data: { status: 'imaging', progress: 50, error: null },
        })

        await tx.panel.updateMany({
            where: { id: { in: failedPanels.map((panel) => panel.id) } },
            data: { status: 'queued' },
        })

        await syncPipelineRunState({
            episodeId,
            userId: auth.user.id,
            episodeStatus: 'imaging',
            runStatus: 'running',
            currentStep: 'image_gen',
            client: tx,
        })

        await recordPipelineEvent({
            episodeId,
            userId: auth.user.id,
            step: 'image_gen',
            status: 'queued',
            metadata: {
                retry: true,
                panelCount: failedPanels.length,
                panelIds: failedPanels.map((panel) => panel.id),
            },
            client: tx,
        })
    })

    await enqueueImageGen(
        episodeId,
        failedPanels.map((panel) => panel.id),
    )

    return NextResponse.json({
        message: `Retrying ${failedPanels.length} panels`,
        retrying: failedPanels.length,
    })
})
