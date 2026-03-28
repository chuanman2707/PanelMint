import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { cancelEpisodePipelineJobs } from '@/lib/queue'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'

const CANCELLABLE_STATUSES = ['pending', 'queued', 'analyzing', 'storyboarding', 'imaging', 'review_analysis', 'review_storyboard']

export const POST = apiHandler(async (request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { runId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, runId)
    if (ownership.error) return ownership.error

    const episode = await prisma.episode.findUnique({
        where: { id: runId },
        select: { status: true },
    })

    if (!episode) {
        return NextResponse.json({ error: 'Episode not found' }, { status: 404 })
    }

    if (!CANCELLABLE_STATUSES.includes(episode.status)) {
        return NextResponse.json(
            { error: `Cannot cancel episode in status: ${episode.status}` },
            { status: 400 },
        )
    }

    const cancelledJobs = await cancelEpisodePipelineJobs(runId)

    await prisma.$transaction(async (tx) => {
        await tx.episode.update({
            where: { id: runId },
            data: { status: 'error', error: 'Cancelled by user' },
        })

        await tx.panel.updateMany({
            where: {
                page: { episodeId: runId },
                status: 'queued',
            },
            data: { status: 'error' },
        })

        await syncPipelineRunState({
            episodeId: runId,
            userId: auth.user.id,
            episodeStatus: 'error',
            runStatus: 'cancelled',
            currentStep: 'cancelled',
            error: 'Cancelled by user',
            completedAt: new Date(),
            client: tx,
        })

        await recordPipelineEvent({
            episodeId: runId,
            userId: auth.user.id,
            step: 'cancelled',
            status: 'cancelled',
            metadata: { cancelledJobs },
            client: tx,
        })
    })

    return NextResponse.json({ ok: true, message: 'Generation cancelled', cancelledJobs })
})
