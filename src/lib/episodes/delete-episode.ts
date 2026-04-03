import { prisma } from '@/lib/prisma'

interface DeleteEpisodeForProjectArgs {
    episodeId: string
    projectId: string
}

export async function deleteEpisodeForProject({
    episodeId,
    projectId,
}: DeleteEpisodeForProjectArgs) {
    await prisma.episode.delete({
        where: { id: episodeId },
    })

    const remainingEpisodes = await prisma.episode.count({
        where: { projectId },
    })

    if (remainingEpisodes === 0) {
        await prisma.project.delete({
            where: { id: projectId },
        })
    }
}
