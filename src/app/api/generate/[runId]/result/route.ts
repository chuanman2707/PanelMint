import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

export const GET = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { runId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, runId)
    if (ownership.error) return ownership.error

    const episode = await prisma.episode.findUnique({
        where: { id: runId },
        include: {
            pages: {
                orderBy: { pageIndex: 'asc' },
                include: {
                    panels: {
                        orderBy: { panelIndex: 'asc' },
                        include: {
                            bubbles: {
                                orderBy: { bubbleIndex: 'asc' },
                            },
                        },
                    },
                },
            },
        },
    })

    if (!episode) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Return pages with page-level images and panel metadata
    const pages = episode.pages.map((page, idx) => ({
        id: page.id,
        index: idx,
        imageUrl: page.imageUrl,
        summary: page.summary,
        panelCount: page.panels.length,
        status: page.imageUrl ? 'done' : page.panels.some(p => p.status === 'generating') ? 'generating' : 'pending',
        panels: page.panels.map((panel) => ({
            id: panel.id,
            description: panel.description,
            shotType: panel.shotType,
            status: panel.status,
            bubbles: panel.bubbles.map((b) => ({
                id: b.id,
                speaker: b.speaker,
                content: b.content,
                bubbleType: b.bubbleType,
                positionX: b.positionX,
                positionY: b.positionY,
                width: b.width,
                height: b.height,
            })),
        })),
    }))

    return NextResponse.json({ pages })
})
