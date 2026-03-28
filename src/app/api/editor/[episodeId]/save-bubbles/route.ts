import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { parseJsonBody } from '@/lib/api-validate'
import { saveBubblesRequestSchema } from '@/lib/validators/pipeline'

interface BubblePayload {
    id?: string
    bubbleIndex: number
    speaker: string | null
    content: string
    bubbleType: string
    positionX: number
    positionY: number
    width: number
    height: number
}

export const POST = apiHandler(async (request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { episodeId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, episodeId)
    if (ownership.error) return ownership.error

    const { panelId, bubbles } = await parseJsonBody(request, saveBubblesRequestSchema)

    // Verify panel belongs to this episode
    const panel = await prisma.panel.findFirst({
        where: {
            id: panelId,
            page: { episodeId },
        },
    })

    if (!panel) {
        return NextResponse.json({ error: 'Panel not found' }, { status: 404 })
    }

    // Delete existing bubbles for this panel, then recreate
    await prisma.speechBubble.deleteMany({
        where: { panelId },
    })

    if (bubbles.length > 0) {
        await prisma.speechBubble.createMany({
            data: bubbles.map((b, idx) => ({
                panelId,
                bubbleIndex: idx,
                speaker: b.speaker,
                content: b.content || '',
                bubbleType: b.bubbleType || 'speech',
                positionX: Math.max(0, Math.min(1, Number(b.positionX) || 0.5)),
                positionY: Math.max(0, Math.min(1, Number(b.positionY) || 0.5)),
                width: Math.max(0.05, Math.min(1, Number(b.width) || 0.3)),
                height: Math.max(0.05, Math.min(1, Number(b.height) || 0.2)),
            })),
        })
    }

    return NextResponse.json({ ok: true, count: bubbles.length })
})
