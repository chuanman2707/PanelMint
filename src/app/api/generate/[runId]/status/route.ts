import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

type EpisodeStatusSnapshot = {
    status: string
    progress: number
    pages: Array<{
        panels: Array<{
            approved: boolean
            imageUrl: string | null
            status: string
            updatedAt?: Date
        }>
    }>
}

const STALE_IMAGING_PANEL_MS = 15 * 60_000

function deriveEffectivePhase(episode: EpisodeStatusSnapshot) {
    if (episode.status !== 'imaging') {
        return {
            phase: episode.status,
            progress: episode.progress,
        }
    }

    const approvedPanels = episode.pages.flatMap((page) => page.panels).filter((panel) => panel.approved)
    const activePanels = approvedPanels.filter((panel) =>
        panel.imageUrl === null
        && ['queued', 'pending', 'generating'].includes(panel.status)
        && (
            !(panel.updatedAt instanceof Date)
            || Date.now() - panel.updatedAt.getTime() < STALE_IMAGING_PANEL_MS
        )
    )
    const remainingPanels = approvedPanels.filter((panel) =>
        panel.imageUrl === null && !['done', 'content_filtered'].includes(panel.status)
    )

    if (activePanels.length > 0) {
        return {
            phase: episode.status,
            progress: episode.progress,
        }
    }

    if (remainingPanels.length === 0) {
        return {
            phase: 'done',
            progress: 100,
        }
    }

    return {
        phase: 'review_storyboard',
        progress: 50,
    }
}

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
    const effectiveState = deriveEffectivePhase(episode)

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
