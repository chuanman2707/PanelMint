import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueImageGen } from '@/lib/queue'
import { getLocalEpisode, getOrCreateLocalUser } from '@/lib/local-user'
import { checkRateLimit, IMAGE_GEN_LIMIT } from '@/lib/api-rate-limit'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { generateImagesRequestSchema } from '@/lib/validators/pipeline'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'

export const POST = apiHandler(async (request, context) => {
    const localUser = await getOrCreateLocalUser()

    const rateLimited = await checkRateLimit('image-gen', localUser.id, IMAGE_GEN_LIMIT)
    if (rateLimited) return rateLimited

    const { runId } = await context.params
    const ownership = await getLocalEpisode(localUser.id, runId)
    if (ownership.error) return ownership.error

    const episode = await prisma.episode.findUnique({
        where: { id: runId },
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
        select: { id: true },
    })

    if (panels.length === 0) {
        return NextResponse.json({
            error: 'No panels need image generation. Approve panels first.',
        }, { status: 400 })
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
            userId: localUser.id,
            episodeStatus: 'imaging',
            runStatus: 'running',
            currentStep: 'image_gen',
            client: tx,
        })

        await recordPipelineEvent({
            episodeId: runId,
            userId: localUser.id,
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
