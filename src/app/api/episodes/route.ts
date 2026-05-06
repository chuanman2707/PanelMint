import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getOrCreateLocalUser } from '@/lib/local-user'
import { apiHandler } from '@/lib/api-handler'

export const GET = apiHandler(async () => {
    const localUser = await getOrCreateLocalUser()

    const episodes = await prisma.episode.findMany({
        where: { project: { userId: localUser.id } },
        orderBy: { createdAt: 'desc' },
        include: {
            project: { select: { name: true, artStyle: true } },
            pages: {
                select: {
                    _count: { select: { panels: true } },
                },
            },
        },
    })

    const result = episodes.map((ep) => ({
        id: ep.id,
        name: ep.name,
        status: ep.status,
        progress: ep.progress,
        projectName: ep.project.name,
        artStyle: ep.project.artStyle,
        panelCount: ep.pages.reduce((sum, p) => sum + p._count.panels, 0),
        createdAt: ep.createdAt.toISOString(),
        error: ep.error,
    }))

    return NextResponse.json({ episodes: result })
})
