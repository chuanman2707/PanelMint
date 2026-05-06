import { NextRequest } from 'next/server'
import { getLocalEpisode, getOrCreateLocalUser } from '@/lib/local-user'
import { getEpisodeProgressSnapshot } from '@/lib/progress/episode-progress-snapshot'

export const dynamic = 'force-dynamic'

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ episodeId: string }> },
) {
    const localUser = await getOrCreateLocalUser()

    const { episodeId } = await context.params
    const ownership = await getLocalEpisode(localUser.id, episodeId)
    if (ownership.error) return ownership.error

    const snapshot = await getEpisodeProgressSnapshot(episodeId)
    if (!snapshot) {
        return new Response('Not found', { status: 404 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`))
            controller.close()
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
