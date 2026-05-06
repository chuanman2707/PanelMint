import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocalEpisode, getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { approveStoryboardRequestSchema } from '@/lib/validators/pipeline'
import { recordPipelineEvent } from '@/lib/pipeline/run-state'
import { deriveEffectiveEpisodePhase } from '@/lib/pipeline/episode-phase'

export const POST = apiHandler(async (request, context) => {
    const localUser = await getOrCreateLocalUser()

    const { runId } = await context.params
    const ownership = await getLocalEpisode(localUser.id, runId)
    if (ownership.error) return ownership.error

    const episode = ownership.episode

    if (episode.status !== 'review_storyboard') {
        const episodeSnapshot = await prisma.episode.findUnique({
            where: { id: runId },
            select: {
                status: true,
                progress: true,
                pages: {
                    select: {
                        panels: {
                            select: {
                                approved: true,
                                imageUrl: true,
                                status: true,
                                updatedAt: true,
                            },
                        },
                    },
                },
            },
        })

        const effectivePhase = episodeSnapshot
            ? deriveEffectiveEpisodePhase(episodeSnapshot).phase
            : episode.status

        if (effectivePhase !== 'review_storyboard') {
            return NextResponse.json(
                { error: `Cannot approve storyboard in status: ${episode.status}` },
                { status: 400 }
            )
        }
    }

    const { panels } = await parseJsonBody(request, approveStoryboardRequestSchema)
    const requestedPanelIds = [...new Set(panels.map((panel) => panel.id).filter(Boolean))]

    const ownedPanels = requestedPanelIds.length > 0
        ? await prisma.panel.findMany({
            where: {
                id: { in: requestedPanelIds },
                page: { episodeId: runId },
            },
            select: { id: true },
        })
        : []

    if (ownedPanels.length !== requestedPanelIds.length) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    let approvedCount = 0
    for (const panel of panels) {
        await prisma.panel.update({
            where: { id: panel.id },
            data: {
                approved: panel.approved === true,
                approvedPrompt: panel.editedPrompt ?? null,
            },
        })

        if (panel.approved) approvedCount++
    }

    await recordPipelineEvent({
        episodeId: runId,
        userId: localUser.id,
        step: 'review_storyboard',
        status: 'completed',
        metadata: {
            approvedCount,
            panelCount: panels.length,
        },
    })

    return NextResponse.json({
        ok: true,
        approvedCount,
    })
})
