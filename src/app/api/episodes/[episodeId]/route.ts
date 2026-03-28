import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireEpisodeOwner } from '@/lib/api-auth'
import { apiHandler } from '@/lib/api-handler'

export const DELETE = apiHandler(async (_request, context) => {
    const auth = await requireAuth()
    if (auth.error) return auth.error

    const { episodeId } = await context.params
    const ownership = await requireEpisodeOwner(auth.user.id, episodeId)
    if (ownership.error) return ownership.error

    const episode = ownership.episode

    // Delete the episode (cascades to pages, panels, bubbles)
    await prisma.episode.delete({ where: { id: episodeId } })

    // If this was the only episode in the project, delete the project too
    const remainingEpisodes = await prisma.episode.count({
        where: { projectId: episode.projectId },
    })
    if (remainingEpisodes === 0) {
        await prisma.project.delete({ where: { id: episode.projectId } })
    }

    return NextResponse.json({ ok: true })
})
