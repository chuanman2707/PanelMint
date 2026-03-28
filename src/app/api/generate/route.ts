import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueAnalyze } from '@/lib/queue'
import { requireAuth } from '@/lib/api-auth'
import { checkRateLimit, GENERATE_LIMIT } from '@/lib/api-rate-limit'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { generateRequestSchema } from '@/lib/validators/generate'
import { AppError } from '@/lib/errors'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'
import {
    ACTION_CREDIT_COSTS,
    canAccessPremium,
    checkCredits,
    normalizeImageModelTier,
} from '@/lib/billing'

export const POST = apiHandler(async (request) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const rateLimited = await checkRateLimit('generate', auth.user.id, GENERATE_LIMIT)
    if (rateLimited) return rateLimited

    // Prevent duplicate pipelines — check if user already has an in-progress episode
    const inProgress = await prisma.episode.findFirst({
        where: {
            project: { userId: auth.user.id },
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
        imageModelTier,
    } = await parseJsonBody(request, generateRequestSchema)

    const normalizedImageModelTier = normalizeImageModelTier(imageModelTier)

    if (normalizedImageModelTier === 'premium' && !canAccessPremium(auth.user.accountTier as 'free' | 'paid')) {
        throw AppError.forbidden('Premium image generation unlocks after your first credit purchase.')
    }

    const hasCreditsForKickoff = await checkCredits(auth.user.id, ACTION_CREDIT_COSTS.llm_generation)
    if (!hasCreditsForKickoff) {
        throw new AppError(
            'Insufficient credits. You need at least 80 credits to start generation.',
            402,
        )
    }

    // Create project + episode
    const { project, episode } = await prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
            data: {
                userId: auth.user.id,
                name: `Comic ${new Date().toLocaleString('vi-VN')}`,
                artStyle: normalizedArtStyle,
                imageModel: normalizedImageModelTier,
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
            userId: auth.user.id,
            episodeStatus: 'queued',
            client: tx,
        })

        await recordPipelineEvent({
            episodeId: episode.id,
            userId: auth.user.id,
            step: 'analyze',
            status: 'queued',
            metadata: {
                projectId: project.id,
                pageCount: clampedPageCount,
                imageModelTier: normalizedImageModelTier,
            },
            client: tx,
        })

        return { project, episode }
    })

    await enqueueAnalyze({
        episodeId: episode.id,
        userId: auth.user.id,
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
