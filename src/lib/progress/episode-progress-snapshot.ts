import { prisma } from '@/lib/prisma'

export interface EpisodeProgressSnapshot {
    status: string
    progress: number
    error: string | null
}

export async function getEpisodeProgressSnapshot(episodeId: string): Promise<EpisodeProgressSnapshot | null> {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
            status: true,
            progress: true,
            error: true,
        },
    })

    if (!episode) return null

    return {
        status: episode.status,
        progress: episode.progress,
        error: episode.error,
    }
}
