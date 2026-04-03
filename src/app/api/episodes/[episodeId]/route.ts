import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'
import { deleteEpisodeForProject } from '@/lib/episodes/delete-episode'

export const DELETE = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { episodeId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, episodeId)
    if (ownership.error) return ownership.error

    await deleteEpisodeForProject({
        episodeId,
        projectId: ownership.episode.projectId,
    })

    return NextResponse.json({ ok: true })
})
