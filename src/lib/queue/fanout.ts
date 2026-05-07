import { prisma } from '@/lib/prisma'

export function getUniqueIds(values: string[] | undefined): string[] {
    if (!values?.length) return []
    return [...new Set(values.filter(Boolean))]
}

export async function getEpisodeOwner(episodeId: string): Promise<string> {
    const episode = await prisma.episode.findUnique({
        where: { id: episodeId },
        select: {
            project: {
                select: { userId: true },
            },
        },
    })

    if (!episode?.project.userId) {
        throw new Error(`Episode ${episodeId} is missing a project owner.`)
    }

    return episode.project.userId
}
