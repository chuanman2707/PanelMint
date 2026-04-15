import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { deriveEffectiveEpisodePhase } from '@/lib/pipeline/episode-phase'

export const GET = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { runId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, runId)
    if (ownership.error) return ownership.error

    const episode = await prisma.episode.findUnique({
        where: { id: runId },
        include: {
            project: true,
            pages: {
                orderBy: { pageIndex: 'asc' },
                include: {
                    panels: {
                        orderBy: { panelIndex: 'asc' },
                    },
                },
            },
        },
    })

    if (!episode) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const totalPanels = episode.pages.reduce((sum, p) => sum + p.panels.length, 0)
    const completedPanels = episode.pages.reduce(
        (sum, p) => sum + p.panels.filter((panel) => panel.status === 'done').length,
        0
    )
    const effectiveState = deriveEffectiveEpisodePhase(episode)

    // Base response
    const response: Record<string, unknown> = {
        phase: effectiveState.phase,
        progress: effectiveState.progress,
        totalPanels,
        completedPanels,
        error: episode.error,
        pageCount: episode.pageCount,
    }

    // When in review_analysis, include characters + locations + pages
    if (effectiveState.phase === 'review_analysis') {
        const characters = await prisma.character.findMany({
            where: { projectId: episode.projectId },
            orderBy: { name: 'asc' },
        })
        const locations = await prisma.location.findMany({
            where: { projectId: episode.projectId },
            orderBy: { name: 'asc' },
        })

        response.characters = characters.map((c) => ({
            id: c.id,
            name: c.name,
            aliases: c.aliases,
            description: c.description,
            imageUrl: c.imageUrl,
            identityJson: c.identityJson,
        }))
        response.locations = locations.map((l) => ({
            id: l.id,
            name: l.name,
            description: l.description,
        }))
        response.pages = episode.pages.map((p) => ({
            id: p.id,
            pageIndex: p.pageIndex,
            summary: p.summary,
            content: p.content,
            characters: p.characters,
            location: p.location,
        }))
    }

    // When in review_storyboard, include panels with descriptions
    if (effectiveState.phase === 'review_storyboard') {
        response.panels = episode.pages.flatMap((page) =>
            page.panels.map((panel) => ({
                id: panel.id,
                pageIndex: page.pageIndex,
                panelIndex: panel.panelIndex,
                description: panel.description,
                shotType: panel.shotType,
                characters: panel.characters,
                location: panel.location,
                approved: panel.approved,
                approvedPrompt: panel.approvedPrompt,
                status: panel.status,
                imageUrl: panel.imageUrl,
                sourceExcerpt: panel.sourceExcerpt,
                mustKeep: panel.mustKeep,
                mood: panel.mood,
                lighting: panel.lighting,
            }))
        )
    }

    return NextResponse.json(response)
})
