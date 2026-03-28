import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueStoryboard } from '@/lib/queue'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { approveAnalysisRequestSchema } from '@/lib/validators/pipeline'
import { recordPipelineEvent, syncPipelineRunState } from '@/lib/pipeline/run-state'

export const POST = apiHandler(async (request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { runId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, runId)
    if (ownership.error) return ownership.error

    const episode = ownership.episode

    if (episode.status !== 'review_analysis') {
        return NextResponse.json(
            { error: `Cannot approve analysis in status: ${episode.status}` },
            { status: 400 }
        )
    }

    const { characters, locations } = await parseJsonBody(
        request,
        approveAnalysisRequestSchema,
    )

    const uniqueCharacterIds = [...new Set(characters.map((char) => char.id))]
    const uniqueLocationIds = [...new Set(locations.map((location) => location.id))]

    const [ownedCharacters, ownedLocations] = await Promise.all([
        uniqueCharacterIds.length > 0
            ? prisma.character.findMany({
                where: {
                    id: { in: uniqueCharacterIds },
                    projectId: episode.projectId,
                },
                select: { id: true },
            })
            : Promise.resolve([]),
        uniqueLocationIds.length > 0
            ? prisma.location.findMany({
                where: {
                    id: { in: uniqueLocationIds },
                    projectId: episode.projectId,
                },
                select: { id: true },
            })
            : Promise.resolve([]),
    ])

    if (ownedCharacters.length !== uniqueCharacterIds.length || ownedLocations.length !== uniqueLocationIds.length) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
        await Promise.all([
            ...characters.map((char) => tx.character.update({
                where: { id: char.id },
                data: {
                    name: char.name,
                    aliases: char.aliases ?? null,
                    description: char.description,
                },
            })),
            ...locations.map((loc) => tx.location.update({
                where: { id: loc.id },
                data: {
                    name: loc.name,
                    description: loc.description,
                },
            })),
        ])

        await recordPipelineEvent({
            episodeId: runId,
            userId: auth.user.id,
            step: 'review_analysis',
            status: 'completed',
            metadata: {
                characterCount: characters.length,
                locationCount: locations.length,
            },
            client: tx,
        })

        await syncPipelineRunState({
            episodeId: runId,
            userId: auth.user.id,
            episodeStatus: 'storyboarding',
            runStatus: 'running',
            currentStep: 'storyboard',
            client: tx,
        })
    })

    await enqueueStoryboard(runId)

    return NextResponse.json({ ok: true })
})
