import { NextRequest, NextResponse } from 'next/server'
import { getLocalEpisode, getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'
import { deleteEpisodeForProject } from '@/lib/episodes/delete-episode'

export const DELETE = apiHandler(async (_request, context) => {
    const localUser = await getOrCreateLocalUser()

    const { episodeId } = await context.params
    const ownership = await getLocalEpisode(localUser.id, episodeId)
    if (ownership.error) return ownership.error

    await deleteEpisodeForProject({
        episodeId,
        projectId: ownership.episode.projectId,
    })

    return NextResponse.json({ ok: true })
})
