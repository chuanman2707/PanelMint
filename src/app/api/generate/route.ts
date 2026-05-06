import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueAnalyze } from '@/lib/queue'
import { getOrCreateLocalUser } from '@/lib/local-user'
import { checkRateLimit, GENERATE_LIMIT } from '@/lib/api-rate-limit'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { generateRequestSchema } from '@/lib/validators/generate'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'

export const POST = apiHandler(async (request) => {
    const localUser = await getOrCreateLocalUser()

    const rateLimited = await checkRateLimit('generate', localUser.id, GENERATE_LIMIT)
    if (rateLimited) return rateLimited

    // Prevent duplicate pipelines — check if user already has an in-progress episode
    const inProgress = await prisma.episode.findFirst({
        where: {
            project: { userId: localUser.id },
            status: { in: ['queued', 'analyzing', 'storyboarding', 'imaging'] },
        },
    })
    if (inProgress) {
        return NextResponse.json(
            { error: 'A generation is already in progress', existingRunId: inProgress.id },
            { status: 409 }
        )
    }

    const {
        text,
        artStyle: normalizedArtStyle,
        pageCount: clampedPageCount,
    } = await parseJsonBody(request, generateRequestSchema)

    // Create project + episode
    const { project, episode } = await prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
            data: {
                userId: localUser.id,
                name: `Comic ${new Date().toLocaleString('vi-VN')}`,
                artStyle: normalizedArtStyle,
                episodes: {
                    create: {
                        name: 'Chapter 1',
                        novelText: text.trim(),
                        pageCount: clampedPageCount,
                        status: 'queued',
                    },
                },
            },
            include: { episodes: true },
        })

        const episode = project.episodes[0]

        await syncPipelineRunState({
            episodeId: episode.id,
            userId: localUser.id,
            episodeStatus: 'queued',
            client: tx,
        })

        await recordPipelineEvent({
            episodeId: episode.id,
            userId: localUser.id,
            step: 'analyze',
            status: 'queued',
            metadata: {
                projectId: project.id,
                pageCount: clampedPageCount,
            },
            client: tx,
        })

        return { project, episode }
    })

    await enqueueAnalyze({
        episodeId: episode.id,
        userId: localUser.id,
        projectId: project.id,
        text: text.trim(),
        artStyle: normalizedArtStyle,
        pageCount: clampedPageCount,
    })

    return NextResponse.json({
        runId: episode.id,
        projectId: project.id,
    })
})
